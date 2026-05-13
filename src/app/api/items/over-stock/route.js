import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

async function ensureSchema() {
  try {
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS max_stock_threshold INTEGER`;
  } catch (e) {
    console.error("ensureSchema items.max_stock_threshold:", e?.message);
  }
}

// GET /api/items/over-stock
// Returns items where current_quantity > max_stock_threshold (per branch).
// Same shape as /api/items/low-stock for symmetry.
export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();

    const rows = await sql`
      SELECT
        i.id,
        i.name,
        i.description,
        i.image_url,
        i.min_stock_threshold,
        i.max_stock_threshold,
        i.unit,
        b.id as branch_id,
        b.name as branch_name,
        b.location as branch_location,
        COALESCE(last_inv.inv_quantity, 0)
          + COALESCE(receipts_after.total_received, 0) AS current_quantity
      FROM items i
      CROSS JOIN branches b

      LEFT JOIN LATERAL (
        SELECT ii.quantity AS inv_quantity, COALESCE(io.operation_date, io.created_at) AS op_date
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
            -- GREATEST(received_at, created_at): protects against
            -- backdated rows (e.g. green-bean deposits stamped with an
            -- older order_date) that would otherwise be silently
            -- excluded from totals.
            OR GREATEST(pr.received_at, pr.created_at) > last_inv.op_date
          )
      ) receipts_after ON true

      WHERE i.is_active = true
        AND i.show_in_inventory = true
        AND i.max_stock_threshold IS NOT NULL
        AND i.max_stock_threshold > 0
        AND (last_inv.op_date IS NOT NULL OR receipts_after.total_received > 0)
      ORDER BY i.name, b.name
    `;

    const filteredItems = rows.filter(
      (item) =>
        Number(item.max_stock_threshold) > 0 &&
        Number(item.current_quantity) > Number(item.max_stock_threshold),
    );

    return Response.json(filteredItems);
  } catch (error) {
    console.error("Error fetching over-stock items:", error);
    return Response.json(
      { error: "Failed to fetch over-stock items", details: error.message },
      { status: 500 },
    );
  }
}
