import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import { s as sendWhatsAppViaWasender } from './wasender-Cn2_RTrC.js';
import '@neondatabase/serverless';
import 'crypto';

function safeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}
function safeInt(value) {
  const n = safeNumber(value);
  if (n === null) return null;
  const i = Math.trunc(n);
  if (!Number.isFinite(i)) return null;
  return i;
}
function normalizeIsoDate(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}
function parseMonthRange(raw) {
  const value = raw ? String(raw).trim() : "";
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  const monthStart = `${y}-${m}-01`;
  const next = new Date(Date.UTC(year, month, 1));
  const nextY = next.getUTCFullYear();
  const nextM = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextMonthStart = `${nextY}-${nextM}-01`;
  return {
    month: value,
    monthStart,
    nextMonthStart
  };
}
function normalizeEmployeeIds(body) {
  const raw = body?.employee_ids ?? body?.employeeIds;
  if (Array.isArray(raw)) {
    return raw.map(v => safeInt(v)).filter(v => Number.isFinite(v) && v > 0);
  }
  const single = safeInt(body?.employee_id ?? body?.employeeId);
  return single ? [single] : [];
}
function buildDeductionRowSelectSql(whereClause, params) {
  // Keep this in one place so GET/POST can stay in sync
  return sql(`
      SELECT
        d.id,
        d.employee_id,
        e.name as employee_name,
        d.violation_date,
        d.violation_category,
        d.reason,
        d.amount,
        d.source,
        d.created_by_employee_id,
        d.created_by_employee_name,
        d.created_at,
        d.image_url,
        d.image_mime_type,
        d.image_name,
        d.image_size_bytes
      FROM hr_employee_deductions d
      JOIN employees e ON e.id = d.employee_id
      ${whereClause}
    `, params);
}
async function notifyDeductionWhatsApp({
  createdRows,
  actorUser
}) {
  try {
    const rows = Array.isArray(createdRows) ? createdRows : [];
    if (rows.length === 0) {
      return {
        ok: true,
        skipped: true,
        reason: "no_rows"
      };
    }
    const dateValue = rows[0]?.violation_date ? String(rows[0].violation_date).slice(0, 10) : null;
    const categoryValue = rows[0]?.violation_category || null;
    const reasonValue = rows[0]?.reason || null;
    const createdByUsername = actorUser?.username ? String(actorUser.username) : null;
    const createdByName = actorUser?.name ? String(actorUser.name) : null;
    const source = createdByUsername || createdByName || null;
    const affectedIds = Array.from(new Set(rows.map(r => safeInt(r.employee_id)).filter(Boolean)));

    // HR recipients = everyone with HR permission
    const hrRecipients = await sql`
      SELECT id, name, phone
      FROM employees
      WHERE role = 'Admin'
        AND COALESCE(can_access_hr, false) = true
        AND phone IS NOT NULL
        AND TRIM(phone) <> ''
      ORDER BY id ASC
      LIMIT 25
    `;
    const affectedRecipients = affectedIds.length ? await sql(`
            SELECT id, name, phone
            FROM employees
            WHERE id = ANY($1::int[])
              AND phone IS NOT NULL
              AND TRIM(phone) <> ''
            ORDER BY id ASC
          `, [affectedIds]) : [];
    const recipientsMap = new Map();
    hrRecipients.forEach(r => recipientsMap.set(Number(r.id), {
      ...r,
      kind: "hr"
    }));
    affectedRecipients.forEach(r => {
      const id = Number(r.id);
      if (!recipientsMap.has(id)) {
        recipientsMap.set(id, {
          ...r,
          kind: "employee"
        });
      }
    });
    const recipients = Array.from(recipientsMap.values());
    if (recipients.length === 0) {
      return {
        ok: true,
        skipped: true,
        reason: "no_phones"
      };
    }
    const listLines = rows.slice(0, 10).map(r => {
      const empName = r.employee_name || `#${r.employee_id}`;
      const amount = r.amount;
      const amountText = amount === null || amount === undefined ? "" : ` (${amount})`;
      return `- ${empName}${amountText}`;
    });
    const moreCount = rows.length - listLines.length;
    const moreLine = moreCount > 0 ? `… والمزيد (${moreCount})` : null;
    const headerLines = ["خصم جديد", rows.length > 1 ? `عدد الموظفين: ${rows.length}` : null, dateValue ? `التاريخ: ${dateValue}` : null, categoryValue ? `التصنيف: ${categoryValue}` : null, source ? `المصدر: ${source}` : null].filter(Boolean);
    const hrText = [...headerLines, "الموظفين:", ...listLines, moreLine, reasonValue ? `السبب: ${reasonValue}` : null].filter(Boolean).join("\n").trim();
    const results = await Promise.all(recipients.map(async r => {
      const to = r.phone;
      if (!to) return {
        employeeId: r.id,
        ok: true,
        skipped: true
      };
      const isHr = r.kind === "hr";
      let text = hrText;
      if (!isHr) {
        // Employee-specific message (only for those who aren't HR)
        const row = rows.find(x => Number(x.employee_id) === Number(r.id));
        const amount = row?.amount;
        const amountText = amount === null || amount === undefined ? "-" : String(amount);
        const lines = ["تم تسجيل خصم عليك", dateValue ? `التاريخ: ${dateValue}` : null, categoryValue ? `التصنيف: ${categoryValue}` : null, `المبلغ: ${amountText}`, reasonValue ? `السبب: ${reasonValue}` : null].filter(Boolean);
        text = lines.join("\n").trim();
      }
      const res = await sendWhatsAppViaWasender({
        to,
        text
      });
      if (!res.ok) {
        console.error("Deduction WhatsApp notify failed", {
          employeeId: r.id,
          error: res.error,
          details: res.details
        });
      }
      return {
        employeeId: r.id,
        ok: res.ok
      };
    }));
    return {
      ok: true,
      results
    };
  } catch (error) {
    console.error("notifyDeductionWhatsApp error", error);
    return {
      ok: false,
      error: "notify_failed"
    };
  }
}
async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_access_hr"
    }, {
      role: "Admin",
      permission: "can_manage_deductions"
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
    const url = new URL(request.url);
    const employeeIdRaw = url.searchParams.get("employeeId");
    const employeeId = employeeIdRaw ? safeNumber(employeeIdRaw) : null;
    const monthRaw = url.searchParams.get("month");
    const monthRange = monthRaw ? parseMonthRange(monthRaw) : null;
    let where = "WHERE 1=1";
    const params = [];
    if (employeeId) {
      params.push(employeeId);
      where += ` AND d.employee_id = $${params.length}`;
    }
    if (monthRaw) {
      if (!monthRange) {
        return Response.json({
          error: "Invalid month"
        }, {
          status: 400
        });
      }
      params.push(monthRange.monthStart);
      where += ` AND d.violation_date >= $${params.length}`;
      params.push(monthRange.nextMonthStart);
      where += ` AND d.violation_date < $${params.length}`;
    }
    where += " ORDER BY d.violation_date DESC, d.created_at DESC, d.id DESC LIMIT 500";
    const rows = await buildDeductionRowSelectSql(where, params);
    return Response.json(rows);
  } catch (error) {
    console.error("HR: Error fetching deductions:", error);
    return Response.json({
      error: "Failed to fetch deductions"
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_access_hr"
    }, {
      role: "Admin",
      permission: "can_manage_deductions"
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
    const body = await request.json();
    const employeeIds = normalizeEmployeeIds(body);
    const violationDate = normalizeIsoDate(body.violation_date ?? body.violationDate);
    const category = body.violation_category ?? body.violationCategory;
    const reason = body.reason;
    const amount = safeNumber(body.amount);
    const imageUrl = body.image_url ?? body.imageUrl;
    const imageMimeType = body.image_mime_type ?? body.imageMimeType;
    const imageName = body.image_name ?? body.imageName;
    const imageSizeBytes = body.image_size_bytes ?? body.imageSizeBytes ?? body.imageSize;

    // IMPORTANT: source is fixed automatically (ignore any client-provided value)

    if (!employeeIds || employeeIds.length === 0) {
      return Response.json({
        error: "employee_id(s) is required"
      }, {
        status: 400
      });
    }
    if (!violationDate) {
      return Response.json({
        error: "violation_date is required"
      }, {
        status: 400
      });
    }
    if (amount === null || amount < 0) {
      return Response.json({
        error: "amount is required"
      }, {
        status: 400
      });
    }
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const createdByUsername = auth.user?.username ? String(auth.user.username) : null;

    // Prefer username (اسم المستخدم) then fallback to name
    const source = createdByUsername || createdByName || null;
    const categoryValue = category ? String(category) : null;
    const reasonValue = reason ? String(reason) : null;
    const imageUrlValue = imageUrl ? String(imageUrl) : null;
    const imageMimeTypeValue = imageMimeType ? String(imageMimeType) : null;
    const imageNameValue = imageName ? String(imageName) : null;
    const imageSizeValue = imageSizeBytes === null || imageSizeBytes === undefined || imageSizeBytes === "" ? null : safeNumber(imageSizeBytes);
    const uniqueEmployeeIds = Array.from(new Set(employeeIds));
    const insertResults = await sql.transaction(txn => uniqueEmployeeIds.map(empId => txn`
          INSERT INTO hr_employee_deductions (
            employee_id,
            violation_date,
            violation_category,
            reason,
            amount,
            source,
            created_by_employee_id,
            created_by_employee_name,
            image_url,
            image_mime_type,
            image_name,
            image_size_bytes
          )
          VALUES (
            ${empId},
            ${violationDate},
            ${categoryValue},
            ${reasonValue},
            ${amount},
            ${source},
            ${createdById},
            ${createdByName},
            ${imageUrlValue},
            ${imageMimeTypeValue},
            ${imageNameValue},
            ${imageSizeValue}
          )
          RETURNING id
        `));
    const newIds = insertResults.map(r => r?.[0]?.id).filter(v => safeInt(v));
    const rows = newIds.length ? await buildDeductionRowSelectSql(`WHERE d.id = ANY($1::int[]) ORDER BY d.violation_date DESC, d.created_at DESC, d.id DESC`, [newIds]) : [];

    // best-effort notifications (WhatsApp)
    try {
      await notifyDeductionWhatsApp({
        createdRows: rows,
        actorUser: auth.user
      });
    } catch (e) {
      console.error("Deduction notify failed", e);
    }
    if (uniqueEmployeeIds.length > 1) {
      return Response.json({
        ok: true,
        count: rows.length,
        rows
      });
    }
    return Response.json(rows[0] || null);
  } catch (error) {
    console.error("HR: Error creating deduction:", error);
    return Response.json({
      error: "Failed to create deduction",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
