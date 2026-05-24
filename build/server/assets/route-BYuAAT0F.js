import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

const PAYROLL_CATEGORY_NAME = "رواتب";
const PAYROLL_TEMPLATE_NAME = "رواتب الموظفين";

/**
 * Sync the closed payroll month to the fixed-expenses tab.
 *
 *  - Idempotent: re-running on the same month updates in place.
 *  - Creates the "رواتب" expense category if missing (scope='fixed').
 *  - Creates the "رواتب الموظفين" fixed template if missing
 *    (frequency='monthly', start_month = the closed month).
 *  - Updates the template's default_amount to the closed-month total
 *    so future months default to the same number.
 *  - Replaces any existing accounting_expenses row for (template,
 *    month) with a confirmed row carrying the closed-month total.
 */
async function syncPayrollToFixedExpense({
  monthStart,
  totalNetPay,
  userId,
  userName
}) {
  // 1) Category — find or create.
  let [category] = await sql`
    SELECT id FROM accounting_expense_types
    WHERE name = ${PAYROLL_CATEGORY_NAME}
    LIMIT 1
  `;
  if (!category) {
    [category] = await sql`
      INSERT INTO accounting_expense_types (name, scope, is_active)
      VALUES (${PAYROLL_CATEGORY_NAME}, 'fixed', TRUE)
      RETURNING id
    `;
  }

  // 2) Template — find or create. Re-activate if a previous run had
  //    soft-deleted it.
  let [template] = await sql`
    SELECT id FROM accounting_fixed_expenses
    WHERE expense_name = ${PAYROLL_TEMPLATE_NAME}
      AND expense_type_id = ${category.id}
    LIMIT 1
  `;
  if (!template) {
    [template] = await sql`
      INSERT INTO accounting_fixed_expenses (
        expense_type_id, expense_name, default_amount,
        is_active, start_month, frequency,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${category.id}, ${PAYROLL_TEMPLATE_NAME}, ${totalNetPay},
        TRUE, ${monthStart}, 'monthly',
        ${userId}, ${userName}
      )
      RETURNING id
    `;
  } else {
    await sql`
      UPDATE accounting_fixed_expenses
         SET default_amount = ${totalNetPay},
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${template.id}
    `;
  }

  // 3) Replace the accounting_expenses row for (template, month).
  await sql`
    DELETE FROM accounting_expenses
    WHERE fixed_expense_id = ${template.id}
      AND expense_month = ${monthStart}
  `;
  await sql`
    INSERT INTO accounting_expenses (
      expense_type_id, expense_month, expense_name, amount,
      fixed_expense_id, is_confirmed, confirmed_amount, confirmed_at,
      created_by_employee_id, created_by_employee_name,
      confirmed_by_employee_id, confirmed_by_employee_name
    )
    VALUES (
      ${category.id}, ${monthStart}, ${PAYROLL_TEMPLATE_NAME}, ${totalNetPay},
      ${template.id}, TRUE, ${totalNetPay}, NOW(),
      ${userId}, ${userName},
      ${userId}, ${userName}
    )
  `;
  return {
    categoryId: category.id,
    templateId: template.id,
    totalNetPay
  };
}

/**
 * On payroll-month re-open: drop the accounting_expenses row that
 * the previous close created. Leaves the template + category in
 * place so the next close re-fills cleanly.
 */
async function removePayrollFixedExpense({
  monthStart
}) {
  const [template] = await sql`
    SELECT id FROM accounting_fixed_expenses
    WHERE expense_name = ${PAYROLL_TEMPLATE_NAME}
    LIMIT 1
  `;
  if (!template) return;
  await sql`
    DELETE FROM accounting_expenses
    WHERE fixed_expense_id = ${template.id}
      AND expense_month = ${monthStart}
  `;
}

// POST /api/accounting/payroll/close
// body: { month: 'YYYY-MM' }
// Closes (or reopens) the payroll month
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
    const monthRaw = body.month ? String(body.month).trim() : "";
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({
        error: "Invalid month"
      }, {
        status: 400
      });
    }
    const [y, m] = monthRaw.split("-");
    const monthStart = `${y}-${m}-01`;
    const closedById = auth.user?.id ? Number(auth.user.id) : null;
    const closedByName = auth.user?.name ? String(auth.user.name) : null;

    // Find the run
    const [run] = await sql("SELECT * FROM accounting_payroll_runs WHERE payroll_month = $1 LIMIT 1", [monthStart]);
    if (!run) {
      return Response.json({
        error: "لا يوجد مسير لهذا الشهر"
      }, {
        status: 404
      });
    }

    // Toggle close/open
    const newIsClosed = !run.is_closed;
    const [updated] = await sql(`UPDATE accounting_payroll_runs
       SET is_closed = $1,
           closed_at = $2,
           closed_by_employee_id = $3,
           closed_by_employee_name = $4
       WHERE id = $5
       RETURNING *`, [newIsClosed, newIsClosed ? new Date().toISOString() : null, newIsClosed ? closedById : null, newIsClosed ? closedByName : null, run.id]);

    // Sync to fixed-expenses when closing; tear down on reopen. Wrapped
    // in try/catch so a sync failure never blocks the payroll-close
    // operation itself.
    let payrollSync = null;
    try {
      if (newIsClosed) {
        const [{
          total_net_pay
        }] = await sql(`SELECT COALESCE(SUM(net_pay), 0)::numeric AS total_net_pay
             FROM accounting_payroll_entries
            WHERE run_id = $1`, [run.id]);
        payrollSync = await syncPayrollToFixedExpense({
          monthStart,
          totalNetPay: Number(total_net_pay) || 0,
          userId: closedById,
          userName: closedByName
        });
      } else {
        await removePayrollFixedExpense({
          monthStart
        });
      }
    } catch (syncErr) {
      console.error("payroll close → fixed-expense sync failed", syncErr);
    }
    return Response.json({
      ok: true,
      run: updated,
      payroll_sync: payrollSync
    });
  } catch (error) {
    console.error("payroll close POST error", error);
    return Response.json({
      error: "فشل تقفيلة الشهر",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
