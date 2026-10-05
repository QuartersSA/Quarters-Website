// العقود التأجيرية — نواة الخادم المشتركة بين مسارات
// /api/accounting/lease-contracts/*: المخطط، حساب «إيجارات»، تحميل
// العقود والدفعات مع الحقول المحسوبة، توليد جدول الدفعات واستبداله،
// وتحليل مدخلات العقد والتحقق منها.
//
// الحسابات نفسها (الجدول، الاستقطاع، حالة العقد) في
// src/utils/leaseMath.js — تُستخدم هنا وفي الواجهة بلا اختلاف.

import sql from "@/app/api/utils/sql";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";
import { hardDeletePurchaseInvoices } from "@/app/api/utils/purchaseInvoiceDelete";
import {
  LEASE_FREQUENCIES,
  CONTRACT_TYPES,
  DEFAULT_VAT_RATE,
  generateSchedule,
  installmentAmounts,
  installmentWithFixed,
  splitFixedCharges,
  FREQUENCY_MONTHS,
  monthDiff,
  monthKey,
  contractStatus,
  daysBetween,
  addDays,
  isDateKey,
  compareDateKeys,
  round2,
} from "@/utils/leaseMath";

// صلاحيات القسم: محاسبة كاملة أو مشتريات فقط (مثل فواتير المشتريات).
export const REQUIRE_LEASE = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
  ],
};

const RENT_CODE = "5202";
const RENT_NAME = "إيجارات";

export function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

export function parseMoney(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 100) / 100;
}

export function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function textOrNull(value, max = 2000) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

// ---------------------------------------------------------------------------
// المخطط — يُنفَّذ مرة واحدة لكل عملية خادم (وعد مُخزَّن؛ يُعاد عند الفشل).
// ---------------------------------------------------------------------------
let ensurePromise = null;

