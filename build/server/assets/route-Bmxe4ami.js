import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-BuK6EXRX.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/items/stock-value?branchId=<id>
// One row per item with:
//   - total_quantity   = the same current quantity shown in إدارة الأصناف
//                        (last inventory + receipts/transfers after reset)
//   - effective_cost   = cost per default inventory unit
//   - total_value      = quantity × cost per default inventory unit
//
// Math mirrors `/api/items` byte-for-byte (same last_inv + receipts_after
// CTEs). When `branchId` is omitted (or 0), the sum is across every
// branch — same total as the dashboard "قيمة المخزون" stat. When
// supplied, the API reports the value held at that single branch.
//
// Cost source mirrors `/api/dashboard/analytics` so a bean-linked item
// with NULL `items.cost` falls back to the latest green-bean order
// price. Inactive / hidden items are excluded.
async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureInventoryUnitSnapshotSchema();
    const {
      searchParams
    } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const parsedBranchId = branchIdRaw ? Number(branchIdRaw) : null;
    const branchFilter = Number.isFinite(parsedBranchId) && parsedBranchId > 0 ? parsedBranchId : null;
    const query = `
      WITH item_totals AS (
        SELECT
          cs.item_id,
          SUM(COALESCE(cs.current_display_quantity, 0))::numeric(12, 3)
            AS total_quantity,
          CASE
            WHEN COUNT(DISTINCT NULLIF(cs.current_display_unit, '')) = 1
              THEN MAX(NULLIF(cs.current_display_unit, ''))
            WHEN COUNT(DISTINCT NULLIF(cs.current_display_unit, '')) > 1
              THEN 'وحدات متعددة'
            ELSE NULL
          END AS entered_unit,
          CASE
            WHEN SUM(COALESCE(cs.current_display_quantity, 0)) <> 0
              THEN (
                SUM(COALESCE(cs.current_base_quantity, 0))
                / NULLIF(SUM(COALESCE(cs.current_display_quantity, 0)), 0)
              )::numeric(20, 8)
            ELSE MAX(COALESCE(cs.current_display_unit_factor, 1))::numeric(20, 8)
          END AS weighted_unit_factor,
          SUM(COALESCE(cs.current_base_quantity, 0))::numeric(20, 8)
            AS total_base_quantity
        FROM inventory_current_stock_v cs
        LEFT JOIN item_branch_disabled ibd
          ON ibd.item_id = cs.item_id AND ibd.branch_id = cs.branch_id
        WHERE ($1::int IS NULL OR cs.branch_id = $1::int)
          AND ibd.item_id IS NULL
        GROUP BY cs.item_id
      )
      SELECT
        i.id,
        i.name,
        i.name_en,
        -- Display unit pill shows whichever unit the operator picked
        -- as "وحدة المخزون الافتراضية" on the item. Falls back to
        -- the legacy flat i.unit text when no multi-unit row exists.
        COALESCE(it.entered_unit, inv_unit.name_ar, i.unit) AS unit,
        i.image_url,
        i.cost,
        -- effective_cost = cost PER INVENTORY UNIT, derived from the
        -- base cost × that unit's conversion_factor. Bean-link
        -- fallback chain is unchanged for items that get their cost
        -- from green-bean orders.
        (
          COALESCE(i.base_purchase_cost, i.cost, last_bean_price.final_price)
            * COALESCE(it.weighted_unit_factor, inv_unit.factor, 1)
        )::numeric(14, 4) AS effective_cost,
        last_bean_price.final_price AS fallback_cost,
        c.name AS category_name,
        -- Display quantity = the raw summed current stock, so
        -- this column matches "إجمالي المخزون" on the items table
        -- (which the operator confirmed is the canonical reference).
        -- effective_cost is per default inventory unit, so the table
        -- can display a direct qty × cost value.
        COALESCE(it.total_quantity, 0)::numeric(12, 3) AS total_quantity,
        -- Total value = stored_qty × base_cost × inv_factor.
        --
        -- Critical: inventory_items.quantity is recorded in the
        -- item's DEFAULT INVENTORY UNIT (the employee counts e.g. in
        -- حبة), while base_purchase_cost is the price of ONE BASE
        -- unit. conversion_factor = "base units per one inventory
        -- unit", so qty × factor converts the count to base units,
        -- and × base_cost yields real money. Equivalently this is
        -- qty × (base_cost × factor) = displayed_qty × displayed
        -- per-unit cost. Factor-1 items (incl. all pre-multi-unit
        -- rows whose default unit auto-seeded at factor 1) are
        -- unaffected. This is the same as displayed_qty × displayed
        -- cost per inventory unit.
        CASE
          WHEN COALESCE(i.base_purchase_cost, i.cost, last_bean_price.final_price) IS NULL
            THEN NULL
          ELSE (
            COALESCE(it.total_base_quantity, 0)
              * COALESCE(i.base_purchase_cost, i.cost, last_bean_price.final_price)
          )::numeric(14, 2)
        END AS total_value
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN item_totals it ON it.item_id = i.id
      LEFT JOIN LATERAL (
        SELECT mu.name_ar, iu.conversion_factor AS factor
        FROM item_units iu
        JOIN measurement_units mu ON mu.id = iu.unit_id
        WHERE iu.id = i.default_inventory_unit_id
        LIMIT 1
      ) inv_unit ON TRUE
      LEFT JOIN LATERAL (
        SELECT oi.computed_final_price_per_kg AS final_price
        FROM accounting_green_bean_order_items oi
        JOIN accounting_green_bean_orders o ON o.id = oi.order_id
        WHERE oi.bean_id = i.linked_green_bean_id
          AND oi.computed_final_price_per_kg IS NOT NULL
        ORDER BY o.order_date DESC, oi.id DESC
        LIMIT 1
      ) last_bean_price ON i.linked_green_bean_id IS NOT NULL
      WHERE i.is_active = true
        AND i.show_in_inventory = true
      ORDER BY i.name ASC
    `;
    const rows = await sql(query, [branchFilter]);
    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching stock value:", error);
    return Response.json({
      error: "Failed to fetch stock value",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
