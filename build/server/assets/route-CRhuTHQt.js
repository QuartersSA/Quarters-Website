import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { a as assertItemsEnabledAtBranch } from './branchVisibility-DozON22O.js';
import { e as ensureInventoryUnitSnapshotSchema, g as getDefaultInventoryUnitSnapshots, s as snapshotForItem } from './inventoryUnitSnapshots-B5krAOBv.js';
import { v as validateBusinessDate } from './dateUtils-DCPDkvv9.js';
import '@neondatabase/serverless';
import 'crypto';
import './employeeDisplayName-CwZGtUC2.js';

/**
 * Validate a user-supplied openedAt value.
 * Returns null if invalid / out of business range.
 */
function validateOpenedAt(value) {
  const result = validateBusinessDate(value, {
    allowFuture: 1,
    minYear: 2020
  });
  return result.ok ? result.date : null;
}
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
    const {
      searchParams
    } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const branchId = branchIdRaw ? parseInt(branchIdRaw) : null;
    const values = [];
    let where = "WHERE 1=1";
    let idx = 1;
    if (branchId && !Number.isNaN(branchId)) {
      where += ` AND os.branch_id = $${idx}`;
      values.push(branchId);
      idx += 1;
    }
    const hasFromTo = !!fromRaw && !!toRaw;
    if (hasFromTo) {
      where += ` AND (os.opened_at AT TIME ZONE 'Asia/Riyadh')::date >= $${idx}::date`;
      values.push(fromRaw);
      idx += 1;
      where += ` AND (os.opened_at AT TIME ZONE 'Asia/Riyadh')::date <= $${idx}::date`;
      values.push(toRaw);
      idx += 1;
    }
    const query = `
      SELECT
        os.id,
        os.branch_id,
        b.name as branch_name,
        os.opened_at,
        os.note,
        os.created_at,
        (SELECT COUNT(*) FROM opening_session_items osi WHERE osi.session_id = os.id) as items_count
      FROM opening_sessions os
      LEFT JOIN branches b ON b.id = os.branch_id
      ${where}
      ORDER BY os.opened_at DESC, os.id DESC
    `;
    const rows = await sql(query, values);
    return Response.json({
      rows
    });
  } catch (error) {
    console.error("Error listing opening sessions:", error);
    return Response.json({
      error: "Failed to list opening sessions"
    }, {
      status: 500
    });
  }
}
async function POST(request) {
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
    const body = await request.json();
    const {
      branchId,
      openedAt,
      note,
      items
    } = body;
    const branchIdNum = parseInt(branchId);
    if (!branchIdNum || Number.isNaN(branchIdNum)) {
      return Response.json({
        error: "معرّف الفرع مطلوب"
      }, {
        status: 400
      });
    }
    if (!openedAt) {
      return Response.json({
        error: "تاريخ المخزون الافتتاحي مطلوب"
      }, {
        status: 400
      });
    }
    if (!validateOpenedAt(openedAt)) {
      return Response.json({
        error: "تاريخ المخزون الافتتاحي غير صالح (يجب أن يكون بين 2020 واليوم)"
      }, {
        status: 400
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({
        error: "قائمة الأصناف مطلوبة"
      }, {
        status: 400
      });
    }
    const cleaned = [];
    for (const row of items) {
      const itemIdNum = parseInt(row.itemId);
      const qtyNum = Number(row.quantity);
      if (!itemIdNum || Number.isNaN(itemIdNum)) {
        continue;
      }
      if (!Number.isFinite(qtyNum) || qtyNum < 0) {
        continue;
      }
      cleaned.push({
        itemId: itemIdNum,
        quantity: qtyNum
      });
    }
    if (cleaned.length === 0) {
      return Response.json({
        error: "لا توجد كميات صالحة لحفظها"
      }, {
        status: 400
      });
    }

    // Branch-visibility guard: reject opening sessions that include
    // items disabled at this branch. The writes would land in
    // opening_session_items + inventory_items but the items API
    // would hide them — the session would "succeed" while the
    // opening qty disappeared from totals.
    {
      const fail = await assertItemsEnabledAtBranch(branchIdNum, cleaned.map(c => c.itemId));
      if (fail) return Response.json(fail.body, {
        status: fail.status
      });
    }
    const actingEmployeeId = auth.user?.id || null;
    const snapshots = await getDefaultInventoryUnitSnapshots(cleaned.map(it => it.itemId));
    const itemIds = [];
    const quantities = [];
    const unitIds = [];
    const unitNames = [];
    const unitFactors = [];
    for (const it of cleaned) {
      const snap = snapshotForItem(snapshots, it.itemId);
      itemIds.push(it.itemId);
      quantities.push(Math.round(it.quantity * 1000) / 1000);
      unitIds.push(snap.unitId);
      unitNames.push(snap.unitName);
      unitFactors.push(snap.unitFactor);
    }

    // Build the full timestamp for opened_at (store time precision)
    const openedAtTimestamp = openedAt.includes("T") ? openedAt : `${openedAt}T00:00:00`;

    // Extract date-only for the unique constraint conflict check
    const openedAtDateOnly = openedAt.includes("T") ? openedAt.split("T")[0] : openedAt;

    // 1) Check if a session already exists for this branch+date
    const existingSessions = await sql(`SELECT id FROM opening_sessions 
       WHERE branch_id = $1
         AND (opened_at AT TIME ZONE 'Asia/Riyadh')::date = $2::date`, [branchIdNum, openedAtDateOnly]);
    let session;
    if (existingSessions.length > 0) {
      // Update existing session with new timestamp + note
      const [updated] = await sql(`UPDATE opening_sessions 
         SET opened_at = $1::timestamp, note = $2
         WHERE id = $3
         RETURNING id, branch_id, opened_at, note, created_at`, [openedAtTimestamp, note || null, existingSessions[0].id]);
      session = updated;
    } else {
      // Insert new session
      const [inserted] = await sql(`INSERT INTO opening_sessions (branch_id, opened_at, note)
         VALUES ($1, $2::timestamp, $3)
         RETURNING id, branch_id, opened_at, note, created_at`, [branchIdNum, openedAtTimestamp, note || null]);
      session = inserted;
    }

    // Replace old items for this session.
    await sql(`
        WITH deleted AS (
          DELETE FROM opening_session_items WHERE session_id = $1
          RETURNING 1
        ),
        rows AS (
          SELECT
            unnest($2::int[]) AS item_id,
            unnest($3::numeric[]) AS quantity,
            unnest($4::int[]) AS unit_id,
            unnest($5::text[]) AS unit_name,
            unnest($6::numeric[]) AS unit_factor
        )
        INSERT INTO opening_session_items (
          session_id, item_id, quantity, unit_id, unit_name, unit_factor
        )
        SELECT $1, item_id, quantity, unit_id, unit_name, unit_factor
        FROM rows
      `, [session.id, itemIds, quantities, unitIds, unitNames, unitFactors]);

    // 2) Create an inventory_operations record so it appears as a regular operation
    //    Remove any old "Opening" operation for same branch+date first
    const inventoryNumber = `OPN-${branchIdNum}-${openedAtDateOnly.replace(/-/g, "")}`;

    // Use the full datetime (with time) for operation_date
    const operationTimestamp = openedAt.includes("T") ? openedAt : `${openedAt}T00:00:00`;

    // Storage = real moment. $5 (operationTimestamp) is a Riyadh
    // wall-clock string from the form; pin it to Asia/Riyadh on the
    // cast so PG records the correct moment.
    const [operation] = await sql(`WITH deleted_ops AS (
         DELETE FROM inventory_operations
          WHERE branch_id = $2
            AND inventory_type = 'Opening'
            AND (COALESCE(operation_date, created_at) AT TIME ZONE 'Asia/Riyadh')::date = $6::date
          RETURNING 1
       ),
       op AS (
         INSERT INTO inventory_operations
           (inventory_number, branch_id, employee_id, inventory_type, status, note, operation_date, created_at)
         VALUES (
           $1, $2, $3, 'Opening', 'Completed', $4,
           $5::timestamp AT TIME ZONE 'Asia/Riyadh',
           NOW()
         )
         RETURNING id, inventory_number, branch_id, employee_id, inventory_type, status, created_at, operation_date
       ),
       rows AS (
         SELECT
           unnest($7::int[]) AS item_id,
           unnest($8::numeric[]) AS quantity,
           unnest($9::int[]) AS unit_id,
           unnest($10::text[]) AS unit_name,
           unnest($11::numeric[]) AS unit_factor
       ),
       inserted AS (
         INSERT INTO inventory_items (
           operation_id, item_id, quantity, branch_id,
           unit_id, unit_name, unit_factor
         )
         SELECT
           op.id, rows.item_id, rows.quantity, op.branch_id,
           rows.unit_id, rows.unit_name, rows.unit_factor
         FROM op, rows
         RETURNING 1
       )
       SELECT op.*, (SELECT COUNT(*) FROM inserted) AS inserted_count
       FROM op`, [inventoryNumber, branchIdNum, actingEmployeeId, note || "مخزون افتتاحي", operationTimestamp, openedAtDateOnly, itemIds, quantities, unitIds, unitNames, unitFactors]);
    console.log("Opening session + inventory operation created:", {
      sessionId: session.id,
      operationId: operation.id,
      items: cleaned.length
    });
    return Response.json({
      session,
      operation
    }, {
      status: 201
    });
  } catch (error) {
    console.error("Error creating opening session:", error);
    return Response.json({
      error: "Failed to create opening session"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
