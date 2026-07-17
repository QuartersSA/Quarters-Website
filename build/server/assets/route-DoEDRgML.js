import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { n as notifyByPref } from './waNotify-Q_m-GyX2.js';
import { s as sendWhatsAppViaWasender } from './wasender-yto7m5av.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-CwZGtUC2.js';
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
let deductionImagesColumnEnsured = false;
async function ensureDeductionImagesColumn() {
  if (deductionImagesColumnEnsured) return;
  try {
    await sql`ALTER TABLE hr_employee_deductions ADD COLUMN IF NOT EXISTS images JSONB`;
    deductionImagesColumnEnsured = true;
  } catch (e) {
    console.error("ensureDeductionImagesColumn failed", e);
  }
}
function normalizeImagesInput(body) {
  // Accept either an `images` array (new) or single `image_*` fields (legacy).
  const raw = body?.images ?? body?.imageList ?? null;
  let arr = [];
  if (Array.isArray(raw)) {
    arr = raw.map(item => {
      if (!item || typeof item !== "object") return null;
      const url = item.url ?? item.image_url ?? null;
      if (!url) return null;
      const mimeType = item.mimeType ?? item.image_mime_type ?? null;
      const name = item.name ?? item.image_name ?? null;
      const sizeBytes = item.sizeBytes ?? item.size_bytes ?? item.image_size_bytes ?? null;
      const sizeNum = sizeBytes === null || sizeBytes === undefined || sizeBytes === "" ? null : safeNumber(sizeBytes);
      return {
        url: String(url),
        mimeType: mimeType ? String(mimeType) : null,
        name: name ? String(name) : null,
        sizeBytes: sizeNum
      };
    }).filter(Boolean);
  } else {
    const url = body?.image_url ?? body?.imageUrl ?? null;
    if (url) {
      const mimeType = body?.image_mime_type ?? body?.imageMimeType ?? null;
      const name = body?.image_name ?? body?.imageName ?? null;
      const sizeRaw = body?.image_size_bytes ?? body?.imageSizeBytes ?? body?.imageSize ?? null;
      const sizeNum = sizeRaw === null || sizeRaw === undefined || sizeRaw === "" ? null : safeNumber(sizeRaw);
      arr = [{
        url: String(url),
        mimeType: mimeType ? String(mimeType) : null,
        name: name ? String(name) : null,
        sizeBytes: sizeNum
      }];
    }
  }
  return arr;
}

