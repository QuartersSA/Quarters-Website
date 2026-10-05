// مخزن محلي مؤقت لمشاريع تأسيس الفروع — يحاكي واجهة
// `/api/accounting/branch-projects` في localStorage حتى تُربط الخلفية.
//
// كل الدوال async وتعيد نسخاً عميقة؛ المعرّفات أعداد صحيحة متزايدة لكل
// مجموعة. كل وصول إلى localStorage محروس بـ try/catch مع نسخة في الذاكرة
// حتى لا ينهار SSR أو نافذة التصفح الخاص.

import {
  DEFAULT_PHASE_TEMPLATE,
  accountName,
  addDays,
  buildPhasesFromTemplate,
  invoiceStatus,
  nextProjectCode,
  pendingMilestones,
  todayRiyadh,
} from "./branchProjectMath";

export const BRANCH_PROJECTS_STORAGE_KEY = "branchProjects.mock.v1";

const COLLECTIONS = ["project", "phase", "task", "invoice", "update", "attachment"];
const DEFAULT_AUTHOR = "الإدارة";

let memoryStore = null;

// ---------- التخزين ----------

function clone(value) {
  if (value === undefined) return value;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // سقوط إلى JSON
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function readStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BRANCH_PROJECTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.projects) && parsed.seq ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRANCH_PROJECTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // تخزين ممنوع (خاص/ممتلئ) — تبقى النسخة في الذاكرة.
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BRANCH_PROJECTS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function loadStore() {
  if (memoryStore) return memoryStore;
  memoryStore = readStorage() || buildSeed();
  writeStorage(memoryStore);
  return memoryStore;
}

function persist(store) {
  memoryStore = store;
  writeStorage(store);
}

function nextId(store, collection) {
  const current = Number(store.seq[collection]) || 0;
  store.seq[collection] = current + 1;
  return current + 1;
}

// ---------- مساعدات ----------

function delay(ms = 60) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function numOr0(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value) {
  return value === null || value === undefined ? "" : String(value);
}

function dateOrNull(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null;
}

function notFound(what = "المشروع") {
  const error = new Error(`${what} غير موجود`);
  error.code = "not_found";
  error.status = 404;
  return error;
}

function findProject(store, id) {
  const project = store.projects.find((p) => p.id === Number(id));
  if (!project) throw notFound();
  return project;
}

function touch(project) {
  project.updated_at = nowIso();
}

function maxSort(list) {
  return list.reduce((m, row) => Math.max(m, numOr0(row.sort_order)), 0);
}

function normalizePhaseInput(input, existing) {
  const base = existing || {};
  return {
    name: str(input.name ?? base.name),
    planned_start: dateOrNull(input.planned_start ?? base.planned_start),
    planned_end: dateOrNull(input.planned_end ?? base.planned_end),
    actual_start: dateOrNull(input.actual_start ?? base.actual_start),
    actual_end: dateOrNull(input.actual_end ?? base.actual_end),
    status: str(input.status ?? base.status ?? "not_started") || "not_started",
    budget: numOr0(input.budget ?? base.budget),
    weight: input.weight == null || input.weight === "" ? numOr0(base.weight) || 1 : numOr0(input.weight) || 1,
    progress_override:
      input.progress_override === undefined ? (base.progress_override ?? null) : numOrNull(input.progress_override),
    owner_employee_id: numOrNull(input.owner_employee_id ?? base.owner_employee_id),
    owner_name: str(input.owner_name ?? base.owner_name),
    contractor_contact_id: numOrNull(input.contractor_contact_id ?? base.contractor_contact_id),
    contractor_name: str(input.contractor_name ?? base.contractor_name),
    color: str(input.color ?? base.color) || "#64748b",
    notes: str(input.notes ?? base.notes),
    template_key: input.template_key ?? base.template_key ?? null,
    default_account_code: input.default_account_code ?? base.default_account_code ?? null,
  };
}

