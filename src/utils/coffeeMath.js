// وحدة حساب البن — تُستخدم على الخادم (مصدر الحقيقة) وفي الواجهة
// (المعاينة الحية) بنفس المعادلات حتى لا يختلف رقم بين الشاشة والقاعدة.
//
// كل الأرقام بالريال. الضريبة من البند نفسه (لا ثابت 15%):
//   الكيلو الخام        = الكمية × كيلو/الخيشة   (أو الكمية مباشرة في وضع كغ)
//   تكلفة البن (خالي)   = صافي البند بعد حصة الخصم
//   تكلفة البن (شامل)   = خالي + ضريبة البند بعد حصة الخصم
//   التحميص             = تحميص/كغ × الكيلو الخام (+ ضريبة التحميص إن وُجدت)
//   الهدر %             = (1 − الواصل ÷ الخام) × 100          ← عند اكتمال الوصول فقط
//   الصافي/كغ (خالي)    = (بن خالي + تحميص + إضافي) ÷ الواصل
//   الصافي/كغ (شامل)    = (بن شامل + تحميص + ضريبته + إضافي) ÷ الواصل ← تكلفة الصنف

export const COFFEE_QTY_UNITS = ["sack", "kg"];
export const DEFAULT_ROAST_PER_KG = 9;
export const DEFAULT_ROAST_TAX_RATE = 0;
export const ROAST_DUE_DAYS = 15;
// حارس سعر الكيلو الخام — يلتقط الخطأ الشائع: كمية بالكيلو تُحسب خياشًا.
export const RAW_PRICE_MIN = 3;
export const RAW_PRICE_MAX = 500;
export const WASTE_WARN_LOW = 5;
export const WASTE_WARN_HIGH = 30;
export const WASTE_CONFIRM = 60;

export function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
export function round3(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}
export function round4(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}

// null عند الفراغ — لا يتحول الفراغ إلى 0 أبدًا (0 قيمة مقصودة).
export function numOrNull(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// توزيع خصم الرأس على البنود بنسبة صافي كل بند، بأكبر الباقي حتى
// يساوي المجموع خصم الرأس تمامًا. يعيد مصفوفة حصص بنفس ترتيب البنود.
export function allocateDiscount(lineSubtotals, discount) {
  const subs = lineSubtotals.map((v) => Math.max(Number(v) || 0, 0));
  const raw = subs.reduce((s, v) => s + v, 0);
  const d = Math.min(Math.max(Number(discount) || 0, 0), raw);
  if (d <= 0 || raw <= 0) return subs.map(() => 0);
  const shares = subs.map((v) => round2((d * v) / raw));
  const residual = round2(d - shares.reduce((s, v) => s + v, 0));
  if (Math.abs(residual) >= 0.005) {
    let idx = 0;
    for (let i = 1; i < subs.length; i += 1) if (subs[i] > subs[idx]) idx = i;
    shares[idx] = round2(shares[idx] + residual);
  }
  return shares;
}

// حساب بند بن واحد. المدخلات كلها أرقام جاهزة (لا نصوص).
export function computeCoffeeLine({
  quantity,
  quantityUnit,
  kgPerSack,
  lineSubtotal,
  lineTax,
  lineDiscount = 0,
  discountFactor = 1,
  roastPerKg,
  roastTaxRate = 0,
  extraCost = 0,
  receivedKg = null,
  arrivalComplete = false,
}) {
  const qty = Number(quantity) || 0;
  const unit = quantityUnit === "kg" ? "kg" : "sack";
  const kps = numOrNull(kgPerSack);
  const rawKgExact = unit === "kg" ? qty : kps ? qty * kps : 0;
  const rawKg = round3(rawKgExact);
  const sacks =
    unit === "sack" ? round3(qty) : kps && kps > 0 ? round3(qty / kps) : null;

  const beanExcl = round2(Math.max((Number(lineSubtotal) || 0) - (Number(lineDiscount) || 0), 0));
  const beanTax = round2((Number(lineTax) || 0) * (Number(discountFactor) || 1));
  const beanIncl = round2(beanExcl + beanTax);

  const roastRate = Math.max(numOrNull(roastPerKg) ?? 0, 0);
  const roastNet = round2(roastRate * rawKgExact);
  const roastTax = round2((roastNet * Math.max(Number(roastTaxRate) || 0, 0)) / 100);
  const extra = round2(Math.max(Number(extraCost) || 0, 0));

  const landedExcl = round2(beanExcl + roastNet + extra);
  const landedIncl = round2(beanIncl + roastNet + roastTax + extra);
  const rawCostPerKg = rawKgExact > 0 ? round4(beanExcl / rawKgExact) : null;

  const received = numOrNull(receivedKg);
  const complete = !!arrivalComplete && received !== null && received > 0;
  const wastePercent = complete && rawKgExact > 0
    ? round4((1 - received / rawKgExact) * 100)
    : null;
  const netExclPerKg = complete ? round4(landedExcl / received) : null;
  const netInclPerKg = complete ? round4(landedIncl / received) : null;

  return {
    quantityUnit: unit,
    rawKg,
    sacks,
    beanCostExcl: beanExcl,
    beanCostIncl: beanIncl,
    rawCostPerKg,
    roastTotalNet: roastNet,
    roastTaxAmount: roastTax,
    extraCost: extra,
    landedExcl,
    landedIncl,
    receivedKg: received,
    arrivalComplete: complete,
    wastePercent,
    netExclPerKg,
    netInclPerKg,
  };
}

// تصنيف نسبة الهدر للشارات والتأكيدات.
export function wasteFlag(wastePercent) {
  if (wastePercent === null || wastePercent === undefined) return null;
  if (wastePercent < 0) return "over";
  if (wastePercent > WASTE_CONFIRM) return "confirm";
  if (wastePercent > WASTE_WARN_HIGH) return "high";
  if (wastePercent < WASTE_WARN_LOW) return "low";
  return "ok";
}

// حالة بند البن للعرض.
export function coffeeLineStatus(line) {
  if (!line?.roast_enabled) return "off";
  if (line.arrival_complete) return "received";
  const r = Number(line.received_kg) || 0;
  if (r > 0) return "partial";
  return "pending";
}

// أيهما تصنّف الكمية: كغ أم خيشة — من وصف البند أو وحدة الشراء.
export function guessQuantityUnit(description, purchaseUnit) {
  const text = `${description || ""} ${purchaseUnit || ""}`.toLowerCase();
  if (/(\bkg\b|كجم|كغ|كيلو|كلغ)/.test(text)) return "kg";
  if (/(خيش|شوال|كيس|جوال|bag|sack)/.test(text)) return "sack";
  return null;
}

// تاريخ + أيام (سلاسل YYYY-MM-DD) — بلا اعتماد على المنطقة الزمنية.
export function addDays(dateKey, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}
