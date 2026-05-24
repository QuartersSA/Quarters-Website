import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Idempotent schema bootstrap. Runs on every request; cheap thanks to IF NOT EXISTS.
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_fixed_expenses (
      id SERIAL PRIMARY KEY,
      expense_type_id INTEGER NOT NULL REFERENCES accounting_expense_types(id),
      expense_name TEXT NOT NULL,
      default_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      start_month DATE,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;

  // Link confirmed expense rows back to the fixed-expense template they came from
  await sql`
    ALTER TABLE accounting_expenses
    ADD COLUMN IF NOT EXISTS fixed_expense_id INTEGER
    REFERENCES accounting_fixed_expenses(id) ON DELETE SET NULL
  `;

  // frequency column for legacy rows that predate it. Existing rows
  // default to 'monthly' (the implicit behavior before this field).
  await sql`
    ALTER TABLE accounting_fixed_expenses
    ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'monthly'
  `;
  // Drop and re-add the constraint so legacy versions (without
  // 'quarterly') don't block writes after we widen the enum.
  try {
    await sql`
      ALTER TABLE accounting_fixed_expenses
      DROP CONSTRAINT IF EXISTS accounting_fixed_expenses_freq_chk
    `;
    await sql`
      ALTER TABLE accounting_fixed_expenses
      ADD CONSTRAINT accounting_fixed_expenses_freq_chk
      CHECK (frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual'))
    `;
  } catch (e) {
    // constraint juggling failed — most likely already in the target
    // state; harmless on next request.
  }
}
const VALID_FREQ = new Set(["monthly", "quarterly", "semi_annual", "annual"]);

// GET /api/accounting/fixed-expenses
// Returns active fixed expense templates (joined with type name)
async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
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
    const rows = includeInactive ? await sql`
          SELECT f.*, t.name AS expense_type_name
          FROM accounting_fixed_expenses f
          JOIN accounting_expense_types t ON t.id = f.expense_type_id
          ORDER BY f.is_active DESC, t.name ASC, f.expense_name ASC
        ` : await sql`
          SELECT f.*, t.name AS expense_type_name
          FROM accounting_fixed_expenses f
          JOIN accounting_expense_types t ON t.id = f.expense_type_id
          WHERE f.is_active = TRUE
          ORDER BY t.name ASC, f.expense_name ASC
        `;
    return Response.json({
      fixed_expenses: rows
    });
  } catch (error) {
    console.error("fixed-expenses GET error", error);
    return Response.json({
      error: "فشل تحميل المصروفات الثابتة",
      details: error.message
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/fixed-expenses
// body: { expense_type_id, expense_name, default_amount, start_month? }
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
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
    const typeId = body.expense_type_id ? Number(body.expense_type_id) : null;
    const expenseName = body.expense_name ? String(body.expense_name).trim() : "";
    const defaultAmount = body.default_amount !== undefined && body.default_amount !== null ? Number(body.default_amount) : null;
    const startMonthRaw = body.start_month ? String(body.start_month).trim() : "";
    const frequency = body.frequency && VALID_FREQ.has(body.frequency) ? body.frequency : "monthly";
    if (!typeId) {
      return Response.json({
        error: "نوع المصروف مطلوب"
      }, {
        status: 400
      });
    }
    if (!expenseName) {
      return Response.json({
        error: "اسم المصروف مطلوب"
      }, {
        status: 400
      });
    }
    if (defaultAmount === null || defaultAmount < 0) {
      return Response.json({
        error: "المبلغ الافتراضي مطلوب ويجب أن يكون أكبر من صفر"
      }, {
        status: 400
      });
    }
    let startMonth = null;
    if (startMonthRaw) {
      if (!/^\d{4}-\d{2}$/.test(startMonthRaw)) {
        return Response.json({
          error: "صيغة شهر البداية غير صحيحة (YYYY-MM)"
        }, {
          status: 400
        });
      }
      startMonth = `${startMonthRaw}-01`;
    }
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const [created] = await sql`
      INSERT INTO accounting_fixed_expenses (
        expense_type_id, expense_name, default_amount, start_month, frequency,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${typeId}, ${expenseName}, ${defaultAmount}, ${startMonth}, ${frequency},
        ${createdById}, ${createdByName}
      )
      RETURNING *
    `;
    return Response.json({
      ok: true,
      fixed_expense: created
    });
  } catch (error) {
    console.error("fixed-expenses POST error", error);
    return Response.json({
      error: "فشل إضافة المصروف الثابت",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
