// inventory-operations: GET (list + detail) | POST (create) | DELETE (remove)
import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { sendWhatsAppViaWasender } from "@/app/api/utils/wasender";
import { assertItemsEnabledAtBranch } from "@/app/api/utils/branchVisibility";

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

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mn}:${ss}`;
}

// Idempotent schema migrations applied on every request.
// Postgres ALTER COLUMN to widen INTEGER → NUMERIC is non-blocking and preserves
// all existing data. Wrapped in try/catch so concurrent requests don't error.
async function ensureSchema() {
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
  // shift". Add an explicit column; old rows stay NULL and the UI
  // falls back to the existing display.
  try {
    await sql`
      ALTER TABLE inventory_items
        ADD COLUMN IF NOT EXISTS transfer_quantity NUMERIC(12, 3)
    `;
  } catch (e) {
    console.error("ensureSchema inventory_items.transfer_quantity:", e?.message);
  }
}

// WhatsApp notify to opted-in admins (never blocks saving)
async function notifyAdminsWhatsAppInventoryOperation({
  branchName,
  employeeName,
  inventoryType,
  inventoryNumber,
  operationId,
}) {
  try {
    const admins = await sql`
      SELECT id, name, phone
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
      return { ok: true, skipped: true, reason: "no_admin_phones" };
    }

    const lines = [
      "جرد جديد",
      branchName ? `الفرع: ${branchName}` : null,
      inventoryType ? `النوع: ${inventoryType}` : null,
      inventoryNumber ? `رقم الجرد: ${inventoryNumber}` : null,
      operationId ? `رقم العملية: #${operationId}` : null,
      employeeName ? `الموظف: ${employeeName}` : null,
    ].filter(Boolean);

    const text = lines.join("\n").trim();

    const results = await Promise.all(
      admins.map(async (a) => {
        const r = await sendWhatsAppViaWasender({ to: a.phone, text });
        if (!r.ok) {
          console.error("Inventory WhatsApp notify failed", {
            adminId: a.id,
            error: r.error,
            details: r.details,
          });
        }
        return { adminId: a.id, ok: r.ok };
      }),
    );

    return { ok: true, results };
  } catch (e) {
    console.error("notifyAdminsWhatsAppInventoryOperation error", e);
    return { ok: false, error: "notify_failed" };
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
    const itemNames = rows.map((r) => r.item_name).filter(Boolean);
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
      receipt_batch_id: batchId,
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
      receipt_batch_id: null,
    });
  }

  return result;
}

