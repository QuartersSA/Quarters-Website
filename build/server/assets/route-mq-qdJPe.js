import { l as legacyGone } from './legacyGreenBean-BA_TFDYb.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import 'crypto';

// PUT /api/accounting/green-bean-order-items/:id — مؤرشف (410).
// كان يسجّل الكمية الواصلة بعد الهدر لبند طلب توريد قديم. الوصول
// يُسجَّل الآن على بند البن في فاتورة المشتريات.
async function PUT(request, {
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

export { PUT };
