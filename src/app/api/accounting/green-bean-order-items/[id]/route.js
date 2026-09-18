import { legacyGone } from "@/app/api/utils/legacyGreenBean";

// PUT /api/accounting/green-bean-order-items/:id — مؤرشف (410).
// كان يسجّل الكمية الواصلة بعد الهدر لبند طلب توريد قديم. الوصول
// يُسجَّل الآن على بند البن في فاتورة المشتريات.
export async function PUT(request, { params }) {
  void params;
  return legacyGone();
}
