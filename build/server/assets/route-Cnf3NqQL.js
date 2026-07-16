import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { s as sendWhatsAppViaWasender } from './wasender-kTQXZFza.js';
import { n as notifyByPref, a as notifyLowStockIfAny } from './waNotify-xh8pRsff.js';
import { a as assertItemsEnabledAtBranch } from './branchVisibility-CLODkXYw.js';
import { g as getDefaultInventoryUnitSnapshots, s as snapshotForItem, e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-Eh4y0Ete.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-Ba9mYj5Z.js';
import { p as parseBusinessTimestamp } from './dateUtils-DCPDkvv9.js';
import '@neondatabase/serverless';
import 'crypto';

// inventory-operations: GET (list + detail) | POST (create) | DELETE (remove)

/**
 * Parse user-supplied operation_date.
 * Preserves local wall-clock time so DB and UI agree on the calendar day.
 * Returns `YYYY-MM-DD HH:mm:ss` or null when invalid / out of business range.
 *
 * Rejects:
 *   - more than 1 day in the future (catches typos like 2050)
 *   - before 2020 (catches typos like 1925)
 */
function parseOperationDate(value) {
  return parseBusinessTimestamp(value, {
    allowFuture: 1,
    minYear: 2020
  });
}

// Idempotent schema migrations applied on every request.
// Postgres ALTER COLUMN to widen INTEGER → NUMERIC is non-blocking and preserves
// all existing data. Wrapped in try/catch so concurrent requests don't error.
async function ensureSchema() {
  await ensureEmployeeDisplayNameSchema();
  try {
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'inventory_items'
            AND column_name = 'quantity'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE inventory_items ALTER COLUMN quantity TYPE NUMERIC(12, 3);
        END IF;
      END $$
    `;
  } catch (e) {
    console.error("ensureSchema inventory_items.quantity:", e?.message);
  }
  try {
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'opening_session_items'
            AND column_name = 'quantity'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE opening_session_items ALTER COLUMN quantity TYPE NUMERIC(12, 3);
        END IF;
      END $$
    `;
  } catch (e) {
    console.error("ensureSchema opening_session_items.quantity:", e?.message);
  }

  // Transfer ops were originally storing only the post-transfer absolute
  // (quantity = from_new on the OUT leg, to_new on the IN leg). The UI
  // needs the *moved* amount too — "how many units did this transfer
  // shift". Add an explicit column; old rows stay NULL and get backfilled
  // below.
  try {
    await sql`
      ALTER TABLE inventory_items
        ADD COLUMN IF NOT EXISTS transfer_quantity NUMERIC(12, 3)
    `;
  } catch (e) {
    console.error("ensureSchema inventory_items.transfer_quantity:", e?.message);
  }

  // One-shot backfill for legacy Transfer rows that predate the column.
  // Computing on-the-fly per request would let downstream rows shift
  // their "moved" value whenever an upstream Transfer was deleted —
  // because their prev_balance lookup would jump further back.
  // Backfilling once + reading the stored value gives a stable answer
  // that doesn't depend on neighbors.
  //
  // The EXISTS guard makes this cheap after the first successful run:
  // once every row is filled the UPDATE is skipped entirely.
  try {
    const [pending] = await sql`
      SELECT 1
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
       WHERE io.inventory_type = 'Transfer'
         AND ii.transfer_quantity IS NULL
       LIMIT 1
    `;
    if (pending) {
      await sql`
        WITH chain AS (
          SELECT
            ii.id AS row_id,
            ABS(
              COALESCE(
                (
                  SELECT COALESCE(prev_ii.quantity, 0)
                       + COALESCE((
                           SELECT SUM(pr.quantity)
                             FROM purchase_receipts pr
                            WHERE pr.item_id = ii.item_id
                              AND pr.branch_id = ii.branch_id
                              AND GREATEST(pr.received_at, pr.created_at)
                                  > COALESCE(prev_io.operation_date, prev_io.created_at)
                              AND GREATEST(pr.received_at, pr.created_at)
                                  < COALESCE(io.operation_date, io.created_at)
                         ), 0)
                    FROM inventory_items prev_ii
                    JOIN inventory_operations prev_io
                      ON prev_io.id = prev_ii.operation_id
                   WHERE prev_ii.item_id = ii.item_id
                     AND prev_ii.branch_id = ii.branch_id
                     AND prev_ii.id <> ii.id
                     AND prev_io.status = 'Completed'
                     AND prev_io.inventory_type IN ('Daily','Weekly','Transfer','Opening')
                     AND COALESCE(prev_io.operation_date, prev_io.created_at)
                         < COALESCE(io.operation_date, io.created_at)
                   ORDER BY COALESCE(prev_io.operation_date, prev_io.created_at) DESC,
                            prev_io.id DESC
                   LIMIT 1
                ),
                (
                  SELECT COALESCE(SUM(pr.quantity), 0)
                    FROM purchase_receipts pr
                   WHERE pr.item_id = ii.item_id
                     AND pr.branch_id = ii.branch_id
                     AND GREATEST(pr.received_at, pr.created_at)
                         < COALESCE(io.operation_date, io.created_at)
                )
              ) - ii.quantity
            ) AS moved
          FROM inventory_items ii
          JOIN inventory_operations io ON io.id = ii.operation_id
          WHERE io.inventory_type = 'Transfer'
            AND ii.transfer_quantity IS NULL
        )
        UPDATE inventory_items target
           SET transfer_quantity = chain.moved
          FROM chain
         WHERE target.id = chain.row_id
      `;
    }
  } catch (e) {
    console.error("ensureSchema backfill transfer_quantity:", e?.message);
  }
  try {
    await ensureInventoryUnitSnapshotSchema();
  } catch (e) {
    console.error("ensureSchema inventory unit snapshots:", e?.message);
  }
}

// WhatsApp notify to opted-in admins (never blocks saving)
async function notifyAdminsWhatsAppInventoryOperation({
  branchName,
  employeeName,
  inventoryType,
  inventoryNumber,
  operationId
}) {
  try {
    const admins = await sql`
      SELECT id, COALESCE(NULLIF(display_name, ''), name) AS name, phone
      FROM employees
      WHERE role = 'Admin'
        AND COALESCE(can_manage_inventory, false) = true
        AND COALESCE(notify_inventory_operation_wa, false) = true
        AND phone IS NOT NULL
        AND TRIM(phone) <> ''
      ORDER BY id ASC
      LIMIT 25
    `;
    if (!admins.length) {
      return {
        ok: true,
        skipped: true,
        reason: "no_admin_phones"
      };
    }
    const lines = ["جرد جديد", branchName ? `الفرع: ${branchName}` : null, inventoryType ? `النوع: ${inventoryType}` : null, inventoryNumber ? `رقم الجرد: ${inventoryNumber}` : null, operationId ? `رقم العملية: #${operationId}` : null, employeeName ? `الموظف: ${employeeName}` : null].filter(Boolean);
    const text = lines.join("\n").trim();
    const results = await Promise.all(admins.map(async a => {
      const r = await sendWhatsAppViaWasender({
        to: a.phone,
        text
      });
      if (!r.ok) {
        console.error("Inventory WhatsApp notify failed", {
          adminId: a.id,
          error: r.error,
          details: r.details
        });
      }
      return {
        adminId: a.id,
        ok: r.ok
      };
    }));
    return {
      ok: true,
      results
    };
  } catch (e) {
    console.error("notifyAdminsWhatsAppInventoryOperation error", e);
    return {
      ok: false,
      error: "notify_failed"
    };
  }
}

/**
 * Group purchase receipt rows into batched operations.
 * Receipts with a `receipt_batch_id` are merged into a single virtual operation.
 * Receipts without a batch id remain as individual virtual operations (legacy data).
 */
function groupReceiptsIntoOperations(receipts) {
  const batched = new Map(); // batch_id → array of rows
  const singles = []; // rows with no batch_id

  for (const r of receipts) {
    if (r.receipt_batch_id) {
      if (!batched.has(r.receipt_batch_id)) {
        batched.set(r.receipt_batch_id, []);
      }
      batched.get(r.receipt_batch_id).push(r);
    } else {
      singles.push(r);
    }
  }
  const result = [];

  // Batched receipts → one operation per batch
  for (const [batchId, rows] of batched.entries()) {
    const first = rows[0];
    // Guard each row's quantity: a NULL or non-numeric DB value would
    // turn the sum into NaN and poison everything downstream (display,
    // CSV export, totals).
    const totalQty = rows.reduce((s, r) => {
      const n = Number(r?.quantity);
      return s + (Number.isFinite(n) ? n : 0);
    }, 0);
    const itemNames = rows.map(r => r.item_name).filter(Boolean);
    const itemCount = rows.length;
    result.push({
      id: `batch-${batchId}`,
      inventory_number: `RCV-${batchId}`,
      inventory_type: "Receipt",
      status: "Completed",
      created_at: first.created_at,
      operation_date: first.received_at || first.created_at,
      branch_id: first.branch_id,
      branch_name: first.branch_name,
      branch_location: first.branch_location,
      employee_id: first.created_by_employee_id || null,
      employee_name: first.created_by_employee_name || null,
      employee_email: null,
      transfer_branch_id: null,
      transfer_branch_name: null,
      transfer_direction: null,
      note: first.note,
      received_at: first.received_at,
      receipt_item_name: itemCount === 1 ? itemNames[0] : `${itemCount} أصناف`,
      receipt_quantity: totalQty,
      receipt_item_count: itemCount,
      receipt_batch_id: batchId
    });
  }

  // Single (legacy) receipts → one operation each
  for (const r of singles) {
    result.push({
      id: `rcpt-${r.id}`,
      inventory_number: `RCV-${r.id}`,
      inventory_type: "Receipt",
      status: "Completed",
      created_at: r.created_at,
      operation_date: r.received_at || r.created_at,
      branch_id: r.branch_id,
      branch_name: r.branch_name,
      branch_location: r.branch_location,
      employee_id: r.created_by_employee_id || null,
      employee_name: r.created_by_employee_name || null,
      employee_email: null,
      transfer_branch_id: null,
      transfer_branch_name: null,
      transfer_direction: null,
      note: r.note,
      receipt_item_name: r.item_name,
      receipt_quantity: Number(r.quantity),
      received_at: r.received_at,
      receipt_item_count: 1,
      receipt_batch_id: null
    });
  }
  return result;
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
  await ensureSchema();
  try {
    const {
      searchParams
    } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const operationId = searchParams.get("id");

    // ── Detail view for a batched receipt ──
    if (operationId && String(operationId).startsWith("batch-")) {
      const batchId = String(operationId).replace("batch-", "");
      const rows = await sql(`SELECT
          pr.id,
          pr.branch_id,
          b.name   AS branch_name,
          b.location AS branch_location,
          pr.item_id,
          i.name   AS item_name,
          i.description AS item_description,
          pr.quantity,
          pr.received_at,
          pr.note,
          pr.created_at,
          pr.created_by_employee_id,
          COALESCE(NULLIF(e.display_name, ''), pr.created_by_employee_name, e.name) AS created_by_employee_name,
          pr.receipt_batch_id
        FROM purchase_receipts pr
        LEFT JOIN branches b ON b.id = pr.branch_id
        LEFT JOIN items    i ON i.id = pr.item_id
        LEFT JOIN employees e ON e.id = pr.created_by_employee_id
        WHERE pr.receipt_batch_id = $1
        ORDER BY i.name`, [batchId]);
      if (!rows || rows.length === 0) {
        return Response.json({
          error: "سجل الوارد غير موجود"
        }, {
          status: 404
        });
      }
      const first = rows[0];
      return Response.json({
        id: `batch-${batchId}`,
        inventory_number: `RCV-${batchId}`,
        inventory_type: "Receipt",
        status: "Completed",
        created_at: first.created_at,
        operation_date: first.received_at || first.created_at,
        branch_id: first.branch_id,
        branch_name: first.branch_name,
        branch_location: first.branch_location,
        employee_id: first.created_by_employee_id || null,
        employee_name: first.created_by_employee_name || null,
        employee_email: null,
        transfer_branch_id: null,
        transfer_branch_name: null,
        transfer_branch_location: null,
        transfer_direction: null,
        note: first.note,
        received_at: first.received_at,
        receipt_batch_id: batchId,
        items: rows.map(r => ({
          id: r.id,
          item_id: r.item_id,
          quantity: Number(r.quantity),
          item_name: r.item_name,
          item_description: r.item_description
        }))
      });
    }

    // ── Detail view for a single purchase receipt (virtual) ──
    if (operationId && String(operationId).startsWith("rcpt-")) {
      const receiptId = parseInt(String(operationId).replace("rcpt-", ""));
      const [rcpt] = await sql`
        SELECT
          pr.id,
          pr.branch_id,
          b.name   AS branch_name,
          b.location AS branch_location,
          pr.item_id,
          i.name   AS item_name,
          i.description AS item_description,
          pr.quantity,
          pr.received_at,
          pr.note,
          pr.created_at,
          pr.created_by_employee_id,
          COALESCE(NULLIF(e.display_name, ''), pr.created_by_employee_name, e.name) AS created_by_employee_name
        FROM purchase_receipts pr
        LEFT JOIN branches b ON b.id = pr.branch_id
        LEFT JOIN items    i ON i.id = pr.item_id
        LEFT JOIN employees e ON e.id = pr.created_by_employee_id
        WHERE pr.id = ${receiptId}
      `;
      if (!rcpt) {
        return Response.json({
          error: "سجل الوارد غير موجود"
        }, {
          status: 404
        });
      }
      return Response.json({
        id: `rcpt-${rcpt.id}`,
        inventory_number: `RCV-${rcpt.id}`,
        inventory_type: "Receipt",
        status: "Completed",
        created_at: rcpt.created_at,
        operation_date: rcpt.received_at || rcpt.created_at,
        branch_id: rcpt.branch_id,
        branch_name: rcpt.branch_name,
        branch_location: rcpt.branch_location,
        employee_id: rcpt.created_by_employee_id || null,
        employee_name: rcpt.created_by_employee_name || null,
        employee_email: null,
        transfer_branch_id: null,
        transfer_branch_name: null,
        transfer_branch_location: null,
        transfer_direction: null,
        note: rcpt.note,
        received_at: rcpt.received_at,
        receipt_item_name: rcpt.item_name,
        receipt_quantity: Number(rcpt.quantity),
        items: [{
          id: rcpt.id,
          item_id: rcpt.item_id,
          quantity: Number(rcpt.quantity),
          item_name: rcpt.item_name,
          item_description: rcpt.item_description
        }]
      });
    }

    // ── Detail view for a single inventory operation ──
    if (operationId) {
      const [operation] = await sql`
        SELECT 
          io.id,
          io.inventory_number,
          io.inventory_type,
          io.status,
          io.created_at,
          io.operation_date,
          io.branch_id,
          b.name as branch_name,
          b.location as branch_location,
          io.employee_id,
          COALESCE(NULLIF(e.display_name, ''), e.name) as employee_name,
          e.email as employee_email,
          io.transfer_branch_id,
          tb.name as transfer_branch_name,
          tb.location as transfer_branch_location,
          io.transfer_direction,
          io.note
        FROM inventory_operations io
        LEFT JOIN branches b ON io.branch_id = b.id
        LEFT JOIN branches tb ON io.transfer_branch_id = tb.id
        LEFT JOIN employees e ON io.employee_id = e.id
        WHERE io.id = ${parseInt(operationId)}
      `;
      if (!operation) {
        return Response.json({
          error: "عملية الجرد غير موجودة"
        }, {
          status: 404
        });
      }

      // Transfer ops: ii.transfer_quantity is set at creation time for
      // new transfers and backfilled once by ensureSchema for legacy
      // rows. Reading the stored column keeps the displayed value
      // stable when neighboring transfers are added or deleted.
      const items = await sql`
        SELECT
          ii.id,
          ii.item_id,
          ii.quantity,
          ii.transfer_quantity,
          i.name as item_name,
          i.description as item_description
        FROM inventory_items ii
        LEFT JOIN items i ON ii.item_id = i.id
        WHERE ii.operation_id = ${parseInt(operationId)}
        ORDER BY i.name
      `;
      return Response.json({
        ...operation,
        items
      });
    }

    // ── List view: inventory operations + purchase receipts merged ──
    let operations;
    if (branchId) {
      operations = await sql`
        SELECT 
          io.id,
          io.inventory_number,
          io.inventory_type,
          io.status,
          io.created_at,
          io.operation_date,
          io.branch_id,
          b.name as branch_name,
          b.location as branch_location,
          io.employee_id,
          COALESCE(NULLIF(e.display_name, ''), e.name) as employee_name,
          e.email as employee_email,
          io.transfer_branch_id,
          tb.name as transfer_branch_name,
          io.transfer_direction,
          io.note
        FROM inventory_operations io
        LEFT JOIN branches b ON io.branch_id = b.id
        LEFT JOIN branches tb ON io.transfer_branch_id = tb.id
        LEFT JOIN employees e ON io.employee_id = e.id
        WHERE io.branch_id = ${parseInt(branchId)}
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC
      `;
    } else {
      operations = await sql`
        SELECT 
          io.id,
          io.inventory_number,
          io.inventory_type,
          io.status,
          io.created_at,
          io.operation_date,
          io.branch_id,
          b.name as branch_name,
          b.location as branch_location,
          io.employee_id,
          COALESCE(NULLIF(e.display_name, ''), e.name) as employee_name,
          e.email as employee_email,
          io.transfer_branch_id,
          tb.name as transfer_branch_name,
          io.transfer_direction,
          io.note
        FROM inventory_operations io
        LEFT JOIN branches b ON io.branch_id = b.id
        LEFT JOIN branches tb ON io.transfer_branch_id = tb.id
        LEFT JOIN employees e ON io.employee_id = e.id
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC
      `;
    }

    // Fetch purchase receipts
    let receipts;
    if (branchId) {
      receipts = await sql`
        SELECT
          pr.id, pr.branch_id,
          b.name AS branch_name, b.location AS branch_location,
          pr.item_id, i.name AS item_name,
          pr.quantity, pr.received_at, pr.note, pr.created_at,
          pr.created_by_employee_id,
          COALESCE(NULLIF(e.display_name, ''), pr.created_by_employee_name, e.name) AS created_by_employee_name,
          pr.receipt_batch_id
        FROM purchase_receipts pr
        LEFT JOIN branches b ON b.id = pr.branch_id
        LEFT JOIN items    i ON i.id = pr.item_id
        LEFT JOIN employees e ON e.id = pr.created_by_employee_id
        WHERE pr.branch_id = ${parseInt(branchId)}
        ORDER BY pr.created_at DESC
      `;
    } else {
      receipts = await sql`
        SELECT
          pr.id, pr.branch_id,
          b.name AS branch_name, b.location AS branch_location,
          pr.item_id, i.name AS item_name,
          pr.quantity, pr.received_at, pr.note, pr.created_at,
          pr.created_by_employee_id,
          COALESCE(NULLIF(e.display_name, ''), pr.created_by_employee_name, e.name) AS created_by_employee_name,
          pr.receipt_batch_id
        FROM purchase_receipts pr
        LEFT JOIN branches b ON b.id = pr.branch_id
        LEFT JOIN items    i ON i.id = pr.item_id
        LEFT JOIN employees e ON e.id = pr.created_by_employee_id
        ORDER BY pr.created_at DESC
      `;
    }

    // Group receipts: batched ones become a single operation, legacy ones stay individual
    const receiptRows = groupReceiptsIntoOperations(receipts || []);

    // Merge and sort by operation_date DESC (the authoritative date)
    const merged = [...operations, ...receiptRows].sort((a, b) => new Date(b.operation_date || b.created_at) - new Date(a.operation_date || a.created_at));
    return Response.json(merged);
  } catch (error) {
    console.error("Error fetching inventory operations:", error);
    return Response.json({
      error: "Failed to fetch inventory operations"
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_inventory"
    }, {
      role: "Employee",
      permission: "can_do_inventory"
    }]
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
    const body = await request.json();
    const {
      branchId,
      employeeId,
      inventoryType,
      availableItems,
      unavailableItems,
      operationDate
    } = body;
    const actingEmployeeId = auth.user?.id || employeeId || null;

    // Employees always use server time — only Admins may specify a custom date
    const isAdmin = auth.user?.role === "Admin";
    // Validate + normalize operation_date when admin supplies one
    let opDateValue = null;
    if (isAdmin && operationDate) {
      opDateValue = parseOperationDate(operationDate);
      if (!opDateValue) {
        return Response.json({
          error: "تاريخ العملية غير صالح (يجب أن يكون بين 2020 واليوم)"
        }, {
          status: 400
        });
      }
    }
    if (auth.user?.role === "Employee") {
      const allowed = Array.isArray(auth.user?.branchIds) ? auth.user.branchIds : [];
      const bIdNum = Number(branchId);
      if (!Number.isFinite(bIdNum) || !allowed.includes(bIdNum)) {
        return Response.json({
          error: "لا تملك صلاحية على هذا الفرع"
        }, {
          status: 403
        });
      }
    }
    if (!branchId) {
      return Response.json({
        error: "معرف الفرع مطلوب",
        details: "branchId is required"
      }, {
        status: 400
      });
    }
    if (!inventoryType) {
      return Response.json({
        error: "نوع الجرد مطلوب",
        details: "inventoryType is required"
      }, {
        status: 400
      });
    }

    // Branch-visibility guard: refuse counts for (item, branch) pairs the
    // admin has marked as disabled. Without this the row gets written to
    // inventory_items but the items API hides it via its disabled-pair
    // filter, so the count "succeeds" yet the stock never appears on
    // the items / stock-value pages — silent data loss.
    const requestedItemIds = [...Object.keys(availableItems || {}).map(Number), ...(Array.isArray(unavailableItems) ? unavailableItems.map(Number) : [])].filter(x => Number.isFinite(x) && x > 0);
    if (requestedItemIds.length > 0) {
      const fail = await assertItemsEnabledAtBranch(branchId, requestedItemIds);
      if (fail) return Response.json(fail.body, {
        status: fail.status
      });
    }
    if (requestedItemIds.length === 0) {
      return Response.json({
        error: "يجب إدخال صنف واحد على الأقل"
      }, {
        status: 400
      });
    }
    const unitSnapshots = await getDefaultInventoryUnitSnapshots(requestedItemIds);
    const insertItemIds = [];
    const insertQuantities = [];
    const insertUnitIds = [];
    const insertUnitNames = [];
    const insertUnitFactors = [];
    for (const [itemIdRaw, qtyRaw] of Object.entries(availableItems || {})) {
      const itemId = Number(itemIdRaw);
      const qty = Number(qtyRaw);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      if (!Number.isFinite(qty) || qty < 0) {
        return Response.json({
          error: `كمية غير صحيحة للصنف #${itemId}`
        }, {
          status: 400
        });
      }
      const snap = snapshotForItem(unitSnapshots, itemId);
      insertItemIds.push(itemId);
      insertQuantities.push(Math.round(qty * 1000) / 1000);
      insertUnitIds.push(snap.unitId);
      insertUnitNames.push(snap.unitName);
      insertUnitFactors.push(snap.unitFactor);
    }
    for (const itemIdRaw of unavailableItems || []) {
      const itemId = Number(itemIdRaw);
      if (!Number.isFinite(itemId) || itemId <= 0) continue;
      const snap = snapshotForItem(unitSnapshots, itemId);
      insertItemIds.push(itemId);
      insertQuantities.push(0);
      insertUnitIds.push(snap.unitId);
      insertUnitNames.push(snap.unitName);
      insertUnitFactors.push(snap.unitFactor);
    }
    const inventoryNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Storage = real moment (NOW()).
    // For the user-supplied `opDateValue` we get a Riyadh wall-clock
    // string ("YYYY-MM-DD HH:MM:SS") from the picker. Cast it to a
    // timestamp and pin it to Asia/Riyadh so PG records the correct
    // moment, not whatever the session TZ happens to be. Display
    // (`formatDateTime`) reads the stored moment back in
    // `Asia/Riyadh` so the cell shows the user's wall-clock.
    const [operation] = await sql(`WITH op AS (
         INSERT INTO inventory_operations (inventory_number, branch_id, employee_id, inventory_type, status, operation_date, created_at)
         VALUES (
           $1, $2, $3, $4, 'Completed',
           COALESCE($5::timestamp AT TIME ZONE 'Asia/Riyadh', NOW()),
           NOW()
         )
         RETURNING id, inventory_number, branch_id, employee_id, inventory_type, status, created_at, operation_date
       ),
       rows AS (
         SELECT
           unnest($6::int[]) AS item_id,
           unnest($7::numeric[]) AS quantity,
           unnest($8::int[]) AS unit_id,
           unnest($9::text[]) AS unit_name,
           unnest($10::numeric[]) AS unit_factor
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
       FROM op`, [inventoryNumber, branchId, actingEmployeeId || null, inventoryType, opDateValue, insertItemIds, insertQuantities, insertUnitIds, insertUnitNames, insertUnitFactors]);
    console.log("Inventory operation created successfully:", operation);
    const [branch] = await sql`SELECT id, name FROM branches WHERE id = ${Number(operation.branch_id)}`;
    const actingId = Number(operation.employee_id);
    let employeeName = "";
    if (Number.isFinite(actingId) && actingId > 0) {
      const [emp] = await sql`
        SELECT id, COALESCE(NULLIF(display_name, ''), name) AS name
        FROM employees
        WHERE id = ${actingId}
      `;
      employeeName = emp?.name || "";
    }
    notifyAdminsWhatsAppInventoryOperation({
      branchName: branch?.name || "—",
      employeeName,
      inventoryType: operation?.inventory_type,
      inventoryNumber: operation?.inventory_number,
      operationId: operation?.id
    }).catch(e => console.error("notify admins whatsapp error", e));

    // إشعارات تفضيلات الموظفين: نوع العملية يحدد المفتاح، ثم فحص
    // الحد الأدنى للأصناف المتأثرة في هذا الفرع.
    {
      const opType = String(operation?.inventory_type || "");
      const prefKey = opType === "Receipt" ? "inv_receipt" : opType === "Transfer" ? "inv_transfer" : "inv_stocktake";
      const title = opType === "Receipt" ? "📦 عملية وارد جديدة" : opType === "Transfer" ? "🔁 عملية تحويل جديدة" : "📋 عملية جرد جديدة";
      const text = [title, `الفرع: ${branch?.name || "—"}`, `الرقم: ${operation?.inventory_number || ""}`, employeeName ? `الموظف: ${employeeName}` : null, `عدد الأصناف: ${insertItemIds.length}`].filter(Boolean).join("\n");
      notifyByPref(prefKey, text).catch(() => {});
      notifyLowStockIfAny({
        branchId: operation?.branch_id,
        itemIds: insertItemIds
      }).catch(() => {});
    }
    return Response.json(operation, {
      status: 201
    });
  } catch (error) {
    console.error("Error creating inventory operation:", error);
    return Response.json({
      error: "فشل في إنشاء عملية الجرد",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
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
    const operationId = searchParams.get("id");
    if (!operationId) {
      return Response.json({
        error: "معرّف العملية مطلوب"
      }, {
        status: 400
      });
    }

    // ── Delete a batched receipt ──
    if (String(operationId).startsWith("batch-")) {
      const batchId = String(operationId).replace("batch-", "");
      const existing = await sql(`SELECT id FROM purchase_receipts WHERE receipt_batch_id = $1`, [batchId]);
      if (!existing || existing.length === 0) {
        return Response.json({
          error: "سجل الوارد غير موجود"
        }, {
          status: 404
        });
      }
      await sql(`DELETE FROM purchase_receipts WHERE receipt_batch_id = $1`, [batchId]);
      return Response.json({
        ok: true,
        deleted: "receipt_batch",
        batchId,
        count: existing.length
      });
    }

    // ── Delete a single purchase receipt (virtual Receipt operation) ──
    if (String(operationId).startsWith("rcpt-")) {
      const receiptId = parseInt(String(operationId).replace("rcpt-", ""));
      if (!Number.isFinite(receiptId) || receiptId <= 0) {
        return Response.json({
          error: "معرّف الوارد غير صحيح"
        }, {
          status: 400
        });
      }
      const [existing] = await sql`
        SELECT id FROM purchase_receipts WHERE id = ${receiptId}
      `;
      if (!existing) {
        return Response.json({
          error: "سجل الوارد غير موجود"
        }, {
          status: 404
        });
      }
      await sql`DELETE FROM purchase_receipts WHERE id = ${receiptId}`;
      return Response.json({
        ok: true,
        deleted: "receipt",
        id: receiptId
      });
    }

    // ── Delete a real inventory operation (Daily / Weekly / Transfer) ──
    const opId = parseInt(operationId);
    if (!Number.isFinite(opId) || opId <= 0) {
      return Response.json({
        error: "معرّف العملية غير صحيح"
      }, {
        status: 400
      });
    }
    const [operation] = await sql`
      SELECT id, inventory_number, inventory_type, transfer_direction
      FROM inventory_operations
      WHERE id = ${opId}
    `;
    if (!operation) {
      return Response.json({
        error: "عملية الجرد غير موجودة"
      }, {
        status: 404
      });
    }

    // For Transfer operations: delete BOTH paired operations (out + in
    // share same inventory_number) AND return the moved units to the
    // chain so the source's current stock goes back up.
    //
    // Naive delete only removes the two legs. Any LATER transfer at
    // the same (item, branch) stored an absolute that baked in this
    // transfer's effect, so the deletion's credit never propagated
    // without also bumping those later rows.
    //
    // We:
    //  1) Compute moved amounts per item from the OUT leg's
    //     transfer_quantity (set at creation, backfilled for legacy
    //     rows by ensureSchema).
    //  2) Guard rails:
    //     - moved must be > 0; NULL/0 means we never knew the moved
    //       amount, refuse rather than silently delete with no
    //       adjustment.
    //     - check that no subsequent Transfer at the destination
    //       would go negative once we subtract `moved`. If so, the
    //       chain has dependent transfers that need to be deleted
    //       first; surface them in a 409 so the user can act.
    //  3) Wrap the UPDATEs + DELETEs in a single sql.transaction so
    //     a mid-operation failure can't leave a half-adjusted chain.
    //  4) Apply +moved to every subsequent Transfer row at the source
    //     branch and -moved at the destination branch (item-scoped).
    //     Daily/Weekly/Opening rows are physical recounts the user
    //     explicitly measured, so they're preserved as-is.
    if (operation.inventory_type === "Transfer") {
      const paired = await sql`
        SELECT id, branch_id, transfer_branch_id, transfer_direction,
               COALESCE(operation_date, created_at) AS op_date
          FROM inventory_operations
         WHERE inventory_number = ${operation.inventory_number}
      `;
      const pairedIds = paired.map(r => r.id);
      const outLeg = paired.find(p => p.transfer_direction === "out") || paired[0];
      const inLeg = paired.find(p => p.transfer_direction === "in") || paired[1] || null;
      const sourceBranchId = outLeg?.branch_id;
      const destBranchId = inLeg?.branch_id || outLeg?.transfer_branch_id || null;
      const opDate = outLeg?.op_date || operation.op_date;

      // Per-item moved amounts. Joined with items so the conflict
      // response can name the items if we have to refuse.
      const movedRows = outLeg ? await sql`
            SELECT
              ii.item_id,
              i.name AS item_name,
              (
                ii.transfer_quantity::numeric
                  * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
              ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS moved,
              COALESCE(iu.conversion_factor, 1)::numeric AS current_factor
            FROM inventory_items ii
            LEFT JOIN items i ON i.id = ii.item_id
            LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
            WHERE ii.operation_id = ${outLeg.id}
          ` : [];

      // (2a) NULL / zero guard. If any row's moved is null/0 we don't
      // know how much to put back. Surface it instead of silently
      // deleting the legs.
      const missingMoved = movedRows.filter(r => {
        const m = r.moved === null || r.moved === undefined ? null : Number(r.moved);
        return m === null || !Number.isFinite(m) || m <= 0;
      });
      if (missingMoved.length > 0) {
        return Response.json({
          error: "تعذّر حذف التحويل: كمية النقل المسجلة غير معروفة لبعض الأصناف",
          items: missingMoved.map(r => r.item_name || `#${r.item_id}`)
        }, {
          status: 409
        });
      }

      // (2b) Cascade guard at destination. If a later transfer at the
      // destination branch would go negative after subtracting moved,
      // it depended on these units — refuse and tell the user which
      // transfers to delete first.
      if (destBranchId && movedRows.length > 0) {
        const conflicts = [];
        for (const row of movedRows) {
          const moved = Number(row.moved);
          const currentFactor = Number(row.current_factor) || 1;
          const movedBase = moved * currentFactor;
          const dependents = await sql`
            SELECT io.inventory_number, io.id, ii.quantity
              FROM inventory_items ii
              JOIN inventory_operations io ON io.id = ii.operation_id
             WHERE io.inventory_type = 'Transfer'
               AND ii.item_id = ${row.item_id}
               AND ii.branch_id = ${destBranchId}
               AND io.id <> ALL(${pairedIds})
               AND COALESCE(io.operation_date, io.created_at) > ${opDate}
               AND ii.quantity < (
                 ${movedBase}::numeric
                   / NULLIF(COALESCE(ii.unit_factor, ${currentFactor})::numeric, 0)
               )
             ORDER BY COALESCE(io.operation_date, io.created_at) ASC
          `;
          for (const d of dependents) {
            conflicts.push({
              item_name: row.item_name,
              inventory_number: d.inventory_number
            });
          }
        }
        if (conflicts.length > 0) {
          const numbers = Array.from(new Set(conflicts.map(c => c.inventory_number)));
          return Response.json({
            error: "لا يمكن حذف هذا التحويل: توجد تحويلات لاحقة تعتمد على الكمية المنقولة. احذفها أولاً.",
            dependent_transfers: numbers,
            conflicts
          }, {
            status: 409
          });
        }
      }

      // (3) Atomic UPDATE + DELETE. Build the statement array first.
      const txStatements = [];
      for (const row of movedRows) {
        const moved = Number(row.moved);
        const currentFactor = Number(row.current_factor) || 1;
        const movedBase = moved * currentFactor;
        if (sourceBranchId) {
          txStatements.push(sql`
            UPDATE inventory_items ii
               SET quantity = quantity + (
                 ${movedBase}::numeric
                   / NULLIF(COALESCE(ii.unit_factor, ${currentFactor})::numeric, 0)
               )
              FROM inventory_operations io
             WHERE ii.operation_id = io.id
               AND io.inventory_type = 'Transfer'
               AND ii.item_id = ${row.item_id}
               AND ii.branch_id = ${sourceBranchId}
               AND io.id <> ALL(${pairedIds})
               AND COALESCE(io.operation_date, io.created_at) > ${opDate}
          `);
        }
        if (destBranchId) {
          txStatements.push(sql`
            UPDATE inventory_items ii
               SET quantity = quantity - (
                 ${movedBase}::numeric
                   / NULLIF(COALESCE(ii.unit_factor, ${currentFactor})::numeric, 0)
               )
              FROM inventory_operations io
             WHERE ii.operation_id = io.id
               AND io.inventory_type = 'Transfer'
               AND ii.item_id = ${row.item_id}
               AND ii.branch_id = ${destBranchId}
               AND io.id <> ALL(${pairedIds})
               AND COALESCE(io.operation_date, io.created_at) > ${opDate}
          `);
        }
      }
      for (const pid of pairedIds) {
        // inventory_items for the paired ops cascade via FK on delete.
        txStatements.push(sql`DELETE FROM inventory_operations WHERE id = ${pid}`);
      }
      if (txStatements.length > 0) {
        await sql.transaction(txStatements);
      }
      return Response.json({
        ok: true,
        deleted: "transfer",
        ids: pairedIds,
        inventory_number: operation.inventory_number
      });
    }

    // For Opening operations, also delete the corresponding opening_sessions record
    if (operation.inventory_type === "Opening") {
      // Find the branch and date from the operation
      const [opFull] = await sql`
        SELECT branch_id, (COALESCE(operation_date, created_at) AT TIME ZONE 'Asia/Riyadh')::date as op_date
        FROM inventory_operations WHERE id = ${opId}
      `;
      if (opFull) {
        // Delete matching opening_session (same branch + date)
        await sql(`DELETE FROM opening_sessions WHERE branch_id = $1 AND opened_at::date = $2`, [opFull.branch_id, opFull.op_date]);
      }
      await sql`DELETE FROM inventory_operations WHERE id = ${opId}`;
      return Response.json({
        ok: true,
        deleted: "opening",
        id: opId,
        inventory_type: operation.inventory_type
      });
    }

    // For Daily / Weekly: just delete the operation (CASCADE deletes inventory_items)
    await sql`DELETE FROM inventory_operations WHERE id = ${opId}`;
    return Response.json({
      ok: true,
      deleted: "operation",
      id: opId,
      inventory_type: operation.inventory_type
    });
  } catch (error) {
    console.error("Error deleting inventory operation:", error);
    return Response.json({
      error: "فشل في حذف العملية",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function PUT(request) {
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
      operationId,
      note,
      operationDate,
      items
    } = body;
    if (!operationId) {
      return Response.json({
        error: "معرّف العملية مطلوب"
      }, {
        status: 400
      });
    }
    const opId = parseInt(operationId);
    if (!Number.isFinite(opId) || opId <= 0) {
      return Response.json({
        error: "معرّف العملية غير صحيح"
      }, {
        status: 400
      });
    }

    // Look up the existing operation
    const [operation] = await sql`
      SELECT id, inventory_number, inventory_type, branch_id, transfer_branch_id, transfer_direction
      FROM inventory_operations
      WHERE id = ${opId}
    `;
    if (!operation) {
      return Response.json({
        error: "العملية غير موجودة"
      }, {
        status: 404
      });
    }
    const invType = operation.inventory_type;

    // Items are required for Daily/Weekly/Opening edits. For
    // Transfer, items are optional — sending only metadata (note +
    // date) is valid (applies to both legs), and sending items
    // triggers the delta-based chain adjustment in the Transfer
    // branch below.
    const cleanedItems = [];
    if (Array.isArray(items)) {
      for (const it of items) {
        const itemId = parseInt(it?.itemId);
        const qty = Number(it?.quantity);
        if (!itemId || Number.isNaN(itemId)) continue;
        if (!Number.isFinite(qty) || qty < 0) continue;
        cleanedItems.push({
          itemId,
          quantity: qty
        });
      }
    }
    if (invType !== "Transfer" && cleanedItems.length === 0) {
      return Response.json({
        error: "أضف صنف واحد على الأقل"
      }, {
        status: 400
      });
    }

    // Branch-visibility guard for non-Transfer edits. Transfer rows
    // have their own validation downstream and the items live at
    // either source or destination, not just operation.branch_id.
    if (invType !== "Transfer" && cleanedItems.length > 0) {
      const fail = await assertItemsEnabledAtBranch(operation.branch_id, cleanedItems.map(c => c.itemId));
      if (fail) return Response.json(fail.body, {
        status: fail.status
      });
    }

    // Validate operation_date in PUT before any DB writes
    let validatedOpDate = null;
    if (operationDate) {
      validatedOpDate = parseOperationDate(operationDate);
      if (!validatedOpDate) {
        return Response.json({
          error: "تاريخ العملية غير صالح (يجب أن يكون بين 2020 واليوم)"
        }, {
          status: 400
        });
      }
    }

    // Helper: update note + operation_date on a single inventory_operations row
    async function updateOperationRow(rowId, noteVal, dateVal) {
      const setClauses = [];
      const values = [];
      let idx = 1;
      if (noteVal !== undefined) {
        setClauses.push(`note = $${idx}`);
        values.push(noteVal || null);
        idx++;
      }
      if (dateVal) {
        // Pin the cast to Asia/Riyadh — the value here is a Riyadh
        // wall-clock string from the edit modal. Without the explicit
        // TZ the cast falls back to the session TZ and the saved
        // moment ends up offset by the difference.
        setClauses.push(`operation_date = $${idx}::timestamp AT TIME ZONE 'Asia/Riyadh'`);
        values.push(validatedOpDate || dateVal);
        idx++;
      }
      if (setClauses.length > 0) {
        values.push(rowId);
        const query = `UPDATE inventory_operations SET ${setClauses.join(", ")} WHERE id = $${idx}`;
        await sql(query, values);
      }
    }

    // Helper: replace inventory_items for a given operation
    async function replaceInventoryItems(opRowId, branchId, itemsList) {
      const snapshots = await getDefaultInventoryUnitSnapshots(itemsList.map(it => it.itemId));
      const statements = [sql`DELETE FROM inventory_items WHERE operation_id = ${opRowId}`];
      for (const it of itemsList) {
        const snap = snapshotForItem(snapshots, it.itemId);
        statements.push(sql`
          INSERT INTO inventory_items (
            operation_id, item_id, quantity, branch_id,
            unit_id, unit_name, unit_factor
          )
          VALUES (
            ${opRowId}, ${it.itemId}, ${it.quantity}, ${branchId},
            ${snap.unitId}, ${snap.unitName}, ${snap.unitFactor}
          )
        `);
      }
      await sql.transaction(statements);
    }

    // ── Handle Transfer operations ──
    //
    // Transfer edit is delta-based. Each (item) carries a `moved`
    // amount stored on both legs as transfer_quantity. The legs'
    // quantity fields hold post-transfer absolutes
    // (source-remainder + destination-total), so a quantity change
    // for one item must:
    //
    //   1. shift the OUT leg's stored absolute by -delta
    //   2. shift the IN  leg's stored absolute by +delta
    //   3. cascade the same shift through every later Transfer row
    //      at the source / destination branches (their stored
    //      absolutes baked in the old moved amount)
    //   4. update both legs' transfer_quantity to newMoved
    //
    // Adding or removing items via edit is intentionally NOT
    // supported — that path requires a delete + recreate so the
    // initial branch-availability and routing checks run cleanly.
    if (invType === "Transfer") {
      const paired = await sql`
        SELECT id, branch_id, transfer_branch_id, transfer_direction,
               COALESCE(operation_date, created_at) AS op_date
          FROM inventory_operations
         WHERE inventory_number = ${operation.inventory_number}
         ORDER BY id ASC
      `;
      const outLeg = paired.find(p => p.transfer_direction === "out") || paired[0];
      const inLeg = paired.find(p => p.transfer_direction === "in") || paired[1] || null;
      if (!outLeg || !inLeg) {
        return Response.json({
          error: "بنية التحويل غير مكتملة (ساق مفقودة)"
        }, {
          status: 500
        });
      }
      const sourceBranchId = outLeg.branch_id;
      const destBranchId = inLeg.branch_id;
      const opDate = outLeg.op_date;
      const pairedIds = [outLeg.id, inLeg.id];

      // If no `items` payload, fall back to metadata-only update.
      const itemsProvided = Array.isArray(cleanedItems) && cleanedItems.length > 0;
      if (itemsProvided) {
        const outItems = await sql`
          SELECT
            ii.item_id,
            (
              ii.quantity::numeric
                * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
            ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS quantity,
            (
              ii.transfer_quantity::numeric
                * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
            ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS transfer_quantity,
            COALESCE(iu.conversion_factor, 1)::numeric AS current_factor
          FROM inventory_items ii
          JOIN items i ON i.id = ii.item_id
          LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
          WHERE ii.operation_id = ${outLeg.id}
        `;
        const inItems = await sql`
          SELECT
            ii.item_id,
            (
              ii.quantity::numeric
                * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
            ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS quantity
          FROM inventory_items ii
          JOIN items i ON i.id = ii.item_id
          LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
          WHERE ii.operation_id = ${inLeg.id}
        `;
        const outMap = new Map(outItems.map(r => [Number(r.item_id), {
          qty: Number(r.quantity) || 0,
          moved: r.transfer_quantity === null || r.transfer_quantity === undefined ? null : Number(r.transfer_quantity),
          currentFactor: Number(r.current_factor) || 1
        }]));
        const inMap = new Map(inItems.map(r => [Number(r.item_id), Number(r.quantity) || 0]));

        // Build adjustments list and validate input shape.
        const adjustments = [];
        for (const it of cleanedItems) {
          const out = outMap.get(it.itemId);
          if (!out) {
            return Response.json({
              error: "إضافة أصناف جديدة عبر التعديل غير مدعومة — احذف التحويل وأنشئه من جديد",
              item_id: it.itemId
            }, {
              status: 400
            });
          }
          if (out.moved === null) {
            return Response.json({
              error: "كمية النقل الأصلية لأحد الأصناف غير معروفة — تعذّر التعديل",
              item_id: it.itemId
            }, {
              status: 409
            });
          }
          if (it.quantity <= 0) {
            return Response.json({
              error: "لإزالة صنف من التحويل احذف التحويل وأنشئه من جديد",
              item_id: it.itemId
            }, {
              status: 400
            });
          }
          const delta = it.quantity - out.moved;
          if (delta !== 0) {
            adjustments.push({
              item_id: it.itemId,
              newMoved: it.quantity,
              delta,
              currentFactor: out.currentFactor || 1,
              outQty: out.qty,
              inQty: inMap.get(it.itemId) || 0,
              outNewQty: out.qty - delta,
              inNewQty: (inMap.get(it.itemId) || 0) + delta
            });
          }
        }

        // Pre-flight: don't let an edit push any chain value negative.
        for (const adj of adjustments) {
          const {
            item_id,
            delta,
            outQty,
            inQty
          } = adj;

          // OUT leg new qty = outQty - delta. If delta > outQty, source
          // didn't have that many to transfer in the first place.
          if (outQty - delta < 0) {
            return Response.json({
              error: "الكمية الجديدة تتجاوز ما كان متاحاً في فرع المرسل وقت التحويل",
              item_id
            }, {
              status: 400
            });
          }

          // IN leg new qty = inQty + delta. Floor at 0.
          if (inQty + delta < 0) {
            return Response.json({
              error: "الكمية في فرع المستلم غير كافية للصنف",
              item_id
            }, {
              status: 400
            });
          }

          // Source cascade: when delta > 0 we subtract delta from
          // every subsequent Transfer row at the source. Reject if
          // any would go negative — user must shrink/delete those
          // later transfers first.
          if (delta > 0) {
            const currentFactor = Number(adj.currentFactor) || 1;
            const deltaBase = delta * currentFactor;
            const conflicts = await sql`
              SELECT io.inventory_number
                FROM inventory_items ii
                JOIN inventory_operations io ON io.id = ii.operation_id
               WHERE io.inventory_type = 'Transfer'
                 AND ii.item_id = ${item_id}
                 AND ii.branch_id = ${sourceBranchId}
                 AND io.id <> ALL(${pairedIds})
                 AND COALESCE(io.operation_date, io.created_at) > ${opDate}
                 AND ii.quantity < (
                   ${deltaBase}::numeric
                     / NULLIF(COALESCE(ii.unit_factor, ${currentFactor})::numeric, 0)
                 )
            `;
            if (conflicts.length > 0) {
              return Response.json({
                error: "لا يمكن التعديل: توجد تحويلات لاحقة في فرع المرسل ستصبح كميتها سالبة",
                dependent_transfers: Array.from(new Set(conflicts.map(c => c.inventory_number)))
              }, {
                status: 409
              });
            }
          }

          // Destination cascade: when delta < 0 we subtract |delta|
          // from every subsequent Transfer row at the destination.
          if (delta < 0) {
            const need = -delta;
            const currentFactor = Number(adj.currentFactor) || 1;
            const needBase = need * currentFactor;
            const conflicts = await sql`
              SELECT io.inventory_number
                FROM inventory_items ii
                JOIN inventory_operations io ON io.id = ii.operation_id
               WHERE io.inventory_type = 'Transfer'
                 AND ii.item_id = ${item_id}
                 AND ii.branch_id = ${destBranchId}
                 AND io.id <> ALL(${pairedIds})
                 AND COALESCE(io.operation_date, io.created_at) > ${opDate}
                 AND ii.quantity < (
                   ${needBase}::numeric
                     / NULLIF(COALESCE(ii.unit_factor, ${currentFactor})::numeric, 0)
                 )
            `;
            if (conflicts.length > 0) {
              return Response.json({
                error: "لا يمكن التعديل: توجد تحويلات لاحقة في فرع المستلم ستصبح كميتها سالبة",
                dependent_transfers: Array.from(new Set(conflicts.map(c => c.inventory_number)))
              }, {
                status: 409
              });
            }
          }
        }

        // Apply atomically: legs + cascade + transfer_quantity.
        if (adjustments.length > 0) {
          const snapshots = await getDefaultInventoryUnitSnapshots(adjustments.map(adj => adj.item_id));
          const stmts = [];
          for (const adj of adjustments) {
            const {
              item_id,
              newMoved,
              delta,
              outNewQty,
              inNewQty
            } = adj;
            const snap = snapshotForItem(snapshots, item_id);
            const currentFactor = Number(snap.unitFactor) || 1;
            const deltaBase = delta * currentFactor;
            stmts.push(sql`
              UPDATE inventory_items
                 SET quantity = ${outNewQty},
                     transfer_quantity = ${newMoved},
                     unit_id = ${snap.unitId},
                     unit_name = ${snap.unitName},
                     unit_factor = ${snap.unitFactor}
               WHERE operation_id = ${outLeg.id}
                 AND item_id = ${item_id}
            `);
            stmts.push(sql`
              UPDATE inventory_items
                 SET quantity = ${inNewQty},
                     transfer_quantity = ${newMoved},
                     unit_id = ${snap.unitId},
                     unit_name = ${snap.unitName},
                     unit_factor = ${snap.unitFactor}
               WHERE operation_id = ${inLeg.id}
                 AND item_id = ${item_id}
            `);
            stmts.push(sql`
              UPDATE inventory_items ii
                 SET quantity = quantity - (
                   ${deltaBase}::numeric
                     / NULLIF(COALESCE(ii.unit_factor, ${currentFactor})::numeric, 0)
                 )
                FROM inventory_operations io
               WHERE ii.operation_id = io.id
                 AND io.inventory_type = 'Transfer'
                 AND ii.item_id = ${item_id}
                 AND ii.branch_id = ${sourceBranchId}
                 AND io.id <> ALL(${pairedIds})
                 AND COALESCE(io.operation_date, io.created_at) > ${opDate}
            `);
            stmts.push(sql`
              UPDATE inventory_items ii
                 SET quantity = quantity + (
                   ${deltaBase}::numeric
                     / NULLIF(COALESCE(ii.unit_factor, ${currentFactor})::numeric, 0)
                 )
                FROM inventory_operations io
               WHERE ii.operation_id = io.id
                 AND io.inventory_type = 'Transfer'
                 AND ii.item_id = ${item_id}
                 AND ii.branch_id = ${destBranchId}
                 AND io.id <> ALL(${pairedIds})
                 AND COALESCE(io.operation_date, io.created_at) > ${opDate}
            `);
          }
          await sql.transaction(stmts);
        }
      }

      // Note + date metadata always applied to both legs (outside
      // the items transaction — these are idempotent and don't
      // touch chain state).
      for (const p of paired) {
        await updateOperationRow(p.id, note, operationDate);
      }
      return Response.json({
        ok: true,
        type: "transfer",
        operationId: opId
      });
    }

    // ── Handle Opening operations ──
    if (invType === "Opening") {
      await updateOperationRow(opId, note, operationDate);
      await replaceInventoryItems(opId, operation.branch_id, cleanedItems);

      // Also update the corresponding opening_session if it exists
      const sessions = await sql(`SELECT id FROM opening_sessions WHERE branch_id = $1 ORDER BY opened_at DESC LIMIT 5`, [operation.branch_id]);
      if (sessions.length > 0) {
        const sessionId = sessions[0].id;
        const sessionSetClauses = [];
        const sessionValues = [];
        let sIdx = 1;
        if (operationDate) {
          sessionSetClauses.push(`opened_at = $${sIdx}::timestamp`);
          sessionValues.push(validatedOpDate || operationDate);
          sIdx++;
        }
        if (note !== undefined) {
          sessionSetClauses.push(`note = $${sIdx}`);
          sessionValues.push(note || null);
          sIdx++;
        }
        if (sessionSetClauses.length > 0) {
          sessionValues.push(sessionId);
          const sessionQuery = `UPDATE opening_sessions SET ${sessionSetClauses.join(", ")} WHERE id = $${sIdx}`;
          await sql(sessionQuery, sessionValues);
        }

        // Replace session items with the same unit snapshots as the
        // inventory operation rows.
        const snapshots = await getDefaultInventoryUnitSnapshots(cleanedItems.map(it => it.itemId));
        const stmts = [sql`DELETE FROM opening_session_items WHERE session_id = ${sessionId}`];
        for (const it of cleanedItems) {
          const snap = snapshotForItem(snapshots, it.itemId);
          stmts.push(sql`
            INSERT INTO opening_session_items (
              session_id, item_id, quantity, unit_id, unit_name, unit_factor
            )
            VALUES (
              ${sessionId}, ${it.itemId}, ${it.quantity},
              ${snap.unitId}, ${snap.unitName}, ${snap.unitFactor}
            )
          `);
        }
        await sql.transaction(stmts);
      }
      return Response.json({
        ok: true,
        type: "opening",
        operationId: opId
      });
    }

    // ── Handle Daily / Weekly operations ──
    await updateOperationRow(opId, note, operationDate);
    await replaceInventoryItems(opId, operation.branch_id, cleanedItems);
    return Response.json({
      ok: true,
      type: invType.toLowerCase(),
      operationId: opId
    });
  } catch (error) {
    console.error("Error updating inventory operation:", error);
    return Response.json({
      error: "فشل تعديل العملية",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST, PUT };
