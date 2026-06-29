import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureInventoryUnitSnapshotSchema } from "@/app/api/utils/inventoryUnitSnapshots";

// GET /api/items/stock-value?branchId=<id>
//
// Stock value must use the same quantity and unit reference shown in the
// items-management table:
//   current quantity = latest physical count + later receipts + later transfers
//   display unit     = the item's current default inventory unit
//   total value      = displayed quantity * displayed unit cost
export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureInventoryUnitSnapshotSchema();

    const { searchParams } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const parsedBranchId = branchIdRaw ? Number(branchIdRaw) : null;
    const branchFilter =
      Number.isFinite(parsedBranchId) && parsedBranchId > 0
        ? parsedBranchId
        : null;

    const query = `
      WITH last_reset AS (
        SELECT DISTINCT ON (ii.item_id, io.branch_id)
          ii.item_id,
          io.branch_id,
          ii.quantity::numeric AS inv_quantity,
          COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE io.status = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
          AND ($1::int IS NULL OR io.branch_id = $1::int)
        ORDER BY
          ii.item_id,
          io.branch_id,
          COALESCE(io.operation_date, io.created_at) DESC,
          io.id DESC
      ),
      receipts_after AS (
        SELECT
          pr.item_id,
          pr.branch_id,
          SUM(pr.quantity::numeric) AS total_received
        FROM purchase_receipts pr
        LEFT JOIN last_reset li
          ON li.item_id = pr.item_id AND li.branch_id = pr.branch_id
        WHERE ($1::int IS NULL OR pr.branch_id = $1::int)
          AND (
            li.op_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > li.op_date
          )
        GROUP BY pr.item_id, pr.branch_id
      ),
      transfers_after AS (
        SELECT
          ii.item_id,
          ii.branch_id,
          SUM(
            CASE io.transfer_direction
              WHEN 'in' THEN COALESCE(ii.transfer_quantity, 0)::numeric
              WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)::numeric
              ELSE 0::numeric
            END
          ) AS net_transfer
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        LEFT JOIN last_reset li
          ON li.item_id = ii.item_id AND li.branch_id = ii.branch_id
        WHERE io.status = 'Completed'
          AND io.inventory_type = 'Transfer'
          AND ($1::int IS NULL OR ii.branch_id = $1::int)
          AND (
            li.op_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > li.op_date
          )
        GROUP BY ii.item_id, ii.branch_id
      ),
      stock_keys AS (
        SELECT item_id, branch_id FROM last_reset
        UNION
        SELECT item_id, branch_id FROM receipts_after
        UNION
        SELECT item_id, branch_id FROM transfers_after
      ),
      item_totals AS (
        SELECT
          sk.item_id,
          SUM(
            COALESCE(li.inv_quantity, 0)
              + COALESCE(ra.total_received, 0)
              + COALESCE(ta.net_transfer, 0)
          )::numeric(12, 3) AS total_quantity
        FROM stock_keys sk
        LEFT JOIN last_reset li
          ON li.item_id = sk.item_id AND li.branch_id = sk.branch_id
        LEFT JOIN receipts_after ra
          ON ra.item_id = sk.item_id AND ra.branch_id = sk.branch_id
        LEFT JOIN transfers_after ta
          ON ta.item_id = sk.item_id AND ta.branch_id = sk.branch_id
        LEFT JOIN item_branch_disabled ibd
          ON ibd.item_id = sk.item_id AND ibd.branch_id = sk.branch_id
        WHERE ibd.item_id IS NULL
        GROUP BY sk.item_id
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
    return Response.json(
      { error: "Failed to fetch stock value", details: error.message },
      { status: 500 },
    );
  }
}