function normalizeTaskInput(input, existing) {
  const base = existing || {};
  const status = str(input.status ?? base.status ?? "todo") || "todo";
  let done_at = input.done_at === undefined ? (base.done_at ?? null) : dateOrNull(input.done_at);
  if (status === "done" && !done_at) done_at = todayRiyadh();
  if (status !== "done") done_at = null;
  return {
    phase_id: numOrNull(input.phase_id ?? base.phase_id),
    title: str(input.title ?? base.title),
    status,
    is_milestone: input.is_milestone === undefined ? !!base.is_milestone : !!input.is_milestone,
    due_date: input.due_date === undefined ? (base.due_date ?? null) : dateOrNull(input.due_date),
    done_at,
    assignee_employee_id: numOrNull(input.assignee_employee_id ?? base.assignee_employee_id),
    assignee_name: str(input.assignee_name ?? base.assignee_name),
    notes: str(input.notes ?? base.notes),
  };
}

const PROJECT_FIELDS = [
  "name",
  "city",
  "district",
  "address",
  "area_sqm",
  "status",
  "contract_signed_date",
  "target_opening_date",
  "actual_opening_date",
  "budget_total",
  "manager_employee_id",
  "manager_name",
  "lease_contract_id",
  "lease_contract_number",
  "notes",
  "cover_url",
];

function applyProjectFields(project, body) {
  for (const key of PROJECT_FIELDS) {
    if (!(key in body)) continue;
    const value = body[key];
    switch (key) {
      case "area_sqm":
      case "manager_employee_id":
      case "lease_contract_id":
        project[key] = numOrNull(value);
        break;
      case "budget_total":
        project[key] = numOr0(value);
        break;
      case "contract_signed_date":
      case "target_opening_date":
      case "actual_opening_date":
        project[key] = dateOrNull(value);
        break;
      case "cover_url":
        project[key] = value ? String(value) : null;
        break;
      default:
        project[key] = str(value);
    }
  }
}

// إدراج أقسام (مع مهامها) من القالب في مشروع.
function insertTemplatePhases(store, project, phases) {
  for (const built of phases) {
    const { tasks, ...phaseFields } = built;
    const phase = { id: nextId(store, "phase"), project_id: project.id, ...phaseFields };
    project.phases.push(phase);
    for (const t of tasks || []) {
      project.tasks.push({ id: nextId(store, "task"), project_id: project.id, phase_id: phase.id, ...t });
    }
  }
}

function newProject(store, body) {
  const id = nextId(store, "project");
  const ts = nowIso();
  const project = {
    id,
    code: nextProjectCode(store.projects),
    name: "",
    city: "",
    district: "",
    address: "",
    area_sqm: null,
    status: "planning",
    contract_signed_date: null,
    target_opening_date: null,
    actual_opening_date: null,
    budget_total: 0,
    manager_employee_id: null,
    manager_name: "",
    lease_contract_id: null,
    lease_contract_number: "",
    notes: "",
    cover_url: null,
    created_at: ts,
    updated_at: ts,
    phases: [],
    tasks: [],
    invoices: [],
    updates: [],
    attachments: [],
  };
  applyProjectFields(project, body || {});
  if (!project.name) project.name = `مشروع ${project.code}`;
  return project;
}

// ---------- بيانات العيّنة ----------

