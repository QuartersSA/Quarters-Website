import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-BuK6EXRX.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/items/stock-value?branchId=<id>
//
// Stock value must use the same quantity and unit reference shown in the
// items-management table:
//   current quantity = latest physical count + later receipts + later transfers
//   display unit     = the item's current default inventory unit
//   total value      = displayed quantity * displayed unit cost
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
          SUM(COALESCE(cs.current_quantity, 0))::numeric(12, 3)
            AS total_quantity
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
        COALESCE(inv_unit.name_ar, i.unit) AS unit,
        i.image_url,
        i.cost,
        (
          COALESCE(i.base_purchase_cost, i.cost, last_bean_price.final_price)
            * COALESCE(inv_unit.factor, 1)
        )::numeric(14, 4) AS effective_cost,
        last_bean_price.final_price AS fallback_cost,
        c.name AS category_name,
        COALESCE(it.total_quantity, 0)::numeric(12, 3) AS total_quantity,
        CASE
          WHEN COALESCE(i.base_purchase_cost, i.cost, last_bean_price.final_price) IS NULL
            THEN NULL
          ELSE (
            COALESCE(it.total_quantity, 0)
              * COALESCE(i.base_purchase_cost, i.cost, last_bean_price.final_price)
              * COALESCE(inv_unit.factor, 1)
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
