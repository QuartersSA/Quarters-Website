import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Employee loans / advances. The admin records a loan with a total
// amount + an installment plan (N months starting from a chosen
// month). The payroll computation pulls the per-month installment
// from this table and subtracts it from net_salary.

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_employee_loans (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      total_amount NUMERIC(12, 2) NOT NULL,
      installments_count INTEGER NOT NULL CHECK (installments_count > 0),
      start_month DATE NOT NULL,
      note TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
}
const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting"
};

// GET /api/accounting/employee-loans
//   ?employee_id=N         filter to one employee
//   ?month=YYYY-MM         only loans whose installment window covers
//                          this month (used by payroll preview)
//   ?includeInactive=1     include archived loans
//
// Each row carries a derived `monthly_amount` (total / installments)
// and a `paid_months_to_date` count via the same date math the payroll
// uses, so the UI can show "X / N شهر".
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
    const employeeIdRaw = url.searchParams.get("employee_id");
    const monthRaw = url.searchParams.get("month");
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const conditions = [];
    const values = [];
    let idx = 1;
    if (!includeInactive) {
      conditions.push("l.is_active = TRUE");
    }
    if (employeeIdRaw) {
      const eid = Number(employeeIdRaw);
      if (Number.isFinite(eid) && eid > 0) {
        conditions.push(`l.employee_id = $${idx}`);
        values.push(eid);
        idx += 1;
      }
    }
    let monthStart = null;
    if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
      monthStart = `${monthRaw}-01`;
      // Loan applies to the month if:
      //   start_month <= monthStart
      //   AND start_month + installments months > monthStart
      conditions.push(`l.start_month <= $${idx} AND (l.start_month + (l.installments_count || ' months')::interval) > $${idx}`);
      values.push(monthStart);
      idx += 1;
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT
        l.id,
        l.employee_id,
        e.name AS employee_name,
        l.total_amount,
        l.installments_count,
        -- IMPORTANT: cast to text so the DATE doesn't go through
        -- JS Date object conversion in the postgres driver. node-pg
        -- parses DATE values using the server's LOCAL timezone, then
        -- JSON.stringify converts the Date to ISO UTC. On a server in
        -- a positive timezone (e.g. Asia/Riyadh) the day shifts back
        -- by one and the client renders the previous month for any
        -- start_month picked from the loan modal. Casting to TEXT in
        -- SQL skips the Date round-trip entirely.
        TO_CHAR(l.start_month, 'YYYY-MM-DD') AS start_month,
        l.note,
        l.is_active,
        l.created_at,
        l.created_by_employee_name,
        ROUND(l.total_amount / NULLIF(l.installments_count, 0), 2) AS monthly_amount,
        -- Installments actually paid so far.
        --
        -- An installment counts as "paid" only when BOTH of these hold
        -- for the payroll run that covers it:
        --   1. The run is closed (run.is_closed = TRUE) — so the
        --      accountant has signed off on the month.
        --   2. The employee's entry is marked paid (entry.is_paid =
        --      TRUE) — so the loan deduction was actually applied.
        --
        -- We also constrain to runs inside the loan's installment
        -- window so a stale entry can't push the counter past
        -- installments_count. Before this fix the value was derived
        -- from elapsed calendar months, which falsely showed "2 / 8"
        -- mid-month even though the current month hadn't been closed.
        COALESCE((
          SELECT COUNT(*)::int
          FROM accounting_payroll_entries pe
          JOIN accounting_payroll_runs pr ON pr.id = pe.run_id
          WHERE pe.employee_id = l.employee_id
            AND pr.is_closed = TRUE
            AND pe.is_paid = TRUE
            AND pr.payroll_month >= l.start_month
            AND pr.payroll_month <
                (l.start_month + (l.installments_count || ' months')::interval)
            AND COALESCE(pe.loan_deduction, 0) > 0
        ), 0) AS paid_months_to_date
      FROM accounting_employee_loans l
      JOIN employees e ON e.id = l.employee_id
      ${whereClause}
      ORDER BY l.is_active DESC, l.created_at DESC
    `;
    const rows = await sql(query, values);
    return Response.json({
      loans: rows
    });
  } catch (error) {
    console.error("employee-loans GET error", error);
    return Response.json({
      error: "فشل تحميل السلف",
      details: error.message
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/employee-loans
// body: { employee_id, total_amount, installments_count, start_month: 'YYYY-MM', note? }
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
    const employeeId = Number(body.employee_id);
    const totalAmount = Number(body.total_amount);
    const installments = Number(body.installments_count);
    const startMonthRaw = body.start_month ? String(body.start_month).trim() : "";
    const note = body.note ? String(body.note).trim() : null;
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return Response.json({
        error: "الموظف مطلوب"
      }, {
        status: 400
      });
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return Response.json({
        error: "مبلغ القرض يجب أن يكون أكبر من صفر"
      }, {
        status: 400
      });
    }
    if (!Number.isFinite(installments) || installments <= 0) {
      return Response.json({
        error: "عدد الأقساط يجب أن يكون أكبر من صفر"
      }, {
        status: 400
      });
    }
    if (!/^\d{4}-\d{2}$/.test(startMonthRaw)) {
      return Response.json({
        error: "شهر بدء الاستقطاع مطلوب (YYYY-MM)"
      }, {
        status: 400
      });
    }
    const startMonth = `${startMonthRaw}-01`;
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;

    // Returning columns explicitly with TO_CHAR on start_month so the
    // DATE doesn't drift through the JS Date round-trip (see GET).
    const [created] = await sql`
      WITH ins AS (
        INSERT INTO accounting_employee_loans (
          employee_id, total_amount, installments_count, start_month, note,
          created_by_employee_id, created_by_employee_name
        )
        VALUES (
          ${employeeId}, ${totalAmount}, ${installments}, ${startMonth}, ${note},
          ${createdById}, ${createdByName}
        )
        RETURNING *
      )
      SELECT
        id, employee_id, total_amount, installments_count,
        TO_CHAR(start_month, 'YYYY-MM-DD') AS start_month,
        note, is_active, created_at, updated_at,
        created_by_employee_id, created_by_employee_name
      FROM ins
    `;
    return Response.json({
      ok: true,
      loan: created
    });
  } catch (error) {
    console.error("employee-loans POST error", error);
    return Response.json({
      error: "فشل إضافة القرض",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