function buildSeed() {
  const store = {
    projects: [],
    seq: Object.fromEntries(COLLECTIONS.map((c) => [c, 0])),
  };

  // (1) فرع الواحة — الدمام، قيد التنفيذ.
  const oasis = newProject(store, {
    name: "فرع الواحة",
    city: "الدمام",
    district: "حي الواحة",
    address: "شارع الأمير محمد بن فهد، مجمع الواحة التجاري",
    area_sqm: 140,
    status: "in_progress",
    contract_signed_date: "2026-06-01",
    target_opening_date: "2026-11-11",
    budget_total: 650000,
    manager_name: "فهد العتيبي",
    lease_contract_number: "LC-2026-004",
    notes: "موقع على زاوية بواجهتين؛ المقاول ملتزم بتسليم التشطيب قبل منتصف أكتوبر.",
  });
  const schedule = [
    { planned_start: "2026-06-01", planned_end: "2026-06-15", actual_start: "2026-06-01", actual_end: "2026-06-14", status: "done", budget: 60000, owner_name: "فهد العتيبي" },
    { planned_start: "2026-06-16", planned_end: "2026-07-15", actual_start: "2026-06-16", actual_end: "2026-07-20", status: "done", budget: 25000, owner_name: "سارة القحطاني" },
    { planned_start: "2026-07-01", planned_end: "2026-07-31", actual_start: "2026-07-05", actual_end: "2026-08-02", status: "done", budget: 40000, contractor_name: "استوديو خط للتصميم" },
    { planned_start: "2026-08-01", planned_end: "2026-10-10", actual_start: "2026-08-03", actual_end: null, status: "in_progress", budget: 180000, contractor_name: "مؤسسة البناء الحديث للمقاولات", owner_name: "فهد العتيبي" },
    { planned_start: "2026-09-15", planned_end: "2026-10-15", status: "not_started", budget: 70000, contractor_name: "شركة التيار للكهرباء والتكييف" },
    { planned_start: "2026-10-10", planned_end: "2026-10-25", status: "not_started", budget: 120000 },
    { planned_start: "2026-10-15", planned_end: "2026-10-28", status: "not_started", budget: 45000 },
    { planned_start: "2026-10-20", planned_end: "2026-10-31", status: "not_started", budget: 25000 },
    { planned_start: "2026-10-01", planned_end: "2026-11-05", status: "not_started", budget: 15000, owner_name: "سارة القحطاني" },
    { planned_start: "2026-11-01", planned_end: "2026-11-08", status: "not_started", budget: 10000 },
    { planned_start: "2026-10-25", planned_end: "2026-11-11", status: "not_started", budget: 10000 },
  ];
  const built = buildPhasesFromTemplate(
    DEFAULT_PHASE_TEMPLATE,
    oasis.contract_signed_date,
    oasis.target_opening_date,
  ).map((phase, i) => {
    const over = schedule[i] || {};
    const merged = { ...phase, ...over };
    merged.tasks = phase.tasks.map((t) => ({ ...t, due_date: merged.planned_end }));
    if (merged.status === "done") {
      merged.tasks = merged.tasks.map((t) => ({ ...t, status: "done", done_at: merged.actual_end }));
    }
    return merged;
  });
  // القسم 4 جارٍ: نصف المهام منجزة.
  built[3].tasks = built[3].tasks.map((t, j) =>
    j < 3 ? { ...t, status: "done", done_at: addDays("2026-08-20", j * 12) } : j === 3 ? { ...t, status: "in_progress" } : t,
  );
  insertTemplatePhases(store, oasis, built);
  const phaseId = (i) => oasis.phases[i].id;

  const invoiceRows = [
    { invoice_number: "LEASE-LC-2026-004-01", invoice_date: "2026-06-01", due_date: "2026-06-01", supplier_name: "شركة الواحة العقارية", phase_id: phaseId(0), expense_account_code: "5301", total_amount: 57500, paid_amount: 57500, source: "lease" },
    { invoice_number: "BLD-1042", invoice_date: "2026-06-20", due_date: "2026-07-05", supplier_name: "أمانة المنطقة الشرقية", phase_id: phaseId(1), expense_account_code: "5302", total_amount: 8500, paid_amount: 8500 },
    { invoice_number: "DS-2026-17", invoice_date: "2026-07-10", due_date: "2026-08-10", supplier_name: "استوديو خط للتصميم", phase_id: phaseId(2), expense_account_code: "5303", total_amount: 38000, paid_amount: 38000 },
    { invoice_number: "CT-0088", invoice_date: "2026-08-15", due_date: "2026-09-15", supplier_name: "مؤسسة البناء الحديث للمقاولات", phase_id: phaseId(3), expense_account_code: "5304", total_amount: 95000, paid_amount: 60000 },
    { invoice_number: "CT-0091", invoice_date: "2026-09-25", due_date: "2026-10-25", supplier_name: "مؤسسة البناء الحديث للمقاولات", phase_id: phaseId(3), expense_account_code: "5304", total_amount: 70000, paid_amount: 0 },
    { invoice_number: "EL-554", invoice_date: "2026-09-28", due_date: "2026-10-28", supplier_name: "شركة التيار للكهرباء والتكييف", phase_id: phaseId(4), expense_account_code: "5305", total_amount: 32000, paid_amount: 16000 },
    { invoice_number: "EQ-2026-301", invoice_date: "2026-09-20", due_date: "2026-10-20", supplier_name: "بن الحجاز لمعدات القهوة", phase_id: phaseId(5), expense_account_code: "5306", total_amount: 98000, paid_amount: 49000 },
    { invoice_number: "FR-77", invoice_date: "2026-10-01", due_date: "2026-10-31", supplier_name: "مصنع الخشب الذهبي للأثاث", phase_id: phaseId(6), expense_account_code: "5307", total_amount: 30000, paid_amount: 0 },
    { invoice_number: "SYS-19", invoice_date: "2026-10-03", due_date: "2026-11-02", supplier_name: "فودكس لأنظمة نقاط البيع", phase_id: phaseId(7), expense_account_code: "5308", total_amount: 18500, paid_amount: 0 },
  ];
  for (const row of invoiceRows) {
    oasis.invoices.push({
      id: nextId(store, "invoice"),
      project_id: oasis.id,
      source: "manual",
      ...row,
      expense_account_name: accountName(row.expense_account_code),
      status: invoiceStatus(row, "2026-10-05"),
    });
  }

  const updateRows = [
    { phase_id: phaseId(1), body: "صدرت رخصة البلدية وفسح الدفاع المدني بعد تعديل مخرج الطوارئ.", created_at: "2026-07-20T09:30:00.000Z", created_by_name: "سارة القحطاني" },
    { phase_id: phaseId(3), body: "اكتملت أعمال الجبس والأسقف، وبدأ تنفيذ البار. المقاول يتوقع تسليم الدهانات خلال أسبوعين.", created_at: "2026-09-18T14:05:00.000Z", created_by_name: "فهد العتيبي" },
    { phase_id: phaseId(5), body: "تم تأكيد طلب ماكينة الإسبريسو والطواحين — الوصول المتوقع 15 أكتوبر.", created_at: "2026-09-22T11:40:00.000Z", created_by_name: "فهد العتيبي" },
  ];
  for (const row of updateRows) {
    oasis.updates.push({ id: nextId(store, "update"), project_id: oasis.id, photos: [], ...row });
  }

  const attachmentRows = [
    { phase_id: phaseId(0), url: "#", label: "عقد إيجار الموقع", kind: "contract", created_by_name: "فهد العتيبي", created_at: "2026-06-02T08:00:00.000Z" },
    { phase_id: phaseId(1), url: "#", label: "رخصة البلدية", kind: "permit", created_by_name: "سارة القحطاني", created_at: "2026-07-20T10:00:00.000Z" },
    { phase_id: phaseId(2), url: "#", label: "المخطط المعماري المعتمد", kind: "design", created_by_name: "فهد العتيبي", created_at: "2026-08-02T12:00:00.000Z" },
  ];
  for (const row of attachmentRows) {
    oasis.attachments.push({ id: nextId(store, "attachment"), project_id: oasis.id, ...row });
  }
  oasis.created_at = "2026-06-01T06:00:00.000Z";
  oasis.updated_at = "2026-10-03T07:15:00.000Z";
  store.projects.push(oasis);

  // (2) فرع الملقا — الرياض، تخطيط.
  const malqa = newProject(store, {
    name: "فرع الملقا",
    city: "الرياض",
    district: "حي الملقا",
    address: "طريق أنس بن مالك",
    area_sqm: 110,
    status: "planning",
    contract_signed_date: "2026-10-01",
    target_opening_date: "2027-03-15",
    budget_total: 500000,
    manager_name: "نورة الشهري",
    notes: "بانتظار اعتماد التصميم قبل التعاقد مع المقاول.",
  });
  insertTemplatePhases(
    store,
    malqa,
    buildPhasesFromTemplate(DEFAULT_PHASE_TEMPLATE, malqa.contract_signed_date, malqa.target_opening_date),
  );
  malqa.updates.push({
    id: nextId(store, "update"),
    project_id: malqa.id,
    phase_id: malqa.phases[0].id,
    body: "تم توقيع عقد الإيجار؛ تسليم الموقع المتوقع بداية نوفمبر.",
    photos: [],
    created_by_name: "نورة الشهري",
    created_at: "2026-10-02T09:00:00.000Z",
  });
  malqa.created_at = "2026-10-01T06:00:00.000Z";
  malqa.updated_at = "2026-10-02T09:00:00.000Z";
  store.projects.push(malqa);

  return store;
}

