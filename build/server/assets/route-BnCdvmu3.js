import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/accounting/expenses?month=YYYY-MM
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
    const url = new URL(request.url);
    const monthRaw = url.searchParams.get("month");

    // Always return expense types. Only `id` and `name` are consumed by
    // the form selectors and the cafe-preset matcher — fetching the
    // full row was wasted bytes over the wire.
    const types = await sql`SELECT id, name FROM accounting_expense_types ORDER BY name ASC`;
    if (!monthRaw) {
      return Response.json({
        types,
        expenses: []
      });
    }
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({
        error: "Invalid month format"
      }, {
        status: 400
      });
    }
    const monthStart = `${monthRaw}-01`;
    const expenses = await sql`
      SELECT e.*, t.name AS expense_type_name
      FROM accounting_expenses e
      JOIN accounting_expense_types t ON t.id = e.expense_type_id
      WHERE e.expense_month = ${monthStart}
      ORDER BY t.name ASC, e.expense_name ASC, e.id ASC
    `;

    // Active fixed-expense templates that have NOT been instantiated yet for this month.
    //
    // Frequency gating: monthly → every month, semi_annual → every 6th
    // month from start_month, annual → every 12th month from
    // start_month. Templates without a start_month default to monthly
    // applicability from the beginning of time.
    //
    // The (year*12 + month) trick converts a DATE into a monotonically
    // increasing month index so modular arithmetic works across years.
    let pendingFixed = [];
    try {
      pendingFixed = await sql`
        SELECT f.id, f.expense_type_id, f.expense_name, f.default_amount,
               f.start_month, f.frequency, t.name AS expense_type_name
        FROM accounting_fixed_expenses f
        JOIN accounting_expense_types t ON t.id = f.expense_type_id
        WHERE f.is_active = TRUE
          AND (f.start_month IS NULL OR f.start_month <= ${monthStart})
          AND (
            f.start_month IS NULL
            OR f.frequency = 'monthly'
            OR (
              f.frequency = 'semi_annual'
              AND ((
                EXTRACT(YEAR FROM ${monthStart}::date)::int * 12
                + EXTRACT(MONTH FROM ${monthStart}::date)::int
              ) - (
                EXTRACT(YEAR FROM f.start_month)::int * 12
                + EXTRACT(MONTH FROM f.start_month)::int
              )) % 6 = 0
            )
            OR (
              f.frequency = 'annual'
              AND ((
                EXTRACT(YEAR FROM ${monthStart}::date)::int * 12
                + EXTRACT(MONTH FROM ${monthStart}::date)::int
              ) - (
                EXTRACT(YEAR FROM f.start_month)::int * 12
                + EXTRACT(MONTH FROM f.start_month)::int
              )) % 12 = 0
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM accounting_expenses e
            WHERE e.fixed_expense_id = f.id
              AND e.expense_month = ${monthStart}
          )
        ORDER BY t.name ASC, f.expense_name ASC
      `;
    } catch (e) {
      // Table likely doesn't exist yet; that's fine — first request to fixed-expenses
      // GET/POST will create it.
      pendingFixed = [];
    }
    return Response.json({
      types,
      expenses,
      pending_fixed: pendingFixed
    });
  } catch (error) {
    console.error("expenses GET error", error);
    return Response.json({
      error: "فشل تحميل المصروفات"
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/expenses
// body: { expense_type_id, expense_name, amount, month }
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
    const body = await request.json().catch(() => ({}));
    const typeId = body.expense_type_id ? Number(body.expense_type_id) : null;
    const expenseName = body.expense_name ? String(body.expense_name).trim() : "";
    const amount = body.amount !== undefined && body.amount !== null ? Number(body.amount) : null;
    const monthRaw = body.month ? String(body.month).trim() : "";
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
    if (amount === null || amount < 0) {
      return Response.json({
        error: "المبلغ مطلوب ويجب أن يكون أكبر من صفر"
      }, {
        status: 400
      });
    }
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({
        error: "الشهر مطلوب"
      }, {
        status: 400
      });
    }
    const monthStart = `${monthRaw}-01`;
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const [expense] = await sql`
      INSERT INTO accounting_expenses (
        expense_type_id, expense_month, expense_name, amount,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${typeId}, ${monthStart}, ${expenseName}, ${amount},
        ${createdById}, ${createdByName}
      )
      RETURNING *
    `;
    return Response.json({
      ok: true,
      expense
    });
  } catch (error) {
    console.error("expenses POST error", error);
    return Response.json({
      error: "فشل إضافة المصروف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
