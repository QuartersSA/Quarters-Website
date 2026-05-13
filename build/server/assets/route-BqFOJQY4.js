import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/items/stock-value
// Returns one row per item with:
//   - quantity = sum across ALL branches of (last inventory + receipts after)
//   - cost     = unit cost from items.cost
//   - value    = quantity * cost
// Same per-branch stock formula as /api/items so the totals agree with
// what the user sees in the items table / view-stock modal.
//
// Items with cost = NULL still appear (value = null) so the user can see
// "needs a cost" rows and act on them. Inactive / hidden items are
// excluded — they're not part of operational inventory.
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
    const rows = await sql`
      WITH per_branch AS (
        SELECT
          i.id   AS item_id,
          b.id   AS branch_id,
          COALESCE(last_inv.inv_quantity, 0)
            + COALESCE(receipts_after.total_received, 0) AS qty
        FROM items i
        CROSS JOIN branches b

        LEFT JOIN LATERAL (
          SELECT
            ii.quantity AS inv_quantity,
            COALESCE(io.operation_date, io.created_at) AS op_date
          FROM inventory_items ii
          JOIN inventory_operations io ON io.id = ii.operation_id
          WHERE ii.item_id  = i.id
            AND io.branch_id = b.id
            AND io.status    = 'Completed'
            AND io.inventory_type IN ('Daily', 'Weekly', 'Transfer', 'Opening')
          ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
          LIMIT 1
        ) last_inv ON true

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
          FROM purchase_receipts pr
          WHERE pr.item_id   = i.id
            AND pr.branch_id = b.id
            AND (
              last_inv.op_date IS NULL
              OR pr.received_at > last_inv.op_date
            )
        ) receipts_after ON true
      )
      SELECT
        i.id,
        i.name,
        i.name_en,
        i.unit,
        i.image_url,
        i.cost,
        c.name AS category_name,
        COALESCE(SUM(pb.qty), 0)::numeric(12, 3) AS total_quantity,
        CASE
          WHEN i.cost IS NULL THEN NULL
          ELSE (COALESCE(SUM(pb.qty), 0) * i.cost)::numeric(14, 2)
        END AS total_value
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN per_branch pb ON pb.item_id = i.id
      WHERE i.is_active = true
        AND i.show_in_inventory = true
      GROUP BY i.id, c.name
      ORDER BY i.name ASC
    `;
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
