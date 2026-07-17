import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { a as ensureScheduledReportsSchema, b as buildPurchasesSummaryText } from './purchaseAutomation-Bqlf9yop.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { s as sendWhatsAppViaWasender, n as normalizeWasenderPhone } from './wasender-D4_drgkO.js';
import '@neondatabase/serverless';
import 'crypto';
import './waNotify-MFx8ACW-.js';

const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};
const FREQUENCIES = new Set(["weekly", "monthly"]);
function parsePayload(body = {}) {
  const frequency = String(body.frequency || "monthly").trim();
  return {
    title: body.title ? String(body.title).trim() : "",
    frequency: FREQUENCIES.has(frequency) ? frequency : "monthly",
    phone: body.phone ? String(body.phone).trim() : "",
    isActive: body.is_active !== false
  };
}
function validatePayload(payload) {
  if (!payload.title) return "اسم التقرير مطلوب";
  if (!normalizeWasenderPhone(payload.phone)) {
    return "رقم واتساب غير صالح — مثال: 05xxxxxxxx";
  }
  return null;
}
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureScheduledReportsSchema();
    const rows = await sql`
      SELECT id, title, frequency, phone, is_active,
             last_sent_key,
             TO_CHAR(last_sent_at, 'YYYY-MM-DD HH24:MI') AS last_sent_at
      FROM accounting_scheduled_purchase_reports
      ORDER BY is_active DESC, id DESC
    `;
    return Response.json({
      schedules: rows,
      whatsappConfigured: !!process.env.WASENDER_API_KEY
    });
  } catch (error) {
    console.error("scheduled purchase reports GET error", error);
    return Response.json({
      error: "فشل تحميل التقارير المجدولة",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureScheduledReportsSchema();
    const body = await request.json().catch(() => ({}));

    // «أرسل الآن» — اختبار فوري للجدولة بملخص آخر 30 يوماً.
    if (body.action === "send-now") {
      const id = Number(body.id);
      const [schedule] = await sql`
        SELECT * FROM accounting_scheduled_purchase_reports
        WHERE id = ${id}
      `;
      if (!schedule) {
        return Response.json({
          error: "الجدولة غير موجودة"
        }, {
          status: 404
        });
      }
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Riyadh"
      });
      const start = new Date(`${today}T12:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 29);
      const text = await buildPurchasesSummaryText({
        title: `${schedule.title} — ملخص آخر 30 يوماً (إرسال يدوي)`,
        from: start.toISOString().slice(0, 10),
        to: today
      });
      const result = await sendWhatsAppViaWasender({
        to: schedule.phone,
        text
      });
      if (!result.ok) {
        return Response.json({
          error: `فشل الإرسال: ${result.error}`
        }, {
          status: 502
        });
      }
      await logPurchaseAudit({
        entityType: "report",
        entityId: id,
        action: "manual_send",
        summary: `إرسال يدوي للتقرير المجدول «${schedule.title}» إلى واتساب`,
        actor: auth.user
      });
      return Response.json({
        ok: true,
        sent: true
      });
    }
    const payload = parsePayload(body);
    const validationError = validatePayload(payload);
    if (validationError) {
      return Response.json({
        error: validationError
      }, {
        status: 400
      });
    }
    const [created] = await sql`
      INSERT INTO accounting_scheduled_purchase_reports (
        title, frequency, phone, is_active,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${payload.title}, ${payload.frequency}, ${payload.phone},
        ${payload.isActive},
        ${auth.user?.id ? Number(auth.user.id) : null},
        ${auth.user?.name ? String(auth.user.name) : null}
      )
      RETURNING *
    `;
    await logPurchaseAudit({
      entityType: "report",
      entityId: created.id,
      action: "created",
      summary: `جدولة تقرير «${payload.title}» (${payload.frequency === "weekly" ? "أسبوعي" : "شهري"}) إلى واتساب`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      schedule: created
    }, {
      status: 201
    });
  } catch (error) {
    console.error("scheduled purchase reports POST error", error);
    return Response.json({
      error: "فشل حفظ الجدولة",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function PUT(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureScheduledReportsSchema();
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف الجدولة غير صحيح"
      }, {
        status: 400
      });
    }
    const payload = parsePayload(body);
    const validationError = validatePayload(payload);
    if (validationError) {
      return Response.json({
        error: validationError
      }, {
        status: 400
      });
    }
    const [updated] = await sql`
      UPDATE accounting_scheduled_purchase_reports
      SET title = ${payload.title},
          frequency = ${payload.frequency},
          phone = ${payload.phone},
          is_active = ${payload.isActive}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated) {
      return Response.json({
        error: "الجدولة غير موجودة"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      schedule: updated
    });
  } catch (error) {
    console.error("scheduled purchase reports PUT error", error);
    return Response.json({
      error: "فشل تعديل الجدولة",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureScheduledReportsSchema();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف الجدولة غير صحيح"
      }, {
        status: 400
      });
    }
    const [deleted] = await sql`
      DELETE FROM accounting_scheduled_purchase_reports
      WHERE id = ${id}
      RETURNING id, title
    `;
    if (!deleted) {
      return Response.json({
        error: "الجدولة غير موجودة"
      }, {
        status: 404
      });
    }
    await logPurchaseAudit({
      entityType: "report",
      entityId: id,
      action: "deleted",
      summary: `حذف التقرير المجدول «${deleted.title}»`,
      actor: auth.user
    });
    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("scheduled purchase reports DELETE error", error);
    return Response.json({
      error: "فشل حذف الجدولة",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST, PUT };
