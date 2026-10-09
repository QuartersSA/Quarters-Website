import sql from './sql-CSDV1lSC.js';
import { e as ensureOnce } from './ensureOnce-D_53iNPN.js';
import { e as ensureAccountsSchema } from './accountsTree-RnDnF4VP.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { t as todayRiyadhDateKey } from './dateUtils-Bvji1KrH.js';

// حسابات مشاريع تأسيس الفروع — دوال نقية بلا React، مشتركة بين الصفحات
// والمخزن المحلي (mock) ولاحقاً الخادم.
//
// التواريخ مفاتيح نصية `YYYY-MM-DD` وتُحسب بـ UTC حتى لا تتأثر بمنطقة
// المتصفح الزمنية. المبالغ أرقام (ريال).


// ---------- الثوابت ----------

const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "opened", "cancelled"];
const PROJECT_STATUS_LABELS = {
  planning: "تخطيط",
  in_progress: "قيد التنفيذ",
  on_hold: "متوقف",
  opened: "افتُتح",
  cancelled: "ملغى"
};
const PHASE_STATUSES = ["not_started", "in_progress", "done", "blocked"];
const PHASE_STATUS_LABELS = {
  not_started: "لم يبدأ",
  in_progress: "جارٍ",
  done: "مكتمل",
  blocked: "متعثر"
};
const TASK_STATUSES = ["todo", "in_progress", "done", "blocked"];
const TASK_STATUS_LABELS = {
  todo: "لم تبدأ",
  in_progress: "جارية",
  done: "منجزة",
  blocked: "متعثرة"
};
const ATTACHMENT_KINDS = ["contract", "permit", "design", "quote", "photo", "other"];
const ATTACHMENT_KIND_LABELS = {
  contract: "عقد",
  permit: "ترخيص",
  design: "مخطط",
  quote: "عرض سعر",
  photo: "صورة",
  other: "أخرى"
};
const HEALTH_LABELS = {
  done: "مكتمل",
  on_track: "في المسار",
  at_risk: "في خطر",
  late: "متأخر",
  not_started: "لم يبدأ"
};

// ترتيب السوء: الأعلى أسوأ — يُستخدم لاختيار أسوأ صحة في المشروع.
const HEALTH_RANK = {
  late: 4,
  at_risk: 3,
  on_track: 2,
  not_started: 1,
  done: 0
};
const INVOICE_STATUS_LABELS = {
  pending_payment: "بانتظار السداد",
  partial_paid: "مسدد جزئياً",
  paid: "مسدد",
  overdue: "متأخر"
};

// حسابات مصروفات التأسيس (مجموعة 53).
const ESTABLISHMENT_ACCOUNTS = [{
  code: "5301",
  name: "إيجار ما قبل الافتتاح"
}, {
  code: "5302",
  name: "تراخيص ورسوم حكومية"
}, {
  code: "5303",
  name: "تصميم واستشارات"
}, {
  code: "5304",
  name: "ديكور وتشطيب"
}, {
  code: "5305",
  name: "كهرباء وسباكة وتكييف"
}, {
  code: "5306",
  name: "معدات"
}, {
  code: "5307",
  name: "أثاث ولوحات"
}, {
  code: "5308",
  name: "أنظمة وتقنية"
}, {
  code: "5309",
  name: "رواتب وتدريب ما قبل الافتتاح"
}, {
  code: "5310",
  name: "تسويق الافتتاح"
}, {
  code: "5399",
  name: "أخرى"
}];
function accountName(code) {
  return ESTABLISHMENT_ACCOUNTS.find(a => a.code === String(code || ""))?.name || "";
}

// قالب الأقسام الافتراضي لفرع قهوة مختصة. كل قسم بلون مميز وحساب
// مصروف افتراضي ومهام جاهزة؛ المعالم الخمسة موزّعة على أقسامها.
const DEFAULT_PHASE_TEMPLATE = [{
  key: "contract",
  name: "العقد والإيجار",
  color: "#0ea5e9",
  default_account_code: "5301",
  tasks: [{
    title: "توقيع عقد الإيجار وتوثيقه في إيجار",
    is_milestone: false
  }, {
    title: "سداد دفعة الإيجار الأولى والتأمين",
    is_milestone: false
  }, {
    title: "تسليم الموقع",
    is_milestone: true
  }, {
    title: "تصوير الموقع وتوثيق حالته عند الاستلام",
    is_milestone: false
  }]
}, {
  key: "licenses",
  name: "التراخيص والتصاريح",
  color: "#f59e0b",
  default_account_code: "5302",
  tasks: [{
    title: "إصدار سجل تجاري للفرع",
    is_milestone: false
  }, {
    title: "رخصة بلدية (بلدي)",
    is_milestone: false
  }, {
    title: "فسح الدفاع المدني (سلامة)",
    is_milestone: false
  }, {
    title: "شهادات صحية للعاملين",
    is_milestone: false
  }, {
    title: "تصريح لوحة الواجهة",
    is_milestone: false
  }]
}, {
  key: "design",
  name: "التصميم والمخططات",
  color: "#8b5cf6",
  default_account_code: "5303",
  tasks: [{
    title: "رفع مساحي للموقع",
    is_milestone: false
  }, {
    title: "المخطط المعماري وتوزيع الفراغات",
    is_milestone: false
  }, {
    title: "تصميم البار ومسار الخدمة",
    is_milestone: false
  }, {
    title: "مخططات الكهرباء والسباكة والتكييف",
    is_milestone: false
  }, {
    title: "اعتماد التصميم النهائي",
    is_milestone: false
  }]
}, {
  key: "fitout",
  name: "الديكور والتشطيب",
  color: "#ef4444",
  default_account_code: "5304",
  tasks: [{
    title: "التعاقد مع مقاول التشطيب",
    is_milestone: false
  }, {
    title: "أعمال الهدم والجبس والأسقف",
    is_milestone: false
  }, {
    title: "الأرضيات والدهانات وتكسية الجدران",
    is_milestone: false
  }, {
    title: "تنفيذ البار والمغاسل",
    is_milestone: false
  }, {
    title: "الواجهة واللوحة الخارجية",
    is_milestone: false
  }, {
    title: "اكتمال التشطيب",
    is_milestone: true
  }]
}, {
  key: "mep",
  name: "الكهرباء والسباكة والتكييف",
  color: "#f97316",
  default_account_code: "5305",
  tasks: [{
    title: "لوحة الكهرباء ونقاط المعدات",
    is_milestone: false
  }, {
    title: "تمديدات السباكة والصرف للبار",
    is_milestone: false
  }, {
    title: "تركيب وحدات التكييف والتهوية",
    is_milestone: false
  }, {
    title: "تركيب فلتر مياه مركزي",
    is_milestone: false
  }, {
    title: "فحص واختبار التمديدات",
    is_milestone: false
  }]
}, {
  key: "equipment",
  name: "المعدات",
  color: "#14b8a6",
  default_account_code: "5306",
  tasks: [{
    title: "شراء ماكينة إسبريسو وطواحين",
    is_milestone: false
  }, {
    title: "ثلاجات ومجمدات ومبرد عرض",
    is_milestone: false
  }, {
    title: "ماكينة ثلج وغلايات وأدوات التحضير",
    is_milestone: false
  }, {
    title: "تركيب المعدات",
    is_milestone: true
  }, {
    title: "معايرة الماكينة والطواحين",
    is_milestone: false
  }]
}, {
  key: "furniture",
  name: "الأثاث واللوحات",
  color: "#a16207",
  default_account_code: "5307",
  tasks: [{
    title: "طاولات وكراسي الصالة والجلسات الخارجية",
    is_milestone: false
  }, {
    title: "رفوف العرض وخزائن التخزين",
    is_milestone: false
  }, {
    title: "لوحة القائمة واللوحات الداخلية",
    is_milestone: false
  }, {
    title: "الإضاءة الديكورية والنباتات",
    is_milestone: false
  }]
}, {
  key: "systems",
  name: "الأنظمة (POS وكاميرات وإنترنت)",
  color: "#2563eb",
  default_account_code: "5308",
  tasks: [{
    title: "اشتراك إنترنت وشبكة داخلية",
    is_milestone: false
  }, {
    title: "تركيب نظام نقاط البيع POS",
    is_milestone: false
  }, {
    title: "كاميرات المراقبة ونظام الإنذار",
    is_milestone: false
  }, {
    title: "شاشات القائمة الرقمية والصوتيات",
    is_milestone: false
  }, {
    title: "ربط الفرع بتطبيقات التوصيل",
    is_milestone: false
  }]
}, {
  key: "hiring",
  name: "التوظيف والتدريب",
  color: "#db2777",
  default_account_code: "5309",
  tasks: [{
    title: "التعاقد مع مدير الفرع",
    is_milestone: false
  }, {
    title: "توظيف الباريستا والكاشير",
    is_milestone: false
  }, {
    title: "تدريب على التحضير وخدمة العملاء",
    is_milestone: false
  }, {
    title: "تدريب على نظام POS والإغلاق اليومي",
    is_milestone: false
  }]
}, {
  key: "inventory",
  name: "المخزون الافتتاحي",
  color: "#65a30d",
  default_account_code: "5399",
  tasks: [{
    title: "طلب البن المحمص والمشروبات",
    is_milestone: false
  }, {
    title: "الحليب والمواد الاستهلاكية والتغليف",
    is_milestone: false
  }, {
    title: "الأكواب والعبوات بشعار الفرع",
    is_milestone: false
  }, {
    title: "جرد افتتاحي وتسجيله في المخزون",
    is_milestone: false
  }]
}, {
  key: "launch",
  name: "التسويق والافتتاح",
  color: "#059669",
  default_account_code: "5310",
  tasks: [{
    title: "حملة ما قبل الافتتاح على وسائل التواصل",
    is_milestone: false
  }, {
    title: "تسجيل الفرع في خرائط Google",
    is_milestone: false
  }, {
    title: "الافتتاح التجريبي",
    is_milestone: true
  }, {
    title: "معالجة ملاحظات التجريبي",
    is_milestone: false
  }, {
    title: "الافتتاح",
    is_milestone: true
  }]
}];

