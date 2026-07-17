import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { s as sendWhatsAppViaWasender } from './wasender-CtjKFWCW.js';
import { l as logPurchaseAudit } from './purchaseAudit-DX8U_Szq.js';
import 'crypto';
import './sql-BfhTxwII.js';
import '@neondatabase/serverless';

const REQUIRE_ADMIN = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }, {
    role: "Admin",
    permission: "can_manage_employees"
  }]
};

// رسالة تجريبية للتأكد من سلامة الربط: تُرسل لأي رقم يدخله المدير
// (غير الرقم المقترن) عبر نفس مسار الإرسال الموحد — نجاحها يعني أن
// كل إشعارات النظام ستصل.
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ADMIN);
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
    if (!phone) {
      return Response.json({
        error: "أدخل رقم المستلم"
      }, {
        status: 400
      });
    }
    const now = new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Riyadh",
      dateStyle: "short",
      timeStyle: "short"
    });
    const text = ["✅ رسالة تجريبية — نظام كوارترز", "ربط الواتساب يعمل بنجاح.", `الوقت: ${now} (الرياض)`, auth.user?.name ? `أرسلها: ${auth.user.name}` : null].filter(Boolean).join("\n");
    const result = await sendWhatsAppViaWasender({
      to: phone,
      text
    });
    if (!result.ok) {
      return Response.json({
        error: result.error || "فشل الإرسال"
      }, {
        status: 502
      });
    }
    await logPurchaseAudit({
      entityType: "whatsapp",
      action: "test_message",
      summary: "إرسال رسالة واتساب تجريبية للتحقق من الربط",
      actor: auth.user
    });
    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("whatsapp test error", error);
    return Response.json({
      error: "فشل إرسال الرسالة التجريبية",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
