import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { s as sendWhatsAppViaWasender } from './wasender-4ILI3THM.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-Ba9mYj5Z.js';
import '@neondatabase/serverless';
import 'crypto';

function safeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}
function safeNumericString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "") return null;
  // Accept simple decimal numbers only (keeps Postgres numeric math precise)
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return s;
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
function buildBonusRowSelectSql(whereClause, params) {
  return sql(`
      SELECT
        b.id,
        b.employee_id,
        COALESCE(NULLIF(e.display_name, ''), e.name) as employee_name,
        b.bonus_date,
        b.bonus_category,
        b.reason,

        -- IMPORTANT: for percent bonuses, compute amount from employee total salary
        -- so old rows (created before the fix) still display correctly.
        CASE
          WHEN b.amount_mode = 'percent' AND b.amount_percent IS NOT NULL THEN
            ROUND(
              (COALESCE(e.base_salary, 0) + COALESCE(e.other_allowances, 0))
              * b.amount_percent::numeric / 100,
              2
            )
          ELSE b.amount
        END AS amount,

        b.amount_mode,
        b.amount_percent,
        b.source,
        b.created_by_employee_id,
        b.created_by_employee_name,
        b.created_at,
        b.image_url,
        b.image_mime_type,
        b.image_name,
        b.image_size_bytes
      FROM hr_employee_bonuses b
      JOIN employees e ON e.id = b.employee_id
      ${whereClause}
    `, params);
}
async function notifyBonusWhatsApp({
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
    const dateValue = rows[0]?.bonus_date ? String(rows[0].bonus_date).slice(0, 10) : null;
    const categoryValue = rows[0]?.bonus_category || null;
    const reasonValue = rows[0]?.reason || null;
    const createdByUsername = actorUser?.username ? String(actorUser.username) : null;
    const createdByName = actorUser?.name ? String(actorUser.name) : null;
    const source = createdByUsername || createdByName || null;
    const affectedIds = Array.from(new Set(rows.map(r => safeInt(r.employee_id)).filter(Boolean)));

    // HR recipients = everyone with HR permission
    const hrRecipients = await sql`
      SELECT id, COALESCE(NULLIF(display_name, ''), name) AS name, phone
      FROM employees
      WHERE role = 'Admin'
        AND COALESCE(can_access_hr, false) = true
        AND phone IS NOT NULL
        AND TRIM(phone) <> ''
      ORDER BY id ASC
      LIMIT 25
    `;
    const affectedRecipients = affectedIds.length ? await sql(`
            SELECT id, COALESCE(NULLIF(display_name, ''), name) AS name, phone
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
    const headerLines = ["بونص جديد", rows.length > 1 ? `عدد الموظفين: ${rows.length}` : null, dateValue ? `التاريخ: ${dateValue}` : null, categoryValue ? `النوع: ${categoryValue}` : null, source ? `المصدر: ${source}` : null].filter(Boolean);
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
        const row = rows.find(x => Number(x.employee_id) === Number(r.id));
        const amount = row?.amount;
        const amountText = amount === null || amount === undefined ? "-" : String(amount);
        const lines = ["تم إضافة بونص لك", dateValue ? `التاريخ: ${dateValue}` : null, categoryValue ? `النوع: ${categoryValue}` : null, `المبلغ: ${amountText}`, reasonValue ? `السبب: ${reasonValue}` : null].filter(Boolean);
        text = lines.join("\n").trim();
      }
      const res = await sendWhatsAppViaWasender({
        to,
        text
      });
      if (!res.ok) {
        console.error("Bonus WhatsApp notify failed", {
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
    console.error("notifyBonusWhatsApp error", error);
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
    const url = new URL(request.url);
    const employeeIdRaw = url.searchParams.get("employeeId");
    const employeeId = employeeIdRaw ? safeNumber(employeeIdRaw) : null;
    const monthRaw = url.searchParams.get("month");
    const monthRange = monthRaw ? parseMonthRange(monthRaw) : null;
    let where = "WHERE 1=1";
    const params = [];
    if (employeeId) {
      params.push(employeeId);
      where += ` AND b.employee_id = $${params.length}`;
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
      where += ` AND b.bonus_date >= $${params.length}`;
      params.push(monthRange.nextMonthStart);
      where += ` AND b.bonus_date < $${params.length}`;
    }
    where += " ORDER BY b.bonus_date DESC, b.created_at DESC, b.id DESC LIMIT 500";
    const rows = await buildBonusRowSelectSql(where, params);
    return Response.json(rows);
  } catch (error) {
    console.error("HR: Error fetching bonuses:", error);
    return Response.json({
      error: "Failed to fetch bonuses"
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_accounting"
    }, {
      role: "Admin",
      permission: "can_access_hr"
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
    const body = await request.json();
    const employeeIds = normalizeEmployeeIds(body);

    // ✅ Month-based bonuses (Accounting -> Payroll)
    const monthRaw = body?.month ?? body?.payroll_month ?? body?.payrollMonth;
    const monthRange = monthRaw ? parseMonthRange(monthRaw) : null;
    const bonusDate = normalizeIsoDate(body.bonus_date ?? body.bonusDate ?? (monthRange ? monthRange.monthStart : null));
    const category = body.bonus_category ?? body.bonusCategory;
    const reason = body.reason;
    const amountFixedStr = safeNumericString(body.amount);
    const amountPercentStr = safeNumericString(body.amount_percent ?? body.amountPercent);
    const amountModeRaw = body.amount_mode ?? body.amountMode;
    const requestedMode = amountModeRaw ? String(amountModeRaw) : null;
    const imageUrl = body.image_url ?? body.imageUrl;
    const imageMimeType = body.image_mime_type ?? body.imageMimeType;
    const imageName = body.image_name ?? body.imageName;
    const imageSizeBytes = body.image_size_bytes ?? body.imageSizeBytes ?? body.imageSize;
    if (!employeeIds || employeeIds.length === 0) {
      return Response.json({
        error: "employee_id(s) is required"
      }, {
        status: 400
      });
    }
    if (!bonusDate) {
      return Response.json({
        error: "month or bonus_date is required"
      }, {
        status: 400
      });
    }
    const usingPercent = requestedMode === "percent" || amountFixedStr === null && amountPercentStr !== null;
    if (usingPercent) {
      const p = amountPercentStr === null ? null : Number(amountPercentStr);
      if (p === null || !Number.isFinite(p) || p < 0) {
        return Response.json({
          error: "amount_percent must be a valid number >= 0"
        }, {
          status: 400
        });
      }
    } else {
      const a = amountFixedStr === null ? null : Number(amountFixedStr);
      if (a === null || !Number.isFinite(a) || a < 0) {
        return Response.json({
          error: "amount is required"
        }, {
          status: 400
        });
      }
    }
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const createdByUsername = auth.user?.username ? String(auth.user.username) : null;
    const source = createdByUsername || createdByName || null;
    const categoryValue = category ? String(category) : null;
    const reasonValue = reason ? String(reason) : null;

    // image fields are kept for backwards compatibility, but UI no longer uses them
    const imageUrlValue = imageUrl ? String(imageUrl) : null;
    const imageMimeTypeValue = imageMimeType ? String(imageMimeType) : null;
    const imageNameValue = imageName ? String(imageName) : null;
    const imageSizeValue = imageSizeBytes === null || imageSizeBytes === undefined || imageSizeBytes === "" ? null : safeNumber(imageSizeBytes);
    const uniqueEmployeeIds = Array.from(new Set(employeeIds));

    // If percent mode: compute per employee based on TOTAL salary (base + allowances)
    // using Postgres numeric (accurate)
    let computedAmounts = null;
    if (usingPercent) {
      const percent = amountPercentStr; // keep as string for numeric math
      const rows = await sql(`
          SELECT
            id,
            ROUND(
              (COALESCE(base_salary, 0) + COALESCE(other_allowances, 0))
              * $2::numeric / 100,
              2
            ) AS amount
          FROM employees
          WHERE id = ANY($1::int[])
        `, [uniqueEmployeeIds, percent]);
      computedAmounts = new Map((rows || []).map(r => [Number(r.id), r.amount ?? 0]));
    }
    const insertResults = await sql.transaction(txn => uniqueEmployeeIds.map(empId => {
      const amountValue = usingPercent ? computedAmounts.get(Number(empId)) ?? 0 : amountFixedStr;
      return txn`
          INSERT INTO hr_employee_bonuses (
            employee_id,
            bonus_date,
            bonus_category,
            reason,
            amount,
            amount_mode,
            amount_percent,
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
            ${bonusDate},
            ${categoryValue},
            ${reasonValue},
            ${amountValue},
            ${usingPercent ? "percent" : "fixed"},
            ${usingPercent ? amountPercentStr : null},
            ${source},
            ${createdById},
            ${createdByName},
            ${imageUrlValue},
            ${imageMimeTypeValue},
            ${imageNameValue},
            ${imageSizeValue}
          )
          RETURNING id
        `;
    }));
    const newIds = insertResults.map(r => r?.[0]?.id).filter(v => safeInt(v));
    const rows = newIds.length ? await buildBonusRowSelectSql(`WHERE b.id = ANY($1::int[]) ORDER BY b.bonus_date DESC, b.created_at DESC, b.id DESC`, [newIds]) : [];
    try {
      await notifyBonusWhatsApp({
        createdRows: rows,
        actorUser: auth.user
      });
    } catch (e) {
      console.error("Bonus notify failed", e);
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
    console.error("HR: Error creating bonus:", error);
    return Response.json({
      error: "Failed to create bonus",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