// ---------- مساعدات التاريخ ----------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
function isDateKey(value) {
  return DATE_RE.test(String(value || ""));
}
function parts(key) {
  const m = DATE_RE.exec(String(key || ""));
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
function utcToKey(date) {
  return date.toISOString().slice(0, 10);
}
function todayRiyadh() {
  return todayRiyadhDateKey();
}
function addDays(key, n) {
  const p = parts(key);
  if (!p) return null;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  d.setUTCDate(d.getUTCDate() + Math.trunc(Number(n) || 0));
  return utcToKey(d);
}

// b − a بالأيام (موجب إذا كان b بعد a). null عند مدخل غير صالح.
function daysBetween(a, b) {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return null;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}
function compareDateKeys(a, b) {
  return String(a || "").localeCompare(String(b || ""));
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
  return valid.length ? valid.reduce((a, b) => compareDateKeys(a, b) <= 0 ? a : b) : null;
}
function maxKey(keys) {
  const valid = keys.filter(isDateKey);
  return valid.length ? valid.reduce((a, b) => compareDateKeys(a, b) >= 0 ? a : b) : null;
}

// ---------- أرقام ----------

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function num$1(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function clampPct(value) {
  return Math.min(Math.max(Math.round(num$1(value)), 0), 100);
}
function listOf(value) {
  return Array.isArray(value) ? value : [];
}

// ---------- التقدم ----------

function phaseTasks(project, phaseId) {
  const pid = Number(phaseId);
  return listOf(project?.tasks).filter(t => Number(t?.phase_id) === pid).sort((a, b) => num$1(a?.sort_order) - num$1(b?.sort_order) || num$1(a?.id) - num$1(b?.id));
}

// تقدم القسم: override أولاً؛ وإلا المنجز/الكل؛ بلا مهام يُستنتج من الحالة.
function phaseProgress(phase, tasks) {
  const override = phase?.progress_override;
  if (override !== null && override !== undefined && override !== "" && Number.isFinite(Number(override))) {
    return clampPct(override);
  }
  const list = listOf(tasks);
  if (list.length > 0) {
    const done = list.filter(t => t?.status === "done").length;
    return clampPct(done / list.length * 100);
  }
  if (phase?.status === "done") return 100;
  if (phase?.status === "in_progress") return 50;
  return 0;
}

// تقدم المشروع مرجّح بوزن كل قسم (الافتراضي 1).
function projectProgress(project) {
  const phases = listOf(project?.phases);
  if (!phases.length) return project?.status === "opened" ? 100 : 0;
  let weighted = 0;
  let weights = 0;
  for (const phase of phases) {
    const w = phase?.weight == null || phase.weight === "" ? 1 : Math.max(num$1(phase.weight), 0);
    weighted += phaseProgress(phase, phaseTasks(project, phase?.id)) * w;
    weights += w;
  }
  return weights > 0 ? clampPct(weighted / weights) : 0;
}

// ---------- الصحة ----------

function phaseHealth(phase, tasks, today) {
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
function projectHealth(project, today) {
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
function daysToOpening(project, today) {
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
    committed += num$1(inv?.total_amount);
    paid += num$1(inv?.paid_amount);
  }
  return {
    committed: round2(committed),
    paid: round2(paid)
  };
}
function pctOf(part, whole) {
  if (whole > 0) return Math.max(Math.round(part / whole * 100), 0);
  return part > 0 ? 100 : 0;
}

// فواتير القسم تُرشَّح بـ phase_id (يمكن تمرير كل فواتير المشروع).
function phaseBudget(phase, invoices) {
  const pid = Number(phase?.id);
  const own = listOf(invoices).filter(inv => Number(inv?.phase_id) === pid);
  const budget = round2(Math.max(num$1(phase?.budget), 0));
  const {
    committed,
    paid
  } = sumInvoices(own);
  return {
    budget,
    committed,
    paid,
    remaining: round2(budget - committed),
    over: round2(Math.max(committed - budget, 0)),
    pct: pctOf(committed, budget)
  };
}
function projectBudget(project) {
  const budgetTotal = round2(Math.max(num$1(project?.budget_total), 0));
  const phasesBudget = round2(listOf(project?.phases).reduce((s, p) => s + Math.max(num$1(p?.budget), 0), 0));
  const {
    committed,
    paid
  } = sumInvoices(project?.invoices);
  return {
    budget_total: budgetTotal,
    phases_budget: phasesBudget,
    unallocated: round2(budgetTotal - phasesBudget),
    committed,
    paid,
    remaining: round2(budgetTotal - committed),
    over: round2(Math.max(committed - budgetTotal, 0)),
    pct: pctOf(committed, budgetTotal)
  };
}

// حالة الفاتورة من المسدد/الإجمالي/الاستحقاق.
function invoiceStatus(inv, today) {
  const total = num$1(inv?.total_amount);
  const paid = num$1(inv?.paid_amount);
  if (paid >= total && (total > 0 || paid > 0)) return "paid";
  const day = isDateKey(today) ? today : todayRiyadh();
  if (isDateKey(inv?.due_date) && compareDateKeys(inv.due_date, day) < 0) return "overdue";
  if (paid > 0) return "partial_paid";
  return "pending_payment";
}

// ---------- الخط الزمني ----------

// موضع شريط داخل نطاق (نسب مئوية). الأيام شاملة الطرفين؛ يُقصّ على النطاق.
function barPosition(start, end, rangeStart, rangeEnd) {
  const zero = {
    left_pct: 0,
    width_pct: 0
  };
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
  const left = daysBetween(rangeStart, s) / total * 100;
  const width = (daysBetween(s, e) + 1) / total * 100;
  return {
    left_pct: Math.min(Math.max(round2(left), 0), 100),
    width_pct: Math.min(Math.max(round2(width), 0), 100 - round2(left))
  };
}

// نطاق الخط الزمني: من أول شهر فيه حدث إلى آخر شهر، بأعمدة أشهر وخط اليوم.
function timelineRange(project, today) {
  const day = isDateKey(today) ? today : todayRiyadh();
  const phases = listOf(project?.phases);
  const tasks = listOf(project?.tasks);
  const startCandidates = [project?.contract_signed_date, ...phases.map(p => p?.planned_start), ...phases.map(p => p?.actual_start)];
  const endCandidates = [project?.target_opening_date, project?.actual_opening_date, ...phases.map(p => p?.planned_end), ...phases.map(p => p?.actual_end), ...tasks.filter(t => t?.is_milestone).map(t => t?.due_date)];
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
      width_pct: pos.width_pct
    });
    cursor = addDays(mEnd, 1);
    guard += 1;
  }
  const todayInRange = compareDateKeys(day, start) >= 0 && compareDateKeys(day, end) <= 0;
  const today_pct = todayInRange ? round2((daysBetween(start, day) + 0.5) / total * 100) : null;
  return {
    start,
    end,
    months,
    today_pct
  };
}

