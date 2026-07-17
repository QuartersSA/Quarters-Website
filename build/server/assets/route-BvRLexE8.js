import { s as sql } from './sql-BfhTxwII.js';
import { g as getSearchParams } from './_utils-CbLHH82L.js';
import { s as sendWhatsAppViaWasender } from './wasender-CtjKFWCW.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-Ba9mYj5Z.js';
import '@neondatabase/serverless';
import 'crypto';

/**
 * Idempotent guard: ensure the (branch_id, shift_date, shift_label) combo
 * is unique, so two concurrent submissions for the same shift can't both
 * land. Run before every POST — `IF NOT EXISTS` makes this cheap.
 *
 * Why partial: a unique row in the table represents "this shift was
 * closed". `employee_id` deliberately NOT in the key — we don't want
 * two cashiers both closing the same shift; only the first wins.
 */
let _ensureShiftIdxAttempted = false;
async function ensureShiftClosingsUniqueIndex() {
  if (_ensureShiftIdxAttempted) return;
  _ensureShiftIdxAttempted = true;
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS
        accounting_shift_closings_unique_shift_idx
      ON accounting_shift_closings (branch_id, shift_date, shift_label)
    `;
  } catch (err) {
    // If the table already has duplicate rows from before this guard, the
    // CREATE UNIQUE INDEX will fail. Log and move on — better to ship the
    // POST-side dup check than to block all writes.
    console.error("ensureShiftClosingsUniqueIndex failed (probably existing duplicates):", err?.message);
  }
}
function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}
function toMoneyNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
function diffLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "متطابق";
  if (n < 0) return "عجز";
  return "زيادة";
}
function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
async function notifyAdminsWhatsApp({
  branchName,
  employeeName,
  shiftDate,
  shiftLabel,
  actualCash,
  actualCard,
  foodicsCash,
  foodicsCard,
  note
}) {
  try {
    const admins = await sql`
      SELECT id, COALESCE(NULLIF(display_name, ''), name) AS name, phone
      FROM employees
      WHERE role = 'Admin'
        AND COALESCE(can_manage_accounting, false) = true
        AND COALESCE(notify_shift_close_wa, false) = true
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
    const cashDiff = Number(actualCash) - Number(foodicsCash);
    const cardDiff = Number(actualCard) - Number(foodicsCard);
    const totalDiff = cashDiff + cardDiff;
    const lines = ["تقفيلة شفت (محاسبة)", `الفرع: ${branchName || "—"}`, `التاريخ: ${shiftDate || "—"}`, shiftLabel ? `الشفت: ${shiftLabel}` : null, `الكاش الفعلي: ${formatMoney(actualCash)}`, `الشبكة الفعلية: ${formatMoney(actualCard)}`, `كاش فودكس: ${formatMoney(foodicsCash)}`, `شبكة فودكس: ${formatMoney(foodicsCard)}`, `فرق الكاش: ${formatMoney(cashDiff)} (${diffLabel(cashDiff)})`, `فرق الشبكة: ${formatMoney(cardDiff)} (${diffLabel(cardDiff)})`, `الإجمالي: ${formatMoney(totalDiff)} (${diffLabel(totalDiff)})`, employeeName ? `الموظف: ${employeeName}` : null, note ? `ملاحظة: ${String(note).trim()}` : null].filter(Boolean);
    const text = lines.join("\n").trim();
    const results = await Promise.all(admins.map(async a => {
      const r = await sendWhatsAppViaWasender({
        to: a.phone,
        text
      });
      if (!r.ok) {
        console.error("Admin WhatsApp notify failed", {
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
    console.error("notifyAdminsWhatsApp error", e);
    return {
      ok: false,
      error: "notify_failed"
    };
  }
}

// GET /api/accounting/shift-closings?branchId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureEmployeeDisplayNameSchema();
    const params = getSearchParams(request);
    const branchIdRaw = params.get("branchId");
    const from = params.get("from");
    const to = params.get("to");
    const branchId = toInt(branchIdRaw);
    const values = [];
    let idx = 1;
    let where = "WHERE 1=1";
    if (branchId) {
      where += ` AND sc.branch_id = $${idx}`;
      values.push(branchId);
      idx += 1;
    }
    if (from) {
      where += ` AND sc.shift_date >= $${idx}`;
      values.push(from);
      idx += 1;
    }
    if (to) {
      where += ` AND sc.shift_date <= $${idx}`;
      values.push(to);
      idx += 1;
    }
    const query = `
      SELECT
        sc.id,
        sc.branch_id,
        b.name AS branch_name,
        sc.employee_id,
        COALESCE(NULLIF(e.display_name, ''), e.name, '') AS employee_name,
        sc.shift_date,
        sc.shift_label,
        sc.actual_cash,
        sc.actual_card,
        sc.foodics_cash,
        sc.foodics_card,
        sc.note,
        sc.created_at
      FROM accounting_shift_closings sc
      JOIN branches b ON b.id = sc.branch_id
      LEFT JOIN employees e ON e.id = sc.employee_id
      ${where}
      ORDER BY sc.shift_date DESC, sc.created_at DESC
      LIMIT 250
    `;
    const rows = await sql(query, values);
    const closings = (rows || []).map(r => {
      const cashDiff = Number(r.actual_cash) - Number(r.foodics_cash);
      const cardDiff = Number(r.actual_card) - Number(r.foodics_card);
      const totalDiff = cashDiff + cardDiff;
      return {
        ...r,
        cash_diff: cashDiff,
        card_diff: cardDiff,
        total_diff: totalDiff
      };
    });
    return Response.json({
      closings
    });
  } catch (error) {
    console.error("shift closings GET error", error);
    return Response.json({
      error: "فشل تحميل تقفيلات الشفت"
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/shift-closings
// body: { branchId, shiftDate, shiftLabel, actualCash, actualCard, foodicsCash, foodicsCard, note }
async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Employee",
      permission: "can_close_shift"
    }, {
      role: "Admin",
      permission: "can_manage_accounting"
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
    await ensureEmployeeDisplayNameSchema();
    const body = await request.json().catch(() => ({}));
    const employeeId = toInt(auth.user?.id);
    if (!employeeId) {
      return Response.json({
        error: "Unauthorized"
      }, {
        status: 401
      });
    }
    const branchId = toInt(body.branchId);
    if (!branchId) {
      return Response.json({
        error: "معرّف الفرع مطلوب"
      }, {
        status: 400
      });
    }

    // Employee must be limited to their allowed branches
    if (auth.user?.role === "Employee") {
      const allowed = Array.isArray(auth.user?.branchIds) ? auth.user.branchIds : [];
      if (!allowed.includes(branchId)) {
        return Response.json({
          error: "لا تملك صلاحية على هذا الفرع"
        }, {
          status: 403
        });
      }
    }
    const shiftDate = body.shiftDate ? String(body.shiftDate).slice(0, 10) : "";
    if (!shiftDate || shiftDate.length !== 10) {
      return Response.json({
        error: "التاريخ مطلوب"
      }, {
        status: 400
      });
    }
    const shiftLabelRaw = body.shiftLabel;
    const shiftLabel = shiftLabelRaw ? String(shiftLabelRaw).trim() : null;
    const actualCash = toMoneyNumber(body.actualCash);
    const actualCard = toMoneyNumber(body.actualCard);
    const foodicsCash = toMoneyNumber(body.foodicsCash);
    const foodicsCard = toMoneyNumber(body.foodicsCard);
    if (actualCash === null || actualCard === null || foodicsCash === null || foodicsCard === null) {
      return Response.json({
        error: "الرجاء إدخال جميع المبالغ بشكل صحيح"
      }, {
        status: 400
      });
    }
    if (actualCash < 0 || actualCard < 0 || foodicsCash < 0 || foodicsCard < 0) {
      return Response.json({
        error: "المبالغ يجب أن تكون 0 أو أكثر"
      }, {
        status: 400
      });
    }
    const noteRaw = body.note;
    const note = noteRaw ? String(noteRaw).trim() : null;
    const [branch] = await sql`SELECT id, name FROM branches WHERE id = ${branchId}`;
    await ensureShiftClosingsUniqueIndex();
    let row;
    try {
      [row] = await sql`
        INSERT INTO accounting_shift_closings (
          branch_id,
          employee_id,
          shift_date,
          shift_label,
          actual_cash,
          actual_card,
          foodics_cash,
          foodics_card,
          note
        )
        VALUES (
          ${branchId},
          ${employeeId},
          ${shiftDate},
          ${shiftLabel},
          ${actualCash},
          ${actualCard},
          ${foodicsCash},
          ${foodicsCard},
          ${note}
        )
        RETURNING *
      `;
    } catch (err) {
      // Postgres unique_violation
      if (String(err?.code) === "23505") {
        return Response.json({
          error: "هذا الشفت تم إقفاله مسبقاً (نفس الفرع/التاريخ/الفترة). راجع الأرشيف."
        }, {
          status: 409
        });
      }
      throw err;
    }
    const cashDiff = Number(row.actual_cash) - Number(row.foodics_cash);
    const cardDiff = Number(row.actual_card) - Number(row.foodics_card);
    const totalDiff = cashDiff + cardDiff;

    // Best-effort WhatsApp notify to admins (never blocks saving)
    notifyAdminsWhatsApp({
      branchName: branch?.name || "—",
      employeeName: auth.user?.name || "",
      shiftDate,
      shiftLabel,
      actualCash: row.actual_cash,
      actualCard: row.actual_card,
      foodicsCash: row.foodics_cash,
      foodicsCard: row.foodics_card,
      note
    }).catch(e => console.error("notify admins error", e));
    return Response.json({
      closing: {
        ...row,
        branch_name: branch?.name || "",
        employee_name: auth.user?.name || "",
        cash_diff: cashDiff,
        card_diff: cardDiff,
        total_diff: totalDiff
      }
    }, {
      status: 201
    });
  } catch (error) {
    console.error("shift closings POST error", error);
    return Response.json({
      error: "فشل حفظ تقفيلة الشفت"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
