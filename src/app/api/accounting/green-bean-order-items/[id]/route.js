import { legacyGone } from "@/app/api/utils/legacyGreenBean";
import { requireAuth } from "@/app/api/utils/sessionToken";

// PUT /api/accounting/green-bean-order-items/:id — مؤرشف (410).
// كان يسجّل الكمية الواصلة بعد الهدر لبند طلب توريد قديم. الوصول
// يُسجَّل الآن على بند البن في فاتورة المشتريات.
export async function PUT(request, { params }) {
  void params;
  // بوابة المصادقة تبقى (اختبار apiAuthAudit) — ثم 410 للمؤرشف.
  const auth = requireAuth(request, { role: "Admin", permission: "can_manage_accounting" });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  return legacyGone();
}