async function doEnsureLeaseSchema() {
  // الجداول المرجعية للمفاتيح الأجنبية — نسخة مطابقة لمسار جهات الاتصال
  // كي لا يفشل إنشاء جدول العقود على قاعدة جديدة.
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT,
      vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
      vat_number TEXT,
      default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_lease_contracts (
      id SERIAL PRIMARY KEY,
      contract_number TEXT,
      lessor_name TEXT NOT NULL,
      lessor_contact_id INTEGER REFERENCES accounting_contacts(id) ON DELETE SET NULL,
      lessor_vat_number TEXT,
      location TEXT,
      branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      notice_period_days INTEGER,
      notice_period_text TEXT,
      payment_frequency TEXT NOT NULL DEFAULT 'monthly',
      installment_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      vat_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
      first_due_date DATE,
      total_value NUMERIC(14,2),
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      attachment_url TEXT,
      attachment_name TEXT,
      analysis_json JSONB,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_lease_payments (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER NOT NULL REFERENCES accounting_lease_contracts(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      due_date DATE NOT NULL,
      period_start DATE,
      period_end DATE,
      amount_excl NUMERIC(14,2) NOT NULL DEFAULT 0,
      vat_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
      vat_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      amount_incl NUMERIC(14,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_date DATE,
      paid_amount NUMERIC(14,2),
      invoice_id INTEGER,
      bank_account_id INTEGER,
      receipt_url TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      UNIQUE (contract_id, seq)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lease_payments_due
      ON accounting_lease_payments (status, due_date)
  `;
  // سجل الاستقطاعات المؤكدة: ما حُجز فعليًا من إيرادات كل شهر لكل دفعة.
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_lease_reserves (
      id SERIAL PRIMARY KEY,
      payment_id INTEGER NOT NULL REFERENCES accounting_lease_payments(id) ON DELETE CASCADE,
      contract_id INTEGER NOT NULL REFERENCES accounting_lease_contracts(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      suggested_amount NUMERIC(14,2),
      revenue_basis NUMERIC(14,2),
      note TEXT,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      UNIQUE (payment_id, month)
    )
  `;
  // المبالغ الثابتة (رسوم خدمات/صيانة…) لكل دفعة قبل الضريبة: التفصيل
  // JSON + المجموع؛ وعلى كل دفعة نصيبها ضمن amount_excl.
  await sql`
    ALTER TABLE accounting_lease_contracts
      ADD COLUMN IF NOT EXISTS fixed_charges JSONB,
      ADD COLUMN IF NOT EXISTS fixed_amount NUMERIC(14,2) NOT NULL DEFAULT 0
  `;
  await sql`
    ALTER TABLE accounting_lease_payments
      ADD COLUMN IF NOT EXISTS fixed_excl NUMERIC(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fixed_exempt_excl NUMERIC(14,2) NOT NULL DEFAULT 0
  `;
  // أشهر استقطاع حُذفت فواتيرها نهائيًا — لا يُعاد توليدها.
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_lease_setaside_skips (
      payment_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      PRIMARY KEY (payment_id, month)
    )
  `;
  // عقد مجدد: الدفعة الأولى لها استقطاع كبقية الدفعات (في العقد الجديد
  // تُسدَّد الدفعة الأولى مباشرة بلا استقطاع).
  await sql`
    ALTER TABLE accounting_lease_contracts
      ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN NOT NULL DEFAULT FALSE
  `;
  // الاسم المعرِّف: اسم مختصر يظهر في الجداول (مثل اسم الفرع) بجانب النوع.
  await sql`
    ALTER TABLE accounting_lease_contracts
      ADD COLUMN IF NOT EXISTS display_name TEXT
  `;
  // نوع العقد: branch | housing | warehouse (فرع / سكن / مستودع).
  await sql`
    ALTER TABLE accounting_lease_contracts
      ADD COLUMN IF NOT EXISTS contract_type TEXT NOT NULL DEFAULT 'branch'
  `;
  // هل أُدخلت قيمة الدفعة شاملة الضريبة؟ (تبقى installment_amount قبل
  // الضريبة؛ العلم يُعيد للمستخدم الرقم كما كتبه عند التعديل.)
  await sql`
    ALTER TABLE accounting_lease_contracts
      ADD COLUMN IF NOT EXISTS amount_includes_vat BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await ensureLeaseInvoiceLinkColumns();
}

// أعمدة ربط فواتير الاستقطاع بالعقد/الدفعة/الشهر على فواتير المشتريات —
// تُضاف فقط إن كان جدول الفواتير موجودًا (يُنشئه مسار الفواتير).
export async function ensureLeaseInvoiceLinkColumns() {
  const [reg] = await sql`SELECT to_regclass('accounting_purchase_invoices') AS t`;
  if (!reg?.t) return false;
  await sql`
    ALTER TABLE accounting_purchase_invoices
      ADD COLUMN IF NOT EXISTS lease_contract_id INTEGER,
      ADD COLUMN IF NOT EXISTS lease_payment_id INTEGER,
      ADD COLUMN IF NOT EXISTS lease_month TEXT
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchase_invoices_lease
      ON accounting_purchase_invoices (lease_payment_id, lease_month)
  `;
  return true;
}

export function ensureLeaseSchema() {
  if (!ensurePromise) {
    ensurePromise = doEnsureLeaseSchema().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

// ---------------------------------------------------------------------------
// حساب «إيجارات» (5202): بالرمز أولًا، ثم بالاسم تحت 52، وإلا يُنشأ.
// ---------------------------------------------------------------------------
export async function getRentAccountId() {
  const [byCode] = await sql`
    SELECT id FROM accounting_accounts
    WHERE code = ${RENT_CODE} AND account_type = 'expense' AND is_active
    LIMIT 1
  `;
  if (byCode) return Number(byCode.id);
  const [parent] = await sql`
    SELECT id, code FROM accounting_accounts
    WHERE code = '52' AND is_system AND is_active
    LIMIT 1
  `;
  if (!parent) return null;
  const [byName] = await sql`
    SELECT id FROM accounting_accounts
    WHERE parent_id = ${parent.id} AND is_active AND account_type = 'expense'
      AND TRIM(name) = ${RENT_NAME}
    LIMIT 1
  `;
  if (byName) return Number(byName.id);
  const [created] = await sql`
    INSERT INTO accounting_accounts (code, name, name_en, account_type, parent_id, is_postable, is_system)
    VALUES (${RENT_CODE}, ${RENT_NAME}, 'Rent', 'expense', ${parent.id}, TRUE, TRUE)
    RETURNING id
  `;
  return Number(created.id);
}

// حساب مصروف الإيجار حسب نوع العقد تحت المجموعة 52: «إيجار فرع / مستودع»
// أو «إيجار سكن» — بالاسم أولًا، وإلا يُنشأ برمز حر (5207/5208 إن كانا حرّين).
const LEASE_ACCOUNTS = {
  branch: { name: "إيجار فرع / مستودع", name_en: "Branch / Warehouse Rent", code: "5207" },
  warehouse: { name: "إيجار فرع / مستودع", name_en: "Branch / Warehouse Rent", code: "5207" },
  housing: { name: "إيجار سكن", name_en: "Housing Rent", code: "5208" },
};

async function freeChildCode(parentCode, preferred) {
  const candidates = [preferred];
  for (let n = 7; n <= 98; n += 1) candidates.push(`${parentCode}${String(n).padStart(2, "0")}`);
  for (const code of candidates) {
    const [taken] = await sql`SELECT 1 AS t FROM accounting_accounts WHERE code = ${code} LIMIT 1`;
    if (!taken) return code;
  }
  return `${parentCode}${Date.now() % 1000}`;
}

export async function getLeaseExpenseAccountId(contractType) {
  const spec = LEASE_ACCOUNTS[contractType] || LEASE_ACCOUNTS.branch;
  const [parent] = await sql`
    SELECT id, code FROM accounting_accounts
    WHERE code = '52' AND is_system AND is_active
    LIMIT 1
  `;
  if (!parent) return getRentAccountId();
  const [byName] = await sql`
    SELECT id FROM accounting_accounts
    WHERE parent_id = ${parent.id} AND is_active AND account_type = 'expense'
      AND TRIM(name) = ${spec.name}
    LIMIT 1
  `;
  if (byName) return Number(byName.id);
  const code = await freeChildCode(parent.code, spec.code);
  const [created] = await sql`
    INSERT INTO accounting_accounts (code, name, name_en, account_type, parent_id, is_postable, is_system)
    VALUES (${code}, ${spec.name}, ${spec.name_en}, 'expense', ${parent.id}, TRUE, TRUE)
    RETURNING id
  `;
  return Number(created.id);
}

export function leaseExpenseAccountName(contractType) {
  return (LEASE_ACCOUNTS[contractType] || LEASE_ACCOUNTS.branch).name;
}

// تغيّر نوع العقد (فرع/مستودع ↔ سكن): تُحوَّل كل فواتير الاستقطاع المرتبطة
// بالعقد (وبنودها) إلى حساب المصروف المطابق للنوع الجديد.
export async function repointLeaseInvoiceAccounts(contractId, contractType) {
  const id = Number(contractId);
  if (!Number.isInteger(id) || id <= 0) return { updated: 0, account_id: null, account_name: null };
  const hasTable = await ensureLeaseInvoiceLinkColumns();
  if (!hasTable) return { updated: 0, account_id: null, account_name: null };
  const accountId = await getLeaseExpenseAccountId(contractType);
  const rows = await sql`
    UPDATE accounting_purchase_invoices
    SET expense_account_id = ${accountId},
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE lease_contract_id = ${id}
      AND (expense_account_id IS DISTINCT FROM ${accountId})
    RETURNING id
  `;
  const ids = rows.map((r) => Number(r.id));
  if (ids.length) {
    await sql`
      UPDATE accounting_purchase_invoice_items
      SET account_id = ${accountId}
      WHERE invoice_id = ANY(${ids})
    `;
  }
  return { updated: ids.length, account_id: accountId, account_name: leaseExpenseAccountName(contractType) };
}

// فاتورة استقطاع حُذفت نهائيًا: لا يُعاد إنشاؤها لنفس الدفعة/الشهر.
export async function suppressSetAsideInvoice(paymentId, month) {
  await ensureLeaseSchema();
  await sql`
    INSERT INTO accounting_lease_setaside_skips (payment_id, month)
    VALUES (${Number(paymentId)}, ${String(month)})
    ON CONFLICT DO NOTHING
  `;
}

export async function loadSetAsideSkips(paymentIds) {
  const ids = [...new Set((paymentIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return new Set();
  const rows = await sql`
    SELECT payment_id, month FROM accounting_lease_setaside_skips WHERE payment_id = ANY(${ids})
  `;
  return new Set(rows.map((r) => `${r.payment_id}|${r.month}`));
}

// إيقاف فواتير الاستقطاع غير المسددة المرتبطة بدفعات (حذف/إلغاء/إعادة توليد).
export async function deactivateSetAsideInvoicesForPayments(paymentIds, actor = null, reason = "") {
  const ids = [...new Set((paymentIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return 0;
  const linked = await ensureLeaseInvoiceLinkColumns();
  if (!linked) return 0;
  // غير المسددة فقط تُحذف نهائيًا؛ المسددة سجل مالي يبقى.
  const rows = await sql`
    SELECT id FROM accounting_purchase_invoices
    WHERE lease_payment_id = ANY(${ids}) AND paid_amount <= 0
  `;
  const deleted = await hardDeletePurchaseInvoices(
    rows.map((r) => r.id),
    { actor, reason: `فاتورة استقطاع${reason ? ` — ${reason}` : ""}` },
  );
  return deleted.length;
}

// ---------------------------------------------------------------------------
// الحقول المحسوبة على رأس العقد.
// ---------------------------------------------------------------------------
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function computeContractFields(row, today = todayRiyadh()) {
  const noticeDays = Number(row.notice_period_days) || 0;
  return {
    ...row,
    lessor_contact_id: row.lessor_contact_id ?? null,
    contract_type: CONTRACT_TYPES.includes(row.contract_type) ? row.contract_type : "branch",
    display_name: row.display_name ?? null,
    is_renewal: row.is_renewal === true,
    branch_id: row.branch_id ?? null,
    branch_name: row.branch_name ?? null,
    notice_period_days: row.notice_period_days === null || row.notice_period_days === undefined
      ? null
      : Number(row.notice_period_days),
    installment_amount: num(row.installment_amount),
    vat_rate: num(row.vat_rate, DEFAULT_VAT_RATE),
    amount_includes_vat: row.amount_includes_vat === true,
    fixed_amount: num(row.fixed_amount),
    fixed_charges: Array.isArray(row.fixed_charges) ? row.fixed_charges : [],
    total_value: row.total_value === null || row.total_value === undefined ? null : num(row.total_value),
    is_active: row.is_active !== false,
    computed_status: contractStatus({
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      noticePeriodDays: noticeDays,
      today,
    }),
    days_to_end: isDateKey(row.end_date) ? daysBetween(today, row.end_date) : null,
    notice_starts_on:
      noticeDays > 0 && isDateKey(row.end_date) ? addDays(row.end_date, -noticeDays) : null,
    payments_total: Number(row.payments_total) || 0,
    payments_paid: Number(row.payments_paid) || 0,
    paid_total: num(row.paid_total),
    pending_total: num(row.pending_total),
    next_due_date: row.next_due_date ?? null,
    next_due_amount: row.next_due_amount === null || row.next_due_amount === undefined ? null : num(row.next_due_amount),
    overdue_count: Number(row.overdue_count) || 0,
  };
}

// أعمدة رأس العقد + تجميعات الدفعات (المسدد مقابل المعلّق؛ الملغاة مستبعدة).
// $1 = تاريخ اليوم بالرياض.
const CONTRACT_SELECT = `
  SELECT c.id, c.contract_number, c.display_name, c.contract_type, c.is_renewal, c.lessor_name, c.lessor_contact_id, c.lessor_vat_number,
         c.location, c.branch_id, b.name AS branch_name,
         TO_CHAR(c.start_date, 'YYYY-MM-DD') AS start_date,
         TO_CHAR(c.end_date, 'YYYY-MM-DD') AS end_date,
         c.notice_period_days, c.notice_period_text,
         c.payment_frequency, c.installment_amount, c.vat_rate, c.amount_includes_vat,
         c.fixed_charges, c.fixed_amount,
         TO_CHAR(c.first_due_date, 'YYYY-MM-DD') AS first_due_date,
         c.total_value, c.status, c.notes, c.attachment_url, c.attachment_name,
         c.analysis_json, c.is_active, c.created_at, c.updated_at,
         c.created_by_employee_id, c.created_by_employee_name,
         COALESCE(agg.payments_total, 0)::int AS payments_total,
         COALESCE(agg.payments_paid, 0)::int AS payments_paid,
         COALESCE(agg.paid_total, 0) AS paid_total,
         COALESCE(agg.pending_total, 0) AS pending_total,
         COALESCE(agg.overdue_count, 0)::int AS overdue_count,
         nxt.due_date AS next_due_date,
         nxt.amount_incl AS next_due_amount
  FROM accounting_lease_contracts c
  LEFT JOIN branches b ON b.id = c.branch_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE p.status <> 'cancelled') AS payments_total,
           COUNT(*) FILTER (WHERE p.status = 'paid') AS payments_paid,
           SUM(COALESCE(p.paid_amount, p.amount_incl)) FILTER (WHERE p.status = 'paid') AS paid_total,
           SUM(p.amount_incl) FILTER (WHERE p.status = 'pending') AS pending_total,
           COUNT(*) FILTER (WHERE p.status = 'pending' AND p.due_date < $1::date) AS overdue_count
    FROM accounting_lease_payments p
    WHERE p.contract_id = c.id
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT TO_CHAR(n.due_date, 'YYYY-MM-DD') AS due_date, n.amount_incl
    FROM accounting_lease_payments n
    WHERE n.contract_id = c.id AND n.status = 'pending'
    ORDER BY n.due_date ASC, n.seq ASC
    LIMIT 1
  ) nxt ON TRUE
`;

// قائمة العقود: السارية أولًا ثم بتاريخ الانتهاء تصاعديًا.
export async function listContracts({ includeInactive = false, q = "" } = {}) {
  await ensureLeaseSchema();
  const today = todayRiyadh();
  const params = [today];
  const where = [];
  if (!includeInactive) where.push("c.is_active = TRUE");
  const search = String(q || "").trim();
  if (search) {
    params.push(`%${search}%`);
    const n = params.length;
    where.push(
      `(c.contract_number ILIKE $${n} OR c.display_name ILIKE $${n} OR c.lessor_name ILIKE $${n} OR c.location ILIKE $${n} OR b.name ILIKE $${n})`,
    );
  }
  const text = `
    ${CONTRACT_SELECT}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY c.is_active DESC,
             (c.status = 'active') DESC,
             (c.end_date >= $1::date) DESC,
             c.end_date ASC, c.id ASC
  `;
  const rows = await sql(text, params);
  return rows.map((row) => computeContractFields(row, today));
}

// دفعات عقد واحد (كما تُعرض في تفاصيل العقد).
async function loadContractPayments(contractId) {
  return sql`
    SELECT p.id, p.contract_id, p.seq,
           TO_CHAR(p.due_date, 'YYYY-MM-DD') AS due_date,
           TO_CHAR(p.period_start, 'YYYY-MM-DD') AS period_start,
           TO_CHAR(p.period_end, 'YYYY-MM-DD') AS period_end,
           p.amount_excl, p.fixed_excl, p.fixed_exempt_excl, p.vat_rate, p.vat_amount, p.amount_incl,
           p.status,
           TO_CHAR(p.paid_date, 'YYYY-MM-DD') AS paid_date,
           p.paid_amount, p.invoice_id, inv.invoice_number,
           p.bank_account_id, bank.name AS bank_name,
           p.receipt_url, p.notes
    FROM accounting_lease_payments p
    LEFT JOIN accounting_purchase_invoices inv ON inv.id = p.invoice_id
    LEFT JOIN accounting_bank_accounts bank ON bank.id = p.bank_account_id
    WHERE p.contract_id = ${contractId}
    ORDER BY p.seq ASC, p.due_date ASC
  `;
}

function normalizePaymentRow(row) {
  return {
    ...row,
    amount_excl: num(row.amount_excl),
    fixed_excl: num(row.fixed_excl),
    fixed_exempt_excl: num(row.fixed_exempt_excl),
    vat_rate: num(row.vat_rate, DEFAULT_VAT_RATE),
    vat_amount: num(row.vat_amount),
    amount_incl: num(row.amount_incl),
    paid_amount: row.paid_amount === null || row.paid_amount === undefined ? null : num(row.paid_amount),
    invoice_id: row.invoice_id ?? null,
    invoice_number: row.invoice_number ?? null,
    bank_account_id: row.bank_account_id ?? null,
    bank_name: row.bank_name ?? null,
  };
}

// عقد واحد مع دفعاته والحقول المحسوبة. null إن لم يوجد.
export async function loadContract(id) {
  await ensureLeaseSchema();
  const contractId = Number(id);
  if (!Number.isInteger(contractId) || contractId <= 0) return null;
  const today = todayRiyadh();
  const [row] = await sql(`${CONTRACT_SELECT} WHERE c.id = $2`, [today, contractId]);
  if (!row) return null;
  const payments = await loadContractPayments(contractId);
  return {
    ...computeContractFields(row, today),
    payments: payments.map(normalizePaymentRow),
  };
}

// ---------------------------------------------------------------------------
// قائمة الدفعات مع سياق العقد (لقسمي «سداد المستحق» و«استقطاع شهري»).
// reserve_start = الأكبر بين (استحقاق الدفعة السابقة أو بداية العقد)
// وتاريخ إضافة العقد — يُحسب هنا.
// ---------------------------------------------------------------------------
export async function listPayments({
  status = "pending",
  from = null,
  to = null,
  contractId = null,
  paymentId = null,
  excludeTerminated = false,
  activeContractsOnly = true,
} = {}) {
  await ensureLeaseSchema();
  const today = todayRiyadh();
  const params = [];
  const where = [];
  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const statusKey = ["pending", "paid", "cancelled", "all"].includes(status) ? status : "pending";
  if (statusKey !== "all") where.push(`w.status = ${push(statusKey)}`);
  if (isDateKey(from)) where.push(`w.due_date >= ${push(from)}::date`);
  if (isDateKey(to)) where.push(`w.due_date <= ${push(to)}::date`);
  const contractFilter = parseIntOrNull(contractId);
  if (contractFilter) where.push(`w.contract_id = ${push(contractFilter)}`);
  const paymentFilter = parseIntOrNull(paymentId);
  if (paymentFilter) where.push(`w.id = ${push(paymentFilter)}`);
  // القائمة العامة (بلا عقد محدد): عقود نشطة غير مُنهاة فقط — العقد
  // المُنهى لا التزامات مستقبلية عليه؛ دفعاته تُرى من تفاصيله.
  if (activeContractsOnly && !contractFilter && !paymentFilter) where.push("c.is_active = TRUE");
  if (excludeTerminated || (!contractFilter && !paymentFilter)) {
    where.push("c.status <> 'terminated'");
  }

  const text = `
    WITH w AS (
      SELECT p.*,
             LAG(p.due_date) OVER (PARTITION BY p.contract_id ORDER BY p.seq) AS prev_due_date
      FROM accounting_lease_payments p
    )
    SELECT w.id, w.contract_id, w.seq,
           TO_CHAR(w.due_date, 'YYYY-MM-DD') AS due_date,
           TO_CHAR(w.period_start, 'YYYY-MM-DD') AS period_start,
           TO_CHAR(w.period_end, 'YYYY-MM-DD') AS period_end,
           w.amount_excl, w.fixed_excl, w.fixed_exempt_excl, w.vat_rate, w.vat_amount, w.amount_incl,
           w.status,
           TO_CHAR(w.paid_date, 'YYYY-MM-DD') AS paid_date,
           w.paid_amount, w.invoice_id, inv.invoice_number,
           w.bank_account_id, bank.name AS bank_name,
           w.receipt_url, w.notes,
           TO_CHAR(w.prev_due_date, 'YYYY-MM-DD') AS prev_due_date,
           COALESCE((
             SELECT SUM(r.amount) FROM accounting_lease_reserves r WHERE r.payment_id = w.id
           ), 0) AS reserved_total,
           c.contract_number, c.display_name, c.contract_type, c.is_renewal, c.payment_frequency, c.lessor_name, c.lessor_contact_id, c.location,
           c.branch_id, b.name AS branch_name,
           c.status AS contract_stored_status,
           TO_CHAR(c.start_date, 'YYYY-MM-DD') AS contract_start_date,
           TO_CHAR(c.end_date, 'YYYY-MM-DD') AS contract_end_date,
           c.notice_period_days AS contract_notice_period_days,
           TO_CHAR(c.created_at, 'YYYY-MM-DD') AS contract_created_on
    FROM w
    JOIN accounting_lease_contracts c ON c.id = w.contract_id
    LEFT JOIN branches b ON b.id = c.branch_id
    LEFT JOIN accounting_purchase_invoices inv ON inv.id = w.invoice_id
    LEFT JOIN accounting_bank_accounts bank ON bank.id = w.bank_account_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY w.due_date ASC, w.contract_id ASC, w.seq ASC
  `;
  const rows = await sql(text, params);
  return rows.map((row) => {
    const {
      prev_due_date,
      contract_stored_status,
      contract_start_date,
      contract_end_date,
      contract_notice_period_days,
      contract_created_on,
      ...rest
    } = row;
    const overdue = rest.status === "pending" && compareDateKeys(rest.due_date, today) < 0;
    const windowStart = prev_due_date || contract_start_date || rest.due_date;
    const reserveStart =
      contract_created_on && compareDateKeys(contract_created_on, windowStart) > 0
        ? contract_created_on
        : windowStart;
    // أشهر نافذة الاستقطاع: أشهر التكرار (ربعي 3، نصفي 6…)؛ للدفعات
    // المخصصة الفاصل بين استحقاقها والدفعة السابقة (أو بداية العقد).
    const freqMonths = FREQUENCY_MONTHS[rest.payment_frequency];
    const windowMonths = freqMonths
      ? freqMonths
      : Math.max(monthDiff(monthKey(windowStart), monthKey(rest.due_date)), 1);
    return {
      ...normalizePaymentRow(rest),
      reserved_total: num(rest.reserved_total),
      window_months: windowMonths,
      is_renewal: rest.is_renewal === true,
      // الدفعة الأولى في عقد جديد: بلا استقطاع (تُسدَّد مباشرة).
      setaside_exempt: Number(rest.seq) === 1 && rest.is_renewal !== true,
      contract_created_on: contract_created_on || null,
      contract_status: contractStatus({
        status: contract_stored_status,
        startDate: contract_start_date,
        endDate: contract_end_date,
        noticePeriodDays: contract_notice_period_days,
        today,
      }),
      overdue,
      days_overdue: overdue ? daysBetween(rest.due_date, today) : null,
      reserve_start: reserveStart,
    };
  });
}

// الاستقطاعات المؤكدة لمجموعة دفعات: { [payment_id]: [{ month, amount, ... }] }.
export async function loadReservesByPayment(paymentIds) {
  const ids = [...new Set((paymentIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return {};
  const rows = await sql`
    SELECT id, payment_id, contract_id, month, amount, suggested_amount, revenue_basis, note,
           created_by_employee_name, created_at, updated_at
    FROM accounting_lease_reserves
    WHERE payment_id = ANY(${ids})
    ORDER BY payment_id ASC, month ASC
  `;
  const byPayment = {};
  for (const row of rows) {
    const key = Number(row.payment_id);
    if (!byPayment[key]) byPayment[key] = [];
    byPayment[key].push({
      id: Number(row.id),
      payment_id: key,
      contract_id: Number(row.contract_id),
      month: row.month,
      amount: num(row.amount),
      suggested_amount: row.suggested_amount === null || row.suggested_amount === undefined ? null : num(row.suggested_amount),
      revenue_basis: row.revenue_basis === null || row.revenue_basis === undefined ? null : num(row.revenue_basis),
      note: row.note ?? null,
      created_by_employee_name: row.created_by_employee_name ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  return byPayment;
}

export async function loadPayment(id) {
  const rows = await listPayments({
    status: "all",
    paymentId: id,
    activeContractsOnly: false,
  });
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// جدول الدفعات: توليد ثم استبدال.
// ---------------------------------------------------------------------------

// صفوف الجدول من مدخلات عقد مُحلَّلة (parseContractInput). دفعات مخصصة:
// seq بترتيب تاريخ الاستحقاق؛ الفترة null ما لم تُرسل.
export function buildScheduleRows(input) {
  const fixed = splitFixedCharges(input.fixed_charges);
  if (input.payment_frequency === "custom") {
    const sorted = [...(input.payments || [])].sort((a, b) =>
      compareDateKeys(a.due_date, b.due_date),
    );
    return sorted.map((row, index) => {
      const money = installmentWithFixed({
        amount: row.amount_excl,
        fixedAmount: fixed.exempt,
        fixedTaxableAmount: fixed.taxable,
        vatRate: row.vat_rate ?? input.vat_rate,
        amountIncludesVat: false,
      });
      return {
        seq: index + 1,
        due_date: row.due_date,
        period_start: row.period_start || null,
        period_end: row.period_end || null,
        ...money,
        notes: row.description || null,
      };
    });
  }
  return generateSchedule({
    startDate: input.start_date,
    endDate: input.end_date,
    frequency: input.payment_frequency,
    amount: input.installment_amount,
    fixedAmount: fixed.exempt,
    fixedTaxableAmount: fixed.taxable,
    vatRate: input.vat_rate,
    amountIncludesVat: false,
    firstDueDate: input.first_due_date,
  }).map((row) => ({ ...row, notes: null }));
}

function insertPaymentStatement(contractId, row) {
  return sql`
    INSERT INTO accounting_lease_payments (
      contract_id, seq, due_date, period_start, period_end,
      amount_excl, fixed_excl, fixed_exempt_excl, vat_rate, vat_amount, amount_incl, status, notes
    )
    VALUES (
      ${contractId}, ${row.seq}, ${row.due_date}, ${row.period_start || null}, ${row.period_end || null},
      ${round2(row.amount_excl)}, ${round2(row.fixed_excl || 0)}, ${round2(row.fixed_exempt_excl || 0)}, ${num(row.vat_rate, DEFAULT_VAT_RATE)}, ${round2(row.vat_amount)}, ${round2(row.amount_incl)},
      'pending', ${row.notes || null}
    )
  `;
}

// إعادة حساب إجمالي العقد شامل الضريبة من الجدول (بلا الملغاة).
export async function recomputeContractTotal(contractId) {
  const [row] = await sql`
    UPDATE accounting_lease_contracts c
    SET total_value = COALESCE((
          SELECT SUM(p.amount_incl) FROM accounting_lease_payments p
          WHERE p.contract_id = c.id AND p.status <> 'cancelled'
        ), 0),
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE c.id = ${contractId}
    RETURNING total_value
  `;
  return row ? num(row.total_value) : 0;
}

// استبدال جدول الدفعات. keepPaid: تبقى الصفوف المسددة كما هي (بتسلسلها)؛
// الصف المولَّد الذي يصادف تسلسل صف مسدد يُهمل؛ ما عداه (معلّق/ملغى)
// يُحذف وتُدرج الصفوف المولَّدة كمعلّقة. ثم يُعاد حساب total_value.
// matchBySeq: الجداول المولَّدة (شهري/ربع…) تُطابق المسدد بتسلسله أيضًا
// (نفس الفترة ولو تغيّر المبلغ)؛ الدفعات المخصصة تُطابق بالاستحقاق والمبلغ
// فقط لأن التسلسل يتزحزح مع حذف/إضافة صف.
export async function replaceSchedule(
  contractId,
  rows,
  { keepPaid = false, matchBySeq = true } = {},
) {
  const statements = [];
  let paidSeqs = new Set();
  let paidKeys = new Set();
  let skipped = 0;
  // فواتير الاستقطاع المرتبطة بالصفوف التي ستُحذف تُوقف (غير المسددة فقط).
  const removable = keepPaid
    ? await sql`SELECT id FROM accounting_lease_payments WHERE contract_id = ${contractId} AND status <> 'paid'`
    : await sql`SELECT id FROM accounting_lease_payments WHERE contract_id = ${contractId}`;
  await deactivateSetAsideInvoicesForPayments(
    removable.map((r) => r.id),
    null,
    "أُعيد توليد جدول الدفعات",
  );
  if (keepPaid) {
    const paidRows = await sql`
      SELECT seq, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date, amount_incl
      FROM accounting_lease_payments
      WHERE contract_id = ${contractId} AND status = 'paid'
    `;
    paidSeqs = new Set(paidRows.map((r) => Number(r.seq)));
    // نفس الدفعة قد تعود بتسلسل مختلف (حذف/إضافة صف قبلها) — تُعرف
    // بالاستحقاق والمبلغ فلا تُدرج نسخة معلّقة منها.
    paidKeys = new Set(paidRows.map((r) => `${r.due_date}|${round2(r.amount_incl).toFixed(2)}`));
    statements.push(sql`
      DELETE FROM accounting_lease_payments
      WHERE contract_id = ${contractId} AND status <> 'paid'
    `);
  } else {
    statements.push(sql`
      DELETE FROM accounting_lease_payments WHERE contract_id = ${contractId}
    `);
  }
  let nextSeq = 1;
  for (const row of rows) {
    if (
      (matchBySeq && paidSeqs.has(Number(row.seq))) ||
      paidKeys.has(`${row.due_date}|${round2(row.amount_incl).toFixed(2)}`)
    ) {
      skipped += 1;
      continue;
    }
    // تسلسل حر (لا يصادف صفًا مسددًا محفوظًا).
    let seq = Number(row.seq) || nextSeq;
    while (paidSeqs.has(seq)) seq += 1;
    nextSeq = seq + 1;
    statements.push(insertPaymentStatement(contractId, { ...row, seq }));
  }
  await sql.transaction(statements);
  const total = await recomputeContractTotal(contractId);
  return { inserted: rows.length - skipped, skipped, kept_paid: paidSeqs.size, total_value: total };
}

// ---------------------------------------------------------------------------
// تحليل مدخلات العقد (POST/PUT) والتحقق منها.
// يعيد { ok:true, value } أو { ok:false, error }.
// installment_amount في القيمة المعادة دائمًا قبل الضريبة (يُفكّ إن كان
// المُدخل شاملًا).
// ---------------------------------------------------------------------------
export function parseContractInput(body = {}, { requireSchedule = true } = {}) {
  const lessorName = textOrNull(body.lessor_name, 300);
  if (!lessorName) return { ok: false, error: "اسم المؤجر مطلوب" };

  const startDate = parseDate(body.start_date);
  const endDate = parseDate(body.end_date);
  if (!startDate) return { ok: false, error: "تاريخ بداية العقد غير صحيح (YYYY-MM-DD)" };
  if (!endDate) return { ok: false, error: "تاريخ انتهاء العقد غير صحيح (YYYY-MM-DD)" };
  if (compareDateKeys(endDate, startDate) < 0) {
    return { ok: false, error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية أو يساويه" };
  }

  const contractType = String(body.contract_type || "branch").trim();
  if (!CONTRACT_TYPES.includes(contractType)) {
    return { ok: false, error: "نوع العقد غير معروف (فرع / سكن / مستودع)" };
  }

  const frequency = String(body.payment_frequency || "monthly").trim();
  if (!LEASE_FREQUENCIES.includes(frequency)) {
    return { ok: false, error: "تكرار الدفعات غير معروف" };
  }

  const vatRaw = body.vat_rate === undefined || body.vat_rate === null || body.vat_rate === ""
    ? DEFAULT_VAT_RATE
    : Number(body.vat_rate);
  if (!Number.isFinite(vatRaw) || vatRaw < 0 || vatRaw > 100) {
    return { ok: false, error: "نسبة الضريبة يجب أن تكون بين 0 و100" };
  }
  const vatRate = Math.round(vatRaw * 100) / 100;
  const amountIncludesVat = body.amount_includes_vat === true;

  let installmentAmount = 0;
  let payments = [];
  if (frequency === "custom") {
    const raw = Array.isArray(body.payments) ? body.payments : [];
    for (const entry of raw) {
      const dueDate = parseDate(entry?.due_date);
      const amount = parseMoney(entry?.amount_excl ?? entry?.amount, 0);
      if (!dueDate) return { ok: false, error: "تاريخ استحقاق إحدى الدفعات المخصصة غير صحيح" };
      if (!(amount > 0)) return { ok: false, error: "مبلغ إحدى الدفعات المخصصة يجب أن يكون أكبر من صفر" };
      const rowVatRaw = entry?.vat_rate === undefined || entry?.vat_rate === null || entry?.vat_rate === ""
        ? vatRate
        : Number(entry.vat_rate);
      const rowVat = Number.isFinite(rowVatRaw) ? Math.min(Math.max(rowVatRaw, 0), 100) : vatRate;
      payments.push({
        due_date: dueDate,
        amount_excl: amount,
        vat_rate: rowVat,
        description: textOrNull(entry?.description, 300),
        period_start: parseDate(entry?.period_start),
        period_end: parseDate(entry?.period_end),
      });
    }
    if (!payments.length && requireSchedule) {
      return { ok: false, error: "أضف دفعة واحدة على الأقل للدفعات المخصصة" };
    }
  } else {
    const rawAmount = parseMoney(body.installment_amount, 0);
    if (!(rawAmount > 0)) return { ok: false, error: "قيمة الدفعة مطلوبة" };
    installmentAmount = installmentAmounts({
      amount: rawAmount,
      vatRate,
      amountIncludesVat,
    }).amount_excl;
    if (!(installmentAmount > 0)) return { ok: false, error: "قيمة الدفعة مطلوبة" };
  }

  // المبالغ الثابتة لكل دفعة (قبل الضريبة): قائمة {label, amount} أو مجموع.
  const fixedCharges = [];
  if (Array.isArray(body.fixed_charges)) {
    for (const entry of body.fixed_charges) {
      const amount = parseMoney(entry?.amount, 0);
      const label = textOrNull(entry?.label ?? entry?.description, 200);
      if (!(amount > 0) && !label) continue;
      if (amount < 0) return { ok: false, error: "مبلغ ثابت غير صحيح" };
      fixedCharges.push({
        label: label || "مبلغ ثابت",
        amount: round2(amount),
        taxable: entry?.taxable === true,
      });
    }
  }
  let fixedAmount = round2(fixedCharges.reduce((sum, row) => sum + row.amount, 0));
  if (!fixedCharges.length && body.fixed_amount !== undefined && body.fixed_amount !== null && body.fixed_amount !== "") {
    fixedAmount = parseMoney(body.fixed_amount, 0);
    if (fixedAmount < 0) return { ok: false, error: "مبلغ ثابت غير صحيح" };
    fixedAmount = round2(fixedAmount);
    if (fixedAmount > 0) fixedCharges.push({ label: "مبالغ ثابتة", amount: fixedAmount, taxable: false });
  }

  const noticeDaysRaw = body.notice_period_days;
  let noticeDays = null;
  if (noticeDaysRaw !== undefined && noticeDaysRaw !== null && noticeDaysRaw !== "") {
    const n = Number(noticeDaysRaw);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, error: "فترة الإشعار (بالأيام) غير صحيحة" };
    }
    noticeDays = n;
  }

  // غياب الحقل = أبقِ المخزَّن (PUT يستخدم COALESCE؛ POST يفترض active).
  const status =
    body.status === undefined || body.status === null
      ? null
      : body.status === "terminated"
        ? "terminated"
        : "active";
  const firstDue = parseDate(body.first_due_date);

  let analysisJson = null;
  if (body.analysis_json && typeof body.analysis_json === "object") {
    analysisJson = body.analysis_json;
  }

  return {
    ok: true,
    value: {
      contract_number: textOrNull(body.contract_number, 120),
      contract_type: contractType,
      display_name: textOrNull(body.display_name, 120),
      is_renewal: body.is_renewal === true,
      lessor_name: lessorName,
      lessor_contact_id: parseIntOrNull(body.lessor_contact_id),
      lessor_vat_number: textOrNull(body.lessor_vat_number, 40),
      location: textOrNull(body.location, 300),
      branch_id: parseIntOrNull(body.branch_id),
      start_date: startDate,
      end_date: endDate,
      notice_period_days: noticeDays,
      notice_period_text: textOrNull(body.notice_period_text, 300),
      payment_frequency: frequency,
      installment_amount: round2(installmentAmount),
      vat_rate: vatRate,
      amount_includes_vat: amountIncludesVat,
      fixed_charges: fixedCharges,
      fixed_amount: fixedAmount,
      first_due_date: firstDue,
      payments,
      notes: textOrNull(body.notes, 4000),
      attachment_url: textOrNull(body.attachment_url, 1000),
      attachment_name: textOrNull(body.attachment_name, 300),
      analysis_json: analysisJson,
      status,
      expected_updated_at: body.expected_updated_at ? String(body.expected_updated_at) : null,
      regenerate_schedule: body.regenerate_schedule === true,
    },
  };
}

// مقارنة زمنية متسامحة (< ثانية) للتفاؤل التزامني.
export function sameInstant(a, b) {
  if (!a || !b) return true;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) < 1000;
}
