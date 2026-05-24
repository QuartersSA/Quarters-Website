import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// POST /api/accounting/fixed-expenses/:id/toggle-paid
// body: { month: "YYYY-MM", amount?: number }
//
// Idempotent toggle:
//   - No accounting_expenses row exists for (fixed_id, month) yet:
//     creates one as confirmed + paid, with the supplied amount (or
//     the template's default_amount).
//   - A row exists: deletes it (unpaid).
//
// Returns { paid: boolean, expense: row|null }.

async function POST(request, {
  params
}) {
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
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({
        error: "Invalid ID"
      }, {
        status: 400
      });
    }
    const body = await request.json().catch(() => ({}));
    const monthRaw = body.month ? String(body.month).trim() : "";
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({
        error: "الشهر مطلوب (YYYY-MM)"
      }, {
        status: 400
      });
    }
    const monthStart = `${monthRaw}-01`;
    const [template] = await sql`
      SELECT id, expense_type_id, expense_name, default_amount, frequency
      FROM accounting_fixed_expenses
      WHERE id = ${id}
    `;
    if (!template) {
      return Response.json({
        error: "القالب غير موجود"
      }, {
        status: 404
      });
    }
    const [existing] = await sql`
      SELECT id, is_confirmed, amount, confirmed_amount
      FROM accounting_expenses
      WHERE fixed_expense_id = ${id} AND expense_month = ${monthStart}
      LIMIT 1
    `;

    // Toggle off: row exists → delete (unpaid).
    if (existing) {
      await sql`DELETE FROM accounting_expenses WHERE id = ${existing.id}`;
      return Response.json({
        ok: true,
        paid: false,
        expense: null
      });
    }

    // Toggle on: create + mark paid.
    //
    // Per-month amount derives from the template's cycle:
    //   monthly      → default_amount
    //   quarterly    → default_amount / 3
    //   semi_annual  → default_amount / 6
    //   annual       → default_amount / 12
    // The admin can still pass an explicit `amount` to override the
    // derived value for a one-off month.
    const cycleMonths = template.frequency === "quarterly" ? 3 : template.frequency === "semi_annual" ? 6 : template.frequency === "annual" ? 12 : 1;
    const overrideAmount = body.amount !== undefined && body.amount !== null && body.amount !== "" ? Number(body.amount) : null;
    const derivedAmount = (Number(template.default_amount) || 0) / cycleMonths;
    const amount = overrideAmount !== null && Number.isFinite(overrideAmount) && overrideAmount >= 0 ? overrideAmount : Math.round(derivedAmount * 100) / 100;
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const [expense] = await sql`
      INSERT INTO accounting_expenses (
        expense_type_id, expense_month, expense_name, amount,
        fixed_expense_id, is_confirmed, confirmed_amount, confirmed_at,
        created_by_employee_id, created_by_employee_name,
        confirmed_by_employee_id, confirmed_by_employee_name
      )
      VALUES (
        ${template.expense_type_id}, ${monthStart}, ${template.expense_name}, ${amount},
        ${template.id}, true, ${amount}, NOW(),
        ${createdById}, ${createdByName},
        ${createdById}, ${createdByName}
      )
      RETURNING *
    `;
    return Response.json({
      ok: true,
      paid: true,
      expense
    });
  } catch (error) {
    console.error("fixed-expenses toggle-paid error", error);
    return Response.json({
      error: "فشل تحديث الحالة",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
