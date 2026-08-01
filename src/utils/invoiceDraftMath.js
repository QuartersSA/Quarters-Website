// حساب إجماليات مسودة فاتورة الرفع الجماعي — مصدر واحد للمعادلات
// يستخدمه الخادم (التحقق قبل الاعتماد) والواجهة (إعادة الحساب الحي
// أثناء التعديل). نفس قواعد نافذة الفاتورة الواحدة حرفياً:
//   - بند غير شامل الضريبة: الصافي = كمية×سعر، الضريبة نسبة منه.
//   - بند شامل: يُفكك عكسياً (الصافي = المبلغ ÷ (1+النسبة)).
//   - خصم الفاتورة يقتطع من الصافي قبل الضريبة وتتقلص الضريبة نسبياً.

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function computeDraftTotals(draft) {
  const items = Array.isArray(draft?.items) ? draft.items : [];
  let rawSubtotal = 0;
  let rawTax = 0;
  for (const item of items) {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    const rate = Math.min(Math.max(Number(item.tax_rate) || 0, 0), 100) / 100;
    const amount = round2(quantity * unitPrice);
    if (amount <= 0) continue;
    // تقريب لكل بند قبل الجمع — مطابقة حرفية لـ lineMath في نافذة
    // الفاتورة وparseItems في الخادم (الضريبة تُحسب من الصافي غير
    // المقرب ثم تُقرب)؛ التقريب الواحد في النهاية يعطي فلساً مختلفاً
    // في تفكيك الضريبة على إيصالات نقاط البيع.
    if (item.amount_includes_tax) {
      const net = amount / (1 + rate);
      rawSubtotal += round2(net);
      rawTax += round2(amount - net);
    } else {
      rawSubtotal += amount;
      rawTax += round2(amount * rate);
    }
  }
  rawSubtotal = round2(rawSubtotal);
  rawTax = round2(rawTax);
  const discount = Math.min(
    Math.max(Number(draft?.discount) || 0, 0),
    rawSubtotal,
  );
  const factor = rawSubtotal > 0 ? (rawSubtotal - discount) / rawSubtotal : 1;
  const subtotal = round2(rawSubtotal - discount);
  const tax = round2(rawTax * factor);
  return {
    subtotal,
    discount: round2(discount),
    tax,
    total: round2(subtotal + tax),
  };
}
