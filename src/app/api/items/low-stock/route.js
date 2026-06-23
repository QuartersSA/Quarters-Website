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
    // current_quantity = last RESET (Daily/Weekly/Opening physical count)
    //                  + receipts since that reset
    //                  + signed transfer deltas since that reset
    //
    // See /api/items/summary for the rationale: stored Transfer
    // absolutes can drift; the operation's intent (transfer_quantity
    // + direction) is the authoritative number, matching the timeline
    // report.
    const rows = await sql`
      SELECT
        i.id,
        i.name,
        i.description,
        i.image_url,
        i.min_stock_threshold,
        COALESCE(inv_unit.name_ar, i.unit) AS unit,
        b.id as branch_id,
        b.name as branch_name,
        b.location as branch_location,
        COALESCE(last_reset.inv_quantity, 0)
          + COALESCE(receipts_after.total_received, 0)
          + COALESCE(transfers_after.net_transfer, 0) AS current_quantity
      FROM items i
      CROSS JOIN branches b
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id
      LEFT JOIN LATERAL (
        SELECT mu.name_ar
        FROM item_units iu
        JOIN measurement_units mu ON mu.id = iu.unit_id
        WHERE iu.id = i.default_inventory_unit_id
        LIMIT 1
      ) inv_unit ON true

      LEFT JOIN LATERAL (
        SELECT ii.quantity AS inv_quantity,
               COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id  = i.id
          AND io.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
        LIMIT 1
      ) last_reset ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
        FROM purchase_receipts pr
        WHERE pr.item_id   = i.id
          AND pr.branch_id = b.id
          AND (
            last_reset.op_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > last_reset.op_date
          )
      ) receipts_after ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
          CASE io.transfer_direction
            WHEN 'in'  THEN  COALESCE(ii.transfer_quantity, 0)
            WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)
            ELSE 0
          END
        ), 0) AS net_transfer
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id   = i.id
          AND ii.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type = 'Transfer'
          AND (
            last_reset.op_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > last_reset.op_date
          )
      ) transfers_after ON true

      WHERE i.is_active = true
        AND i.show_in_inventory = true
        AND ibd.item_id IS NULL
        AND (
          last_reset.op_date IS NOT NULL
          OR receipts_after.total_received > 0
          OR transfers_after.net_transfer <> 0
        )
      ORDER BY i.name, b.name
    `;

    const filteredItems = rows.filter(
      (item) =>
        Number(item.current_quantity) < Number(item.min_stock_threshold),
    );

    return Response.json(filteredItems);
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    return Response.json(
      { error: "Failed to fetch low stock items" },
      { status: 500 },
    );
  }
}
