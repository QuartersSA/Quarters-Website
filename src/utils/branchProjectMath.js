// حسابات مشاريع تأسيس الفروع — دوال نقية بلا React، مشتركة بين الصفحات
// والمخزن المحلي (mock) ولاحقاً الخادم.
//
// التواريخ مفاتيح نصية `YYYY-MM-DD` وتُحسب بـ UTC حتى لا تتأثر بمنطقة
// المتصفح الزمنية. المبالغ أرقام (ريال).

import { todayRiyadhDateKey } from "./dateUtils";

// ---------- الثوابت ----------

export const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "opened", "cancelled"];
export const PROJECT_STATUS_LABELS = {
  planning: "تخطيط",
  in_progress: "قيد التنفيذ",
  on_hold: "متوقف",
  opened: "افتُتح",
  cancelled: "ملغى",
};

export const PHASE_STATUSES = ["not_started", "in_progress", "done", "blocked"];
export const PHASE_STATUS_LABELS = {
  not_started: "لم يبدأ",
  in_progress: "جارٍ",
  done: "مكتمل",
  blocked: "متعثر",
};

export const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"];
export const TASK_STATUS_LABELS = {
  todo: "لم تبدأ",
  in_progress: "جارية",
  done: "منجزة",
  blocked: "متعثرة",
};

export const ATTACHMENT_KINDS = ["contract", "permit", "design", "quote", "photo", "other"];
export const ATTACHMENT_KIND_LABELS = {
  contract: "عقد",
  permit: "ترخيص",
  design: "مخطط",
  quote: "عرض سعر",
  photo: "صورة",
  other: "أخرى",
};

export const HEALTH_LABELS = {
  done: "مكتمل",
  on_track: "في المسار",
  at_risk: "في خطر",
  late: "متأخر",
  not_started: "لم يبدأ",
};

// ترتيب السوء: الأعلى أسوأ — يُستخدم لاختيار أسوأ صحة في المشروع.
export const HEALTH_RANK = { late: 4, at_risk: 3, on_track: 2, not_started: 1, done: 0 };

export const INVOICE_STATUS_LABELS = {
  pending_payment: "بانتظار السداد",
  partial_paid: "مسدد جزئياً",
  paid: "مسدد",
  overdue: "متأخر",
};

// حسابات مصروفات التأسيس (مجموعة 53).
export const ESTABLISHMENT_ACCOUNTS = [
  { code: "5301", name: "إيجار ما قبل الافتتاح" },
  { code: "5302", name: "تراخيص ورسوم حكومية" },
  { code: "5303", name: "تصميم واستشارات" },
  { code: "5304", name: "ديكور وتشطيب" },
  { code: "5305", name: "كهرباء وسباكة وتكييف" },
  { code: "5306", name: "معدات" },
  { code: "5307", name: "أثاث ولوحات" },
  { code: "5308", name: "أنظمة وتقنية" },
  { code: "5309", name: "رواتب وتدريب ما قبل الافتتاح" },
  { code: "5310", name: "تسويق الافتتاح" },
  { code: "5399", name: "أخرى" },
];

export function accountName(code) {
  return ESTABLISHMENT_ACCOUNTS.find((a) => a.code === String(code || ""))?.name || "";
}

