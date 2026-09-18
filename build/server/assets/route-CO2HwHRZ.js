import { l as legacyGone } from './legacyGreenBean-BA_TFDYb.js';

// PUT /api/accounting/green-bean-order-items/:id — مؤرشف (410).
// كان يسجّل الكمية الواصلة بعد الهدر لبند طلب توريد قديم. الوصول
// يُسجَّل الآن على بند البن في فاتورة المشتريات.
async function PUT(request, {
  params
}) {
  return legacyGone();
}

export { PUT };
