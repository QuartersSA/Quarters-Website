import { l as legacyGone } from './legacyGreenBean-BA_TFDYb.js';

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
  return legacyGone();
}

export { POST };
