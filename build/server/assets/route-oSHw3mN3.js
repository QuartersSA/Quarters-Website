import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { a as assertItemsEnabledAtBranch } from './branchVisibility-CXtulk0B.js';
import '@neondatabase/serverless';
import 'crypto';

/**
 * Validate a user-supplied openedAt value.
 * Returns null if invalid / out of business range.
 */
function validateOpenedAt(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    d = new Date(`${str}T00:00:00`);
  } else {
    d = new Date(str);
  }
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() < 2020) return null;
  if (d > new Date(Date.now() + 24 * 60 * 60 * 1000)) return null;
  return d;
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
      where += ` AND os.opened_at::date >= $${idx}::date`;
      values.push(fromRaw);
      idx += 1;
      where += ` AND os.opened_at::date <= $${idx}::date`;
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

    // Build the full timestamp for opened_at (store time precision)
    const openedAtTimestamp = openedAt.includes("T") ? openedAt : `${openedAt}T00:00:00`;

    // Extract date-only for the unique constraint conflict check
    const openedAtDateOnly = openedAt.includes("T") ? openedAt.split("T")[0] : openedAt;

    // 1) Check if a session already exists for this branch+date
    const existingSessions = await sql(`SELECT id FROM opening_sessions 
       WHERE branch_id = $1 AND opened_at::date = $2::date`, [branchIdNum, openedAtDateOnly]);
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

    // Replace old items for this session
    await sql("DELETE FROM opening_session_items WHERE session_id = $1", [session.id]);
    for (const it of cleaned) {
      await sql(`INSERT INTO opening_session_items (session_id, item_id, quantity) VALUES ($1, $2, $3)`, [session.id, it.itemId, it.quantity]);
    }

    // 2) Create an inventory_operations record so it appears as a regular operation
    //    Remove any old "Opening" operation for same branch+date first
    const existingOps = await sql(`SELECT id FROM inventory_operations
       WHERE branch_id = $1
         AND inventory_type = 'Opening'
         AND (COALESCE(operation_date, created_at))::date = $2::date`, [branchIdNum, openedAtDateOnly]);
    for (const op of existingOps) {
      await sql(`DELETE FROM inventory_operations WHERE id = $1`, [op.id]);
    }
    const inventoryNumber = `OPN-${branchIdNum}-${openedAtDateOnly.replace(/-/g, "")}`;

    // Use the full datetime (with time) for operation_date
    const operationTimestamp = openedAt.includes("T") ? openedAt : `${openedAt}T00:00:00`;
    const [operation] = await sql(`INSERT INTO inventory_operations
         (inventory_number, branch_id, employee_id, inventory_type, status, note, operation_date)
       VALUES ($1, $2, $3, 'Opening', 'Completed', $4, $5::timestamp)
       RETURNING id, inventory_number, branch_id, employee_id, inventory_type, status, created_at, operation_date`, [inventoryNumber, branchIdNum, actingEmployeeId, note || "مخزون افتتاحي", operationTimestamp]);

    // Insert items into inventory_items for this operation
    for (const it of cleaned) {
      await sql(`INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
         VALUES ($1, $2, $3, $4)`, [operation.id, it.itemId, it.quantity, branchIdNum]);
    }
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
