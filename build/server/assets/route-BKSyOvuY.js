import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureAccountsSchema } from './accountsTree-BiYqjwch.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { r as runPurchaseAutomation, a as syncRecurringTemplateFromInvoice, c as createRecurringTemplateFromInvoice } from './purchaseAutomation-oQMrImT7.js';
import { n as notifyByPref } from './waNotify-CtLfIpXX.js';
import { b as loadRoastChild, c as loadInvoiceLines, d as recomputeItemCost, f as reverseDeposits, h as loadRoastLinks, i as applyCoffeeToItems, j as assertRoastSyncAllowed, s as syncRoastInvoice, k as reverseSyncRoastToBean, C as CoffeeError, m as resolveRoaster, n as getRoastingAccountId, o as reserveIds, p as insertLineStatement, q as recordArrival, e as ensureCoffeeSchema, L as LINE_SELECT_COLUMNS, t as planLineReconcile } from './coffeeInvoices-43pTEYyU.js';
import '@neondatabase/serverless';
import 'crypto';
import './wasender-DykD1wlV.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';

// Full accounting admins OR admins limited to قسم المشتريات only.
const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};

// Creating an invoice is also allowed for the field entry flow
// (رفع فاتورة مشتريات): employees with the dedicated permission can
// ADD invoices only — reading the ledger and editing stay admin-only.
const REQUIRE_PURCHASES_CREATE = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }, {
    permission: "can_add_purchase_invoices"
  }]
};

