// مشاريع تأسيس الفروع — نواة الخادم المشتركة بين مسارات
// /api/accounting/branch-projects/*: المخطط، حسابات مجموعة 53، تحميل
// المشاريع مع الأقسام والمهام والفواتير والتطورات والمرفقات، تحليل
// المدخلات، وإنشاء مشروع من القالب الافتراضي.
//
// الحسابات نفسها (التقدم، الصحة، الميزانية، القالب) في
// src/utils/branchProjectMath.js — تُستخدم هنا وفي الواجهة بلا اختلاف.

import sql from "@/app/api/utils/sql";
import { ensureOnce } from "@/app/api/utils/ensureOnce";
import { ensureAccountsSchema } from "@/app/api/utils/accountsTree";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";
import {
  ATTACHMENT_KINDS,
  DEFAULT_PHASE_TEMPLATE,
  ESTABLISHMENT_ACCOUNTS,
  PHASE_STATUSES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  buildPhasesFromTemplate,
  compareDateKeys,
  isDateKey,
  round2,
  todayRiyadh,
} from "@/utils/branchProjectMath";

// صلاحيات القسم: محاسبة كاملة أو مشتريات فقط (مثل فواتير المشتريات).
export const REQUIRE_BRANCH_PROJECTS = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
  ],
};

export { ATTACHMENT_KINDS, PHASE_STATUSES, PROJECT_STATUSES, TASK_STATUSES };

const ESTABLISHMENT_PARENT = {
  code: "53",
  name: "تكاليف تأسيس الفروع",
  name_en: "Branch Establishment Costs",
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
export function parseId(value) {
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

export const ensureBranchProjectsSchema = ensureOnce(ensureBranchProjectsSchemaImpl);

// أعمدة ربط فاتورة المشتريات بالمشروع/القسم — تُضاف فقط إن كان جدول
// الفواتير موجودًا (يُنشئه مسار الفواتير). يعيد true إن كان الجدول موجودًا.
// النتيجة الإيجابية تُحفظ لكل عملية (الجدول لا يختفي)؛ السلبية تُعاد.
let invoiceColumnsReady = false;
export async function ensureProjectInvoiceLinkColumns() {
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
  const codes = ESTABLISHMENT_ACCOUNTS.map((a) => a.code);
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

export function ensureEstablishmentAccounts() {
  if (!establishmentPromise) {
    establishmentPromise = resolveEstablishmentAccounts().catch((error) => {
      establishmentPromise = null;
      throw error;
    });
  }
  return establishmentPromise;
}

export function isEstablishmentAccountCode(code) {
  const key = str(code).trim();
  return ESTABLISHMENT_ACCOUNTS.some((a) => a.code === key);
}

// id حساب التأسيس للكود (يُنشأ إن غاب). كود غير معروف → 5399.
export async function getEstablishmentAccountId(code) {
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
    attachments: [],
  };
}

export function mapPhaseRow(row) {
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
    updated_at: iso(row.updated_at),
  };
}

export function mapTaskRow(row) {
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
    updated_at: iso(row.updated_at),
  };
}

export function mapUpdateRow(row) {
  return {
    id: Number(row.id),
    project_id: Number(row.project_id),
    phase_id: intOrNull(row.phase_id),
    body: str(row.body),
    photos: parseJsonArray(row.photos),
    created_by_employee_id: intOrNull(row.created_by_employee_id),
    created_by_name: str(row.created_by_name),
    created_at: iso(row.created_at),
  };
}

export function mapAttachmentRow(row) {
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
    created_at: iso(row.created_at),
  };
}

// صف فاتورة مشتريات (مع acc/c) → ProjectInvoice. الحالة مشتقة بنفس ترتيب
// بقية النظام: مسدد → متأخر → مسدد جزئيًا → بانتظار السداد.
export function mapInvoiceRow(row, today = todayRiyadh()) {
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
    lease_month: row.lease_month ? String(row.lease_month) : null,
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
  return sql(
    `${INVOICE_SELECT}
     WHERE inv.project_id = ANY($1::int[]) AND inv.is_active = TRUE
     ORDER BY inv.invoice_date DESC, inv.id DESC`,
    [ids],
  );
}