// قالب الأقسام الافتراضي لفرع قهوة مختصة. كل قسم بلون مميز وحساب
// مصروف افتراضي ومهام جاهزة؛ المعالم الخمسة موزّعة على أقسامها.
export const DEFAULT_PHASE_TEMPLATE = [
  {
    key: "contract",
    name: "العقد والإيجار",
    color: "#0ea5e9",
    default_account_code: "5301",
    tasks: [
      { title: "توقيع عقد الإيجار وتوثيقه في إيجار", is_milestone: false },
      { title: "سداد دفعة الإيجار الأولى والتأمين", is_milestone: false },
      { title: "تسليم الموقع", is_milestone: true },
      { title: "تصوير الموقع وتوثيق حالته عند الاستلام", is_milestone: false },
    ],
  },
  {
    key: "licenses",
    name: "التراخيص والتصاريح",
    color: "#f59e0b",
    default_account_code: "5302",
    tasks: [
      { title: "إصدار سجل تجاري للفرع", is_milestone: false },
      { title: "رخصة بلدية (بلدي)", is_milestone: false },
      { title: "فسح الدفاع المدني (سلامة)", is_milestone: false },
      { title: "شهادات صحية للعاملين", is_milestone: false },
      { title: "تصريح لوحة الواجهة", is_milestone: false },
    ],
  },
  {
    key: "design",
    name: "التصميم والمخططات",
    color: "#8b5cf6",
    default_account_code: "5303",
    tasks: [
      { title: "رفع مساحي للموقع", is_milestone: false },
      { title: "المخطط المعماري وتوزيع الفراغات", is_milestone: false },
      { title: "تصميم البار ومسار الخدمة", is_milestone: false },
      { title: "مخططات الكهرباء والسباكة والتكييف", is_milestone: false },
      { title: "اعتماد التصميم النهائي", is_milestone: false },
    ],
  },
  {
    key: "fitout",
    name: "الديكور والتشطيب",
    color: "#ef4444",
    default_account_code: "5304",
    tasks: [
      { title: "التعاقد مع مقاول التشطيب", is_milestone: false },
      { title: "أعمال الهدم والجبس والأسقف", is_milestone: false },
      { title: "الأرضيات والدهانات وتكسية الجدران", is_milestone: false },
      { title: "تنفيذ البار والمغاسل", is_milestone: false },
      { title: "الواجهة واللوحة الخارجية", is_milestone: false },
      { title: "اكتمال التشطيب", is_milestone: true },
    ],
  },
  {
    key: "mep",
    name: "الكهرباء والسباكة والتكييف",
    color: "#f97316",
    default_account_code: "5305",
    tasks: [
      { title: "لوحة الكهرباء ونقاط المعدات", is_milestone: false },
      { title: "تمديدات السباكة والصرف للبار", is_milestone: false },
      { title: "تركيب وحدات التكييف والتهوية", is_milestone: false },
      { title: "تركيب فلتر مياه مركزي", is_milestone: false },
      { title: "فحص واختبار التمديدات", is_milestone: false },
    ],
  },
  {
    key: "equipment",
    name: "المعدات",
    color: "#14b8a6",
    default_account_code: "5306",
    tasks: [
      { title: "شراء ماكينة إسبريسو وطواحين", is_milestone: false },
      { title: "ثلاجات ومجمدات ومبرد عرض", is_milestone: false },
      { title: "ماكينة ثلج وغلايات وأدوات التحضير", is_milestone: false },
      { title: "تركيب المعدات", is_milestone: true },
      { title: "معايرة الماكينة والطواحين", is_milestone: false },
    ],
  },
  {
    key: "furniture",
    name: "الأثاث واللوحات",
    color: "#a16207",
    default_account_code: "5307",
    tasks: [
      { title: "طاولات وكراسي الصالة والجلسات الخارجية", is_milestone: false },
      { title: "رفوف العرض وخزائن التخزين", is_milestone: false },
      { title: "لوحة القائمة واللوحات الداخلية", is_milestone: false },
      { title: "الإضاءة الديكورية والنباتات", is_milestone: false },
    ],
  },
  {
    key: "systems",
    name: "الأنظمة (POS وكاميرات وإنترنت)",
    color: "#2563eb",
    default_account_code: "5308",
    tasks: [
      { title: "اشتراك إنترنت وشبكة داخلية", is_milestone: false },
      { title: "تركيب نظام نقاط البيع POS", is_milestone: false },
      { title: "كاميرات المراقبة ونظام الإنذار", is_milestone: false },
      { title: "شاشات القائمة الرقمية والصوتيات", is_milestone: false },
      { title: "ربط الفرع بتطبيقات التوصيل", is_milestone: false },
    ],
  },
  {
    key: "hiring",
    name: "التوظيف والتدريب",
    color: "#db2777",
    default_account_code: "5309",
    tasks: [
      { title: "التعاقد مع مدير الفرع", is_milestone: false },
      { title: "توظيف الباريستا والكاشير", is_milestone: false },
      { title: "تدريب على التحضير وخدمة العملاء", is_milestone: false },
      { title: "تدريب على نظام POS والإغلاق اليومي", is_milestone: false },
    ],
  },
  {
    key: "inventory",
    name: "المخزون الافتتاحي",
    color: "#65a30d",
    default_account_code: "5399",
    tasks: [
      { title: "طلب البن المحمص والمشروبات", is_milestone: false },
      { title: "الحليب والمواد الاستهلاكية والتغليف", is_milestone: false },
      { title: "الأكواب والعبوات بشعار الفرع", is_milestone: false },
      { title: "جرد افتتاحي وتسجيله في المخزون", is_milestone: false },
    ],
  },
  {
    key: "launch",
    name: "التسويق والافتتاح",
    color: "#059669",
    default_account_code: "5310",
    tasks: [
      { title: "حملة ما قبل الافتتاح على وسائل التواصل", is_milestone: false },
      { title: "تسجيل الفرع في خرائط Google", is_milestone: false },
      { title: "الافتتاح التجريبي", is_milestone: true },
      { title: "معالجة ملاحظات التجريبي", is_milestone: false },
      { title: "الافتتاح", is_milestone: true },
    ],
  },
];

