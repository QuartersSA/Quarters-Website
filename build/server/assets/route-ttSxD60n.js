import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

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
    // current stock = last Daily/Weekly/Transfer count + SUM(purchase_receipts after it)
    const rows = await sql`
      SELECT
        i.id,
        i.name,
        i.description,
        i.image_url,
        i.min_stock_threshold,
        i.unit,
        b.id as branch_id,
        b.name as branch_name,
        b.location as branch_location,
        COALESCE(last_inv.inv_quantity, 0)
          + COALESCE(receipts_after.total_received, 0) AS current_quantity
      FROM items i
      CROSS JOIN branches b
      -- Hide (item, branch) pairs admin disabled per-branch (sparse table).
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id

      LEFT JOIN LATERAL (
        SELECT ii.quantity AS inv_quantity, COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id  = i.id
          AND io.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Transfer', 'Opening')
        -- io.id DESC tiebreaker: matches /api/items so two ops at the
        -- same timestamp resolve to the same row across endpoints.
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
            -- GREATEST(received_at, created_at): protects against
            -- backdated rows (e.g. green-bean deposits stamped with an
            -- older order_date) that would otherwise be silently
            -- excluded from totals.
            OR GREATEST(pr.received_at, pr.created_at) > last_inv.op_date
          )
      ) receipts_after ON true

      WHERE i.is_active = true
        AND i.show_in_inventory = true
        AND ibd.item_id IS NULL
        AND (last_inv.op_date IS NOT NULL OR receipts_after.total_received > 0)
      ORDER BY i.name, b.name
    `;
    const filteredItems = rows.filter(item => Number(item.current_quantity) < Number(item.min_stock_threshold));
    return Response.json(filteredItems);
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    return Response.json({
      error: "Failed to fetch low stock items"
    }, {
      status: 500
    });
  }
}

export { GET };
