import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-q4ac2Sc7.js';
import '@neondatabase/serverless';
import 'crypto';

async function ensureSchema() {
  try {
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS max_stock_threshold NUMERIC(12, 3)`;
  } catch (e) {
    console.error("ensureSchema items.max_stock_threshold:", e?.message);
  }
}

// GET /api/items/over-stock
// Returns items where current_quantity > max_stock_threshold (per branch).
// Same shape as /api/items/low-stock for symmetry.
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
    await ensureSchema();
    await ensureInventoryUnitSnapshotSchema();

    // current_quantity uses the same reset + receipts + signed-transfers
    // formula as /api/items/summary so over-stock readings stay
    // consistent with the timeline report.
    const rows = await sql`
      SELECT
        i.id,
        i.name,
        i.description,
        i.image_url,
        i.min_stock_threshold,
        i.max_stock_threshold,
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
        AND i.max_stock_threshold IS NOT NULL
        AND i.max_stock_threshold > 0
        AND cs.has_signal = true
      ORDER BY i.name, b.name
    `;
    const filteredItems = rows.filter(item => Number(item.max_stock_threshold) > 0 && Number(item.current_quantity) > Number(item.max_stock_threshold));
    return Response.json(filteredItems);
  } catch (error) {
    console.error("Error fetching over-stock items:", error);
    return Response.json({
      error: "Failed to fetch over-stock items",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
