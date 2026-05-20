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
    // For each (item × branch):
    //   current_quantity = last RESET (Daily/Weekly/Opening physical count)
    //                    + receipts since that reset
    //                    + signed transfer deltas since that reset
    //
    // Why not just "last inventory_items.quantity + receipts since"?
    // Transfer rows store a post-transfer absolute that can drift
    // relative to the chain when cascade adjustments on prior edits
    // / deletes don't perfectly sync the stored value with the
    // operation's recorded intent. The timeline report computes
    // balance from the *intent* (transfer_quantity ± direction),
    // which is the source of truth. This endpoint now does the same
    // so its numbers always match the timeline.
    //
    // Daily / Weekly / Opening rows ARE the source of truth for
    // absolute (physical recounts), so the most recent one resets
    // the baseline. Anything after it is layered as signed deltas.
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
        last_reset.operation_id,
        last_reset.inventory_number,
        last_reset.inventory_type,
        last_reset.operation_status,
        last_reset.operation_date,
        last_reset.employee_name,
        COALESCE(last_reset.inv_quantity, 0)
          + COALESCE(receipts_after.total_received, 0)
          + COALESCE(transfers_after.net_transfer, 0)   AS current_quantity,
        COALESCE(last_reset.inv_quantity, 0)            AS last_inventory_quantity,
        COALESCE(receipts_after.total_received, 0)      AS receipts_since_last_inventory,
        COALESCE(transfers_after.net_transfer, 0)       AS net_transfer_since_last_inventory,
        (
          SELECT COUNT(*)
          FROM inventory_operations io2
          WHERE io2.branch_id = b.id
            AND io2.status = 'Completed'
        ) AS total_operations
      FROM items i
      CROSS JOIN branches b

      -- Hide (item, branch) pairs the admin has disabled per-branch.
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id

      -- 1) Last reset = most recent Daily / Weekly / Opening physical count.
      --    Transfers do NOT reset the absolute — they're a delta on top.
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
          AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
        LIMIT 1
      ) last_reset ON true

      -- 2) Receipts on top of the reset (or from the beginning if no reset).
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
        FROM purchase_receipts pr
        WHERE pr.item_id   = i.id
          AND pr.branch_id = b.id
          AND (
            last_reset.operation_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > last_reset.operation_date
          )
      ) receipts_after ON true

      -- 3) Signed transfer deltas on top of the reset (matches the
      --    timeline report's semantic computation):
      --       OUT leg at this branch: -transfer_quantity
      --       IN  leg at this branch: +transfer_quantity
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
            last_reset.operation_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > last_reset.operation_date
          )
      ) transfers_after ON true

      WHERE i.is_active = true
        AND ibd.item_id IS NULL
      ORDER BY i.name, b.name
    `;
    return Response.json(itemsSummary);
  } catch (error) {
    console.error("Error fetching items summary:", error);
    return Response.json({
      error: "Failed to fetch items summary"
    }, {
      status: 500
    });
  }
}

export { GET };
