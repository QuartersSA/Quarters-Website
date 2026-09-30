// حسابات العقود التأجيرية — مشتركة بين الخادم (مصدر الحقيقة) والواجهة
// (المعاينة الحية) بنفس المعادلات.
//
// جدول الدفعات: من (تاريخ البداية، تاريخ النهاية، التكرار، قيمة الدفعة
// قبل الضريبة، نسبة الضريبة، أول استحقاق اختياري) → قائمة دفعات.
// الاستقطاع الشهري لدفعة معلّقة: نافذة الادخار من «بداية الاحتساب»
// (استحقاق الدفعة السابقة أو بداية العقد) إلى تاريخ الاستحقاق؛ يُقسم
// المبلغ شامل الضريبة على عدد أشهر النافذة، ويُحسب المُدَّخر المفترض
// حتى الشهر الحالي والمتبقي.

const LEASE_FREQUENCIES = ["monthly", "quarterly", "semi_annual", "annual", "custom"];
const FREQUENCY_MONTHS = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12
};
const FREQUENCY_LABELS = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semi_annual: "نصف سنوي",
  annual: "سنوي",
  custom: "دفعات مخصصة"
};
const DEFAULT_VAT_RATE = 15;

// نوع العقد: ما هي العين المؤجرة.
const CONTRACT_TYPES = ["branch", "housing", "warehouse"];
const CONTRACT_TYPE_LABELS = {
  branch: "فرع",
  housing: "سكن",
  warehouse: "مستودع"
};
function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function isDateKey(value) {
  return DATE_RE.test(String(value || ""));
}
function parts(dateKey) {
  const m = DATE_RE.exec(String(dateKey || ""));
  if (!m) return null;
  return {
    y: Number(m[1]),
    m: Number(m[2]),
    d: Number(m[3])
  };
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function toDateKey(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// إضافة أشهر مع تثبيت اليوم (31 يناير + 1 شهر = 28/29 فبراير).
function addMonths(dateKey, months) {
  const p = parts(dateKey);
  if (!p) return null;
  const total = p.y * 12 + (p.m - 1) + Number(months || 0);
  const y = Math.floor(total / 12);
  const m = total % 12 + 1;
  const d = Math.min(p.d, daysInMonth(y, m));
  return toDateKey(y, m, d);
}
function addDays(dateKey, days) {
  const p = parts(dateKey);
  if (!p) return null;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}
function monthKey(dateKey) {
  const p = parts(dateKey);
  return p ? `${p.y}-${pad2(p.m)}` : null;
}

// عدد الأشهر بين مفتاحي شهر (YYYY-MM) — b − a.
function monthDiff(aMonthKey, bMonthKey) {
  const a = /^(\d{4})-(\d{2})/.exec(String(aMonthKey || ""));
  const b = /^(\d{4})-(\d{2})/.exec(String(bMonthKey || ""));
  if (!a || !b) return 0;
  return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
}
function compareDateKeys(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

// مبلغ الدفعة: قبل الضريبة → ضريبة → شامل. إن كان المُدخل شاملًا يُفكّ.
function installmentAmounts({
  amount,
  vatRate = DEFAULT_VAT_RATE,
  amountIncludesVat = false
}) {
  const rate = Math.min(Math.max(Number(vatRate) || 0, 0), 100);
  const raw = Math.max(Number(amount) || 0, 0);
  // قبل الضريبة يُثبَّت أولًا (مقرَّبًا)، ثم الضريبة منه، ثم الشامل مجموعهما —
  // فتتطابق أرقام الجدول مع بند فاتورة المشتريات (سعر قبل الضريبة × نسبة)
  // ولا يظهر فرق هللة بين المجموع والشامل.
  const excl = round2(amountIncludesVat ? raw / (1 + rate / 100) : raw);
  const vat = round2(excl * (rate / 100));
  return {
    amount_excl: excl,
    vat_rate: rate,
    vat_amount: vat,
    amount_incl: round2(excl + vat)
  };
}

// تقسيم قائمة المبالغ الثابتة [{label, amount, taxable}] إلى خاضع للضريبة
// ومعفى (عقود «إيجار» تطبّق الضريبة على الأجرة فقط غالبًا).
function splitFixedCharges(list) {
  let exempt = 0;
  let taxable = 0;
  for (const row of Array.isArray(list) ? list : []) {
    const amount = Math.max(Number(row?.amount) || 0, 0);
    if (row?.taxable === true) taxable += amount;else exempt += amount;
  }
  return {
    exempt: round2(exempt),
    taxable: round2(taxable),
    total: round2(exempt + taxable)
  };
}

// مبلغ الدفعة = الأجرة (قبل الضريبة، تُفكّ إن كانت شاملة) + المبالغ الثابتة
// لكل دفعة. الضريبة على (الأجرة + الثابت الخاضع) فقط؛ الثابت المعفى يُضاف
// بعد الضريبة — فتطابق الدفعة جدول العقد (أجرة + ضريبتها + خدمات).
function installmentWithFixed({
  amount,
  fixedAmount = 0,
  fixedTaxableAmount = 0,
  vatRate = DEFAULT_VAT_RATE,
  amountIncludesVat = false
}) {
  const rent = installmentAmounts({
    amount,
    vatRate,
    amountIncludesVat
  }).amount_excl;
  const exempt = round2(Math.max(Number(fixedAmount) || 0, 0));
  const taxable = round2(Math.max(Number(fixedTaxableAmount) || 0, 0));
  const taxed = installmentAmounts({
    amount: rent + taxable,
    vatRate,
    amountIncludesVat: false
  });
  return {
    rent_excl: rent,
    fixed_excl: round2(exempt + taxable),
    fixed_exempt_excl: exempt,
    amount_excl: round2(taxed.amount_excl + exempt),
    vat_rate: taxed.vat_rate,
    vat_amount: taxed.vat_amount,
    amount_incl: round2(taxed.amount_incl + exempt)
  };
}

// توليد جدول الدفعات. يعيد [] عند نقص المدخلات.
// firstDueDate: أول استحقاق (افتراضيًا تاريخ البداية). الدفعات تتوالى
// كل N شهر حتى (وليس بعد) تاريخ النهاية. فترة كل دفعة = [الاستحقاق،
// الاستحقاق + N شهر − يوم] مقصوصة عند نهاية العقد.
function generateSchedule({
  startDate,
  endDate,
  frequency,
  amount,
  vatRate = DEFAULT_VAT_RATE,
  amountIncludesVat = false,
  fixedAmount = 0,
  fixedTaxableAmount = 0,
  firstDueDate = null,
  maxInstallments = 240
}) {
  const months = FREQUENCY_MONTHS[frequency];
  if (!months || !isDateKey(startDate) || !isDateKey(endDate)) return [];
  if (compareDateKeys(endDate, startDate) < 0) return [];
  const money = installmentWithFixed({
    amount,
    fixedAmount,
    fixedTaxableAmount,
    vatRate,
    amountIncludesVat
  });
  if (!(money.rent_excl > 0)) return [];
  const first = isDateKey(firstDueDate) ? firstDueDate : startDate;
  const rows = [];
  let due = first;
  let seq = 1;
  while (compareDateKeys(due, endDate) <= 0 && seq <= maxInstallments) {
    const periodStart = seq === 1 ? startDate : addMonths(first, months * (seq - 1));
    const nextDue = addMonths(first, months * seq);
    const periodEndRaw = addDays(nextDue, -1);
    const periodEnd = compareDateKeys(periodEndRaw, endDate) > 0 ? endDate : periodEndRaw;
    rows.push({
      seq,
      due_date: due,
      period_start: periodStart,
      period_end: periodEnd,
      ...money
    });
    due = nextDue;
    seq += 1;
  }
  return rows;
}

// جدول الاستقطاع الشهري لدفعة: N أشهر (N = أشهر التكرار: ربعي 3، نصفي 6،
// سنوي 12) تنتهي بالشهر السابق لشهر الاستحقاق — لا استقطاع في شهر
// الاستحقاق نفسه لأنه لا ينتهي قبل موعد السداد. المبلغ يُقسم بالتساوي
// والشهر الأخير يحمل باقي التقريب. مثال: ربعي يستحق 2026-12-15 →
// 2026-09، 2026-10، 2026-11.
function setAsideSchedule({
  amountIncl,
  dueDate,
  windowMonths
}) {
  const amount = round2(amountIncl);
  const dueMonth = monthKey(dueDate);
  const n = Math.max(Math.round(Number(windowMonths) || 0), 1);
  if (!dueMonth || !(amount > 0)) return [];
  const monthly = round2(amount / n);
  const rows = [];
  for (let i = n; i >= 1; i -= 1) {
    const month = monthKey(addMonths(`${dueMonth}-01`, -i));
    const last = i === 1;
    rows.push({
      month,
      seq: n - i + 1,
      amount: last ? round2(amount - round2(monthly * (n - 1))) : monthly
    });
  }
  return rows;
}

// حالة العقد المعروضة من تواريخه وحالته المخزَّنة.
function contractStatus({
  status,
  startDate,
  endDate,
  noticePeriodDays,
  today
}) {
  if (status === "terminated") return "terminated";
  if (!isDateKey(endDate) || !today) return status || "active";
  if (compareDateKeys(endDate, today) < 0) return "ended";
  if (compareDateKeys(startDate, today) > 0) return "upcoming";
  const noticeDays = Number(noticePeriodDays) || 0;
  if (noticeDays > 0 && compareDateKeys(addDays(endDate, -noticeDays), today) <= 0) {
    return "notice";
  }
  return "active";
}
const CONTRACT_STATUS_LABELS = {
  active: "ساري",
  upcoming: "لم يبدأ",
  notice: "داخل فترة الإشعار",
  ended: "منتهي",
  terminated: "مُنهى"
};
function daysBetween(fromKey, toKey) {
  const a = parts(fromKey);
  const b = parts(toKey);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export { CONTRACT_TYPES as C, DEFAULT_VAT_RATE as D, FREQUENCY_MONTHS as F, LEASE_FREQUENCIES as L, monthKey as a, contractStatus as b, compareDateKeys as c, daysBetween as d, isDateKey as e, addDays as f, generateSchedule as g, installmentAmounts as h, installmentWithFixed as i, setAsideSchedule as j, CONTRACT_STATUS_LABELS as k, CONTRACT_TYPE_LABELS as l, monthDiff as m, FREQUENCY_LABELS as n, daysInMonth as o, round2 as r, splitFixedCharges as s };
