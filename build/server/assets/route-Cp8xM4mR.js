import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureAccountsSchema, n as nextChildCode } from './accountsTree-D8TS0rGA.js';
import '@neondatabase/serverless';
import 'crypto';

const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting"
};
const ACCOUNT_TYPES = new Set(["bank", "credit_card", "petty_cash"]);

// Mirror every bank account as an asset account under «1102 البنوك»
// in شجرة الحسابات. Best-effort: a tree hiccup must never block the
// bank account itself, so failures only log.
async function linkBankAccountToTree(bankAccount) {
  try {
    await ensureAccountsSchema();
    const [existing] = await sql`
      SELECT id FROM accounting_accounts
      WHERE source_bank_account_id = ${bankAccount.id}
    `;
    if (existing) return existing.id;
    const [parent] = await sql`
      SELECT id, code FROM accounting_accounts
      WHERE code = '1102' AND is_system AND is_active
      LIMIT 1
    `;
    if (!parent) return null;
    const code = await nextChildCode(parent.id, parent.code);
    const [created] = await sql`
      INSERT INTO accounting_accounts (
        code, name, name_en, account_type, parent_id,
        is_postable, is_system, source_bank_account_id, notes
      )
      VALUES (
        ${code}, ${bankAccount.name}, ${bankAccount.bank_name || null},
        'asset', ${parent.id}, TRUE, FALSE, ${bankAccount.id},
        'مرتبط تلقائياً بحساب بنكي'
      )
      RETURNING id
    `;
    await sql`
      UPDATE accounting_bank_accounts
      SET account_id = ${created.id}
      WHERE id = ${bankAccount.id}
    `;
    return created.id;
  } catch (error) {
    console.error("bank account tree link failed:", error?.message);
    return null;
  }
}
async function ensureSchema() {
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
  await sql`
    ALTER TABLE accounting_bank_accounts
      ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'bank',
      ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SAR',
      ADD COLUMN IF NOT EXISTS bank_name TEXT,
      ADD COLUMN IF NOT EXISTS iban TEXT,
      ADD COLUMN IF NOT EXISTS account_number TEXT,
      ADD COLUMN IF NOT EXISTS book_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS statement_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by_employee_name TEXT,
      ADD COLUMN IF NOT EXISTS account_id INTEGER
  `;
}
function parseMoney(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 100) / 100;
}
function parsePayload(body) {
  const name = body?.name ? String(body.name).trim() : "";
  const accountTypeRaw = body?.account_type ? String(body.account_type).trim() : "bank";
  const accountType = ACCOUNT_TYPES.has(accountTypeRaw) ? accountTypeRaw : "bank";
  const currency = body?.currency ? String(body.currency).trim().toUpperCase() : "SAR";
  const bankName = body?.bank_name ? String(body.bank_name).trim() : null;
  const iban = body?.iban ? String(body.iban).replace(/\s+/g, "").toUpperCase() : null;
  const accountNumber = body?.account_number ? String(body.account_number).trim() : null;
  const bookBalance = parseMoney(body?.book_balance, 0);
  const statementBalance = parseMoney(body?.statement_balance, 0);
  const notes = body?.notes ? String(body.notes).trim() : null;
  return {
    name,
    accountType,
    currency,
    bankName,
    iban,
    accountNumber,
    bookBalance,
    statementBalance,
    notes
  };
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

    // Backfill: bank accounts created before شجرة الحسابات existed get
    // their tree link on first listing. No-op once everything is linked.
    const unlinked = await sql`
      SELECT id, name, bank_name FROM accounting_bank_accounts
      WHERE account_id IS NULL AND is_active
    `;
    for (const account of unlinked) {
      await linkBankAccountToTree(account);
    }
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const q = (url.searchParams.get("q") || "").trim();
    const conditions = [];
    const values = [];
    let idx = 1;
    if (!includeInactive) {
      conditions.push("is_active = TRUE");
    }
    if (q) {
      conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(COALESCE(bank_name,'')) LIKE $${idx} OR LOWER(COALESCE(iban,'')) LIKE $${idx} OR LOWER(COALESCE(account_number,'')) LIKE $${idx})`);
      values.push(`%${q.toLowerCase()}%`);
      idx += 1;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await sql(`
        SELECT
          id,
          name,
          account_type,
          currency,
          bank_name,
          iban,
          account_number,
          book_balance,
          statement_balance,
          (book_balance - statement_balance) AS difference,
          account_id,
          notes,
          is_active,
          created_at,
          updated_at,
          created_by_employee_id,
          created_by_employee_name
        FROM accounting_bank_accounts
        ${where}
        ORDER BY is_active DESC, name ASC, id DESC
      `, values);
    return Response.json({
      accounts: rows
    });
  } catch (error) {
    console.error("bank accounts GET error", error);
    return Response.json({
      error: "فشل تحميل الحسابات البنكية",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function POST(request) {
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
    const payload = parsePayload(body);
    if (!payload.name) {
      return Response.json({
        error: "اسم الحساب مطلوب"
      }, {
        status: 400
      });
    }
    if (!payload.currency) {
      return Response.json({
        error: "العملة مطلوبة"
      }, {
        status: 400
      });
    }
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const [created] = await sql`
      INSERT INTO accounting_bank_accounts (
        name,
        account_type,
        currency,
        bank_name,
        iban,
        account_number,
        book_balance,
        statement_balance,
        notes,
        created_by_employee_id,
        created_by_employee_name
      )
      VALUES (
        ${payload.name},
        ${payload.accountType},
        ${payload.currency},
        ${payload.bankName},
        ${payload.iban},
        ${payload.accountNumber},
        ${payload.bookBalance},
        ${payload.statementBalance},
        ${payload.notes},
        ${createdById},
        ${createdByName}
      )
      RETURNING *
    `;
    await linkBankAccountToTree(created);
    return Response.json({
      ok: true,
      account: created
    }, {
      status: 201
    });
  } catch (error) {
    console.error("bank accounts POST error", error);
    return Response.json({
      error: "فشل إضافة الحساب البنكي",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