// ---------- القالب والأكواد ----------

// أقسام بلا id من القالب، موزّعة بالتساوي بين توقيع العقد والافتتاح
// (القسم الأخير ينتهي يوم الافتتاح). كل قسم يحمل `tasks` جاهزة للإدراج.
function buildPhasesFromTemplate(template, contractDate, targetOpening) {
  const list = listOf(template);
  const n = list.length;
  const hasDates = isDateKey(contractDate) && isDateKey(targetOpening) && compareDateKeys(targetOpening, contractDate) >= 0;
  // المدة شاملة الطرفين (يوم العقد ويوم الافتتاح) حتى تتساوى الأقسام.
  const span = hasDates ? daysBetween(contractDate, targetOpening) + 1 : 0;
  const boundary = i => {
    if (!hasDates) return null;
    const key = addDays(contractDate, Math.round(span * i / n));
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
        notes: ""
      }))
    };
  });
}
function nextProjectCode$1(projects) {
  let max = 0;
  for (const p of listOf(projects)) {
    const m = /^BP-(\d+)$/.exec(String(p?.code || "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `BP-${String(max + 1).padStart(3, "0")}`;
}

// ---------- الملخص ----------

const ACTIVE_STATUSES = new Set(["planning", "in_progress", "on_hold"]);
function summarizeProjects(projects, today) {
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
      nearest = {
        project_id: project.id,
        name: project.name,
        days
      };
    }
  }
  return {
    active_count,
    budget_total: round2(budget_total),
    committed_total: round2(committed_total),
    paid_total: round2(paid_total),
    nearest_opening: nearest,
    late_phases
  };
}

// المعالم غير المنجزة — تُستخدم قبل تأكيد الافتتاح.
function pendingMilestones$1(project) {
  return listOf(project?.tasks).filter(t => t?.is_milestone && t?.status !== "done");
}

// مشاريع تأسيس الفروع — نواة الخادم المشتركة بين مسارات
// /api/accounting/branch-projects/*: المخطط، حسابات مجموعة 53، تحميل
// المشاريع مع الأقسام والمهام والفواتير والتطورات والمرفقات، تحليل
// المدخلات، وإنشاء مشروع من القالب الافتراضي.
//
// الحسابات نفسها (التقدم، الصحة، الميزانية، القالب) في
// src/utils/branchProjectMath.js — تُستخدم هنا وفي الواجهة بلا اختلاف.


// صلاحيات القسم: محاسبة كاملة أو «تأسيس الفروع» فقط. تُستخدم لكل
// الكتابة ولقراءة المشروع الواحد.
const REQUIRE_BRANCH_PROJECTS = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_branch_projects"
  }]
};