// فاتورة واحدة بنفس شكل ProjectInvoice (للمسارات التي تربط/تعدّل فاتورة).
// null إن لم توجد أو كانت موقوفة.
export async function loadProjectInvoice(invoiceId) {
  const id = parseId(invoiceId);
  if (!id) return null;
  const linked = await ensureProjectInvoiceLinkColumns();
  if (!linked) return null;
  const [row] = await sql(
    `${INVOICE_SELECT} WHERE inv.id = $1 AND inv.is_active = TRUE LIMIT 1`,
    [id],
  );
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

function assemble(projectRows, { phases, tasks, invoices, updates, attachments }, today) {
  const phaseGroups = groupBy(phases, mapPhaseRow);
  const taskGroups = groupBy(tasks, mapTaskRow);
  const invoiceGroups = groupBy(invoices, (row) => mapInvoiceRow(row, today));
  const updateGroups = groupBy(updates, mapUpdateRow);
  const attachmentGroups = groupBy(attachments, mapAttachmentRow);
  return projectRows.map((row) => {
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
export async function listProjects() {
  const rows = await sql(`
    ${PROJECT_SELECT}
    WHERE p.is_active = TRUE
    ORDER BY (p.status IN ('planning', 'in_progress', 'on_hold')) DESC,
             p.target_opening_date ASC NULLS LAST,
             p.id DESC
  `);
  if (!rows.length) return [];
  const ids = rows.map((row) => Number(row.id));
  const [phases, tasks, invoices] = await Promise.all([
    loadPhases(ids),
    loadTasks(ids),
    loadInvoices(ids),
  ]);
  return assemble(rows, { phases, tasks, invoices, updates: [], attachments: [] }, todayRiyadh());
}

// مشروع واحد كامل (كل الأبناء). null إن لم يوجد أو كان محذوفًا.
export async function loadProject(id) {
  const projectId = parseId(id);
  if (!projectId) return null;
  const [row] = await sql(`${PROJECT_SELECT} WHERE p.id = $1 AND p.is_active = TRUE`, [projectId]);
  if (!row) return null;
  const ids = [projectId];
  const [phases, tasks, invoices, updates, attachments] = await Promise.all([
    loadPhases(ids),
    loadTasks(ids),
    loadInvoices(ids),
    loadUpdates(ids),
    loadAttachments(ids),
  ]);
  const [project] = assemble([row], { phases, tasks, invoices, updates, attachments }, todayRiyadh());
  return project || null;
}

export async function projectExists(id) {
  const projectId = parseId(id);
  if (!projectId) return false;
  const [row] = await sql`
    SELECT 1 AS ok FROM branch_projects
    WHERE id = ${projectId} AND is_active = TRUE
    LIMIT 1
  `;
  return !!row;
}

export async function phaseBelongsToProject(phaseId, projectId) {
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
export async function loadPhase(phaseId, projectId = null) {
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
export async function loadTask(taskId, projectId = null) {
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
export async function nextProjectCode() {
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
export async function pendingMilestones(projectId) {
  const id = parseId(projectId);
  if (!id) return [];
  const rows = await sql`
    SELECT title FROM branch_project_tasks
    WHERE project_id = ${id} AND is_milestone = TRUE AND status <> 'done'
    ORDER BY due_date ASC NULLS LAST, sort_order ASC, id ASC
  `;
  return rows.map((row) => str(row.title));
}

export async function logProjectAudit({ projectId, action, summary = null, actor = null }) {
  return logPurchaseAudit({
    entityType: "branch_project",
    entityId: parseId(projectId),
    action,
    summary,
    actor,
  });
}

// ---------------------------------------------------------------------------
// تحليل المدخلات. كل دالة تعيد { value, error }؛ مع existing تسقط الحقول
// الغائبة (undefined) إلى القيم المخزّنة (PUT جزئي)، بينما null/"" تمسح.
// ---------------------------------------------------------------------------

function fail(error) {
  return { value: null, error };
}

export function parseProjectInput(body = {}, existing = null) {
  const input = body && typeof body === "object" ? body : {};
  const base = existing || {};
  const has = (key) => input[key] !== undefined;
  const pick = (key, fallback) => (has(key) ? input[key] : (base[key] ?? fallback));

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
      cover_url: coverRaw ? String(coverRaw).trim() || null : null,
    },
  };
}

export function parsePhaseInput(body = {}, existing = null) {
  const input = body && typeof body === "object" ? body : {};
  const base = existing || {};
  const has = (key) => input[key] !== undefined;
  const pick = (key, fallback) => (has(key) ? input[key] : (base[key] ?? fallback));

  const name = text(pick("name", ""), 300);
  if (!name) return fail("اسم القسم مطلوب");

  const dateFields = [
    ["planned_start", "تاريخ البداية المخطط غير صحيح (YYYY-MM-DD)"],
    ["planned_end", "تاريخ النهاية المخطط غير صحيح (YYYY-MM-DD)"],
    ["actual_start", "تاريخ البداية الفعلي غير صحيح (YYYY-MM-DD)"],
    ["actual_end", "تاريخ النهاية الفعلي غير صحيح (YYYY-MM-DD)"],
  ];
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
      notes: text(pick("notes", ""), 5000),
    },
  };
}

export function parseTaskInput(body = {}, existing = null) {
  const input = body && typeof body === "object" ? body : {};
  const base = existing || {};
  const has = (key) => input[key] !== undefined;
  const pick = (key, fallback) => (has(key) ? input[key] : (base[key] ?? fallback));

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
      notes: text(pick("notes", ""), 5000),
    },
  };
}

// ---------------------------------------------------------------------------
// إنشاء مشروع (مع القالب الافتراضي). ثلاث رحلات بعد إدراج المشروع:
// الأقسام دفعة واحدة (RETURNING id, sort_order) ثم المهام دفعة واحدة.
// أي فشل بعد إدراج المشروع يحذفه (CASCADE) ويعيد رمي الخطأ.
// ---------------------------------------------------------------------------
export async function createProjectWithTemplate(value, { template = "default", actor = null } = {}) {
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
      const built = buildPhasesFromTemplate(
        DEFAULT_PHASE_TEMPLATE,
        value.contract_signed_date,
        value.target_opening_date,
      );
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
          default_account_code: phase.default_account_code,
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
        const idBySort = new Map(inserted.map((r) => [Number(r.sort_order), Number(r.id)]));
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
              sort_order: num(task.sort_order),
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
