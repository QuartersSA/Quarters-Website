import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-BuK6EXRX.js';
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
    await ensureInventoryUnitSnapshotSchema();
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
        COALESCE(inv_unit.name_ar, i.unit) AS unit,
        i.description,
        i.image_url,
        i.min_stock_threshold,
        i.is_active,
        i.created_at,
        b.id   AS branch_id,
        b.name AS branch_name,
        b.location AS branch_location,
        cs.operation_id,
        cs.inventory_number,
        cs.inventory_type,
        cs.operation_status,
        cs.operation_date,
        cs.employee_name,
        COALESCE(cs.current_quantity, 0)                AS current_quantity,
        COALESCE(cs.last_inventory_quantity, 0)         AS last_inventory_quantity,
        COALESCE(cs.receipts_since_last_inventory, 0)   AS receipts_since_last_inventory,
        COALESCE(cs.net_transfer_since_last_inventory, 0) AS net_transfer_since_last_inventory,
        (
          SELECT COUNT(*)
          FROM inventory_operations io2
          WHERE io2.branch_id = b.id
            AND io2.status = 'Completed'
        ) AS total_operations
      FROM items i
      CROSS JOIN branches b
      LEFT JOIN inventory_current_stock_v cs
        ON cs.item_id = i.id AND cs.branch_id = b.id

      -- Hide (item, branch) pairs the admin has disabled per-branch.
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id
      LEFT JOIN LATERAL (
        SELECT mu.name_ar
        FROM item_units iu
        JOIN measurement_units mu ON mu.id = iu.unit_id
        WHERE iu.id = i.default_inventory_unit_id
        LIMIT 1
      ) inv_unit ON true

      WHERE i.is_active = true
        AND i.show_in_inventory = true
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
