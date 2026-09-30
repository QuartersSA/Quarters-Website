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
  firstDueDate = null,
  maxInstallments = 240
}) {
  const months = FREQUENCY_MONTHS[frequency];
  if (!months || !isDateKey(startDate) || !isDateKey(endDate)) return [];
  if (compareDateKeys(endDate, startDate) < 0) return [];
  const money = installmentAmounts({
    amount,
    vatRate,
    amountIncludesVat
  });
  if (!(money.amount_excl > 0)) return [];
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

// الاستقطاع الشهري لدفعة واحدة كما يُرى في شهر «asOfMonth» (YYYY-MM).
// reserveStart: بداية نافذة الادخار (استحقاق الدفعة السابقة، أو بداية
// العقد، أو تاريخ إضافة العقد إن كان بعدهما) — تُمرَّر من الخادم.
function reserveForPayment({
  amountIncl,
  dueDate,
  reserveStart,
  asOfMonth
}) {
  const amount = round2(amountIncl);
  const dueMonth = monthKey(dueDate);
  const startMonth = monthKey(reserveStart) || dueMonth;
  if (!dueMonth || !startMonth || !asOfMonth) {
    return {
      months_total: 1,
      monthly_reserve: amount,
      months_elapsed: 0,
      months_remaining: 1,
      reserved_to_date: 0,
      remaining: amount,
      overdue: false,
      due_this_month: false
    };
  }
  // نافذة الادخار: من شهر البداية إلى الشهر السابق لشهر الاستحقاق —
  // يُدَّخر خلال الفترة ثم يُدفع عند الاستحقاق (نصف سنوي = 6 أشهر).
  // دفعة تستحق في شهر البداية نفسه: نافذة شهر واحد (تُدفع فورًا).
  const monthsTotal = Math.max(monthDiff(startMonth, dueMonth), 1);
  const monthly = round2(amount / monthsTotal);
  // الأشهر المنقضية حتى شهر «الآن» شاملًا (بلا تجاوز النافذة).
  const elapsedRaw = monthDiff(startMonth, asOfMonth) + 1;
  const monthsElapsed = Math.min(Math.max(elapsedRaw, 0), monthsTotal);
  const monthsRemaining = Math.max(monthsTotal - monthsElapsed, 0);
  // آخر شهر يحمل الباقي حتى يساوي المجموع المبلغ تمامًا.
  const reservedToDate = monthsElapsed >= monthsTotal ? amount : round2(monthly * monthsElapsed);
  const thisMonthShare = elapsedRaw <= 0 || elapsedRaw > monthsTotal ? 0 : elapsedRaw === monthsTotal ? round2(amount - round2(monthly * (monthsTotal - 1))) : monthly;
  return {
    months_total: monthsTotal,
    monthly_reserve: monthly,
    this_month_share: thisMonthShare,
    months_elapsed: monthsElapsed,
    months_remaining: monthsRemaining,
    reserved_to_date: reservedToDate,
    remaining: round2(amount - reservedToDate),
    overdue: monthDiff(asOfMonth, dueMonth) < 0,
    due_this_month: dueMonth === asOfMonth
  };
}

// المقترح الذاتي التصحيح لاستقطاع شهر معيّن (سجل الاستقطاعات المؤكدة):
// (المبلغ شامل الضريبة − المُدَّخر فعليًا قبل هذا الشهر) ÷ الأشهر المتبقية
// من هذا الشهر حتى الشهر السابق للاستحقاق. إن فات شهر بلا استقطاع ارتفع
// المقترح تلقائيًا؛ وفي شهر الاستحقاق (أو بعده) يُقترح كامل المتبقي.
// قبل بداية النافذة (reserveStart) المقترح صفر.
function suggestedReserve({
  amountIncl,
  dueDate,
  reserveStart,
  asOfMonth,
  reservedBefore = 0
}) {
  const amount = round2(amountIncl);
  const outstanding = round2(Math.max(amount - (Number(reservedBefore) || 0), 0));
  const dueMonth = monthKey(dueDate);
  if (!dueMonth || !asOfMonth) return {
    suggested: outstanding,
    months_left: 1
  };
  const startMonth = monthKey(reserveStart);
  if (startMonth && monthDiff(startMonth, asOfMonth) < 0) {
    return {
      suggested: 0,
      months_left: Math.max(monthDiff(asOfMonth, dueMonth), 1)
    };
  }
  const monthsLeft = Math.max(monthDiff(asOfMonth, dueMonth), 1);
  return {
    suggested: round2(outstanding / monthsLeft),
    months_left: monthsLeft
  };
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

export { CONTRACT_STATUS_LABELS as C, DEFAULT_VAT_RATE as D, FREQUENCY_LABELS as F, LEASE_FREQUENCIES as L, contractStatus as a, isDateKey as b, compareDateKeys as c, daysBetween as d, addDays as e, reserveForPayment as f, generateSchedule as g, addMonths as h, installmentAmounts as i, daysInMonth as j, monthKey as m, round2 as r, suggestedReserve as s };