// قراءة قائمة المشاريع فقط (GET القائمة): يضاف حامل «قسم المشتريات»
// لأن نافذة فاتورة المشتريات تحتاج القائمة لاختيار المشروع/القسم.
const REQUIRE_BRANCH_PROJECTS_READ = {
  anyOf: [...REQUIRE_BRANCH_PROJECTS.anyOf, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};
const ESTABLISHMENT_PARENT = {
  code: "53",
  name: "تكاليف تأسيس الفروع",
  name_en: "Branch Establishment Costs"
};
const FALLBACK_ACCOUNT_CODE = "5399";
const DEFAULT_PHASE_COLOR = "#64748b";
const MONEY_TOLERANCE = 0.005;

// ---------------------------------------------------------------------------
// مساعدات عامة
// ---------------------------------------------------------------------------

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function numOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function truthy(value) {
  return value === true || value === 1 || value === "true" || value === "1";
}
function str(value) {
  return value === null || value === undefined ? "" : String(value);
}
function text(value, max = 2000) {
  const t = str(value).trim();
  return t.length > max ? t.slice(0, max) : t;
}
function dateOrNull(value) {
  const t = str(value).trim();
  return isDateKey(t) ? t : null;
}

// true إذا كانت القيمة نصًا غير فارغ لكنه ليس تاريخًا صالحًا.
function badDate(value) {
  const t = str(value).trim();
  return t !== "" && !isDateKey(t);
}
function iso(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return String(value);
}
function parseJsonArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// معرّف صحيح موجب أو null (يقبل "12" من params).
function parseId(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// المخطط
// ---------------------------------------------------------------------------

async function ensureBranchProjectsSchemaImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS branch_projects (
      id SERIAL PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      city TEXT,
      district TEXT,
      address TEXT,
      area_sqm NUMERIC(10, 2),
      status TEXT NOT NULL DEFAULT 'planning',
      contract_signed_date DATE,
      target_opening_date DATE,
      actual_opening_date DATE,
      budget_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
      manager_employee_id INTEGER,
      manager_name TEXT,
      lease_contract_id INTEGER,
      lease_contract_number TEXT,
      branch_id INTEGER,
      notes TEXT,
      cover_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    ALTER TABLE branch_projects
      ADD COLUMN IF NOT EXISTS code TEXT,
      ADD COLUMN IF NOT EXISTS city TEXT,
      ADD COLUMN IF NOT EXISTS district TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planning',
      ADD COLUMN IF NOT EXISTS contract_signed_date DATE,
      ADD COLUMN IF NOT EXISTS target_opening_date DATE,
      ADD COLUMN IF NOT EXISTS actual_opening_date DATE,
      ADD COLUMN IF NOT EXISTS budget_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS manager_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS manager_name TEXT,
      ADD COLUMN IF NOT EXISTS lease_contract_id INTEGER,
      ADD COLUMN IF NOT EXISTS lease_contract_number TEXT,
      ADD COLUMN IF NOT EXISTS branch_id INTEGER,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS cover_url TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_employee_name TEXT
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_branch_projects_active
      ON branch_projects (is_active, status)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS branch_project_phases (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      planned_start DATE,
      planned_end DATE,
      actual_start DATE,
      actual_end DATE,
      status TEXT NOT NULL DEFAULT 'not_started',
      budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
      weight NUMERIC(6, 2) NOT NULL DEFAULT 1,
      progress_override NUMERIC(5, 2),
      owner_employee_id INTEGER,
      owner_name TEXT,
      contractor_contact_id INTEGER,
      contractor_name TEXT,
      color TEXT,
      template_key TEXT,
      default_account_code TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    ALTER TABLE branch_project_phases
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS planned_start DATE,
      ADD COLUMN IF NOT EXISTS planned_end DATE,
      ADD COLUMN IF NOT EXISTS actual_start DATE,
      ADD COLUMN IF NOT EXISTS actual_end DATE,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started',
      ADD COLUMN IF NOT EXISTS budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS weight NUMERIC(6, 2) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS progress_override NUMERIC(5, 2),
      ADD COLUMN IF NOT EXISTS owner_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS owner_name TEXT,
      ADD COLUMN IF NOT EXISTS contractor_contact_id INTEGER,
      ADD COLUMN IF NOT EXISTS contractor_name TEXT,
      ADD COLUMN IF NOT EXISTS color TEXT,
      ADD COLUMN IF NOT EXISTS template_key TEXT,
      ADD COLUMN IF NOT EXISTS default_account_code TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_branch_project_phases_project
      ON branch_project_phases (project_id, sort_order)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS branch_project_tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE,
      phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
      due_date DATE,
      done_at DATE,
      done_by_employee_name TEXT,
      assignee_employee_id INTEGER,
      assignee_name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    ALTER TABLE branch_project_tasks
      ADD COLUMN IF NOT EXISTS phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo',
      ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS due_date DATE,
      ADD COLUMN IF NOT EXISTS done_at DATE,
      ADD COLUMN IF NOT EXISTS done_by_employee_name TEXT,
      ADD COLUMN IF NOT EXISTS assignee_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS assignee_name TEXT,
      ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_branch_project_tasks_project
      ON branch_project_tasks (project_id, phase_id)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS branch_project_updates (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE,
      phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      photos JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by_employee_id INTEGER,
      created_by_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    ALTER TABLE branch_project_updates
      ADD COLUMN IF NOT EXISTS phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_name TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_branch_project_updates_project
      ON branch_project_updates (project_id, created_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS branch_project_attachments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES branch_projects(id) ON DELETE CASCADE,
      phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE SET NULL,
      url TEXT NOT NULL,
      label TEXT,
      kind TEXT NOT NULL DEFAULT 'other',
      created_by_employee_id INTEGER,
      created_by_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    ALTER TABLE branch_project_attachments
      ADD COLUMN IF NOT EXISTS phase_id INTEGER REFERENCES branch_project_phases(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS label TEXT,
      ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'other',
      ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_name TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_branch_project_attachments_project
      ON branch_project_attachments (project_id, created_at DESC)
  `;
  await ensureProjectInvoiceLinkColumns();

  // مجموعة حسابات التأسيس (53) تُهيَّأ مبكرًا حتى تظهر في نافذة الفاتورة.
  try {
    await ensureEstablishmentAccounts();
  } catch (error) {
    console.error("establishment accounts ensure failed", error?.message);
  }

  // ربط عقد الإيجار بالمشروع — فقط إن كان جدول العقود موجودًا (يُنشئه
  // مسار العقود).
  const [lease] = await sql`SELECT to_regclass('accounting_lease_contracts') AS t`;
  if (lease?.t) {
    await sql`
      ALTER TABLE accounting_lease_contracts
        ADD COLUMN IF NOT EXISTS project_id INTEGER
    `;
  }
}
const ensureBranchProjectsSchema = ensureOnce(ensureBranchProjectsSchemaImpl);

// أعمدة ربط فاتورة المشتريات بالمشروع/القسم — تُضاف فقط إن كان جدول
// الفواتير موجودًا (يُنشئه مسار الفواتير). يعيد true إن كان الجدول موجودًا.
// النتيجة الإيجابية تُحفظ لكل عملية (الجدول لا يختفي)؛ السلبية تُعاد.
let invoiceColumnsReady = false;
async function ensureProjectInvoiceLinkColumns() {
  if (invoiceColumnsReady) return true;
  const [reg] = await sql`SELECT to_regclass('accounting_purchase_invoices') AS t`;
  if (!reg?.t) return false;
  await sql`
    ALTER TABLE accounting_purchase_invoices
      ADD COLUMN IF NOT EXISTS project_id INTEGER,
      ADD COLUMN IF NOT EXISTS project_phase_id INTEGER
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchase_invoices_project
      ON accounting_purchase_invoices (project_id)
  `;
  invoiceColumnsReady = true;
  return true;
}

// ---------------------------------------------------------------------------
// حسابات مجموعة 53 «تكاليف تأسيس الفروع»: الأب تحت 5، والأبناء من
// ESTABLISHMENT_ACCOUNTS. بالكود النشط أولًا ثم بالاسم تحت الأب، وإلا تُنشأ.
// النتيجة Map(code → id) تُحفظ لكل عملية.
// ---------------------------------------------------------------------------
let establishmentPromise = null;
async function resolveEstablishmentAccounts() {
  await ensureAccountsSchema();
  let [parent] = await sql`
    SELECT id, code FROM accounting_accounts
    WHERE code = ${ESTABLISHMENT_PARENT.code} AND is_active AND account_type = 'expense'
    LIMIT 1
  `;
  if (!parent) {
    const [root] = await sql`
      SELECT id FROM accounting_accounts
      WHERE code = '5' AND is_system AND is_active
      LIMIT 1
    `;
    if (!root) throw new Error("حساب المصروفات الرئيسي (5) غير موجود في شجرة الحسابات");
    [parent] = await sql`
      INSERT INTO accounting_accounts (
        code, name, name_en, account_type, parent_id, is_postable, is_system
      )
      VALUES (
        ${ESTABLISHMENT_PARENT.code}, ${ESTABLISHMENT_PARENT.name}, ${ESTABLISHMENT_PARENT.name_en},
        'expense', ${root.id}, FALSE, TRUE
      )
      RETURNING id, code
    `;
  }
  const parentId = Number(parent.id);
  const codes = ESTABLISHMENT_ACCOUNTS.map(a => a.code);
  const rows = await sql`
    SELECT id, code, parent_id, TRIM(name) AS name
    FROM accounting_accounts
    WHERE is_active AND account_type = 'expense'
      AND (code = ANY(${codes}::text[]) OR parent_id = ${parentId})
  `;
  const byCode = new Map();
  const byName = new Map();
  for (const row of rows) {
    const code = String(row.code || "");
    if (codes.includes(code) && !byCode.has(code)) byCode.set(code, Number(row.id));
    if (Number(row.parent_id) === parentId && row.name && !byName.has(row.name)) {
      byName.set(row.name, Number(row.id));
    }
  }
  const result = new Map();
  for (const spec of ESTABLISHMENT_ACCOUNTS) {
    const existing = byCode.get(spec.code) ?? byName.get(spec.name.trim());
    if (existing) {
      result.set(spec.code, existing);
      continue;
    }
    const [created] = await sql`
      INSERT INTO accounting_accounts (
        code, name, name_en, account_type, parent_id, is_postable, is_system
      )
      VALUES (${spec.code}, ${spec.name}, ${spec.name_en ?? null}, 'expense', ${parentId}, TRUE, TRUE)
      RETURNING id
    `;
    result.set(spec.code, Number(created.id));
  }
  return result;
}
function ensureEstablishmentAccounts() {
  if (!establishmentPromise) {
    establishmentPromise = resolveEstablishmentAccounts().catch(error => {
      establishmentPromise = null;
      throw error;
    });
  }
  return establishmentPromise;
}
function isEstablishmentAccountCode(code) {
  const key = str(code).trim();
  return ESTABLISHMENT_ACCOUNTS.some(a => a.code === key);
}

// id حساب التأسيس للكود (يُنشأ إن غاب). كود غير معروف → 5399.
async function getEstablishmentAccountId(code) {
  const key = isEstablishmentAccountCode(code) ? str(code).trim() : FALLBACK_ACCOUNT_CODE;
  let map = await ensureEstablishmentAccounts();
  if (!map.has(key)) {
    // حُذف الحساب بعد التخزين المؤقت — أعد الحل.
    establishmentPromise = null;
    map = await ensureEstablishmentAccounts();
  }
  return map.get(key) ?? null;
}

// ---------------------------------------------------------------------------
// تحويل الصفوف إلى أشكال الواجهة
// ---------------------------------------------------------------------------

function mapProjectRow(row) {
  return {
    id: Number(row.id),
    code: str(row.code),
    name: str(row.name),
    city: str(row.city),
    district: str(row.district),
    address: str(row.address),
    area_sqm: numOrNull(row.area_sqm),
    status: str(row.status) || "planning",
    contract_signed_date: row.contract_signed_date || null,
    target_opening_date: row.target_opening_date || null,
    actual_opening_date: row.actual_opening_date || null,
    budget_total: round2(num(row.budget_total)),
    manager_employee_id: intOrNull(row.manager_employee_id),
    manager_name: str(row.manager_name),
    lease_contract_id: intOrNull(row.lease_contract_id),
    lease_contract_number: str(row.lease_contract_number),
    branch_id: intOrNull(row.branch_id),
    notes: str(row.notes),
    cover_url: row.cover_url ? String(row.cover_url) : null,
    is_active: row.is_active !== false,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    created_by_employee_id: intOrNull(row.created_by_employee_id),
    created_by_employee_name: str(row.created_by_employee_name),
    phases: [],
    tasks: [],
    invoices: [],
    updates: [],
    attachments: []
  };
}
function mapPhaseRow(row) {
  const weight = numOrNull(row.weight);
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    name: str(row.name),
    sort_order: num(row.sort_order),
    planned_start: row.planned_start || null,
    planned_end: row.planned_end || null,
    actual_start: row.actual_start || null,
    actual_end: row.actual_end || null,
    status: str(row.status) || "not_started",
    budget: round2(num(row.budget)),
    weight: weight === null || weight <= 0 ? 1 : weight,
    progress_override: numOrNull(row.progress_override),
    owner_employee_id: intOrNull(row.owner_employee_id),
    owner_name: str(row.owner_name),
    contractor_contact_id: intOrNull(row.contractor_contact_id),
    contractor_name: str(row.contractor_name),
    color: str(row.color) || DEFAULT_PHASE_COLOR,
    template_key: row.template_key ? String(row.template_key) : null,
    default_account_code: row.default_account_code ? String(row.default_account_code) : null,
    notes: str(row.notes),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at)
  };
}
function mapTaskRow(row) {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    phase_id: intOrNull(row.phase_id),
    title: str(row.title),
    status: str(row.status) || "todo",
    is_milestone: row.is_milestone === true,
    due_date: row.due_date || null,
    done_at: row.done_at || null,
    done_by_employee_name: str(row.done_by_employee_name),
    assignee_employee_id: intOrNull(row.assignee_employee_id),
    assignee_name: str(row.assignee_name),
    sort_order: num(row.sort_order),
    notes: str(row.notes),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at)
  };
}
function mapUpdateRow(row) {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    phase_id: intOrNull(row.phase_id),
    body: str(row.body),
    photos: parseJsonArray(row.photos),
    created_by_employee_id: intOrNull(row.created_by_employee_id),
    created_by_name: str(row.created_by_name),
    created_at: iso(row.created_at)
  };
}
function mapAttachmentRow(row) {
  const kind = str(row.kind);
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    phase_id: intOrNull(row.phase_id),
    url: str(row.url),
    label: str(row.label),
    kind: ATTACHMENT_KINDS.includes(kind) ? kind : "other",
    created_by_employee_id: intOrNull(row.created_by_employee_id),
    created_by_name: str(row.created_by_name),
    created_at: iso(row.created_at)
  };
}

// صف فاتورة مشتريات (مع acc/c) → ProjectInvoice. الحالة مشتقة بنفس ترتيب
// بقية النظام: مسدد → متأخر → مسدد جزئيًا → بانتظار السداد.
function mapInvoiceRow(row, today = todayRiyadh()) {
  const total = round2(num(row.total_amount));
  const paid = round2(num(row.paid_amount));
  const day = isDateKey(today) ? today : todayRiyadh();
  const dueDate = row.due_date || null;
  let status;
  if (total > 0 && paid + MONEY_TOLERANCE >= total) {
    status = "paid";
  } else if (isDateKey(dueDate) && compareDateKeys(dueDate, day) < 0) {
    status = "overdue";
  } else if (paid > MONEY_TOLERANCE) {
    status = "partial_paid";
  } else {
    status = "pending_payment";
  }
  const leaseContractId = intOrNull(row.lease_contract_id);
  return {
    id: Number(row.id),
    project_id: intOrNull(row.project_id),
    invoice_number: str(row.invoice_number),
    invoice_date: row.invoice_date || null,
    due_date: dueDate,
    supplier_name: str(row.supplier_name),
    phase_id: intOrNull(row.project_phase_id ?? row.phase_id),
    expense_account_id: intOrNull(row.expense_account_id),
    expense_account_code: str(row.expense_account_code),
    expense_account_name: str(row.expense_account_name),
    total_amount: total,
    paid_amount: paid,
    status,
    source: leaseContractId ? "lease" : "manual",
    lease_contract_id: leaseContractId,
    lease_month: row.lease_month ? String(row.lease_month) : null
  };
}

// ---------------------------------------------------------------------------
// التحميل: استعلام واحد لكل جدول ثم تجميع في JS (لا N+1).
// ---------------------------------------------------------------------------

const PROJECT_SELECT = `
  SELECT p.id, p.code, p.name, p.city, p.district, p.address, p.area_sqm, p.status,
         TO_CHAR(p.contract_signed_date, 'YYYY-MM-DD') AS contract_signed_date,
         TO_CHAR(p.target_opening_date, 'YYYY-MM-DD') AS target_opening_date,
         TO_CHAR(p.actual_opening_date, 'YYYY-MM-DD') AS actual_opening_date,
         p.budget_total, p.manager_employee_id, p.manager_name,
         p.lease_contract_id, p.lease_contract_number, p.branch_id,
         p.notes, p.cover_url, p.is_active, p.created_at, p.updated_at,
         p.created_by_employee_id, p.created_by_employee_name
  FROM branch_projects p
`;
function loadPhases(ids) {
  return sql`
    SELECT ph.id, ph.project_id, ph.name, ph.sort_order,
           TO_CHAR(ph.planned_start, 'YYYY-MM-DD') AS planned_start,
           TO_CHAR(ph.planned_end, 'YYYY-MM-DD') AS planned_end,
           TO_CHAR(ph.actual_start, 'YYYY-MM-DD') AS actual_start,
           TO_CHAR(ph.actual_end, 'YYYY-MM-DD') AS actual_end,
           ph.status, ph.budget, ph.weight, ph.progress_override,
           ph.owner_employee_id, ph.owner_name, ph.contractor_contact_id, ph.contractor_name,
           ph.color, ph.template_key, ph.default_account_code, ph.notes,
           ph.created_at, ph.updated_at
    FROM branch_project_phases ph
    WHERE ph.project_id = ANY(${ids}::int[])
    ORDER BY ph.project_id ASC, ph.sort_order ASC, ph.id ASC
  `;
}
function loadTasks(ids) {
  return sql`
    SELECT t.id, t.project_id, t.phase_id, t.title, t.status, t.is_milestone,
           TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
           TO_CHAR(t.done_at, 'YYYY-MM-DD') AS done_at,
           t.done_by_employee_name, t.assignee_employee_id, t.assignee_name,
           t.sort_order, t.notes, t.created_at, t.updated_at
    FROM branch_project_tasks t
    WHERE t.project_id = ANY(${ids}::int[])
    ORDER BY t.project_id ASC, t.phase_id ASC NULLS LAST, t.sort_order ASC, t.id ASC
  `;
}
function loadUpdates(ids) {
  return sql`
    SELECT u.id, u.project_id, u.phase_id, u.body, u.photos,
           u.created_by_employee_id, u.created_by_name, u.created_at
    FROM branch_project_updates u
    WHERE u.project_id = ANY(${ids}::int[])
    ORDER BY u.created_at DESC, u.id DESC
  `;
}
function loadAttachments(ids) {
  return sql`
    SELECT a.id, a.project_id, a.phase_id, a.url, a.label, a.kind,
           a.created_by_employee_id, a.created_by_name, a.created_at
    FROM branch_project_attachments a
    WHERE a.project_id = ANY(${ids}::int[])
    ORDER BY a.created_at DESC, a.id DESC
  `;
}
const INVOICE_SELECT = `
  SELECT inv.id, inv.project_id, inv.project_phase_id, inv.invoice_number,
         TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') AS invoice_date,
         TO_CHAR(inv.due_date, 'YYYY-MM-DD') AS due_date,
         COALESCE(NULLIF(c.name, ''), NULLIF(inv.supplier_name, '')) AS supplier_name,
         inv.contact_id, inv.expense_account_id,
         acc.code AS expense_account_code,
         acc.name AS expense_account_name,
         inv.total_amount, inv.paid_amount,
         inv.lease_contract_id, inv.lease_month, inv.is_active
  FROM accounting_purchase_invoices inv
  LEFT JOIN accounting_accounts acc ON acc.id = inv.expense_account_id
  LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
`;
async function loadInvoices(ids) {
  const linked = await ensureProjectInvoiceLinkColumns();
  if (!linked) return [];
  return sql(`${INVOICE_SELECT}
     WHERE inv.project_id = ANY($1::int[]) AND inv.is_active = TRUE
     ORDER BY inv.invoice_date DESC, inv.id DESC`, [ids]);
}

// فاتورة واحدة بنفس شكل ProjectInvoice (للمسارات التي تربط/تعدّل فاتورة).
// null إن لم توجد أو كانت موقوفة.
async function loadProjectInvoice(invoiceId) {
  const id = parseId(invoiceId);
  if (!id) return null;
  const linked = await ensureProjectInvoiceLinkColumns();
  if (!linked) return null;
  const [row] = await sql(`${INVOICE_SELECT} WHERE inv.id = $1 AND inv.is_active = TRUE LIMIT 1`, [id]);
  return row ? mapInvoiceRow(row, todayRiyadh()) : null;
}
function groupBy(rows, mapper) {
  const groups = new Map();
  for (const row of rows) {
    const key = Number(row.project_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mapper(row));
  }
  return groups;
}
function assemble(projectRows, {
  phases,
  tasks,
  invoices,
  updates,
  attachments
}, today) {
  const phaseGroups = groupBy(phases, mapPhaseRow);
  const taskGroups = groupBy(tasks, mapTaskRow);
  const invoiceGroups = groupBy(invoices, row => mapInvoiceRow(row, today));
  const updateGroups = groupBy(updates, mapUpdateRow);
  const attachmentGroups = groupBy(attachments, mapAttachmentRow);
  return projectRows.map(row => {
    const project = mapProjectRow(row);
    project.phases = phaseGroups.get(project.id) || [];
    project.tasks = taskGroups.get(project.id) || [];
    project.invoices = invoiceGroups.get(project.id) || [];
    project.updates = updateGroups.get(project.id) || [];
    project.attachments = attachmentGroups.get(project.id) || [];
    return project;
  });
}

// كل المشاريع النشطة مع الأقسام والمهام والفواتير (updates/attachments فارغة
// للخفة). الجارية أولًا ثم بموعد الافتتاح.
async function listProjects() {
  const rows = await sql(`
    ${PROJECT_SELECT}
    WHERE p.is_active = TRUE
    ORDER BY (p.status IN ('planning', 'in_progress', 'on_hold')) DESC,
             p.target_opening_date ASC NULLS LAST,
             p.id DESC
  `);
  if (!rows.length) return [];
  const ids = rows.map(row => Number(row.id));
  const [phases, tasks, invoices] = await Promise.all([loadPhases(ids), loadTasks(ids), loadInvoices(ids)]);
  return assemble(rows, {
    phases,
    tasks,
    invoices,
    updates: [],
    attachments: []
  }, todayRiyadh());
}

// مشروع واحد كامل (كل الأبناء). null إن لم يوجد أو كان محذوفًا.
async function loadProject(id) {
  const projectId = parseId(id);
  if (!projectId) return null;
  const [row] = await sql(`${PROJECT_SELECT} WHERE p.id = $1 AND p.is_active = TRUE`, [projectId]);
  if (!row) return null;
  const ids = [projectId];
  const [phases, tasks, invoices, updates, attachments] = await Promise.all([loadPhases(ids), loadTasks(ids), loadInvoices(ids), loadUpdates(ids), loadAttachments(ids)]);
  const [project] = assemble([row], {
    phases,
    tasks,
    invoices,
    updates,
    attachments
  }, todayRiyadh());
  return project || null;
}
async function projectExists(id) {
  const projectId = parseId(id);
  if (!projectId) return false;
  const [row] = await sql`
    SELECT 1 AS ok FROM branch_projects
    WHERE id = ${projectId} AND is_active = TRUE
    LIMIT 1
  `;
  return !!row;
}
async function phaseBelongsToProject(phaseId, projectId) {
  const pid = parseId(phaseId);
  const prj = parseId(projectId);
  if (!pid || !prj) return false;
  const [row] = await sql`
    SELECT 1 AS ok FROM branch_project_phases
    WHERE id = ${pid} AND project_id = ${prj}
    LIMIT 1
  `;
  return !!row;
}

// قسم واحد بشكل Phase (بعد POST/PUT). null إن لم يوجد.
async function loadPhase(phaseId, projectId = null) {
  const pid = parseId(phaseId);
  if (!pid) return null;
  const prj = parseId(projectId);
  const rows = await sql`
    SELECT ph.id, ph.project_id, ph.name, ph.sort_order,
           TO_CHAR(ph.planned_start, 'YYYY-MM-DD') AS planned_start,
           TO_CHAR(ph.planned_end, 'YYYY-MM-DD') AS planned_end,
           TO_CHAR(ph.actual_start, 'YYYY-MM-DD') AS actual_start,
           TO_CHAR(ph.actual_end, 'YYYY-MM-DD') AS actual_end,
           ph.status, ph.budget, ph.weight, ph.progress_override,
           ph.owner_employee_id, ph.owner_name, ph.contractor_contact_id, ph.contractor_name,
           ph.color, ph.template_key, ph.default_account_code, ph.notes,
           ph.created_at, ph.updated_at
    FROM branch_project_phases ph
    WHERE ph.id = ${pid} AND (${prj}::int IS NULL OR ph.project_id = ${prj}::int)
    LIMIT 1
  `;
  return rows[0] ? mapPhaseRow(rows[0]) : null;
}

// مهمة واحدة بشكل Task (بعد POST/PUT). null إن لم توجد.
async function loadTask(taskId, projectId = null) {
  const tid = parseId(taskId);
  if (!tid) return null;
  const prj = parseId(projectId);
  const rows = await sql`
    SELECT t.id, t.project_id, t.phase_id, t.title, t.status, t.is_milestone,
           TO_CHAR(t.due_date, 'YYYY-MM-DD') AS due_date,
           TO_CHAR(t.done_at, 'YYYY-MM-DD') AS done_at,
           t.done_by_employee_name, t.assignee_employee_id, t.assignee_name,
           t.sort_order, t.notes, t.created_at, t.updated_at
    FROM branch_project_tasks t
    WHERE t.id = ${tid} AND (${prj}::int IS NULL OR t.project_id = ${prj}::int)
    LIMIT 1
  `;
  return rows[0] ? mapTaskRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// الأكواد والمعالم والتدقيق
// ---------------------------------------------------------------------------

// "BP-00N" من أعلى رقم موجود (يشمل المحذوفة حتى لا يُعاد استخدام كود).
async function nextProjectCode() {
  const rows = await sql`
    SELECT code FROM branch_projects WHERE code ~ '^BP-[0-9]+$'
  `;
  let max = 0;
  for (const row of rows) {
    const m = /^BP-(\d+)$/.exec(String(row.code || "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `BP-${String(max + 1).padStart(3, "0")}`;
}

// عناوين المعالم غير المنجزة — تُفحص قبل تأكيد الافتتاح.
async function pendingMilestones(projectId) {
  const id = parseId(projectId);
  if (!id) return [];
  const rows = await sql`
    SELECT title FROM branch_project_tasks
    WHERE project_id = ${id} AND is_milestone = TRUE AND status <> 'done'
    ORDER BY due_date ASC NULLS LAST, sort_order ASC, id ASC
  `;
  return rows.map(row => str(row.title));
}
async function logProjectAudit({
  projectId,
  action,
  summary = null,
  actor = null
}) {
  return logPurchaseAudit({
    entityType: "branch_project",
    entityId: parseId(projectId),
    action,
    summary,
    actor
  });
}

// ---------------------------------------------------------------------------
// تحليل المدخلات. كل دالة تعيد { value, error }؛ مع existing تسقط الحقول
// الغائبة (undefined) إلى القيم المخزّنة (PUT جزئي)، بينما null/"" تمسح.
// ---------------------------------------------------------------------------

function fail(error) {
  return {
    value: null,
    error
  };
}
function parseProjectInput(body = {}, existing = null) {
  const input = body && typeof body === "object" ? body : {};
  const base = existing || {};
  const has = key => input[key] !== undefined;
  const pick = (key, fallback) => has(key) ? input[key] : base[key] ?? fallback;
  const name = text(pick("name", ""), 300);
  if (!name) return fail("اسم المشروع مطلوب");
  const city = text(pick("city", ""), 200);
  if (!city) return fail("المدينة مطلوبة");
  const district = text(pick("district", ""), 200);
  const address = text(pick("address", ""), 500);
  let areaSqm = null;
  if (has("area_sqm")) {
    if (input.area_sqm !== null && input.area_sqm !== "") {
      areaSqm = numOrNull(input.area_sqm);
      if (areaSqm === null || areaSqm < 0) return fail("المساحة غير صحيحة");
      areaSqm = round2(areaSqm);
    }
  } else {
    areaSqm = numOrNull(base.area_sqm);
  }

  // الحالة: الافتراضي planning؛ 'opened' لا يُقبل هنا (مسار الافتتاح فقط).
  let status = str(pick("status", "planning")).trim() || "planning";
  if (!PROJECT_STATUSES.includes(status)) return fail("حالة المشروع غير معروفة");
  if (status === "opened" && (!existing || base.status !== "opened")) {
    status = existing ? str(base.status) || "planning" : "planning";
  }
  const contractRaw = pick("contract_signed_date", null);
  if (badDate(contractRaw)) return fail("تاريخ توقيع العقد غير صحيح (YYYY-MM-DD)");
  const contractSigned = dateOrNull(contractRaw);
  if (!contractSigned) return fail("تاريخ توقيع العقد مطلوب");
  const targetRaw = pick("target_opening_date", null);
  if (badDate(targetRaw)) return fail("موعد الافتتاح المستهدف غير صحيح (YYYY-MM-DD)");
  const targetOpening = dateOrNull(targetRaw);
  if (!targetOpening) return fail("موعد الافتتاح المستهدف مطلوب");
  if (compareDateKeys(targetOpening, contractSigned) < 0) {
    return fail("موعد الافتتاح المستهدف يجب أن يكون بعد تاريخ توقيع العقد أو يساويه");
  }
  const actualRaw = pick("actual_opening_date", null);
  if (badDate(actualRaw)) return fail("تاريخ الافتتاح الفعلي غير صحيح (YYYY-MM-DD)");
  const actualOpening = dateOrNull(actualRaw);
  let budgetTotal = 0;
  const budgetRaw = pick("budget_total", 0);
  if (budgetRaw !== null && budgetRaw !== "") {
    const n = Number(budgetRaw);
    if (!Number.isFinite(n) || n < 0) return fail("الميزانية الإجمالية غير صحيحة");
    budgetTotal = round2(n);
  }
  const managerRaw = pick("manager_employee_id", null);
  if (managerRaw !== null && managerRaw !== "" && intOrNull(managerRaw) === null) {
    return fail("رقم مدير المشروع غير صحيح");
  }
  const leaseRaw = pick("lease_contract_id", null);
  if (leaseRaw !== null && leaseRaw !== "" && intOrNull(leaseRaw) === null) {
    return fail("رقم عقد الإيجار غير صحيح");
  }
  const branchRaw = pick("branch_id", null);
  if (branchRaw !== null && branchRaw !== "" && intOrNull(branchRaw) === null) {
    return fail("رقم الفرع غير صحيح");
  }
  const coverRaw = pick("cover_url", null);
  const codeRaw = pick("code", null);
  const code = text(codeRaw, 40) || null;
  return {
    error: null,
    value: {
      code,
      name,
      city,
      district,
      address,
      area_sqm: areaSqm,
      status,
      contract_signed_date: contractSigned,
      target_opening_date: targetOpening,
      actual_opening_date: actualOpening,
      budget_total: budgetTotal,
      manager_employee_id: intOrNull(managerRaw),
      manager_name: text(pick("manager_name", ""), 200),
      lease_contract_id: intOrNull(leaseRaw),
      lease_contract_number: text(pick("lease_contract_number", ""), 100),
      branch_id: intOrNull(branchRaw),
      notes: text(pick("notes", ""), 5000),
      cover_url: coverRaw ? String(coverRaw).trim() || null : null
    }
  };
}
function parsePhaseInput(body = {}, existing = null) {
  const input = body && typeof body === "object" ? body : {};
  const base = existing || {};
  const has = key => input[key] !== undefined;
  const pick = (key, fallback) => has(key) ? input[key] : base[key] ?? fallback;
  const name = text(pick("name", ""), 300);
  if (!name) return fail("اسم القسم مطلوب");
  const dateFields = [["planned_start", "تاريخ البداية المخطط غير صحيح (YYYY-MM-DD)"], ["planned_end", "تاريخ النهاية المخطط غير صحيح (YYYY-MM-DD)"], ["actual_start", "تاريخ البداية الفعلي غير صحيح (YYYY-MM-DD)"], ["actual_end", "تاريخ النهاية الفعلي غير صحيح (YYYY-MM-DD)"]];
  const dates = {};
  for (const [key, message] of dateFields) {
    const raw = pick(key, null);
    if (badDate(raw)) return fail(message);
    dates[key] = dateOrNull(raw);
  }
  if (dates.planned_start && dates.planned_end && compareDateKeys(dates.planned_end, dates.planned_start) < 0) {
    return fail("تاريخ نهاية القسم المخطط يجب أن يكون بعد بدايته أو يساويه");
  }
  if (dates.actual_start && dates.actual_end && compareDateKeys(dates.actual_end, dates.actual_start) < 0) {
    return fail("تاريخ نهاية القسم الفعلي يجب أن يكون بعد بدايته أو يساويه");
  }
  const status = str(pick("status", "not_started")).trim() || "not_started";
  if (!PHASE_STATUSES.includes(status)) return fail("حالة القسم غير معروفة");
  let budget = 0;
  const budgetRaw = pick("budget", 0);
  if (budgetRaw !== null && budgetRaw !== "") {
    const n = Number(budgetRaw);
    if (!Number.isFinite(n) || n < 0) return fail("ميزانية القسم غير صحيحة");
    budget = round2(n);
  }

  // الوزن: غياب/فراغ → المخزّن أو 1؛ صفر → 1 (كما في المخزن المحلي).
  let weight;
  if (input.weight === undefined || input.weight === null || input.weight === "") {
    weight = num(base.weight) || 1;
  } else {
    const n = Number(input.weight);
    if (!Number.isFinite(n) || n < 0) return fail("وزن القسم غير صحيح");
    weight = n || 1;
  }
  let progressOverride = null;
  if (has("progress_override")) {
    progressOverride = numOrNull(input.progress_override);
    if (input.progress_override !== null && input.progress_override !== "" && progressOverride === null) {
      return fail("نسبة التقدم غير صحيحة");
    }
  } else {
    progressOverride = numOrNull(base.progress_override);
  }
  if (progressOverride !== null && (progressOverride < 0 || progressOverride > 100)) {
    return fail("نسبة التقدم يجب أن تكون بين 0 و100");
  }
  const ownerRaw = pick("owner_employee_id", null);
  if (ownerRaw !== null && ownerRaw !== "" && intOrNull(ownerRaw) === null) {
    return fail("رقم مسؤول القسم غير صحيح");
  }
  const contractorRaw = pick("contractor_contact_id", null);
  if (contractorRaw !== null && contractorRaw !== "" && intOrNull(contractorRaw) === null) {
    return fail("رقم جهة المقاول غير صحيح");
  }
  const colorRaw = text(pick("color", ""), 32);
  const color = /^#[0-9a-fA-F]{3,8}$/.test(colorRaw) ? colorRaw : DEFAULT_PHASE_COLOR;
  let sortOrder = null;
  if (has("sort_order")) {
    sortOrder = Number.isFinite(Number(input.sort_order)) ? Math.trunc(Number(input.sort_order)) : 0;
  } else if (base.sort_order !== undefined && base.sort_order !== null) {
    sortOrder = num(base.sort_order);
  }
  const templateKeyRaw = pick("template_key", null);
  const accountCodeRaw = pick("default_account_code", null);
  const defaultAccountCode = text(accountCodeRaw, 20) || null;
  return {
    error: null,
    value: {
      name,
      sort_order: sortOrder,
      planned_start: dates.planned_start,
      planned_end: dates.planned_end,
      actual_start: dates.actual_start,
      actual_end: dates.actual_end,
      status,
      budget,
      weight,
      progress_override: progressOverride,
      owner_employee_id: intOrNull(ownerRaw),
      owner_name: text(pick("owner_name", ""), 200),
      contractor_contact_id: intOrNull(contractorRaw),
      contractor_name: text(pick("contractor_name", ""), 200),
      color,
      template_key: text(templateKeyRaw, 50) || null,
      default_account_code: defaultAccountCode,
      notes: text(pick("notes", ""), 5000)
    }
  };
}
function parseTaskInput(body = {}, existing = null) {
  const input = body && typeof body === "object" ? body : {};
  const base = existing || {};
  const has = key => input[key] !== undefined;
  const pick = (key, fallback) => has(key) ? input[key] : base[key] ?? fallback;
  const title = text(pick("title", ""), 500);
  if (!title) return fail("عنوان المهمة مطلوب");
  const phaseRaw = pick("phase_id", null);
  if (phaseRaw !== null && phaseRaw !== "" && intOrNull(phaseRaw) === null) {
    return fail("رقم القسم غير صحيح");
  }
  const status = str(pick("status", "todo")).trim() || "todo";
  if (!TASK_STATUSES.includes(status)) return fail("حالة المهمة غير معروفة");
  const dueRaw = pick("due_date", null);
  if (badDate(dueRaw)) return fail("تاريخ استحقاق المهمة غير صحيح (YYYY-MM-DD)");
  const dueDate = dateOrNull(dueRaw);
  const doneRaw = pick("done_at", null);
  if (badDate(doneRaw)) return fail("تاريخ إنجاز المهمة غير صحيح (YYYY-MM-DD)");
  let doneAt = dateOrNull(doneRaw);
  if (status === "done" && !doneAt) doneAt = todayRiyadh();
  if (status !== "done") doneAt = null;
  const assigneeRaw = pick("assignee_employee_id", null);
  if (assigneeRaw !== null && assigneeRaw !== "" && intOrNull(assigneeRaw) === null) {
    return fail("رقم المسؤول عن المهمة غير صحيح");
  }
  let sortOrder = null;
  if (has("sort_order")) {
    sortOrder = Number.isFinite(Number(input.sort_order)) ? Math.trunc(Number(input.sort_order)) : 0;
  } else if (base.sort_order !== undefined && base.sort_order !== null) {
    sortOrder = num(base.sort_order);
  }
  return {
    error: null,
    value: {
      phase_id: intOrNull(phaseRaw),
      title,
      status,
      is_milestone: has("is_milestone") ? truthy(input.is_milestone) : base.is_milestone === true,
      due_date: dueDate,
      done_at: doneAt,
      assignee_employee_id: intOrNull(assigneeRaw),
      assignee_name: text(pick("assignee_name", ""), 200),
      sort_order: sortOrder,
      notes: text(pick("notes", ""), 5000)
    }
  };
}

// ---------------------------------------------------------------------------
// إنشاء مشروع (مع القالب الافتراضي). ثلاث رحلات بعد إدراج المشروع:
// الأقسام دفعة واحدة (RETURNING id, sort_order) ثم المهام دفعة واحدة.
// أي فشل بعد إدراج المشروع يحذفه (CASCADE) ويعيد رمي الخطأ.
// ---------------------------------------------------------------------------
async function createProjectWithTemplate(value, {
  template = "default",
  actor = null
} = {}) {
  const code = value.code || (await nextProjectCode());
  const actorId = actor?.id ? Number(actor.id) : null;
  const actorName = actor?.name ? String(actor.name) : null;
  const [row] = await sql`
    INSERT INTO branch_projects (
      code, name, city, district, address, area_sqm, status,
      contract_signed_date, target_opening_date, actual_opening_date,
      budget_total, manager_employee_id, manager_name,
      lease_contract_id, lease_contract_number, branch_id, notes, cover_url,
      created_by_employee_id, created_by_employee_name
    )
    VALUES (
      ${code}, ${value.name}, ${value.city || null}, ${value.district || null}, ${value.address || null},
      ${value.area_sqm ?? null}, ${value.status || "planning"},
      ${value.contract_signed_date || null}, ${value.target_opening_date || null}, ${value.actual_opening_date || null},
      ${value.budget_total ?? 0}, ${value.manager_employee_id ?? null}, ${value.manager_name || null},
      ${value.lease_contract_id ?? null}, ${value.lease_contract_number || null}, ${value.branch_id ?? null},
      ${value.notes || null}, ${value.cover_url || null},
      ${actorId}, ${actorName}
    )
    RETURNING id
  `;
  const projectId = Number(row.id);
  try {
    if (template !== "empty") {
      const built = buildPhasesFromTemplate(DEFAULT_PHASE_TEMPLATE, value.contract_signed_date, value.target_opening_date);
      if (built.length) {
        const phaseRows = built.map((phase, i) => ({
          sort_order: i + 1,
          name: phase.name,
          planned_start: phase.planned_start,
          planned_end: phase.planned_end,
          status: phase.status || "not_started",
          budget: num(phase.budget),
          weight: num(phase.weight) || 1,
          color: phase.color || DEFAULT_PHASE_COLOR,
          template_key: phase.template_key,
          default_account_code: phase.default_account_code
        }));
        const inserted = await sql`
          INSERT INTO branch_project_phases (
            project_id, name, sort_order, planned_start, planned_end, status,
            budget, weight, color, template_key, default_account_code,
            owner_name, contractor_name, notes
          )
          SELECT ${projectId}, r.name, r.sort_order, r.planned_start::date, r.planned_end::date, r.status,
                 r.budget, r.weight, r.color, r.template_key, r.default_account_code,
                 '', '', ''
          FROM json_to_recordset(${JSON.stringify(phaseRows)}::json) AS r(
            sort_order int, name text, planned_start text, planned_end text, status text,
            budget numeric, weight numeric, color text, template_key text, default_account_code text
          )
          ORDER BY r.sort_order
          RETURNING id, sort_order
        `;
        const idBySort = new Map(inserted.map(r => [Number(r.sort_order), Number(r.id)]));
        const taskRows = [];
        built.forEach((phase, i) => {
          const phaseId = idBySort.get(i + 1);
          if (!phaseId) return;
          for (const task of phase.tasks || []) {
            taskRows.push({
              phase_id: phaseId,
              title: task.title,
              is_milestone: task.is_milestone === true,
              due_date: task.due_date,
              sort_order: num(task.sort_order)
            });
          }
        });
        if (taskRows.length) {
          await sql`
            INSERT INTO branch_project_tasks (
              project_id, phase_id, title, status, is_milestone, due_date, sort_order,
              assignee_name, notes
            )
            SELECT ${projectId}, r.phase_id, r.title, 'todo', r.is_milestone, r.due_date::date, r.sort_order,
                   '', ''
            FROM json_to_recordset(${JSON.stringify(taskRows)}::json) AS r(
              phase_id int, title text, is_milestone boolean, due_date text, sort_order int
            )
            ORDER BY r.phase_id, r.sort_order
          `;
        }
      }
    }
  } catch (error) {
    try {
      await sql`DELETE FROM branch_projects WHERE id = ${projectId}`;
    } catch (cleanupError) {
      console.error("branch project rollback failed", cleanupError);
    }
    throw error;
  }
  return projectId;
}

export { ATTACHMENT_KINDS as A, nextProjectCode$1 as B, addDays as C, DEFAULT_PHASE_TEMPLATE as D, ESTABLISHMENT_ACCOUNTS as E, PHASE_STATUS_LABELS as F, projectProgress as G, HEALTH_LABELS as H, projectHealth as I, projectBudget as J, daysToOpening as K, summarizeProjects as L, phaseHealth as M, phaseTasks as N, timelineRange as O, PROJECT_STATUS_LABELS as P, phaseProgress as Q, REQUIRE_BRANCH_PROJECTS as R, barPosition as S, phaseBudget as T, daysBetween as U, PHASE_STATUSES as V, TASK_STATUSES as W, TASK_STATUS_LABELS as X, INVOICE_STATUS_LABELS as Y, phaseBelongsToProject as a, ensureProjectInvoiceLinkColumns as b, parseId as c, ATTACHMENT_KIND_LABELS as d, ensureBranchProjectsSchema as e, loadProjectInvoice as f, getEstablishmentAccountId as g, pendingMilestones as h, loadProject as i, loadPhase as j, parsePhaseInput as k, logProjectAudit as l, mapAttachmentRow as m, parseProjectInput as n, loadTask as o, projectExists as p, parseTaskInput as q, mapUpdateRow as r, listProjects as s, createProjectWithTemplate as t, REQUIRE_BRANCH_PROJECTS_READ as u, todayRiyadh as v, accountName as w, invoiceStatus as x, pendingMilestones$1 as y, buildPhasesFromTemplate as z };
