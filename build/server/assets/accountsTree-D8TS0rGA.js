import { s as sql } from './sql-BfhTxwII.js';

// code, name, name_en, type, parentCode|null, postable
const SEED = [["1", "الأصول", "Assets", "asset", null, false], ["11", "الأصول المتداولة", "Current Assets", "asset", "1", false], ["1101", "النقدية بالصندوق", "Cash on Hand", "asset", "11", true], ["1102", "البنوك", "Banks", "asset", "11", false], ["1103", "المخزون", "Inventory", "asset", "11", true], ["1104", "ضريبة القيمة المضافة القابلة للخصم", "VAT Receivable", "asset", "11", true], ["1105", "دفعات مقدمة للموردين", "Supplier Advances", "asset", "11", true], ["2", "الالتزامات", "Liabilities", "liability", null, false], ["21", "الالتزامات المتداولة", "Current Liabilities", "liability", "2", false], ["2101", "الموردون — ذمم دائنة", "Accounts Payable", "liability", "21", true], ["2102", "ضريبة القيمة المضافة المستحقة", "VAT Payable", "liability", "21", true], ["2103", "مصروفات مستحقة", "Accrued Expenses", "liability", "21", true], ["3", "حقوق الملكية", "Equity", "equity", null, false], ["3101", "رأس المال", "Capital", "equity", "3", true], ["3102", "الأرباح المبقاة", "Retained Earnings", "equity", "3", true], ["4", "الإيرادات", "Revenue", "revenue", null, false], ["4101", "إيرادات المبيعات", "Sales Revenue", "revenue", "4", true], ["4102", "إيرادات أخرى", "Other Revenue", "revenue", "4", true], ["5", "المصروفات", "Expenses", "expense", null, false], ["51", "المشتريات", "Purchases", "expense", "5", false], ["52", "مصروفات تشغيلية", "Operating Expenses", "expense", "5", false], ["5201", "رواتب وأجور", "Salaries & Wages", "expense", "52", true], ["5202", "إيجارات", "Rent", "expense", "52", true], ["5203", "كهرباء وماء ومرافق", "Utilities", "expense", "52", true], ["5204", "صيانة", "Maintenance", "expense", "52", true], ["5205", "تسويق وإعلان", "Marketing", "expense", "52", true], ["5299", "مصروفات أخرى", "Other Expenses", "expense", "52", true]];
async function ensureAccountsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_accounts (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT,
      account_type TEXT NOT NULL,
      parent_id INTEGER REFERENCES accounting_accounts(id) ON DELETE SET NULL,
      is_postable BOOLEAN NOT NULL DEFAULT TRUE,
      is_system BOOLEAN NOT NULL DEFAULT FALSE,
      source_category_id INTEGER,
      source_bank_account_id INTEGER,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_code_active
      ON accounting_accounts (code)
      WHERE is_active
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_accounting_accounts_parent
      ON accounting_accounts (parent_id)
  `;

  // Seed the skeleton once (empty table only). Sequential because
  // children need their parent's id.
  const [{
    count
  }] = await sql`
    SELECT COUNT(*)::int AS count FROM accounting_accounts
  `;
  if (Number(count) === 0) {
    const idByCode = new Map();
    for (const [code, name, nameEn, type, parentCode, postable] of SEED) {
      const parentId = parentCode ? idByCode.get(parentCode) || null : null;
      const [row] = await sql`
        INSERT INTO accounting_accounts (
          code, name, name_en, account_type, parent_id, is_postable, is_system
        )
        VALUES (
          ${code}, ${name}, ${nameEn}, ${type}, ${parentId}, ${postable}, TRUE
        )
        RETURNING id
      `;
      idByCode.set(code, row.id);
    }
  }

  // Migrate purchase item-categories into expense accounts under
  // "51 المشتريات". Idempotent: source_category_id marks imported rows,
  // and the generated code is derived from the category id so re-runs
  // insert nothing. Wrapped so a missing item_categories table can
  // never break the tree.
  try {
    await sql`
      INSERT INTO accounting_accounts (
        code, name, name_en, account_type, parent_id,
        is_postable, is_system, source_category_id
      )
      SELECT
        '51' || LPAD(ic.id::text, 2, '0'),
        ic.name,
        ic.name_en,
        'expense',
        p.id,
        TRUE,
        FALSE,
        ic.id
      FROM item_categories ic
      CROSS JOIN (
        SELECT id FROM accounting_accounts
        WHERE code = '51' AND is_system AND is_active
        LIMIT 1
      ) p
      WHERE NOT EXISTS (
        SELECT 1 FROM accounting_accounts a
        WHERE a.source_category_id = ic.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM accounting_accounts a2
        WHERE a2.code = '51' || LPAD(ic.id::text, 2, '0') AND a2.is_active
      )
    `;
  } catch (error) {
    console.error("accounts tree: category migration skipped:", error?.message);
  }
}

// Next free child code under a parent: parentCode + 2-digit sequence
// (overflows naturally to 3 digits after 99). Derived from existing
// sibling codes so gaps left by deactivated accounts aren't reused
// while an active twin exists.
async function nextChildCode(parentId, parentCode) {
  const rows = await sql`
    SELECT code FROM accounting_accounts
    WHERE parent_id = ${parentId}
  `;
  let maxSeq = 0;
  const prefix = String(parentCode);
  for (const row of rows) {
    const code = String(row.code || "");
    if (!code.startsWith(prefix)) continue;
    const suffix = Number(code.slice(prefix.length));
    if (Number.isInteger(suffix) && suffix > maxSeq) maxSeq = suffix;
  }
  const next = maxSeq + 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
}

export { ensureAccountsSchema as e, nextChildCode as n };