// ---------- الواجهة ----------

export const mockApi = {
  async list() {
    await delay();
    const store = loadStore();
    return clone(store.projects);
  },

  async get(id) {
    await delay();
    const store = loadStore();
    return clone(findProject(store, id));
  },

  async create(body = {}) {
    await delay();
    const store = loadStore();
    const project = newProject(store, body);
    const template = body.template === "empty" ? [] : DEFAULT_PHASE_TEMPLATE;
    if (template.length) {
      insertTemplatePhases(
        store,
        project,
        buildPhasesFromTemplate(template, project.contract_signed_date, project.target_opening_date),
      );
    }
    store.projects.push(project);
    persist(store);
    return clone(project);
  },

  async update(id, body = {}) {
    await delay();
    const store = loadStore();
    const project = findProject(store, id);
    applyProjectFields(project, body);
    touch(project);
    persist(store);
    return clone(project);
  },

  async remove(id) {
    await delay();
    const store = loadStore();
    const index = store.projects.findIndex((p) => p.id === Number(id));
    if (index === -1) throw notFound();
    store.projects.splice(index, 1);
    persist(store);
    return { ok: true, id: Number(id) };
  },

  async open(id, body = {}) {
    await delay();
    const store = loadStore();
    const project = findProject(store, id);
    const pending = pendingMilestones(project);
    if (pending.length && !body.force) {
      const error = new Error("توجد معالم غير مكتملة قبل تأكيد الافتتاح");
      error.code = "milestones_pending";
      error.status = 409;
      error.pending = pending.map((t) => t.title);
      throw error;
    }
    project.status = "opened";
    project.actual_opening_date = dateOrNull(body.actual_opening_date) || todayRiyadh();
    touch(project);
    persist(store);
    return clone(project);
  },

  async savePhase({ project_id, id, ...fields }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    let phase;
    if (id) {
      phase = project.phases.find((p) => p.id === Number(id));
      if (!phase) throw notFound("القسم");
      Object.assign(phase, normalizePhaseInput(fields, phase));
      if (fields.sort_order !== undefined) phase.sort_order = numOr0(fields.sort_order);
    } else {
      phase = {
        id: nextId(store, "phase"),
        project_id: project.id,
        sort_order: maxSort(project.phases) + 1,
        ...normalizePhaseInput(fields, null),
      };
      project.phases.push(phase);
    }
    touch(project);
    persist(store);
    return clone(phase);
  },

  async deletePhase({ project_id, id }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const pid = Number(id);
    if (!project.phases.some((p) => p.id === pid)) throw notFound("القسم");
    project.phases = project.phases.filter((p) => p.id !== pid);
    project.tasks = project.tasks.filter((t) => t.phase_id !== pid);
    for (const list of [project.invoices, project.updates, project.attachments]) {
      for (const row of list) if (row.phase_id === pid) row.phase_id = null;
    }
    touch(project);
    persist(store);
    return { ok: true, id: pid };
  },

  async reorderPhases({ project_id, ids }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const order = (Array.isArray(ids) ? ids : []).map(Number);
    let sort = 1;
    for (const pid of order) {
      const phase = project.phases.find((p) => p.id === pid);
      if (phase) phase.sort_order = sort++;
    }
    for (const phase of project.phases) {
      if (!order.includes(phase.id)) phase.sort_order = sort++;
    }
    project.phases.sort((a, b) => a.sort_order - b.sort_order);
    touch(project);
    persist(store);
    return clone(project.phases);
  },

  async saveTask({ project_id, id, ...fields }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    let task;
    if (id) {
      task = project.tasks.find((t) => t.id === Number(id));
      if (!task) throw notFound("المهمة");
      Object.assign(task, normalizeTaskInput(fields, task));
      if (fields.sort_order !== undefined) task.sort_order = numOr0(fields.sort_order);
    } else {
      const normalized = normalizeTaskInput(fields, null);
      task = {
        id: nextId(store, "task"),
        project_id: project.id,
        sort_order: maxSort(project.tasks.filter((t) => t.phase_id === normalized.phase_id)) + 1,
        ...normalized,
      };
      project.tasks.push(task);
    }
    touch(project);
    persist(store);
    return clone(task);
  },

  async deleteTask({ project_id, id }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const tid = Number(id);
    if (!project.tasks.some((t) => t.id === tid)) throw notFound("المهمة");
    project.tasks = project.tasks.filter((t) => t.id !== tid);
    touch(project);
    persist(store);
    return { ok: true, id: tid };
  },

  async addUpdate({ project_id, phase_id, body, photos, created_by_name }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const update = {
      id: nextId(store, "update"),
      project_id: project.id,
      phase_id: numOrNull(phase_id),
      body: str(body),
      photos: Array.isArray(photos) ? photos.filter(Boolean).map(String) : [],
      created_by_name: str(created_by_name) || DEFAULT_AUTHOR,
      created_at: nowIso(),
    };
    project.updates.unshift(update);
    touch(project);
    persist(store);
    return clone(update);
  },

  async deleteUpdate({ project_id, id }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const uid = Number(id);
    if (!project.updates.some((u) => u.id === uid)) throw notFound("التطور");
    project.updates = project.updates.filter((u) => u.id !== uid);
    touch(project);
    persist(store);
    return { ok: true, id: uid };
  },

  async addAttachment({ project_id, phase_id, url, label, kind, created_by_name }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const attachment = {
      id: nextId(store, "attachment"),
      project_id: project.id,
      phase_id: numOrNull(phase_id),
      url: str(url),
      label: str(label),
      kind: str(kind) || "other",
      created_by_name: str(created_by_name) || DEFAULT_AUTHOR,
      created_at: nowIso(),
    };
    project.attachments.push(attachment);
    touch(project);
    persist(store);
    return clone(attachment);
  },

  async deleteAttachment({ project_id, id }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const aid = Number(id);
    if (!project.attachments.some((a) => a.id === aid)) throw notFound("المرفق");
    project.attachments = project.attachments.filter((a) => a.id !== aid);
    touch(project);
    persist(store);
    return { ok: true, id: aid };
  },

  async saveInvoice({ project_id, id, ...fields }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    let invoice;
    if (id) {
      invoice = project.invoices.find((inv) => inv.id === Number(id));
      if (!invoice) throw notFound("الفاتورة");
    } else {
      invoice = { id: nextId(store, "invoice"), project_id: project.id, source: "manual" };
      project.invoices.push(invoice);
    }
    const code = str(fields.expense_account_code ?? invoice.expense_account_code);
    Object.assign(invoice, {
      invoice_number: str(fields.invoice_number ?? invoice.invoice_number),
      invoice_date: dateOrNull(fields.invoice_date ?? invoice.invoice_date),
      due_date: dateOrNull(fields.due_date ?? invoice.due_date),
      supplier_name: str(fields.supplier_name ?? invoice.supplier_name),
      phase_id: numOrNull(fields.phase_id ?? invoice.phase_id),
      expense_account_code: code,
      expense_account_name: accountName(code),
      total_amount: numOr0(fields.total_amount ?? invoice.total_amount),
      paid_amount: numOr0(fields.paid_amount ?? invoice.paid_amount),
    });
    invoice.status = invoiceStatus(invoice, todayRiyadh());
    touch(project);
    persist(store);
    return clone(invoice);
  },

  async deleteInvoice({ project_id, id }) {
    await delay();
    const store = loadStore();
    const project = findProject(store, project_id);
    const iid = Number(id);
    if (!project.invoices.some((inv) => inv.id === iid)) throw notFound("الفاتورة");
    project.invoices = project.invoices.filter((inv) => inv.id !== iid);
    touch(project);
    persist(store);
    return { ok: true, id: iid };
  },
};

// مسح المخزن وإعادة زرع العيّنة (للتجربة والاختبار).
export function resetBranchProjectsMock() {
  clearStorage();
  memoryStore = buildSeed();
  writeStorage(memoryStore);
  return clone(memoryStore.projects);
}
