import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureAccountsSchema } from "@/app/api/utils/accountsTree";

const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting",
};

// Creating an invoice is also allowed for the field entry flow
// (رفع فاتورة مشتريات): employees with the dedicated permission can
// ADD invoices only — reading the ledger and editing stay admin-only.
const REQUIRE_PURCHASES_CREATE = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { permission: "can_add_purchase_invoices" },
  ],
};

const WORKFLOW_STATUSES = new Set(["new", "pending_payment"]);
const DISPLAY_STATUSES = new Set([
  "new",
  "pending_payment",
  "partial_paid",
  "paid",
  "overdue",
]);

function todayRiyadh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
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
      ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'new',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_employee_name TEXT,
      ADD COLUMN IF NOT EXISTS expense_account_id INTEGER
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
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_purchase_invoices_invoice_date
      ON accounting_purchase_invoices (invoice_date DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_purchase_invoices_due_date
      ON accounting_purchase_invoices (due_date)
  `;
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
  const contactId =
    body.contact_id === undefined || body.contact_id === null || body.contact_id === ""
      ? null
      : Number(body.contact_id);
  const supplierName = body.supplier_name
    ? String(body.supplier_name).trim()
    : null;
  const subtotalAmount = parseMoney(body.subtotal_amount, 0);
  const discountAmount = parseMoney(body.discount_amount, 0);
  const taxAmount = parseMoney(body.tax_amount, 0);
  const totalRaw = parseMoney(body.total_amount, 0);
  const totalAmount =
    totalRaw > 0 ? totalRaw : Math.round((subtotalAmount + taxAmount) * 100) / 100;
  const paidAmount = parseMoney(body.paid_amount, 0);
  const paidBankAccountIdRaw =
    body.paid_bank_account_id === undefined ||
    body.paid_bank_account_id === null ||
    body.paid_bank_account_id === ""
      ? null
      : Number(body.paid_bank_account_id);
  const workflowRaw = body.workflow_status
    ? String(body.workflow_status).trim()
    : "new";
  const expenseAccountId =
    body.expense_account_id === undefined ||
    body.expense_account_id === null ||
    body.expense_account_id === ""
      ? null
      : Number(body.expense_account_id);

  return {
    expenseAccountId: Number.isInteger(expenseAccountId)
      ? expenseAccountId
      : null,
    invoiceNumber: body.invoice_number
      ? String(body.invoice_number).trim()
      : generateInvoiceNumber(),
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
    paidBankAccountId:
      Number.isInteger(paidBankAccountIdRaw) &&
      paidBankAccountIdRaw > 0 &&
      paidAmount > 0
        ? paidBankAccountIdRaw
        : null,
    workflowStatus: WORKFLOW_STATUSES.has(workflowRaw) ? workflowRaw : "new",
    notes: body.notes ? String(body.notes).trim() : null,
    attachmentUrl: body.attachment_url ? String(body.attachment_url).trim() : null,
    // Optional proof-of-payment attachment — only meaningful when paid.
    paymentReceiptUrl:
      paidAmount > 0 && body.payment_receipt_url
        ? String(body.payment_receipt_url).trim()
        : null,
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
    const quantity =
      Number.isFinite(qtyRaw) && qtyRaw > 0
        ? Math.round(qtyRaw * 1000) / 1000
        : null;
    const priceRaw = Number(raw?.unit_price);
    const unitPrice =
      Number.isFinite(priceRaw) && priceRaw > 0
        ? Math.round(priceRaw * 10000) / 10000
        : null;
    const amount =
      quantity !== null && unitPrice !== null
        ? round2(quantity * unitPrice)
        : parseMoney(raw?.amount, 0);
    if (amount <= 0) continue;
    const rateRaw = Number(raw?.tax_rate);
    const taxRate = Number.isFinite(rateRaw)
      ? Math.min(Math.max(rateRaw, 0), 100)
      : 15;
    const includesTax = !!raw?.amount_includes_tax;
    const accountId =
      raw?.account_id === undefined || raw?.account_id === null || raw?.account_id === ""
        ? null
        : Number(raw.account_id);
    const subtotal = includesTax ? amount / (1 + taxRate / 100) : amount;
    const tax = includesTax ? amount - subtotal : (amount * taxRate) / 100;
    items.push({
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
    });
  }
  return items;
}

async function replaceInvoiceItems(invoiceId, items) {
  await sql`
    DELETE FROM accounting_purchase_invoice_items
    WHERE invoice_id = ${invoiceId}
  `;
  for (const item of items) {
    await sql`
      INSERT INTO accounting_purchase_invoice_items (
        invoice_id, position, description, account_id,
        quantity, unit_price,
        amount, tax_rate, amount_includes_tax,
        line_subtotal, line_tax, line_total
      )
      VALUES (
        ${invoiceId}, ${item.position}, ${item.description}, ${item.accountId},
        ${item.quantity}, ${item.unitPrice},
        ${item.amount}, ${item.taxRate}, ${item.includesTax},
        ${item.subtotal}, ${item.tax}, ${item.total}
      )
    `;
  }
}

// When lines are present they are the source of truth for the header
// money columns + the header account (first line's account keeps the
// account filter/report working). An invoice-level discount applies
// to the PRE-TAX sum: the taxable base shrinks by the discount and
// the tax shrinks proportionally — line prices stay as printed.
function applyItemsToPayload(payload, items) {
  if (!items || items.length === 0) return payload;
  const rawSubtotal = round2(
    items.reduce((sum, item) => sum + item.subtotal, 0),
  );
  const rawTax = round2(items.reduce((sum, item) => sum + item.tax, 0));
  const discount = Math.min(
    Math.max(payload.discountAmount || 0, 0),
    rawSubtotal,
  );
  const factor = rawSubtotal > 0 ? (rawSubtotal - discount) / rawSubtotal : 1;
  const subtotal = round2(rawSubtotal - discount);
  const tax = round2(rawTax * factor);
  return {
    ...payload,
    discountAmount: round2(discount),
    subtotalAmount: subtotal,
    taxAmount: tax,
    totalAmount: round2(subtotal + tax),
    expenseAccountId:
      items.find((item) => item.accountId)?.accountId ??
      payload.expenseAccountId,
  };
}

async function attachItems(rows) {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return rows;
  try {
    const items = await sql`
      SELECT id, invoice_id, position, description, account_id,
             quantity, unit_price,
             amount, tax_rate, amount_includes_tax,
             line_subtotal, line_tax, line_total
      FROM accounting_purchase_invoice_items
      WHERE invoice_id = ANY(${ids})
      ORDER BY invoice_id, position
    `;
    const byInvoice = new Map();
    for (const item of items) {
      const key = Number(item.invoice_id);
      if (!byInvoice.has(key)) byInvoice.set(key, []);
      byInvoice.get(key).push(item);
    }
    return rows.map((row) => ({
      ...row,
      items: byInvoice.get(Number(row.id)) || [],
    }));
  } catch (error) {
    console.error("attach invoice items failed", error);
    return rows.map((row) => ({ ...row, items: [] }));
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
  return null;
}

function selectInvoicesQuery(where, statusFilter) {
  const statusWhere = statusFilter
    ? "WHERE computed_status = $" + (where.values.length + 2)
    : "";
  return `
    WITH invoice_rows AS (
      SELECT
        inv.id,
        inv.invoice_number,
        inv.contact_id,
        COALESCE(NULLIF(inv.supplier_name, ''), c.name) AS supplier_name,
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
        GREATEST(inv.total_amount - inv.paid_amount, 0) AS balance_due,
        inv.workflow_status,
        CASE
          WHEN inv.is_active = FALSE THEN 'inactive'
          WHEN inv.total_amount > 0 AND inv.paid_amount >= inv.total_amount THEN 'paid'
          WHEN inv.due_date IS NOT NULL
            AND inv.due_date < $${where.values.length + 1}::date
            AND inv.paid_amount < inv.total_amount THEN 'overdue'
          WHEN inv.paid_amount > 0 THEN 'partial_paid'
          WHEN inv.workflow_status = 'new' THEN 'new'
          ELSE 'pending_payment'
        END AS computed_status,
        inv.notes,
        inv.attachment_url,
        inv.is_active,
        inv.created_at,
        inv.updated_at,
        inv.created_by_employee_id,
        inv.created_by_employee_name
      FROM accounting_purchase_invoices inv
      LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
      LEFT JOIN accounting_accounts acc ON acc.id = inv.expense_account_id
      LEFT JOIN accounting_bank_accounts bank ON bank.id = inv.paid_bank_account_id
      ${where.sql}
    )
    SELECT *
    FROM invoice_rows
    ${statusWhere}
    ORDER BY is_active DESC, invoice_date DESC, id DESC
  `;
}

export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
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
      conditions.push(
        `(LOWER(inv.invoice_number) LIKE $${idx} OR LOWER(COALESCE(inv.supplier_name,'')) LIKE $${idx} OR LOWER(COALESCE(c.name,'')) LIKE $${idx})`,
      );
      values.push(`%${q.toLowerCase()}%`);
      idx += 1;
    }

    const where = {
      sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      values,
    };
    const today = todayRiyadh();
    const query = selectInvoicesQuery(where, status);
    const rows = await sql(query, status ? [...values, today, status] : [...values, today]);
    const withItems = await attachItems(rows);

    return Response.json({ invoices: withItems });
  } catch (error) {
    console.error("purchase invoices GET error", error);
    return Response.json(
      { error: "فشل تحميل فواتير المشتريات", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_CREATE);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const items = parseItems(body);
    let payload = parsePayload(body);
    payload = applyItemsToPayload(payload, items);
    const validationError = validatePayload(payload);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    const accountError = await validateExpenseAccount(payload.expenseAccountId);
    if (accountError) {
      return Response.json({ error: accountError }, { status: 400 });
    }

    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;

    const [created] = await sql`
      INSERT INTO accounting_purchase_invoices (
        invoice_number,
        contact_id,
        supplier_name,
        expense_account_id,
        invoice_date,
        due_date,
        currency,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        paid_amount,
        paid_bank_account_id,
        payment_receipt_url,
        workflow_status,
        notes,
        attachment_url,
        created_by_employee_id,
        created_by_employee_name
      )
      VALUES (
        ${payload.invoiceNumber},
        ${payload.contactId},
        ${payload.supplierName},
        ${payload.expenseAccountId},
        ${payload.invoiceDate},
        ${payload.dueDate},
        ${payload.currency},
        ${payload.subtotalAmount},
        ${payload.discountAmount},
        ${payload.taxAmount},
        ${payload.totalAmount},
        ${payload.paidAmount},
        ${payload.paidBankAccountId},
        ${payload.paymentReceiptUrl},
        ${payload.workflowStatus},
        ${payload.notes},
        ${payload.attachmentUrl},
        ${createdById},
        ${createdByName}
      )
      RETURNING *
    `;

    if (items && items.length > 0) {
      await replaceInvoiceItems(created.id, items);
    }

    return Response.json({ ok: true, invoice: created }, { status: 201 });
  } catch (error) {
    console.error("purchase invoices POST error", error);
    return Response.json(
      { error: "فشل إضافة فاتورة المشتريات", details: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const id = body.id ? Number(body.id) : null;
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "معرف الفاتورة غير صحيح" }, { status: 400 });
    }

    const items = parseItems(body);
    let payload = parsePayload(body);
    payload = applyItemsToPayload(payload, items);
    const validationError = validatePayload(payload);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    const accountError = await validateExpenseAccount(payload.expenseAccountId);
    if (accountError) {
      return Response.json({ error: accountError }, { status: 400 });
    }

    const [updated] = await sql`
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
        workflow_status = ${payload.workflowStatus},
        notes = ${payload.notes},
        attachment_url = ${payload.attachmentUrl},
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) {
      return Response.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
    }

    // `items` missing from the payload (quick-payment modal) → leave
    // the stored lines untouched; an array (even empty) replaces them.
    if (items !== null) {
      await replaceInvoiceItems(id, items);
    }

    return Response.json({ ok: true, invoice: updated });
  } catch (error) {
    console.error("purchase invoices PUT error", error);
    return Response.json(
      { error: "فشل تعديل فاتورة المشتريات", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    const force = url.searchParams.get("force") === "1";
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "معرف الفاتورة غير صحيح" }, { status: 400 });
    }

    if (force) {
      const [deleted] = await sql`
        DELETE FROM accounting_purchase_invoices
        WHERE id = ${id}
        RETURNING id
      `;
      if (!deleted) {
        return Response.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
      }
      return Response.json({ ok: true, hard: true });
    }

    const [updated] = await sql`
      UPDATE accounting_purchase_invoices
      SET
        is_active = FALSE,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
      RETURNING id
    `;
    if (!updated) {
      return Response.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
    }

    return Response.json({ ok: true, hard: false });
  } catch (error) {
    console.error("purchase invoices DELETE error", error);
    return Response.json(
      { error: "فشل إيقاف فاتورة المشتريات", details: error.message },
      { status: 500 },
    );
  }
}
