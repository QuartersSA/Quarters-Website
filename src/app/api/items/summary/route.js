import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // For each (item × branch):
    //   current_quantity = last Daily/Weekly inventory count
    //                    + SUM of purchase_receipts received AFTER that inventory
    //
    // This correctly reflects: "stock on hand at last count" + "everything received since".
    const itemsSummary = await sql`
      SELECT
        i.id,
        i.name,
        i.name_en,
        i.unit,
        i.description,
        i.image_url,
        i.min_stock_threshold,
        i.is_active,
        i.created_at,
        b.id   AS branch_id,
        b.name AS branch_name,
        b.location AS branch_location,
        last_inv.operation_id,
        last_inv.inventory_number,
        last_inv.inventory_type,
        last_inv.operation_status,
        last_inv.operation_date,
        last_inv.employee_name,
        -- current_quantity = last inventory count + receipts after that count
        COALESCE(last_inv.inv_quantity, 0)
          + COALESCE(receipts_after.total_received, 0) AS current_quantity,
        COALESCE(last_inv.inv_quantity, 0) AS last_inventory_quantity,
        COALESCE(receipts_after.total_received, 0) AS receipts_since_last_inventory,
        (
          SELECT COUNT(*)
          FROM inventory_operations io2
          WHERE io2.branch_id = b.id
            AND io2.status = 'Completed'
        ) AS total_operations
      FROM items i
      CROSS JOIN branches b

      -- 1) Last Daily / Weekly / Transfer / Opening completed inventory for this item + branch
      LEFT JOIN LATERAL (
        SELECT
          io.id          AS operation_id,
          io.inventory_number,
          io.inventory_type,
          io.status       AS operation_status,
          COALESCE(io.operation_date, io.created_at) AS operation_date,
          e.name          AS employee_name,
          ii.quantity      AS inv_quantity
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        LEFT JOIN employees e ON io.employee_id = e.id
        WHERE ii.item_id  = i.id
          AND io.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Transfer', 'Opening')
        -- io.id DESC tiebreaker: matches /api/items so two ops at the
        -- same timestamp resolve to the same row across endpoints.
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
        LIMIT 1
      ) last_inv ON true

      -- 2) Sum of purchase receipts for this item + branch AFTER the last inventory
      --    GREATEST(received_at, created_at) protects against rows whose
      --    received_at was backdated (legacy green-bean deposits used
      --    order_date instead of NOW) — falling back to created_at keeps
      --    them counted whenever they were actually entered into the system.
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
        FROM purchase_receipts pr
        WHERE pr.item_id   = i.id
          AND pr.branch_id = b.id
          AND (
            last_inv.operation_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > last_inv.operation_date
          )
      ) receipts_after ON true

      WHERE i.is_active = true
      ORDER BY i.name, b.name
    `;

    return Response.json(itemsSummary);
  } catch (error) {
    console.error("Error fetching items summary:", error);
    return Response.json(
      { error: "Failed to fetch items summary" },
      { status: 500 },
    );
  }
}
