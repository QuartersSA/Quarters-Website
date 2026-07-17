import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/accounting/expenses/last-amount?expense_type_id=N&beforeMonth=YYYY-MM
//
// Returns the most recent accounting_expenses amount for the given
// category before `beforeMonth`. Used by the variable-template form
// to prefill "إجمالي المبلغ المتوقع" with the last known number for a
// category the admin is editing.

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
    const typeId = Number(url.searchParams.get("expense_type_id"));
    const beforeMonthRaw = url.searchParams.get("beforeMonth");
    if (!Number.isFinite(typeId) || typeId <= 0) {
      return Response.json({
        error: "expense_type_id مطلوب"
      }, {
        status: 400
      });
    }
    if (!beforeMonthRaw || !/^\d{4}-\d{2}$/.test(beforeMonthRaw)) {
      return Response.json({
        error: "beforeMonth مطلوب بصيغة YYYY-MM"
      }, {
        status: 400
      });
    }
    const before = `${beforeMonthRaw}-01`;
    const [row] = await sql`
      SELECT amount, expense_month, expense_name
        FROM accounting_expenses
       WHERE expense_type_id = ${typeId}
         AND expense_month < ${before}
       ORDER BY expense_month DESC, id DESC
       LIMIT 1
    `;
    return Response.json({
      amount: row ? Number(row.amount) : null,
      expense_month: row?.expense_month || null,
      expense_name: row?.expense_name || null
    });
  } catch (error) {
    console.error("last-amount GET error", error);
    return Response.json({
      error: "فشل البحث",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