// ---------- مساعدات التاريخ ----------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function isDateKey(value) {
  return DATE_RE.test(String(value || ""));
}

function parts(key) {
  const m = DATE_RE.exec(String(key || ""));
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function utcToKey(date) {
  return date.toISOString().slice(0, 10);
}

export function todayRiyadh() {
  return todayRiyadhDateKey();
}

export function addDays(key, n) {
  const p = parts(key);
  if (!p) return null;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  d.setUTCDate(d.getUTCDate() + Math.trunc(Number(n) || 0));
  return utcToKey(d);
}

// b − a بالأيام (موجب إذا كان b بعد a). null عند مدخل غير صالح.
export function daysBetween(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return null;
  return Math.round(
    (Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000,
  );
}

export function compareDateKeys(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

// «11 نوفمبر 2026» — أسماء عربية وأرقام لاتينية.
export function formatDateKey(key) {
  const p = parts(key);
  if (!p) return "—";
  return `${p.d} ${MONTHS_AR[p.m - 1] || ""} ${p.y}`;
}

function monthStart(key) {
  const p = parts(key);
  return p ? `${p.y}-${pad2(p.m)}-01` : null;
}

function monthEnd(key) {
  const p = parts(key);
  if (!p) return null;
  const last = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
  return `${p.y}-${pad2(p.m)}-${pad2(last)}`;
}

function minKey(keys) {
  const valid = keys.filter(isDateKey);
  return valid.length ? valid.reduce((a, b) => (compareDateKeys(a, b) <= 0 ? a : b)) : null;
}

function maxKey(keys) {
  const valid = keys.filter(isDateKey);
  return valid.length ? valid.reduce((a, b) => (compareDateKeys(a, b) >= 0 ? a : b)) : null;
}

// ---------- أرقام ----------

export function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampPct(value) {
  return Math.min(Math.max(Math.round(num(value)), 0), 100);
}

function listOf(value) {
  return Array.isArray(value) ? value : [];
}

function sortedPhases(project) {
  return [...listOf(project?.phases)].sort(
    (a, b) => num(a?.sort_order) - num(b?.sort_order) || num(a?.id) - num(b?.id),
  );
}

// ---------- التقدم ----------

export function phaseTasks(project, phaseId) {
  const pid = Number(phaseId);
  return listOf(project?.tasks)
    .filter((t) => Number(t?.phase_id) === pid)
    .sort((a, b) => num(a?.sort_order) - num(b?.sort_order) || num(a?.id) - num(b?.id));
}

// تقدم القسم: override أولاً؛ وإلا المنجز/الكل؛ بلا مهام يُستنتج من الحالة.
export function phaseProgress(phase, tasks) {
  const override = phase?.progress_override;
  if (override !== null && override !== undefined && override !== "" && Number.isFinite(Number(override))) {
    return clampPct(override);
  }
  const list = listOf(tasks);
  if (list.length > 0) {
    const done = list.filter((t) => t?.status === "done").length;
    return clampPct((done / list.length) * 100);
  }
  if (phase?.status === "done") return 100;
  if (phase?.status === "in_progress") return 50;
  return 0;
}

// تقدم المشروع مرجّح بوزن كل قسم (الافتراضي 1).
export function projectProgress(project) {
  const phases = listOf(project?.phases);
  if (!phases.length) return project?.status === "opened" ? 100 : 0;
  let weighted = 0;
  let weights = 0;
  for (const phase of phases) {
    const w = phase?.weight == null || phase.weight === "" ? 1 : Math.max(num(phase.weight), 0);
    weighted += phaseProgress(phase, phaseTasks(project, phase?.id)) * w;
    weights += w;
  }
  return weights > 0 ? clampPct(weighted / weights) : 0;
}

// ---------- الصحة ----------

export function phaseHealth(phase, tasks, today) {
  const day = isDateKey(today) ? today : todayRiyadh();
  if (phase?.status === "done") return "done";
  const progress = phaseProgress(phase, tasks);
  const start = phase?.planned_start;
  const end = phase?.planned_end;
  if (isDateKey(end) && compareDateKeys(end, day) < 0) return "late";
  if (phase?.status === "blocked") return "at_risk";
  if (isDateKey(start) && isDateKey(end)) {
    const duration = daysBetween(start, end) + 1;
    const remaining = daysBetween(day, end) + 1;
    if (duration > 0 && remaining / duration < 0.2 && progress < 60) return "at_risk";
  }
  if (phase?.status === "not_started" && progress === 0) return "not_started";
  if (!phase?.status && progress === 0 && !phase?.actual_start) return "not_started";
  return "on_track";
}

// أسوأ صحة بين الأقسام غير المكتملة؛ 'done' إن افتُتح أو اكتملت كل الأقسام.
export function projectHealth(project, today) {
  if (project?.status === "opened") return "done";
  const phases = listOf(project?.phases);
  if (!phases.length) return "not_started";
  let worst = "done";
  for (const phase of phases) {
    const health = phaseHealth(phase, phaseTasks(project, phase?.id), today);
    if (HEALTH_RANK[health] > HEALTH_RANK[worst]) worst = health;
  }
  return worst;
}

// الأيام المتبقية للافتتاح المستهدف (سالب = تجاوز). null بلا موعد.
export function daysToOpening(project, today) {
  const target = project?.target_opening_date;
  if (!isDateKey(target)) return null;
  const day = isDateKey(today) ? today : todayRiyadh();
  return daysBetween(day, target);
}

// ---------- الميزانية ----------

function sumInvoices(invoices) {
  let committed = 0;
  let paid = 0;
  for (const inv of listOf(invoices)) {
    committed += num(inv?.total_amount);
    paid += num(inv?.paid_amount);
  }
  return { committed: round2(committed), paid: round2(paid) };
}

function pctOf(part, whole) {
  if (whole > 0) return Math.max(Math.round((part / whole) * 100), 0);
  return part > 0 ? 100 : 0;
}

// فواتير القسم تُرشَّح بـ phase_id (يمكن تمرير كل فواتير المشروع).
export function phaseBudget(phase, invoices) {
  const pid = Number(phase?.id);
  const own = listOf(invoices).filter((inv) => Number(inv?.phase_id) === pid);
  const budget = round2(Math.max(num(phase?.budget), 0));
  const { committed, paid } = sumInvoices(own);
  return {
    budget,
    committed,
    paid,
    remaining: round2(budget - committed),
    over: round2(Math.max(committed - budget, 0)),
    pct: pctOf(committed, budget),
  };
}

export function projectBudget(project) {
  const budgetTotal = round2(Math.max(num(project?.budget_total), 0));
  const phasesBudget = round2(
    listOf(project?.phases).reduce((s, p) => s + Math.max(num(p?.budget), 0), 0),
  );
  const { committed, paid } = sumInvoices(project?.invoices);
  return {
    budget_total: budgetTotal,
    phases_budget: phasesBudget,
    unallocated: round2(budgetTotal - phasesBudget),
    committed,
    paid,
    remaining: round2(budgetTotal - committed),
    over: round2(Math.max(committed - budgetTotal, 0)),
    pct: pctOf(committed, budgetTotal),
  };
}

// حالة الفاتورة من المسدد/الإجمالي/الاستحقاق.
export function invoiceStatus(inv, today) {
  const total = num(inv?.total_amount);
  const paid = num(inv?.paid_amount);
  if (paid >= total && (total > 0 || paid > 0)) return "paid";
  const day = isDateKey(today) ? today : todayRiyadh();
  if (isDateKey(inv?.due_date) && compareDateKeys(inv.due_date, day) < 0) return "overdue";
  if (paid > 0) return "partial_paid";
  return "pending_payment";
}

// ---------- الخط الزمني ----------

// موضع شريط داخل نطاق (نسب مئوية). الأيام شاملة الطرفين؛ يُقصّ على النطاق.
export function barPosition(start, end, rangeStart, rangeEnd) {
  const zero = { left_pct: 0, width_pct: 0 };
  if (!isDateKey(rangeStart) || !isDateKey(rangeEnd)) return zero;
  const total = daysBetween(rangeStart, rangeEnd) + 1;
  if (!(total > 0)) return zero;
  let s = isDateKey(start) ? start : null;
  let e = isDateKey(end) ? end : null;
  if (!s && !e) return zero;
  if (!s) s = e;
  if (!e) e = s;
  if (compareDateKeys(s, rangeStart) < 0) s = rangeStart;
  if (compareDateKeys(e, rangeEnd) > 0) e = rangeEnd;
  if (compareDateKeys(e, s) < 0) return zero;
  const left = (daysBetween(rangeStart, s) / total) * 100;
  const width = ((daysBetween(s, e) + 1) / total) * 100;
  return {
    left_pct: Math.min(Math.max(round2(left), 0), 100),
    width_pct: Math.min(Math.max(round2(width), 0), 100 - round2(left)),
  };
}

// نطاق الخط الزمني: من أول شهر فيه حدث إلى آخر شهر، بأعمدة أشهر وخط اليوم.
export function timelineRange(project, today) {
  const day = isDateKey(today) ? today : todayRiyadh();
  const phases = listOf(project?.phases);
  const tasks = listOf(project?.tasks);
  const startCandidates = [
    project?.contract_signed_date,
    ...phases.map((p) => p?.planned_start),
    ...phases.map((p) => p?.actual_start),
  ];
  const endCandidates = [
    project?.target_opening_date,
    project?.actual_opening_date,
    ...phases.map((p) => p?.planned_end),
    ...phases.map((p) => p?.actual_end),
    ...tasks.filter((t) => t?.is_milestone).map((t) => t?.due_date),
  ];
  let start = minKey(startCandidates);
  let end = maxKey(endCandidates);
  if (!start && !end) {
    start = day;
    end = addDays(day, 150);
  } else if (!start) {
    start = addDays(end, -150);
  } else if (!end) {
    end = addDays(start, 150);
  }
  if (compareDateKeys(end, start) < 0) end = start;
  start = monthStart(start);
  end = monthEnd(end);
  const total = daysBetween(start, end) + 1;
  const months = [];
  let cursor = start;
  let guard = 0;
  while (compareDateKeys(cursor, end) <= 0 && guard < 120) {
    const mEnd = monthEnd(cursor);
    const p = parts(cursor);
    const pos = barPosition(cursor, mEnd, start, end);
    months.push({
      key: `${p.y}-${pad2(p.m)}`,
      label: `${MONTHS_AR[p.m - 1]} ${p.y}`,
      left_pct: pos.left_pct,
      width_pct: pos.width_pct,
    });
    cursor = addDays(mEnd, 1);
    guard += 1;
  }
  const todayInRange = compareDateKeys(day, start) >= 0 && compareDateKeys(day, end) <= 0;
  const today_pct = todayInRange ? round2(((daysBetween(start, day) + 0.5) / total) * 100) : null;
  return { start, end, months, today_pct };
}

// ---------- القالب والأكواد ----------

// أقسام بلا id من القالب، موزّعة بالتساوي بين توقيع العقد والافتتاح
// (القسم الأخير ينتهي يوم الافتتاح). كل قسم يحمل `tasks` جاهزة للإدراج.
export function buildPhasesFromTemplate(template, contractDate, targetOpening) {
  const list = listOf(template);
  const n = list.length;
  const hasDates =
    isDateKey(contractDate) && isDateKey(targetOpening) && compareDateKeys(targetOpening, contractDate) >= 0;
  // المدة شاملة الطرفين (يوم العقد ويوم الافتتاح) حتى تتساوى الأقسام.
  const span = hasDates ? daysBetween(contractDate, targetOpening) + 1 : 0;
  const boundary = (i) => {
    if (!hasDates) return null;
    const key = addDays(contractDate, Math.round((span * i) / n));
    return compareDateKeys(key, targetOpening) > 0 ? targetOpening : key;
  };
  return list.map((tpl, i) => {
    const planned_start = boundary(i);
    let planned_end = null;
    if (hasDates) {
      planned_end = i === n - 1 ? targetOpening : addDays(boundary(i + 1), -1);
      // مدد قصيرة جداً: لا تنتهي قبل بدايتها.
      if (compareDateKeys(planned_end, planned_start) < 0) planned_end = planned_start;
    }
    return {
      name: tpl?.name || `القسم ${i + 1}`,
      sort_order: i + 1,
      planned_start,
      planned_end,
      actual_start: null,
      actual_end: null,
      status: "not_started",
      budget: 0,
      weight: 1,
      progress_override: null,
      owner_employee_id: null,
      owner_name: "",
      contractor_contact_id: null,
      contractor_name: "",
      color: tpl?.color || "#64748b",
      notes: "",
      template_key: tpl?.key || null,
      default_account_code: tpl?.default_account_code || null,
      tasks: listOf(tpl?.tasks).map((t, j) => ({
        title: t?.title || "",
        status: "todo",
        is_milestone: !!t?.is_milestone,
        due_date: planned_end,
        done_at: null,
        assignee_employee_id: null,
        assignee_name: "",
        sort_order: j + 1,
        notes: "",
      })),
    };
  });
}

export function nextProjectCode(projects) {
  let max = 0;
  for (const p of listOf(projects)) {
    const m = /^BP-(\d+)$/.exec(String(p?.code || "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `BP-${String(max + 1).padStart(3, "0")}`;
}

// ---------- الملخص ----------

const ACTIVE_STATUSES = new Set(["planning", "in_progress", "on_hold"]);

export function summarizeProjects(projects, today) {
  const day = isDateKey(today) ? today : todayRiyadh();
  const list = listOf(projects);
  let active_count = 0;
  let budget_total = 0;
  let committed_total = 0;
  let paid_total = 0;
  let late_phases = 0;
  let nearest = null;
  for (const project of list) {
    if (project?.status === "cancelled") continue;
    const money = projectBudget(project);
    budget_total += money.budget_total;
    committed_total += money.committed;
    paid_total += money.paid;
    if (!ACTIVE_STATUSES.has(project?.status)) continue;
    active_count += 1;
    for (const phase of listOf(project?.phases)) {
      if (phaseHealth(phase, phaseTasks(project, phase?.id), day) === "late") late_phases += 1;
    }
    const days = daysToOpening(project, day);
    if (days !== null && days >= 0 && (!nearest || days < nearest.days)) {
      nearest = { project_id: project.id, name: project.name, days };
    }
  }
  return {
    active_count,
    budget_total: round2(budget_total),
    committed_total: round2(committed_total),
    paid_total: round2(paid_total),
    nearest_opening: nearest,
    late_phases,
  };
}

// المعالم غير المنجزة — تُستخدم قبل تأكيد الافتتاح.
export function pendingMilestones(project) {
  return listOf(project?.tasks).filter((t) => t?.is_milestone && t?.status !== "done");
}

export function sortPhases(project) {
  return sortedPhases(project);
}
