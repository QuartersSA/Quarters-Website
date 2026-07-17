import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-B5krAOBv.js';
import '@neondatabase/serverless';
import 'crypto';
import './employeeDisplayName-CwZGtUC2.js';

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
    // current_quantity = last RESET (Daily/Weekly/Opening physical count)
    //                  + receipts since that reset
    //                  + signed transfer deltas since that reset
    //
    // See /api/items/summary for the rationale: stored Transfer
    // absolutes can drift; the operation's intent (transfer_quantity
    // + direction) is the authoritative number, matching the timeline
    // report.
    // الحد الفعّال لكل (صنف، فرع): حد الفرع الخاص إن وُجد في
    // item_branch_min_stock وإلا الحد الافتراضي للصنف.
    await sql`
      CREATE TABLE IF NOT EXISTS item_branch_min_stock (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        min_stock NUMERIC(14, 3) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by_employee_name TEXT,
        PRIMARY KEY (item_id, branch_id)
      )
    `;
    const rows = await sql`
      SELECT
        i.id,
        i.name,
        i.description,
        i.image_url,
        COALESCE(ibm.min_stock, i.min_stock_threshold) AS min_stock_threshold,
        (ibm.min_stock IS NOT NULL) AS branch_specific_threshold,
        i.category_id,
        cat.name AS category_name,
        COALESCE(inv_unit.name_ar, i.unit) AS unit,
        b.id as branch_id,
        b.name as branch_name,
        b.location as branch_location,
        COALESCE(cs.current_quantity, 0) AS current_quantity
      FROM items i
      CROSS JOIN branches b
      LEFT JOIN inventory_current_stock_v cs
        ON cs.item_id = i.id AND cs.branch_id = b.id
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id
      LEFT JOIN item_branch_min_stock ibm
        ON ibm.item_id = i.id AND ibm.branch_id = b.id
      LEFT JOIN item_categories cat ON cat.id = i.category_id
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
        AND (
          cs.has_signal = true
        )
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