// For GET responses: ensure rows expose `images` array even for legacy rows
// that only have the flat image_* fields populated.
function decorateRowImages(row) {
  if (!row) return row;
  let images = Array.isArray(row.images) ? row.images : null;
  if (!images && row.images && typeof row.images === "string") {
    try {
      const parsed = JSON.parse(row.images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      // ignore
    }
  }
  if ((!images || images.length === 0) && row.image_url) {
    images = [{
      url: row.image_url,
      mimeType: row.image_mime_type || null,
      name: row.image_name || null,
      sizeBytes: row.image_size_bytes === null || row.image_size_bytes === undefined ? null : Number(row.image_size_bytes)
    }];
  }
  return {
    ...row,
    images: images || []
  };
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
async function buildDeductionRowSelectSql(whereClause, params) {
  await ensureDeductionImagesColumn();
  // Keep this in one place so GET/POST can stay in sync
  const rows = await sql(`
      SELECT
        d.id,
        d.employee_id,
        COALESCE(NULLIF(e.display_name, ''), e.name) as employee_name,
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
        d.image_size_bytes,
        d.images
      FROM hr_employee_deductions d
      JOIN employees e ON e.id = d.employee_id
      ${whereClause}
    `, params);
  return rows.map(decorateRowImages);
}

// (أُزيلت notifyDeductionWhatsApp: إشعارات الخصومات صارت عبر تفضيل
// hr_deduction فقط — لا رسائل تلقائية للموظف المخصوم أو مدراء HR.)

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
    await ensureEmployeeDisplayNameSchema();
    const body = await request.json();
    const employeeIds = normalizeEmployeeIds(body);
    const violationDate = normalizeIsoDate(body.violation_date ?? body.violationDate);
    const category = body.violation_category ?? body.violationCategory;
    const reason = body.reason;
    const amount = safeNumber(body.amount);
    const images = normalizeImagesInput(body);
    const firstImage = images[0] || null;

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
    const imageUrlValue = firstImage?.url ?? null;
    const imageMimeTypeValue = firstImage?.mimeType ?? null;
    const imageNameValue = firstImage?.name ?? null;
    const imageSizeValue = firstImage?.sizeBytes === null || firstImage?.sizeBytes === undefined ? null : Number(firstImage.sizeBytes);
    const imagesJson = images.length > 0 ? JSON.stringify(images) : null;
    const uniqueEmployeeIds = Array.from(new Set(employeeIds));
    await ensureDeductionImagesColumn();
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
            image_size_bytes,
            images
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
            ${imageSizeValue},
            ${imagesJson}::jsonb
          )
          RETURNING id
        `));
    const newIds = insertResults.map(r => r?.[0]?.id).filter(v => safeInt(v));
    const rows = newIds.length ? await buildDeductionRowSelectSql(`WHERE d.id = ANY($1::int[]) ORDER BY d.violation_date DESC, d.created_at DESC, d.id DESC`, [newIds]) : [];

    // إشعارات واتساب الخصم بثلاث قنوات:
    //   1. الخاصم (مسجّل الخصم): رسالة تأكيد بما سجّله.
    //   2. المخصوم (كل موظف شمله الخصم): «تم تسجيل خصم عليك».
    //   3. مشتركو تفضيل «خصومات الموظفين»: ملخص إشرافي — مع استثناء
    //      الخاصم والمخصومين حتى لا تصلهم نسختان.
    // كلها «أطلق وانسَ» — لا تعطل حفظ الخصم.
    try {
      const dateValue = rows[0]?.violation_date ? String(rows[0].violation_date).slice(0, 10) : null;
      const reasonValue = rows[0]?.reason || null;
      const actorId = safeInt(auth.user?.id);
      const actorName = auth.user?.name ? String(auth.user.name) : null;
      const summaryLines = ["➖ خصم جديد", ...rows.slice(0, 15).map(row => `• ${row.employee_name || `#${row.employee_id}`}: ${row.amount ?? "-"} ريال`), rows.length > 15 ? `… والمزيد (${rows.length - 15})` : null, reasonValue ? `السبب: ${reasonValue}` : null, dateValue ? `التاريخ: ${dateValue}` : null, actorName ? `سجله: ${actorName}` : null].filter(Boolean);

      // أرقام الجوال للخاصم والمخصومين دفعة واحدة.
      const directIds = [...new Set([actorId, ...rows.map(row => safeInt(row.employee_id))].filter(Boolean))];
      const phoneRows = directIds.length ? await sql(`SELECT id, phone FROM employees
             WHERE id = ANY($1::int[])
               AND phone IS NOT NULL AND TRIM(phone) <> ''`, [directIds]) : [];
      const phoneById = new Map(phoneRows.map(row => [Number(row.id), row.phone]));

      // 1. الخاصم — تأكيد.
      const actorPhone = actorId ? phoneById.get(actorId) : null;
      if (actorPhone) {
        sendWhatsAppViaWasender({
          to: actorPhone,
          text: ["✅ تم تسجيل الخصم بنجاح", ...summaryLines.slice(1)].join("\n")
        }).catch(() => {});
      }

      // 2. المخصومون — رسالة شخصية لكل موظف شمله الخصم.
      for (const row of rows) {
        const empId = safeInt(row.employee_id);
        if (!empId || empId === actorId) continue;
        const phone = phoneById.get(empId);
        if (!phone) continue;
        const personal = ["➖ تم تسجيل خصم عليك", `المبلغ: ${row.amount ?? "-"} ريال`, reasonValue ? `السبب: ${reasonValue}` : null, dateValue ? `التاريخ: ${dateValue}` : null, actorName ? `سجله: ${actorName}` : null].filter(Boolean);
        sendWhatsAppViaWasender({
          to: phone,
          text: personal.join("\n")
        }).catch(() => {});
      }

      // 3. المشتركون — الملخص الإشرافي (باستثناء من استلم مباشرة).
      notifyByPref("hr_deduction", summaryLines.join("\n"), {
        excludeEmployeeIds: directIds
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
