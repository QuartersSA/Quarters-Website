import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-B5krAOBv.js';
import '@neondatabase/serverless';
import 'crypto';
import './employeeDisplayName-CwZGtUC2.js';

async function GET(request, {
  params
}) {
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
    const itemId = parseInt(params.id);
    if (!itemId || Number.isNaN(itemId)) {
      return Response.json({
        error: "معرّف الصنف غير صحيح"
      }, {
        status: 400
      });
    }
    const {
      searchParams
    } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const daysRaw = searchParams.get("days");
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const branchId = branchIdRaw ? parseInt(branchIdRaw) : null;
    const days = daysRaw ? parseInt(daysRaw) : 30;
    const safeDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 30;
    const values = [itemId];
    let idx = 2;
    let where = `WHERE ii.item_id = $1`;

    // We record inventory as Completed in POST, so this keeps chart clean
    where += ` AND io.status = 'Completed'`;

    // Date range filter (preferred)
    const hasFromTo = !!fromRaw && !!toRaw;
    if (hasFromTo) {
      // Treat inputs as DATE (YYYY-MM-DD). Include the full end day by using < (to + 1 day).
      where += ` AND COALESCE(io.operation_date, io.created_at) >= ($${idx}::date::timestamp AT TIME ZONE 'Asia/Riyadh')`;
      values.push(fromRaw);
      idx += 1;
      where += ` AND COALESCE(io.operation_date, io.created_at) < (($${idx}::date + INTERVAL '1 day')::timestamp AT TIME ZONE 'Asia/Riyadh')`;
      values.push(toRaw);
      idx += 1;
    } else {
      // Fallback to last N days
      where += ` AND COALESCE(io.operation_date, io.created_at) >= (NOW() - INTERVAL '${safeDays} days')`;
    }
    if (branchId && !Number.isNaN(branchId)) {
      where += ` AND io.branch_id = $${idx}`;
      values.push(branchId);
      idx += 1;
    }
    const query = `
      SELECT
        io.id as operation_id,
        io.inventory_number,
        COALESCE(io.operation_date, io.created_at) as created_at,
        io.branch_id,
        b.name as branch_name,
        (
          ii.quantity::numeric
            * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
        ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS quantity
      FROM inventory_items ii
      JOIN inventory_operations io ON io.id = ii.operation_id
      JOIN items i ON i.id = ii.item_id
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN branches b ON b.id = io.branch_id
      ${where}
      ORDER BY COALESCE(io.operation_date, io.created_at) ASC
    `;
    const rows = await sql(query, values);
    return Response.json({
      item_id: itemId,
      days: safeDays,
      from: hasFromTo ? fromRaw : null,
      to: hasFromTo ? toRaw : null,
      branch_id: branchId,
      rows
    });
  } catch (error) {
    console.error("Error fetching item inventory history:", error);
    return Response.json({
      error: "Failed to fetch item inventory history"
    }, {
      status: 500
    });
  }
}

export { GET };