// Simplified status model: everything is computed from amounts/due
// date; unpaid invoices display بانتظار الاعتماد. "new" survives only
// as a legacy stored value and maps to pending_payment on display.
const WORKFLOW_STATUSES = new Set(["new", "pending_payment"]);
const DISPLAY_STATUSES = new Set(["pending_payment", "partial_paid", "paid", "overdue"]);
function todayRiyadh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
async function ensureSchema() {
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
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    ALTER TABLE accounting_contacts
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS vat_number TEXT,
      ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_employee_name TEXT
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_purchase_invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      contact_id INTEGER REFERENCES accounting_contacts(id) ON DELETE SET NULL,
      supplier_name TEXT,
      invoice_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Riyadh')::DATE),
      due_date DATE,
      currency TEXT NOT NULL DEFAULT 'SAR',
      subtotal_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      paid_bank_account_id INTEGER,
      payment_receipt_url TEXT,
      workflow_status TEXT NOT NULL DEFAULT 'new',
      notes TEXT,
      attachment_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    ALTER TABLE accounting_purchase_invoices
      ADD COLUMN IF NOT EXISTS invoice_number TEXT,
      ADD COLUMN IF NOT EXISTS contact_id INTEGER,
      ADD COLUMN IF NOT EXISTS supplier_name TEXT,
      ADD COLUMN IF NOT EXISTS invoice_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Riyadh')::DATE),
      ADD COLUMN IF NOT EXISTS due_date DATE,
      ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SAR',
      ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_bank_account_id INTEGER,
      ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT,
      ADD COLUMN IF NOT EXISTS branch_id INTEGER,
      ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'new',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS attachment_kind TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_employee_name TEXT,
      ADD COLUMN IF NOT EXISTS expense_account_id INTEGER,
      ADD COLUMN IF NOT EXISTS recurring_template_id INTEGER
  `;
  // Invoices classify against expense accounts from شجرة الحسابات.
  await ensureAccountsSchema();

  // The invoices SELECT joins the banks table (paid_bank_account_id →
  // bank name); make sure it exists even if the banks tab was never
  // opened. Mirrors the CREATE in /api/accounting/bank-accounts.
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_bank_accounts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'bank',
      currency TEXT NOT NULL DEFAULT 'SAR',
      bank_name TEXT,
      iban TEXT,
      account_number TEXT,
      book_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      statement_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;

  // Line items (بنود الفاتورة): each carries its own tree account and
  // tax math. Header subtotal/tax/total are recomputed from the lines
  // whenever a payload includes them; legacy header-only invoices keep
  // working (no rows here).
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_purchase_invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES accounting_purchase_invoices(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      account_id INTEGER,
      amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 15,
      amount_includes_tax BOOLEAN NOT NULL DEFAULT FALSE,
      line_subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
      line_tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
      line_total NUMERIC(14, 2) NOT NULL DEFAULT 0
    )
  `;
  await sql`
    ALTER TABLE accounting_purchase_invoice_items
      ADD COLUMN IF NOT EXISTS quantity NUMERIC(14, 3) NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14, 4) NOT NULL DEFAULT 0
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_purchase_invoice_items_invoice
      ON accounting_purchase_invoice_items (invoice_id, position)
  `;

  // سجل الدفعات: كل دفعة سطر مستقل بتاريخها وبنكها وإيصالها ومن
  // سجّلها. paid_amount في رأس الفاتورة يبقى المجموع (مصدر حساب
  // الحالة)، وهذا الجدول هو التفصيل — أساس التدفق النقدي والأساس
  // النقدي في الإقرار وكشف المورد بمستوى الدفعة.
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_purchase_invoice_payments (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES accounting_purchase_invoices(id) ON DELETE CASCADE,
      amount NUMERIC(14, 2) NOT NULL,
      payment_date DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Riyadh')::DATE),
      bank_account_id INTEGER,
      receipt_url TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_purchase_invoice_payments_invoice
      ON accounting_purchase_invoice_payments (invoice_id, payment_date, id)
  `;

  // مرفقات متعددة للفاتورة الواحدة بمسمياتها: عرض السعر أولاً ثم
  // الفاتورة الضريبية بعد السداد — كلها على نفس فاتورة المشتريات.
  // attachment_url و payment_receipt_url في الرأس باقيان للتوافق
  // ويُعرضان كسطرين ضمن نفس القائمة.
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_purchase_invoice_attachments (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES accounting_purchase_invoices(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      label TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    ALTER TABLE accounting_purchase_invoice_attachments
      ADD COLUMN IF NOT EXISTS kind TEXT
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_purchase_invoice_attachments_invoice
      ON accounting_purchase_invoice_attachments (invoice_id, id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_purchase_invoices_invoice_date
      ON accounting_purchase_invoices (invoice_date DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_purchase_invoices_due_date
      ON accounting_purchase_invoices (due_date)
  `;
  // تكلفة البن: أعمدة البند/الرأس، حساب «تحميص»، افتراضات الصنف
  // والتصنيف، وحدة الكيلو، المحمصة الافتراضية.
  await ensureCoffeeSchema();
}

// من يحق له اعتماد الوصول (إيداع + تكلفة الصنف): إدارة المحاسبة أو
// المشتريات أو المخزون. موظف الإدخال الميداني يبلّغ فقط.
function canFinalizeArrival(user) {
  return user?.role === "Admin" && !!(user?.can_manage_accounting || user?.can_manage_purchases || user?.can_manage_inventory);
}
function coffeeErrorResponse(error) {
  if (error instanceof CoffeeError) {
    return Response.json({
      error: error.message,
      ...(error.extra || {})
    }, {
      status: error.status || 400
    });
  }
  return null;
}
function parseMoney(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 100) / 100;
}
function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
function generateInvoiceNumber() {
  const stamp = todayRiyadh().replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PINV-${stamp}-${suffix}`;
}
function parsePayload(body = {}) {
  const contactId = body.contact_id === undefined || body.contact_id === null || body.contact_id === "" ? null : Number(body.contact_id);
  const supplierName = body.supplier_name ? String(body.supplier_name).trim() : null;
  const subtotalAmount = parseMoney(body.subtotal_amount, 0);
  const discountAmount = parseMoney(body.discount_amount, 0);
  const taxAmount = parseMoney(body.tax_amount, 0);
  const totalRaw = parseMoney(body.total_amount, 0);
  const totalAmount = totalRaw > 0 ? totalRaw : Math.round((subtotalAmount + taxAmount) * 100) / 100;
  // «إرسال إلى الاعتماد» يفرض فاتورة غير مدفوعة مهما أرسل العميل —
  // الصفر هنا يلغي أيضاً بنك السداد والإيصال أدناه.
  const paidAmount = body.submit_for_approval === true ? 0 : parseMoney(body.paid_amount, 0);
  const branchIdRaw = body.branch_id === undefined || body.branch_id === null || body.branch_id === "" ? null : Number(body.branch_id);
  const paidBankAccountIdRaw = body.paid_bank_account_id === undefined || body.paid_bank_account_id === null || body.paid_bank_account_id === "" ? null : Number(body.paid_bank_account_id);
  const workflowRaw = body.workflow_status ? String(body.workflow_status).trim() : "new";
  const expenseAccountId = body.expense_account_id === undefined || body.expense_account_id === null || body.expense_account_id === "" ? null : Number(body.expense_account_id);
  const roasterRaw = Number(body.roaster_contact_id);
  return {
    expenseAccountId: Number.isInteger(expenseAccountId) ? expenseAccountId : null,
    // المحمصة لفاتورة التحميص المولّدة (null = افتراضي التصنيف).
    roasterContactId: Number.isInteger(roasterRaw) && roasterRaw > 0 ? roasterRaw : null,
    // رقم فاتورة المحمصة الفعلية على فاتورة التحميص (لا يستبدل الرقم).
    roasterReference: body.roaster_reference ? String(body.roaster_reference).trim().slice(0, 120) : null,
    // تفاؤل تزامني: النافذة ترسل updated_at الذي حمّلته.
    expectedUpdatedAt: body.expected_updated_at ? String(body.expected_updated_at) : null,
    invoiceNumber: body.invoice_number ? String(body.invoice_number).trim() : generateInvoiceNumber(),
    contactId: Number.isFinite(contactId) ? contactId : null,
    supplierName,
    invoiceDate: parseDate(body.invoice_date) || todayRiyadh(),
    dueDate: parseDate(body.due_date),
    currency: body.currency ? String(body.currency).trim().toUpperCase() : "SAR",
    subtotalAmount,
    discountAmount,
    taxAmount,
    totalAmount,
    paidAmount,
    // Which bank account the payment left from — only meaningful when
    // something was actually paid.
    paidBankAccountId: Number.isInteger(paidBankAccountIdRaw) && paidBankAccountIdRaw > 0 && paidAmount > 0 ? paidBankAccountIdRaw : null,
    branchId: Number.isInteger(branchIdRaw) && branchIdRaw > 0 ? branchIdRaw : null,
    workflowStatus: WORKFLOW_STATUSES.has(workflowRaw) ? workflowRaw : "new",
    notes: body.notes ? String(body.notes).trim() : null,
    attachmentUrl: body.attachment_url ? String(body.attachment_url).trim() : null,
    // تصنيف المستند الأساسي (من المسح الذكي أو المستخدم): عرض سعر /
    // فاتورة ضريبية / سند سداد — يحدد قسم عرضه في درج الفاتورة.
    attachmentKind: ["quote", "tax_invoice", "payment_receipt", "other"].includes(body.attachment_kind) ? body.attachment_kind : null,
    // Optional proof-of-payment attachment — only meaningful when paid.
    paymentReceiptUrl: paidAmount > 0 && body.payment_receipt_url ? String(body.payment_receipt_url).trim() : null
  };
}
function round2(value) {
  return Math.round(value * 100) / 100;
}

// Line items from the payload. Returns null when the payload carries
// no `items` key (legacy callers like the quick-payment modal) — the
// stored lines must then be left untouched. Tax math per line:
//   exclusive: subtotal = amount, tax = amount × rate
//   inclusive: total = amount, subtotal = amount ÷ (1 + rate)
function parseItems(body) {
  if (!Array.isArray(body?.items)) return null;
  const items = [];
  for (const raw of body.items) {
    // Quantity × unit price is the base amount; legacy payloads that
    // send only `amount` become 1 × amount.
    const qtyRaw = Number(raw?.quantity);
    const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.round(qtyRaw * 1000) / 1000 : null;
    const priceRaw = Number(raw?.unit_price);
    const unitPrice = Number.isFinite(priceRaw) && priceRaw > 0 ? Math.round(priceRaw * 10000) / 10000 : null;
    const amount = quantity !== null && unitPrice !== null ? round2(quantity * unitPrice) : parseMoney(raw?.amount, 0);
    // بند بمبلغ 0 يُسقَط — إلا عينة/خيشة مجانية من البن (تحمل كيلو
    // وتحميصًا وإيداعًا بتكلفة 0).
    const freeSample = raw?.free_sample === true && raw?.roast_enabled === true;
    if (amount <= 0 && !freeSample) continue;
    const rateRaw = Number(raw?.tax_rate);
    const taxRate = Number.isFinite(rateRaw) ? Math.min(Math.max(rateRaw, 0), 100) : 15;
    const includesTax = !!raw?.amount_includes_tax;
    const accountId = raw?.account_id === undefined || raw?.account_id === null || raw?.account_id === "" ? null : Number(raw.account_id);
    const subtotal = includesTax ? amount / (1 + taxRate / 100) : amount;
    const tax = includesTax ? amount - subtotal : amount * taxRate / 100;
    const lineIdRaw = Number(raw?.id);
    items.push({
      // معرّف البند القائم — الحفظ يطابق البنود بمعرّفها لا يستبدلها.
      id: Number.isInteger(lineIdRaw) && lineIdRaw > 0 ? lineIdRaw : null,
      position: items.length,
      description: raw?.description ? String(raw.description).trim() : null,
      accountId: Number.isInteger(accountId) ? accountId : null,
      quantity: quantity ?? 1,
      unitPrice: unitPrice ?? amount,
      amount,
      taxRate,
      includesTax,
      subtotal: round2(subtotal),
      tax: round2(tax),
      total: round2(subtotal + tax),
      // بيانات البن — غياب المفتاح يعني «أبقِ المخزَّن» عند التعديل.
      roast_enabled: raw?.roast_enabled,
      quantity_unit: raw?.quantity_unit,
      kg_per_sack: raw?.kg_per_sack,
      // إجمالي الكيلو الخام المُدخل مباشرة (يتقدم على الكمية × كيلو/الخيشة)
      raw_kg: raw?.raw_kg,
      roast_per_kg: raw?.roast_per_kg,
      roast_tax_rate: raw?.roast_tax_rate,
      extra_cost: raw?.extra_cost,
      free_sample: raw?.free_sample,
      confirm_unusual_price: raw?.confirm_unusual_price === true
    });
  }
  return items;
}

// حفظ البنود بالمطابقة (تحديث القائم بمعرّفه، إدراج الجديد، حذف
// الغائب) — لا حذف+إدراج، حتى تبقى بيانات الوصول/الإيداع/الربط.
// extraStatements تُنفَّذ في نفس المعاملة (تحديث الرأس مثلًا).
async function replaceInvoiceItems(invoiceId, items, extraStatements = []) {
  const plan = await planLineReconcile(invoiceId, items);
  const statements = [...plan.statements, ...extraStatements];
  if (statements.length) await sql.transaction(statements);
  return plan;
}

// When lines are present they are the source of truth for the header
// money columns + the header account (first line's account keeps the
// account filter/report working). An invoice-level discount applies
// to the PRE-TAX sum: the taxable base shrinks by the discount and
// the tax shrinks proportionally — line prices stay as printed.
function applyItemsToPayload(payload, items) {
  if (!items || items.length === 0) return payload;
  const rawSubtotal = round2(items.reduce((sum, item) => sum + item.subtotal, 0));
  const rawTax = round2(items.reduce((sum, item) => sum + item.tax, 0));
  const discount = Math.min(Math.max(payload.discountAmount || 0, 0), rawSubtotal);
  const factor = rawSubtotal > 0 ? (rawSubtotal - discount) / rawSubtotal : 1;
  const subtotal = round2(rawSubtotal - discount);
  const tax = round2(rawTax * factor);
  return {
    ...payload,
    discountAmount: round2(discount),
    subtotalAmount: subtotal,
    taxAmount: tax,
    totalAmount: round2(subtotal + tax),
    expenseAccountId: items.find(item => item.accountId)?.accountId ?? payload.expenseAccountId
  };
}
async function attachItems(rows) {
  const ids = rows.map(row => row.id);
  if (ids.length === 0) return rows;
  try {
    const items = await sql(`SELECT ${LINE_SELECT_COLUMNS}
       FROM accounting_purchase_invoice_items
       WHERE invoice_id = ANY($1)
       ORDER BY invoice_id, position, id`, [ids]);
    const byInvoice = new Map();
    for (const item of items) {
      const key = Number(item.invoice_id);
      if (!byInvoice.has(key)) byInvoice.set(key, []);
      byInvoice.get(key).push(item);
    }
    return rows.map(row => ({
      ...row,
      items: byInvoice.get(Number(row.id)) || []
    }));
  } catch (error) {
    console.error("attach invoice items failed", error);
    return rows.map(row => ({
      ...row,
      items: []
    }));
  }
}

// سجل الدفعات يُرفق مع كل صف حتى تقرأه المعاينة الجانبية وتقارير
// البنوك والأساس النقدي دون طلبات إضافية.
async function attachPayments(rows) {
  const ids = rows.map(row => row.id);
  if (ids.length === 0) return rows;
  try {
    const payments = await sql`
      SELECT p.id, p.invoice_id, p.amount,
             TO_CHAR(p.payment_date, 'YYYY-MM-DD') AS payment_date,
             p.bank_account_id, bank.name AS bank_name,
             p.receipt_url, p.notes,
             p.created_by_employee_name
      FROM accounting_purchase_invoice_payments p
      LEFT JOIN accounting_bank_accounts bank ON bank.id = p.bank_account_id
      WHERE p.invoice_id = ANY(${ids})
      ORDER BY p.invoice_id, p.payment_date, p.id
    `;
    const byInvoice = new Map();
    for (const payment of payments) {
      const key = Number(payment.invoice_id);
      if (!byInvoice.has(key)) byInvoice.set(key, []);
      byInvoice.get(key).push(payment);
    }
    return rows.map(row => ({
      ...row,
      payments: byInvoice.get(Number(row.id)) || []
    }));
  } catch (error) {
    console.error("attach invoice payments failed", error);
    return rows.map(row => ({
      ...row,
      payments: []
    }));
  }
}

// المرفقات الإضافية تُرفق مع كل صف لقائمة المرفقات في المعاينة.
async function attachExtraAttachments(rows) {
  const ids = rows.map(row => row.id);
  if (ids.length === 0) return rows;
  try {
    const attachments = await sql`
      SELECT id, invoice_id, url, label, kind,
             TO_CHAR(created_at, 'YYYY-MM-DD') AS attached_date,
             created_by_employee_name
      FROM accounting_purchase_invoice_attachments
      WHERE invoice_id = ANY(${ids})
      ORDER BY invoice_id, id
    `;
    const byInvoice = new Map();
    for (const attachment of attachments) {
      const key = Number(attachment.invoice_id);
      if (!byInvoice.has(key)) byInvoice.set(key, []);
      byInvoice.get(key).push(attachment);
    }
    return rows.map(row => ({
      ...row,
      attachments: byInvoice.get(Number(row.id)) || []
    }));
  } catch (error) {
    console.error("attach invoice attachments failed", error);
    return rows.map(row => ({
      ...row,
      attachments: []
    }));
  }
}

// Classification target must be a live postable expense account —
// otherwise reports built on the tree would silently mis-bucket.
async function validateExpenseAccount(expenseAccountId) {
  if (!expenseAccountId) return null;
  const [account] = await sql`
    SELECT id FROM accounting_accounts
    WHERE id = ${expenseAccountId}
      AND account_type = 'expense'
      AND is_postable
      AND is_active
  `;
  return account ? null : "حساب المصروف المحدد غير صالح";
}
function validatePayload(payload) {
  if (!payload.invoiceNumber) return "رقم الفاتورة مطلوب";
  if (!payload.supplierName && !payload.contactId) return "المورد مطلوب";
  if (!payload.currency) return "العملة مطلوبة";
  if (payload.totalAmount <= 0) return "مبلغ الفاتورة مطلوب";
  if (payload.paidAmount < 0) return "المبلغ المدفوع غير صحيح";
  if (payload.paidAmount > payload.totalAmount) {
    return "المبلغ المدفوع لا يمكن أن يتجاوز مبلغ الفاتورة";
  }
  // تاريخ بعد أكثر من 30 يوماً في المستقبل = سنة مقروءة غلط شبه
  // مؤكد (مسح ذكي قرأ 2028 بدل 2026 مثلاً) — فاتورة كهذه تعلق بقمة
  // الجدول المرتب بالتاريخ وتشوه التقارير. ارفضها برسالة واضحة.
  if (payload.invoiceDate) {
    const limit = new Date();
    limit.setDate(limit.getDate() + 30);
    const limitStr = limit.toISOString().slice(0, 10);
    if (String(payload.invoiceDate) > limitStr) {
      return `تاريخ الفاتورة (${payload.invoiceDate}) في المستقبل البعيد — تحقق من السنة`;
    }
  }
  return null;
}
function selectInvoicesQuery(where, statusFilter) {
  const statusWhere = statusFilter ? "WHERE computed_status = $" + (where.values.length + 2) : "";
  return `
    WITH invoice_rows AS (
      SELECT
        inv.id,
        inv.invoice_number,
        inv.contact_id,
        COALESCE(NULLIF(c.name, ''), NULLIF(inv.supplier_name, '')) AS supplier_name,
        c.name AS contact_name,
        inv.expense_account_id,
        acc.code AS expense_account_code,
        acc.name AS expense_account_name,
        TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') AS invoice_date,
        TO_CHAR(inv.due_date, 'YYYY-MM-DD') AS due_date,
        inv.currency,
        inv.subtotal_amount,
        inv.discount_amount,
        inv.tax_amount,
        inv.total_amount,
        inv.paid_amount,
        inv.paid_bank_account_id,
        bank.name AS paid_bank_name,
        inv.payment_receipt_url,
        inv.branch_id,
        br.name AS branch_name,
        GREATEST(inv.total_amount - inv.paid_amount, 0) AS balance_due,
        inv.recurring_template_id,
        inv.invoice_kind,
        inv.source_invoice_id,
        src.invoice_number AS source_invoice_number,
        inv.roaster_contact_id,
        rc.name AS roaster_name,
        inv.roast_link_state,
        inv.roast_confirmed,
        inv.roaster_reference,
        inv.workflow_status,
        CASE
          WHEN inv.is_active = FALSE THEN 'inactive'
          WHEN inv.total_amount > 0 AND inv.paid_amount >= inv.total_amount THEN 'paid'
          WHEN inv.due_date IS NOT NULL
            AND inv.due_date < $${where.values.length + 1}::date
            AND inv.paid_amount < inv.total_amount THEN 'overdue'
          WHEN inv.paid_amount > 0 THEN 'partial_paid'
          ELSE 'pending_payment'
        END AS computed_status,
        inv.notes,
        inv.attachment_url,
        inv.attachment_kind,
        inv.is_active,
        inv.created_at,
        inv.updated_at,
        inv.created_by_employee_id,
        inv.created_by_employee_name
      FROM accounting_purchase_invoices inv
      LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
      LEFT JOIN accounting_accounts acc ON acc.id = inv.expense_account_id
      LEFT JOIN accounting_bank_accounts bank ON bank.id = inv.paid_bank_account_id
      LEFT JOIN branches br ON br.id = inv.branch_id
      LEFT JOIN accounting_purchase_invoices src ON src.id = inv.source_invoice_id
      LEFT JOIN accounting_contacts rc ON rc.id = inv.roaster_contact_id
      ${where.sql}
    )
    SELECT *
    FROM invoice_rows
    ${statusWhere}
    ORDER BY is_active DESC, invoice_date DESC, id DESC
  `;
}
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSchema();
    // كسول بدل cron: توليد الفواتير المتكررة المستحقة وإرسال
    // التقارير المجدولة عند أول تحميل بعد الموعد. أخطاؤها مبتلعة.
    await runPurchaseAutomation();
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const q = (url.searchParams.get("q") || "").trim();
    const rawStatus = (url.searchParams.get("status") || "").trim();
    const status = DISPLAY_STATUSES.has(rawStatus) ? rawStatus : "";
    const conditions = [];
    const values = [];
    let idx = 1;
    if (!includeInactive) {
      conditions.push("inv.is_active = TRUE");
    }
    if (q) {
      conditions.push(`(LOWER(inv.invoice_number) LIKE $${idx} OR LOWER(COALESCE(inv.supplier_name,'')) LIKE $${idx} OR LOWER(COALESCE(c.name,'')) LIKE $${idx})`);
      values.push(`%${q.toLowerCase()}%`);
      idx += 1;
    }
    const where = {
      sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      values
    };
    const today = todayRiyadh();
    const query = selectInvoicesQuery(where, status);
    const rows = await sql(query, status ? [...values, today, status] : [...values, today]);
    const withItems = await attachItems(rows);
    const withPayments = await attachPayments(withItems);
    const withAttachments = await attachExtraAttachments(withPayments);
    // ملخص فاتورة التحميص المرتبطة بكل فاتورة بن (للدرج والتقرير).
    const roastLinks = await loadRoastLinks(withAttachments.filter(row => row.invoice_kind !== "roast").map(row => row.id));
    const invoices = withAttachments.map(row => ({
      ...row,
      roast_invoice: roastLinks.get(Number(row.id)) || null
    }));
    return Response.json({
      invoices
    });
  } catch (error) {
    console.error("purchase invoices GET error", error);
    return Response.json({
      error: "فشل تحميل فواتير المشتريات",
      details: error.message
    }, {
      status: 500
    });
  }
}

// نواة الإنشاء — يستدعيها POST أدناه ومسار الرفع الجماعي (إرسال بند
// معتمد) حتى يمر الطريقان بنفس التحقق والترقيم والتدقيق والإشعارات.
// الرأس والبنود ودفعة الإنشاء في معاملة واحدة بمعرّفات محجوزة مسبقًا.
// ترجع { ok:true, invoice, roast?, warnings? } أو { ok:false, status, error }.
async function createPurchaseInvoice(body, actor, options = {}) {
  const {
    canFinalize = false
  } = options;
  await ensureSchema();
  const items = parseItems(body);
  let payload = parsePayload(body);
  payload = applyItemsToPayload(payload, items);
  const validationError = validatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      status: 400,
      error: validationError
    };
  }
  const accountError = await validateExpenseAccount(payload.expenseAccountId);
  if (accountError) {
    return {
      ok: false,
      status: 400,
      error: accountError
    };
  }

  // بنود البن: أهلية الحساب + الحساب + الحمايات (على الخادم دائمًا).
  let enriched;
  try {
    enriched = await applyCoffeeToItems(items, payload, {
      invoiceKind: "purchase"
    });
  } catch (error) {
    if (error instanceof CoffeeError) {
      return {
        ok: false,
        status: error.status,
        error: error.message,
        ...(error.extra || {})
      };
    }
    throw error;
  }
  const hasRoast = enriched.some(line => line.coffee && line.coffee.roastTotalNet > 0);
  if (hasRoast) {
    // تحقق مسبق قبل أي كتابة: المحمصة وحساب «تحميص» موجودان.
    const roaster = await resolveRoaster(payload.roasterContactId, enriched);
    if (!roaster) {
      return {
        ok: false,
        status: 400,
        error: "حدد المحمصة (جهة اتصال) لفاتورة التحميص — أو اضبط المحمصة الافتراضية على تصنيف البن"
      };
    }
    if (!(await getRoastingAccountId())) {
      return {
        ok: false,
        status: 500,
        error: "حساب «تحميص» غير موجود في شجرة الحسابات"
      };
    }
  }
  const createdById = actor?.id ? Number(actor.id) : null;
  const createdByName = actor?.name ? String(actor.name) : null;
  const [invoiceId] = await reserveIds("accounting_purchase_invoices", 1);
  const lineIds = await reserveIds("accounting_purchase_invoice_items", enriched.length);
  const statements = [sql`
      INSERT INTO accounting_purchase_invoices (
        id, invoice_number, contact_id, supplier_name, expense_account_id,
        invoice_date, due_date, currency,
        subtotal_amount, discount_amount, tax_amount, total_amount, paid_amount,
        paid_bank_account_id, payment_receipt_url, branch_id, workflow_status,
        notes, attachment_url, attachment_kind, roaster_contact_id,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${invoiceId}, ${payload.invoiceNumber}, ${payload.contactId}, ${payload.supplierName}, ${payload.expenseAccountId},
        ${payload.invoiceDate}, ${payload.dueDate}, ${payload.currency},
        ${payload.subtotalAmount}, ${payload.discountAmount}, ${payload.taxAmount}, ${payload.totalAmount}, ${payload.paidAmount},
        ${payload.paidBankAccountId}, ${payload.paymentReceiptUrl}, ${payload.branchId}, ${payload.workflowStatus},
        ${payload.notes}, ${payload.attachmentUrl}, ${payload.attachmentKind}, ${payload.roasterContactId},
        ${createdById}, ${createdByName}
      )
    `, ...enriched.map((line, index) => insertLineStatement(lineIds[index], invoiceId, line))];
  // ما دُفع عند الإنشاء يدخل سجل الدفعات كسطر أول بتاريخ الفاتورة.
  if (payload.paidAmount > 0) {
    statements.push(sql`
      INSERT INTO accounting_purchase_invoice_payments (
        invoice_id, amount, payment_date, bank_account_id,
        receipt_url, notes,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${invoiceId}, ${payload.paidAmount}, ${payload.invoiceDate},
        ${payload.paidBankAccountId}, ${payload.paymentReceiptUrl},
        'دفعة عند إنشاء الفاتورة',
        ${createdById}, ${createdByName}
      )
    `);
  }
  await sql.transaction(statements);
  const [created] = await sql`
    SELECT * FROM accounting_purchase_invoices WHERE id = ${invoiceId}
  `;
  await logPurchaseAudit({
    entityType: "invoice",
    entityId: created.id,
    action: "created",
    summary: `إنشاء الفاتورة ${payload.invoiceNumber} — ${payload.supplierName || `مورد #${payload.contactId}`} بمبلغ ${payload.totalAmount.toFixed(2)} ${payload.currency}${payload.paidAmount > 0 ? ` (مدفوع ${payload.paidAmount.toFixed(2)})` : ""}${body.submit_for_approval === true ? " — أُرسلت إلى الاعتماد" : ""}`,
    actor
  });
  const warnings = [];
  const hasCoffee = enriched.some(line => line.coffee);

  // خيار «فاتورة متكررة بشكل شهري»: أنشئ قالباً يتولّى النظام توليده
  // تلقائياً مع بداية كل شهر (بانتظار الدفع، استحقاق نهاية الشهر).
  // مشروط بأن يكون أحد حسابات الفاتورة «مصروف ثابت» أو فرعاً منه —
  // الشرط يُعاد فرضه هنا كي لا يعتمد على الواجهة. فشله لا يعطل
  // الفاتورة نفسها. بنود البن لا تُكرَّر أبدًا.
  if (body.recurring_monthly === true && !hasCoffee) {
    try {
      const accountIds = [...(items || []).map(item => item.accountId), payload.expenseAccountId].filter(Boolean);
      await createRecurringTemplateFromInvoice({
        payload,
        accountIds,
        items,
        description: (items || []).find(item => item.description)?.description || null,
        invoiceId: created.id,
        actor
      });
    } catch (error) {
      console.error("recurring template from invoice failed", error);
    }
  } else if (body.recurring_monthly === true && hasCoffee) {
    warnings.push("فواتير البن لا تُكرَّر تلقائيًا — لم يُنشأ قالب متكرر");
  }

  // فاتورة التحميص المولّدة + الوصول عند الإنشاء.
  let roast = null;
  if (hasCoffee) {
    try {
      const beanLines = await loadInvoiceLines(invoiceId);
      roast = await syncRoastInvoice({
        id: invoiceId,
        invoice_number: payload.invoiceNumber,
        invoice_date: payload.invoiceDate,
        roaster_contact_id: payload.roasterContactId
      }, beanLines, actor);
    } catch (error) {
      console.error("roast invoice generation failed", error);
      warnings.push(`لم تُولَّد فاتورة التحميص: ${error.message} — ستُولَّد عند أول تعديل للفاتورة`);
    }
    const arrival = body.arrival;
    if (arrival && Array.isArray(arrival.lines) && arrival.lines.length > 0) {
      const lines = arrival.lines.map(entry => ({
        ...entry,
        id: lineIds[Number(entry.index)]
      })).filter(entry => Number.isInteger(entry.id));
      try {
        await recordArrival({
          id: invoiceId,
          invoice_number: payload.invoiceNumber
        }, lines, {
          deposit: arrival.deposit || null,
          actor,
          canFinalize
        });
      } catch (error) {
        console.error("arrival at creation failed", error);
        warnings.push(`حُفظت الفاتورة لكن لم يُسجَّل الوصول: ${error.message} — سجّله من الدفتر`);
      }
    }
  }

  // إشعار المشتركين في «فاتورة مشتريات جديدة».
  notifyByPref("acc_invoice_created", ["🧾 فاتورة مشتريات جديدة", `الرقم: ${payload.invoiceNumber}`, `المورد: ${payload.supplierName || `#${payload.contactId}`}`, `المبلغ: ${payload.totalAmount.toFixed(2)} ${payload.currency}`, payload.paidAmount > 0 ? `المدفوع: ${payload.paidAmount.toFixed(2)}` : body.submit_for_approval === true ? "الحالة: بانتظار الاعتماد" : null, roast?.total ? `فاتورة تحميص مولّدة: ${roast.total.toFixed(2)} SAR` : null, createdByName ? `بواسطة: ${createdByName}` : null].filter(Boolean).join("\n"));
  return {
    ok: true,
    invoice: created,
    roast,
    warnings
  };
}
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_CREATE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const result = await createPurchaseInvoice(body, auth.user, {
      canFinalize: canFinalizeArrival(auth.user)
    });
    if (!result.ok) {
      const {
        ok,
        status,
        error,
        ...extra
      } = result;
      return Response.json({
        error,
        ...extra
      }, {
        status: status || 400
      });
    }
    return Response.json({
      ok: true,
      invoice: result.invoice,
      roast: result.roast || null,
      warnings: result.warnings || []
    }, {
      status: 201
    });
  } catch (error) {
    const coffee = coffeeErrorResponse(error);
    if (coffee) return coffee;
    console.error("purchase invoices POST error", error);
    return Response.json({
      error: "فشل إضافة فاتورة المشتريات",
      details: error.message
    }, {
      status: 500
    });
  }
}
function sameInstant(a, b) {
  if (!a || !b) return true;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) < 1000;
}
async function PUT(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const id = body.id ? Number(body.id) : null;
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف الفاتورة غير صحيح"
      }, {
        status: 400
      });
    }

    // اللقطة السابقة: نوع الفاتورة، حالتها، وقت آخر تعديل، الدفع.
    const [existing] = await sql`
      SELECT id, invoice_number, invoice_kind, source_invoice_id, is_active,
             updated_at, paid_amount, total_amount, roaster_contact_id,
             roaster_reference, TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
      FROM accounting_purchase_invoices
      WHERE id = ${id}
    `;
    if (!existing) {
      return Response.json({
        error: "الفاتورة غير موجودة"
      }, {
        status: 404
      });
    }
    if (existing.is_active === false) {
      return Response.json({
        error: "الفاتورة موقوفة — لا يمكن تعديلها",
        code: "inactive_invoice"
      }, {
        status: 409
      });
    }
    const invoiceKind = existing.invoice_kind === "roast" ? "roast" : "purchase";
    const items = parseItems(body);
    let payload = parsePayload(body);
    // حزمة بلا رقم (دفعة سريعة) تحتفظ بالرقم المخزَّن — لا رقم PINV جديد.
    if (!body.invoice_number) payload.invoiceNumber = existing.invoice_number;
    if (payload.expectedUpdatedAt && !sameInstant(existing.updated_at, payload.expectedUpdatedAt)) {
      return Response.json({
        error: "الفاتورة تغيّرت من مستخدم آخر — أعد فتحها ثم كرّر التعديل",
        code: "stale_invoice"
      }, {
        status: 409
      });
    }
    payload = applyItemsToPayload(payload, items);
    const validationError = validatePayload(payload);
    if (validationError) {
      return Response.json({
        error: validationError
      }, {
        status: 400
      });
    }
    const accountError = await validateExpenseAccount(payload.expenseAccountId);
    if (accountError) {
      return Response.json({
        error: accountError
      }, {
        status: 400
      });
    }

    // بنود البن: الحساب على الخادم مع إبقاء ما يملكه الخادم (الوصول).
    let enriched = null;
    let existingLines = [];
    if (items !== null) {
      existingLines = await loadInvoiceLines(id);
      enriched = await applyCoffeeToItems(items, payload, {
        existingLines,
        invoiceKind
      });
      if (invoiceKind === "purchase") {
        await assertRoastSyncAllowed(id, enriched, payload.roasterContactId);
      }
    }
    const roasterReference = payload.roasterReference !== null ? payload.roasterReference : existing.roaster_reference;
    const dueDateChanged = (payload.dueDate || null) !== (existing.due_date || null);
    const headerUpdate = sql`
      UPDATE accounting_purchase_invoices
      SET
        invoice_number = ${payload.invoiceNumber},
        contact_id = ${payload.contactId},
        supplier_name = ${payload.supplierName},
        expense_account_id = ${payload.expenseAccountId},
        invoice_date = ${payload.invoiceDate},
        due_date = ${payload.dueDate},
        currency = ${payload.currency},
        subtotal_amount = ${payload.subtotalAmount},
        discount_amount = ${payload.discountAmount},
        tax_amount = ${payload.taxAmount},
        total_amount = ${payload.totalAmount},
        paid_amount = ${payload.paidAmount},
        paid_bank_account_id = ${payload.paidBankAccountId},
        payment_receipt_url = ${payload.paymentReceiptUrl},
        branch_id = ${payload.branchId},
        workflow_status = ${payload.workflowStatus},
        notes = ${payload.notes},
        attachment_url = ${payload.attachmentUrl},
        attachment_kind = ${payload.attachmentKind},
        roaster_contact_id = COALESCE(${payload.roasterContactId}, roaster_contact_id),
        roaster_reference = ${roasterReference},
        -- تعديل فاتورة التحميص يدويًا يجعلها الحقيقة ويثبّت استحقاقها.
        roast_confirmed = CASE WHEN ${invoiceKind === "roast" && items !== null} THEN TRUE ELSE roast_confirmed END,
        due_date_auto = CASE WHEN ${dueDateChanged} THEN FALSE ELSE due_date_auto END,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;

    // `items` missing from the payload (quick-payment modal) → leave
    // the stored lines untouched; an array (even empty) reconciles them.
    if (items !== null) {
      await replaceInvoiceItems(id, enriched, [headerUpdate]);
    } else {
      await headerUpdate;
    }
    const [updated] = await sql`
      SELECT * FROM accounting_purchase_invoices WHERE id = ${id}
    `;
    const previousPaid = Number(existing?.paid_amount || 0);
    const paidDelta = Math.round((payload.paidAmount - previousPaid) * 100) / 100;
    // أي تغيير للمدفوع من المحرر الكامل يدخل سجل الدفعات — موجباً
    // كدفعة أو سالباً كتصحيح، فيبقى مجموع السجل = رأس الفاتورة.
    if (Math.abs(paidDelta) > 0.004) {
      await sql`
        INSERT INTO accounting_purchase_invoice_payments (
          invoice_id, amount, payment_date, bank_account_id,
          receipt_url, notes,
          created_by_employee_id, created_by_employee_name
        )
        VALUES (
          ${id}, ${paidDelta}, ${todayRiyadh()},
          ${payload.paidBankAccountId}, ${payload.paymentReceiptUrl},
          ${paidDelta > 0 ? "دفعة من محرر الفاتورة" : "تصحيح يدوي من محرر الفاتورة"},
          ${auth.user?.id ? Number(auth.user.id) : null},
          ${auth.user?.name ? String(auth.user.name) : null}
        )
      `;
    }
    if (paidDelta > 0.004) {
      await logPurchaseAudit({
        entityType: "invoice",
        entityId: id,
        action: "payment",
        summary: `تسجيل دفعة ${paidDelta.toFixed(2)} ${payload.currency} على الفاتورة ${payload.invoiceNumber} — إجمالي المدفوع ${payload.paidAmount.toFixed(2)} من ${payload.totalAmount.toFixed(2)}`,
        actor: auth.user
      });
    } else {
      await logPurchaseAudit({
        entityType: "invoice",
        entityId: id,
        action: "updated",
        summary: `تعديل الفاتورة ${payload.invoiceNumber} — الإجمالي ${payload.totalAmount.toFixed(2)} ${payload.currency}، المدفوع ${payload.paidAmount.toFixed(2)}`,
        actor: auth.user
      });
    }
    const warnings = [];
    if (invoiceKind === "purchase") {
      // فاتورة التحميص تتبع فاتورة البن (ما دامت غير مؤكَّدة ولا مسددة).
      if (items !== null || payload.roasterContactId) {
        try {
          const beanLines = await loadInvoiceLines(id);
          await syncRoastInvoice({
            id,
            invoice_number: payload.invoiceNumber,
            invoice_date: payload.invoiceDate,
            roaster_contact_id: updated.roaster_contact_id
          }, beanLines, auth.user);
        } catch (error) {
          console.error("roast invoice sync failed", error);
          warnings.push(`لم تُزامَن فاتورة التحميص: ${error.message}`);
        }
      }
      // تكلفة الصنف تُعاد من الصفر لكل صنف تأثر (قبل ∪ بعد).
      const itemIds = new Set();
      for (const line of existingLines) if (line.item_id) itemIds.add(Number(line.item_id));
      for (const line of enriched || []) if (line.coffee?.itemId) itemIds.add(line.coffee.itemId);
      for (const itemId of itemIds) await recomputeItemCost(itemId, auth.user);
    } else if (items !== null) {
      // فاتورة تحميص عُدّلت يدويًا → تصير الحقيقة لبنود البن.
      const touched = await reverseSyncRoastToBean(id, auth.user);
      for (const itemId of touched) await recomputeItemCost(itemId, auth.user);
    }

    // فاتورة مرتبطة بقالب متكرر: تعديل آخر فاتورة (المبلغ 5000 →
    // 4000 مثلاً) يزامن القالب فتخرج فواتير الأشهر القادمة بالقيم
    // الجديدة. فشل المزامنة لا يعطل حفظ الفاتورة.
    try {
      await syncRecurringTemplateFromInvoice({
        invoiceId: id,
        payload,
        items,
        actor: auth.user
      });
    } catch (error) {
      console.error("recurring template sync failed", error);
    }
    return Response.json({
      ok: true,
      invoice: updated,
      warnings
    });
  } catch (error) {
    const coffee = coffeeErrorResponse(error);
    if (coffee) return coffee;
    console.error("purchase invoices PUT error", error);
    return Response.json({
      error: "فشل تعديل فاتورة المشتريات",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    const force = url.searchParams.get("force") === "1";
    const detach = url.searchParams.get("detach") === "1";
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف الفاتورة غير صحيح"
      }, {
        status: 400
      });
    }
    const [invoice] = await sql`
      SELECT id, invoice_number, invoice_kind, source_invoice_id, paid_amount, is_active
      FROM accounting_purchase_invoices WHERE id = ${id}
    `;
    if (!invoice) {
      return Response.json({
        error: "الفاتورة غير موجودة"
      }, {
        status: 404
      });
    }
    const isRoast = invoice.invoice_kind === "roast";
    const child = isRoast ? null : await loadRoastChild(id);
    if (force) {
      // الحذف النهائي محروس: لا حذف لفاتورة (أو نظيرتها) لها دفعات أو إيداع.
      const guardIds = [id, ...(child ? [Number(child.id)] : [])];
      const [pay] = await sql`
        SELECT COUNT(*)::int AS count FROM accounting_purchase_invoice_payments
        WHERE invoice_id = ANY(${guardIds})
      `;
      if (Number(pay?.count) > 0 || Number(invoice.paid_amount) > 0) {
        return Response.json({
          error: "لا يمكن الحذف النهائي لفاتورة لها دفعات (أو فاتورة تحميص مرتبطة لها دفعات) — أوقفها بدل حذفها",
          code: "has_payments"
        }, {
          status: 409
        });
      }
      const [dep] = await sql`
        SELECT COUNT(*)::int AS count FROM accounting_purchase_invoice_items
        WHERE invoice_id = ${id} AND receipt_batch_id IS NOT NULL
      `;
      if (Number(dep?.count) > 0) {
        return Response.json({
          error: "الفاتورة مودَعة في المخزون — ألغِ الإيداع من نافذة تسجيل الوصول قبل الحذف",
          code: "deposited"
        }, {
          status: 409
        });
      }
      const itemIds = (await loadInvoiceLines(id)).map(l => l.item_id).filter(Boolean);
      const statements = [];
      if (child) statements.push(sql`DELETE FROM accounting_purchase_invoices WHERE id = ${child.id}`);
      statements.push(sql`DELETE FROM accounting_purchase_invoices WHERE id = ${id}`);
      await sql.transaction(statements);
      await logPurchaseAudit({
        entityType: "invoice",
        entityId: id,
        action: "deleted",
        summary: `حذف نهائي للفاتورة ${invoice.invoice_number}${child ? ` وفاتورة التحميص ${child.invoice_number}` : ""}`,
        actor: auth.user
      });
      for (const itemId of new Set(itemIds.map(Number))) await recomputeItemCost(itemId, auth.user);
      return Response.json({
        ok: true,
        hard: true
      });
    }
    if (isRoast) {
      // إيقاف فاتورة تحميص مباشرة: فقط بفك الارتباط الصريح — وإلا من
      // فاتورة البن (صفّر التحميص فتتوقف تلقائيًا).
      if (!detach) {
        return Response.json({
          error: "أوقف فاتورة التحميص من فاتورة البن (صفّر تكلفة التحميص) أو استخدم «فك الارتباط»",
          code: "roast_linked"
        }, {
          status: 409
        });
      }
      await sql`
        UPDATE accounting_purchase_invoices
        SET is_active = FALSE, roast_link_state = 'detached', updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${id}
      `;
      await logPurchaseAudit({
        entityType: "invoice",
        entityId: id,
        action: "deactivated",
        summary: `إيقاف فاتورة التحميص ${invoice.invoice_number} مع فك ارتباطها بفاتورة البن`,
        actor: auth.user
      });
      return Response.json({
        ok: true,
        hard: false
      });
    }

    // إيقاف فاتورة بن: عكس الإيداع، ثم الطفل (يتوقف إن كان بلا دفعات،
    // وإلا يبقى مفصولًا)، ثم إعادة حساب تكلفة الأصناف.
    const lines = await loadInvoiceLines(id);
    const itemIds = new Set(lines.map(l => l.item_id).filter(Boolean).map(Number));
    const reversed = await reverseDeposits(id, auth.user);
    let childNote = "";
    if (child) {
      if (Number(child.paid_amount) > 0) {
        await sql`
          UPDATE accounting_purchase_invoices
          SET roast_link_state = 'detached', updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE id = ${child.id}
        `;
        childNote = ` — فاتورة التحميص ${child.invoice_number} عليها دفعات فبقيت نشطة مفصولة`;
      } else {
        await sql`
          UPDATE accounting_purchase_invoices
          SET is_active = FALSE, roast_link_state = 'detached', updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE id = ${child.id}
        `;
        childNote = ` — أُوقفت فاتورة التحميص ${child.invoice_number} معها`;
      }
    }
    const [updated] = await sql`
      UPDATE accounting_purchase_invoices
      SET
        is_active = FALSE,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
      RETURNING id, invoice_number
    `;
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: id,
      action: "deactivated",
      summary: `إيقاف الفاتورة ${updated.invoice_number}${reversed ? ` — عُكس إيداع ${reversed} بند من المخزون` : ""}${childNote}`,
      actor: auth.user
    });
    for (const itemId of itemIds) await recomputeItemCost(itemId, auth.user);
    return Response.json({
      ok: true,
      hard: false,
      detached_roast: !!(child && Number(child.paid_amount) > 0)
    });
  } catch (error) {
    const coffee = coffeeErrorResponse(error);
    if (coffee) return coffee;
    console.error("purchase invoices DELETE error", error);
    return Response.json({
      error: "فشل إيقاف فاتورة المشتريات",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST, PUT, createPurchaseInvoice };