export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  await ensureSchema();

  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const operationId = searchParams.get("id");

    // ── Detail view for a batched receipt ──
    if (operationId && String(operationId).startsWith("batch-")) {
      const batchId = String(operationId).replace("batch-", "");

      const rows = await sql(
        `SELECT
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
          COALESCE(pr.created_by_employee_name, e.name) AS created_by_employee_name,
          pr.receipt_batch_id
        FROM purchase_receipts pr
        LEFT JOIN branches b ON b.id = pr.branch_id
        LEFT JOIN items    i ON i.id = pr.item_id
        LEFT JOIN employees e ON e.id = pr.created_by_employee_id
        WHERE pr.receipt_batch_id = $1
        ORDER BY i.name`,
        [batchId],
      );

      if (!rows || rows.length === 0) {
        return Response.json(
          { error: "سجل الوارد غير موجود" },
          { status: 404 },
        );
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
        items: rows.map((r) => ({
          id: r.id,
          item_id: r.item_id,
          quantity: Number(r.quantity),
          item_name: r.item_name,
          item_description: r.item_description,
        })),
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
          COALESCE(pr.created_by_employee_name, e.name) AS created_by_employee_name
        FROM purchase_receipts pr
        LEFT JOIN branches b ON b.id = pr.branch_id
        LEFT JOIN items    i ON i.id = pr.item_id
        LEFT JOIN employees e ON e.id = pr.created_by_employee_id
        WHERE pr.id = ${receiptId}
      `;

      if (!rcpt) {
        return Response.json(
          { error: "سجل الوارد غير موجود" },
          { status: 404 },
        );
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
        items: [
          {
            id: rcpt.id,
            item_id: rcpt.item_id,
            quantity: Number(rcpt.quantity),
            item_name: rcpt.item_name,
            item_description: rcpt.item_description,
          },
        ],
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
          e.name as employee_name,
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
        return Response.json(
          { error: "عملية الجرد غير موجودة" },
          { status: 404 },
        );
      }

      // For Transfer ops the UI wants the moved amount, not the
      // post-transfer absolute. New rows populate transfer_quantity at
      // creation time, but legacy rows are NULL — for those we compute
      // the moved amount on the fly via chain lookup:
      //   moved = |prev_balance_at(branch,item) - this_row.quantity|
      // prev_balance = most recent inventory_items qty for the same
      // (item, branch) strictly before this op's date, plus any
      // purchase_receipts between that prior row and this op.
      const items = await sql`
        SELECT
          ii.id,
          ii.item_id,
          ii.quantity,
          COALESCE(
            ii.transfer_quantity,
            CASE
              WHEN op.inventory_type = 'Transfer' THEN
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
                                      < COALESCE(op.operation_date, op.created_at)
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
                             < COALESCE(op.operation_date, op.created_at)
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
                             < COALESCE(op.operation_date, op.created_at)
                    )
                  ) - ii.quantity
                )
              ELSE NULL
            END
          ) AS transfer_quantity,
          i.name as item_name,
          i.description as item_description
        FROM inventory_items ii
        LEFT JOIN items i ON ii.item_id = i.id
        LEFT JOIN inventory_operations op ON op.id = ii.operation_id
        WHERE ii.operation_id = ${parseInt(operationId)}
        ORDER BY i.name
      `;

      return Response.json({
        ...operation,
        items,
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
          e.name as employee_name,
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
          e.name as employee_name,
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
          COALESCE(pr.created_by_employee_name, e.name) AS created_by_employee_name,
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
          COALESCE(pr.created_by_employee_name, e.name) AS created_by_employee_name,
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
    const merged = [...operations, ...receiptRows].sort(
      (a, b) =>
        new Date(b.operation_date || b.created_at) -
        new Date(a.operation_date || a.created_at),
    );

    return Response.json(merged);
  } catch (error) {
    console.error("Error fetching inventory operations:", error);
    return Response.json(
      { error: "Failed to fetch inventory operations" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_manage_inventory" },
      { role: "Employee", permission: "can_do_inventory" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const {
      branchId,
      employeeId,
      inventoryType,
      availableItems,
      unavailableItems,
      operationDate,
    } = body;

    const actingEmployeeId = auth.user?.id || employeeId || null;

    // Employees always use server time — only Admins may specify a custom date
    const isAdmin = auth.user?.role === "Admin";
    // Validate + normalize operation_date when admin supplies one
    let opDateValue = null;
    if (isAdmin && operationDate) {
      opDateValue = parseOperationDate(operationDate);
      if (!opDateValue) {
        return Response.json(
          { error: "تاريخ العملية غير صالح (يجب أن يكون بين 2020 واليوم)" },
          { status: 400 },
        );
      }
    }

    if (auth.user?.role === "Employee") {
      const allowed = Array.isArray(auth.user?.branchIds)
        ? auth.user.branchIds
        : [];
      const bIdNum = Number(branchId);
      if (!Number.isFinite(bIdNum) || !allowed.includes(bIdNum)) {
        return Response.json(
          { error: "لا تملك صلاحية على هذا الفرع" },
          { status: 403 },
        );
      }
    }

    if (!branchId) {
      return Response.json(
        { error: "معرف الفرع مطلوب", details: "branchId is required" },
        { status: 400 },
      );
    }

    if (!inventoryType) {
      return Response.json(
        { error: "نوع الجرد مطلوب", details: "inventoryType is required" },
        { status: 400 },
      );
    }

    // Branch-visibility guard: refuse counts for (item, branch) pairs the
    // admin has marked as disabled. Without this the row gets written to
    // inventory_items but the items API hides it via its disabled-pair
    // filter, so the count "succeeds" yet the stock never appears on
    // the items / stock-value pages — silent data loss.
    const requestedItemIds = [
      ...Object.keys(availableItems || {}).map(Number),
      ...(Array.isArray(unavailableItems) ? unavailableItems.map(Number) : []),
    ].filter((x) => Number.isFinite(x) && x > 0);
    if (requestedItemIds.length > 0) {
      const fail = await assertItemsEnabledAtBranch(branchId, requestedItemIds);
      if (fail) return Response.json(fail.body, { status: fail.status });
    }

    const inventoryNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Storage = real moment (NOW()).
    // For the user-supplied `opDateValue` we get a Riyadh wall-clock
    // string ("YYYY-MM-DD HH:MM:SS") from the picker. Cast it to a
    // timestamp and pin it to Asia/Riyadh so PG records the correct
    // moment, not whatever the session TZ happens to be. Display
    // (`formatDateTime`) reads the stored moment back in
    // `Asia/Riyadh` so the cell shows the user's wall-clock.
    const [operation] = await sql(
      `INSERT INTO inventory_operations (inventory_number, branch_id, employee_id, inventory_type, status, operation_date, created_at)
       VALUES (
         $1, $2, $3, $4, 'Completed',
         COALESCE($5::timestamp AT TIME ZONE 'Asia/Riyadh', NOW()),
         NOW()
       )
       RETURNING id, inventory_number, branch_id, employee_id, inventory_type, status, created_at, operation_date`,
      [
        inventoryNumber,
        branchId,
        actingEmployeeId || null,
        inventoryType,
        opDateValue,
      ],
    );

    if (availableItems && Object.keys(availableItems).length > 0) {
      for (const [itemId, qty] of Object.entries(availableItems)) {
        await sql`
          INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
          VALUES (${operation.id}, ${parseInt(itemId)}, ${qty}, ${branchId})
        `;
      }
    }

    if (unavailableItems && unavailableItems.length > 0) {
      for (const itemId of unavailableItems) {
        await sql`
          INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
          VALUES (${operation.id}, ${itemId}, 0, ${branchId})
        `;
      }
    }

    console.log("Inventory operation created successfully:", operation);

    const [branch] =
      await sql`SELECT id, name FROM branches WHERE id = ${Number(operation.branch_id)}`;
    const actingId = Number(operation.employee_id);
    let employeeName = "";
    if (Number.isFinite(actingId) && actingId > 0) {
      const [emp] =
        await sql`SELECT id, name FROM employees WHERE id = ${actingId}`;
      employeeName = emp?.name || "";
    }

    notifyAdminsWhatsAppInventoryOperation({
      branchName: branch?.name || "—",
      employeeName,
      inventoryType: operation?.inventory_type,
      inventoryNumber: operation?.inventory_number,
      operationId: operation?.id,
    }).catch((e) => console.error("notify admins whatsapp error", e));

    return Response.json(operation, { status: 201 });
  } catch (error) {
    console.error("Error creating inventory operation:", error);
    return Response.json(
      { error: "فشل في إنشاء عملية الجرد", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get("id");

    if (!operationId) {
      return Response.json({ error: "معرّف العملية مطلوب" }, { status: 400 });
    }

    // ── Delete a batched receipt ──
    if (String(operationId).startsWith("batch-")) {
      const batchId = String(operationId).replace("batch-", "");

      const existing = await sql(
        `SELECT id FROM purchase_receipts WHERE receipt_batch_id = $1`,
        [batchId],
      );

      if (!existing || existing.length === 0) {
        return Response.json(
          { error: "سجل الوارد غير موجود" },
          { status: 404 },
        );
      }

      await sql(`DELETE FROM purchase_receipts WHERE receipt_batch_id = $1`, [
        batchId,
      ]);

      return Response.json({
        ok: true,
        deleted: "receipt_batch",
        batchId,
        count: existing.length,
      });
    }

    // ── Delete a single purchase receipt (virtual Receipt operation) ──
    if (String(operationId).startsWith("rcpt-")) {
      const receiptId = parseInt(String(operationId).replace("rcpt-", ""));
      if (!Number.isFinite(receiptId) || receiptId <= 0) {
        return Response.json(
          { error: "معرّف الوارد غير صحيح" },
          { status: 400 },
        );
      }

      const [existing] = await sql`
        SELECT id FROM purchase_receipts WHERE id = ${receiptId}
      `;
      if (!existing) {
        return Response.json(
          { error: "سجل الوارد غير موجود" },
          { status: 404 },
        );
      }

      await sql`DELETE FROM purchase_receipts WHERE id = ${receiptId}`;

      return Response.json({
        ok: true,
        deleted: "receipt",
        id: receiptId,
      });
    }

    // ── Delete a real inventory operation (Daily / Weekly / Transfer) ──
    const opId = parseInt(operationId);
    if (!Number.isFinite(opId) || opId <= 0) {
      return Response.json({ error: "معرّف العملية غير صحيح" }, { status: 400 });
    }

    const [operation] = await sql`
      SELECT id, inventory_number, inventory_type, transfer_direction
      FROM inventory_operations
      WHERE id = ${opId}
    `;

    if (!operation) {
      return Response.json(
        { error: "عملية الجرد غير موجودة" },
        { status: 404 },
      );
    }

    // For Transfer operations, delete BOTH paired operations (out + in share same inventory_number)
    if (operation.inventory_type === "Transfer") {
      const paired = await sql`
        SELECT id FROM inventory_operations
        WHERE inventory_number = ${operation.inventory_number}
      `;

      const pairedIds = paired.map((r) => r.id);

      // inventory_items rows are deleted automatically via ON DELETE CASCADE
      for (const pid of pairedIds) {
        await sql`DELETE FROM inventory_operations WHERE id = ${pid}`;
      }

      return Response.json({
        ok: true,
        deleted: "transfer",
        ids: pairedIds,
        inventory_number: operation.inventory_number,
      });
    }

    // For Opening operations, also delete the corresponding opening_sessions record
    if (operation.inventory_type === "Opening") {
      // Find the branch and date from the operation
      const [opFull] = await sql`
        SELECT branch_id, COALESCE(operation_date, created_at)::date as op_date
        FROM inventory_operations WHERE id = ${opId}
      `;

      if (opFull) {
        // Delete matching opening_session (same branch + date)
        await sql(
          `DELETE FROM opening_sessions WHERE branch_id = $1 AND opened_at::date = $2`,
          [opFull.branch_id, opFull.op_date],
        );
      }

      await sql`DELETE FROM inventory_operations WHERE id = ${opId}`;

      return Response.json({
        ok: true,
        deleted: "opening",
        id: opId,
        inventory_type: operation.inventory_type,
      });
    }

    // For Daily / Weekly: just delete the operation (CASCADE deletes inventory_items)
    await sql`DELETE FROM inventory_operations WHERE id = ${opId}`;

    return Response.json({
      ok: true,
      deleted: "operation",
      id: opId,
      inventory_type: operation.inventory_type,
    });
  } catch (error) {
    console.error("Error deleting inventory operation:", error);
    return Response.json(
      { error: "فشل في حذف العملية", details: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { operationId, note, operationDate, items } = body;

    if (!operationId) {
      return Response.json({ error: "معرّف العملية مطلوب" }, { status: 400 });
    }

    const opId = parseInt(operationId);
    if (!Number.isFinite(opId) || opId <= 0) {
      return Response.json({ error: "معرّف العملية غير صحيح" }, { status: 400 });
    }

    // Look up the existing operation
    const [operation] = await sql`
      SELECT id, inventory_number, inventory_type, branch_id, transfer_branch_id, transfer_direction
      FROM inventory_operations
      WHERE id = ${opId}
    `;

    if (!operation) {
      return Response.json({ error: "العملية غير موجودة" }, { status: 404 });
    }

    const invType = operation.inventory_type;

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "أضف صنف واحد على الأقل" },
        { status: 400 },
      );
    }

    const cleanedItems = [];
    for (const it of items) {
      const itemId = parseInt(it?.itemId);
      const qty = Number(it?.quantity);
      if (!itemId || Number.isNaN(itemId)) continue;
      if (!Number.isFinite(qty) || qty < 0) continue;
      cleanedItems.push({ itemId, quantity: qty });
    }

    if (cleanedItems.length === 0) {
      return Response.json({ error: "لا توجد أصناف صالحة" }, { status: 400 });
    }

    // Branch-visibility guard — same protection as POST.
    // For Transfer rows we already rejected `items` edits earlier, but
    // Daily/Weekly/Opening edits flow through here and would otherwise
    // be able to add quantities for items disabled at the operation's
    // branch, silently dropping them from current-stock math.
    {
      const fail = await assertItemsEnabledAtBranch(
        operation.branch_id,
        cleanedItems.map((c) => c.itemId),
      );
      if (fail) return Response.json(fail.body, { status: fail.status });
    }

    // Validate operation_date in PUT before any DB writes
    let validatedOpDate = null;
    if (operationDate) {
      validatedOpDate = parseOperationDate(operationDate);
      if (!validatedOpDate) {
        return Response.json(
          { error: "تاريخ العملية غير صالح (يجب أن يكون بين 2020 واليوم)" },
          { status: 400 },
        );
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
        setClauses.push(
          `operation_date = $${idx}::timestamp AT TIME ZONE 'Asia/Riyadh'`,
        );
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
      await sql(`DELETE FROM inventory_items WHERE operation_id = $1`, [
        opRowId,
      ]);
      for (const it of itemsList) {
        await sql(
          `INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
           VALUES ($1, $2, $3, $4)`,
          [opRowId, it.itemId, it.quantity, branchId],
        );
      }
    }

    // ── Handle Transfer operations ──
    if (invType === "Transfer") {
      // Editing transfer *item quantities* is unsafe: the two legs store
      // post-transfer absolutes (source-remainder vs. destination-total)
      // and replacing both with the same list silently corrupts stock at
      // one side. Until the schema carries the transfer amount as a
      // single source of truth, allow only metadata edits (note +
      // operation_date) — apply them to both paired rows.
      const itemsProvided =
        Array.isArray(cleanedItems) && cleanedItems.length > 0;

      if (itemsProvided) {
        return Response.json(
          {
            error:
              "تعديل كميات أصناف التحويل غير مدعوم. للتغيير، احذف التحويل ثم أنشئه من جديد.",
          },
          { status: 400 },
        );
      }

      const paired = await sql`
        SELECT id, branch_id, transfer_direction
        FROM inventory_operations
        WHERE inventory_number = ${operation.inventory_number}
        ORDER BY id ASC
      `;

      for (const p of paired) {
        await updateOperationRow(p.id, note, operationDate);
      }

      return Response.json({ ok: true, type: "transfer", operationId: opId });
    }

    // ── Handle Opening operations ──
    if (invType === "Opening") {
      await updateOperationRow(opId, note, operationDate);
      await replaceInventoryItems(opId, operation.branch_id, cleanedItems);

      // Also update the corresponding opening_session if it exists
      const sessions = await sql(
        `SELECT id FROM opening_sessions WHERE branch_id = $1 ORDER BY opened_at DESC LIMIT 5`,
        [operation.branch_id],
      );

      if (sessions.length > 0) {
        const sessionId = sessions[0].id;

        const sessionSetClauses = [];
        const sessionValues = [];
        let sIdx = 1;

        if (operationDate) {
          sessionSetClauses.push(`opened_at = $${sIdx}::timestamp`);
          sessionValues.push(operationDate);
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

        // Replace session items
        await sql(`DELETE FROM opening_session_items WHERE session_id = $1`, [
          sessionId,
        ]);

        for (const it of cleanedItems) {
          await sql(
            `INSERT INTO opening_session_items (session_id, item_id, quantity) VALUES ($1, $2, $3)`,
            [sessionId, it.itemId, it.quantity],
          );
        }
      }

      return Response.json({ ok: true, type: "opening", operationId: opId });
    }

    // ── Handle Daily / Weekly operations ──
    await updateOperationRow(opId, note, operationDate);
    await replaceInventoryItems(opId, operation.branch_id, cleanedItems);

    return Response.json({
      ok: true,
      type: invType.toLowerCase(),
      operationId: opId,
    });
  } catch (error) {
    console.error("Error updating inventory operation:", error);
    return Response.json(
      { error: "فشل تعديل العملية", details: error.message },
      { status: 500 },
    );
  }
}
