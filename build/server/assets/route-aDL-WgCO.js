import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DX8U_Szq.js';
import { n as normalizeWasenderPhone, s as sendWhatsAppViaWasender } from './wasender-4ILI3THM.js';
import '@neondatabase/serverless';
import 'crypto';

const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};
function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Riyadh"
  });
}

// تذكير سداد يدوي من مركز الإشعارات: يرسل واتساب بقائمة المتأخرات
// والمستحقات خلال 7 أيام إلى الرقم المُدخل.
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
    const body = await request.json().catch(() => ({}));
    const phone = body.phone ? String(body.phone).trim() : "";
    if (!normalizeWasenderPhone(phone)) {
      return Response.json({
        error: "رقم واتساب غير صالح — مثال: 05xxxxxxxx"
      }, {
        status: 400
      });
    }
    if (!process.env.WASENDER_API_KEY) {
      return Response.json({
        error: "خدمة واتساب غير مفعلة على الخادم (WASENDER_API_KEY)"
      }, {
        status: 503
      });
    }
    const today = todayRiyadh();
    const rows = await sql`
      SELECT inv.invoice_number,
             COALESCE(NULLIF(inv.supplier_name, ''), c.name, 'بدون مورد') AS supplier,
             TO_CHAR(inv.due_date, 'YYYY-MM-DD') AS due_date,
             GREATEST(inv.total_amount - inv.paid_amount, 0) AS balance,
             (inv.due_date < ${today}::date) AS is_overdue
      FROM accounting_purchase_invoices inv
      LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
      WHERE inv.is_active = TRUE
        AND inv.paid_amount < inv.total_amount
        AND inv.due_date IS NOT NULL
        AND inv.due_date <= (${today}::date + INTERVAL '7 days')
      ORDER BY inv.due_date ASC
      LIMIT 30
    `;
    if (rows.length === 0) {
      return Response.json({
        error: "لا توجد فواتير متأخرة أو مستحقة خلال 7 أيام"
      }, {
        status: 400
      });
    }
    const money = value => Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const overdue = rows.filter(row => row.is_overdue);
    const dueSoon = rows.filter(row => !row.is_overdue);
    const lines = ["🔔 تذكير سداد — مشتريات كوارترز", ""];
    if (overdue.length > 0) {
      lines.push(`⚠️ متأخرة (${overdue.length}):`);
      for (const row of overdue) {
        lines.push(`• ${row.invoice_number} — ${row.supplier} — ${money(row.balance)} SAR (استحقاق ${row.due_date})`);
      }
      lines.push("");
    }
    if (dueSoon.length > 0) {
      lines.push(`⏳ تستحق خلال 7 أيام (${dueSoon.length}):`);
      for (const row of dueSoon) {
        lines.push(`• ${row.invoice_number} — ${row.supplier} — ${money(row.balance)} SAR (استحقاق ${row.due_date})`);
      }
      lines.push("");
    }
    const totalBalance = rows.reduce((acc, row) => acc + Number(row.balance || 0), 0);
    lines.push(`الإجمالي المستحق: ${money(totalBalance)} SAR`);
    const result = await sendWhatsAppViaWasender({
      to: phone,
      text: lines.join("\n")
    });
    if (!result.ok) {
      return Response.json({
        error: `فشل إرسال التذكير: ${result.error}`
      }, {
        status: 502
      });
    }
    await logPurchaseAudit({
      entityType: "reminder",
      action: "sent",
      summary: `إرسال تذكير سداد واتساب (${overdue.length} متأخرة، ${dueSoon.length} تستحق قريباً)`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      overdue: overdue.length,
      dueSoon: dueSoon.length
    });
  } catch (error) {
    console.error("purchase reminders POST error", error);
    return Response.json({
      error: "فشل إرسال التذكير",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
