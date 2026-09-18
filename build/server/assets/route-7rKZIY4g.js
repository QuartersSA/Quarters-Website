import { l as legacyGone } from './legacyGreenBean-BA_TFDYb.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import 'crypto';

/**
 * POST /api/accounting/green-bean-orders/:id/deposit — مؤرشف (410).
 *
 * كان يودع الكميات الواصلة من طلب توريد البن القديم في المخزون.
 * الإيداع الآن من فاتورة المشتريات: «تسجيل الوصول» على بند البن
 * (/api/accounting/purchase-invoices/arrival).
 */
async function POST(request, {
  params
}) {
  // بوابة المصادقة تبقى (اختبار apiAuthAudit) — ثم 410 للمؤرشف.
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
  return legacyGone();
}

export { POST };
