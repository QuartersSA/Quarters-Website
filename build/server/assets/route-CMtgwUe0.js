import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Variable-expense templates — the rows the admin sees in the
// VariableGrid. Each template has its own name + an FK to an
// existing expense_type (the catalog category). Multiple templates
// can share the same category.
//
// accounting_expenses rows link back via the new
// `variable_template_id` column so each monthly amount is tied to a
// specific template instead of a bare type.

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_variable_templates (
      id SERIAL PRIMARY KEY,
      expense_type_id INTEGER NOT NULL REFERENCES accounting_expense_types(id),
      name TEXT NOT NULL,
      expected_amount NUMERIC(12, 2),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  // accounting_expenses link back to the originating template.
  await sql`
    ALTER TABLE accounting_expenses
    ADD COLUMN IF NOT EXISTS variable_template_id INTEGER
    REFERENCES accounting_variable_templates(id) ON DELETE SET NULL
  `;
}
const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting"
};

// GET /api/accounting/variable-templates
//   ?includeInactive=1   include deactivated templates
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
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";

    // Hide templates whose parent category was deactivated. Past
    // months' accounting_expenses rows linked to the template are
    // untouched (the FK is ON DELETE SET NULL only on hard delete;
    // soft-deactivating the category doesn't cascade).
    const rows = includeInactive ? await sql`
          SELECT v.*, t.name AS expense_type_name, t.is_active AS type_is_active
          FROM accounting_variable_templates v
          JOIN accounting_expense_types t ON t.id = v.expense_type_id
          ORDER BY v.is_active DESC, t.name ASC, v.name ASC
        ` : await sql`
          SELECT v.*, t.name AS expense_type_name, t.is_active AS type_is_active
          FROM accounting_variable_templates v
          JOIN accounting_expense_types t ON t.id = v.expense_type_id
          WHERE v.is_active = TRUE
            AND t.is_active = TRUE
          ORDER BY t.name ASC, v.name ASC
        `;
    return Response.json({
      templates: rows
    });
  } catch (error) {
    console.error("variable-templates GET error", error);
    return Response.json({
      error: "فشل تحميل قوالب المصروفات المتغيرة",
      details: error.message
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/variable-templates
// body: { name, expense_type_id, expected_amount? }
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
    const name = body.name ? String(body.name).trim() : "";
    const typeId = body.expense_type_id ? Number(body.expense_type_id) : null;
    const expectedRaw = body.expected_amount === null || body.expected_amount === undefined || body.expected_amount === "" ? null : Number(body.expected_amount);
    const expectedAmount = expectedRaw !== null && Number.isFinite(expectedRaw) && expectedRaw >= 0 ? expectedRaw : null;
    if (!name) {
      return Response.json({
        error: "اسم البند مطلوب"
      }, {
        status: 400
      });
    }
    if (!Number.isFinite(typeId) || typeId <= 0) {
      return Response.json({
        error: "التصنيف مطلوب"
      }, {
        status: 400
      });
    }
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const [created] = await sql`
      INSERT INTO accounting_variable_templates (
        expense_type_id, name, expected_amount,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${typeId}, ${name}, ${expectedAmount},
        ${createdById}, ${createdByName}
      )
      RETURNING *
    `;
    return Response.json({
      ok: true,
      template: created
    });
  } catch (error) {
    console.error("variable-templates POST error", error);
    return Response.json({
      error: "فشل إضافة القالب",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
