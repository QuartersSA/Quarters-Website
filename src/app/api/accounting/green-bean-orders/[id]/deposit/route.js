import { legacyGone } from "@/app/api/utils/legacyGreenBean";

/**
 * POST /api/accounting/green-bean-orders/:id/deposit — مؤرشف (410).
 *
 * كان يودع الكميات الواصلة من طلب توريد البن القديم في المخزون.
 * الإيداع الآن من فاتورة المشتريات: «تسجيل الوصول» على بند البن
 * (/api/accounting/purchase-invoices/arrival).
 */
export async function POST(request, { params }) {
  void params;
  return legacyGone();
}
