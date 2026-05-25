import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// PUT /api/accounting/expenses/variable
// body: { month: "YYYY-MM", variable_template_id, amount, mark_paid? }
//
// Upserts one accounting_expenses row per (variable_template_id,
// month). Each row in the variable grid is a template, not a bare
// category, so the uniqueness key is the template id.
//
// Setting amount to 0/null deletes the row for that (template, month).
// Returns { ok: true, expense: row|null }.

async function PUT(request) {
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
        error: "الشهر مطلوب"
      }, {
        status: 400
      });
    }
    const monthStart = `${monthRaw}-01`;
    const templateId = body.variable_template_id ? Number(body.variable_template_id) : null;
    if (!Number.isFinite(templateId) || templateId <= 0) {
      return Response.json({
        error: "القالب المتغيّر مطلوب"
      }, {
        status: 400
      });
    }
    const amountRaw = body.amount;
    const amount = amountRaw === null || amountRaw === undefined || amountRaw === "" ? null : Number(amountRaw);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      return Response.json({
        error: "المبلغ غير صحيح"
      }, {
        status: 400
      });
    }

    // Resolve template → category for the row's denormalized fields.
    const [template] = await sql`
      SELECT v.id, v.expense_type_id, v.name AS template_name,
             t.name AS type_name
      FROM accounting_variable_templates v
      JOIN accounting_expense_types t ON t.id = v.expense_type_id
      WHERE v.id = ${templateId}
      LIMIT 1
    `;
    if (!template) {
      return Response.json({
        error: "القالب غير موجود"
      }, {
        status: 404
      });
    }
    const [existing] = await sql`
      SELECT id FROM accounting_expenses
      WHERE variable_template_id = ${templateId}
        AND expense_month = ${monthStart}
      ORDER BY id ASC
      LIMIT 1
    `;

    // amount=null or 0 → remove the row (treated as "not entered").
    if (amount === null || amount === 0) {
      if (existing) {
        await sql`DELETE FROM accounting_expenses WHERE id = ${existing.id}`;
      }
      return Response.json({
        ok: true,
        expense: null
      });
    }
    const markPaid = !!body.mark_paid;
    const userId = auth.user?.id ? Number(auth.user.id) : null;
    const userName = auth.user?.name ? String(auth.user.name) : null;
    const expenseName = template.template_name || template.type_name;
    if (existing) {
      const [updated] = await sql`
        UPDATE accounting_expenses
           SET amount = ${amount},
               expense_type_id = ${template.expense_type_id},
               expense_name = ${expenseName},
               variable_template_id = ${templateId},
               is_confirmed = ${markPaid || false},
               confirmed_amount = ${markPaid ? amount : null},
               confirmed_at = ${markPaid ? new Date().toISOString() : null},
               confirmed_by_employee_id = ${markPaid ? userId : null},
               confirmed_by_employee_name = ${markPaid ? userName : null},
               updated_at = CURRENT_TIMESTAMP
         WHERE id = ${existing.id}
         RETURNING *
      `;
      return Response.json({
        ok: true,
        expense: updated
      });
    }
    const [created] = await sql`
      INSERT INTO accounting_expenses (
        expense_type_id, expense_month, expense_name, amount,
        variable_template_id,
        is_confirmed, confirmed_amount, confirmed_at,
        created_by_employee_id, created_by_employee_name,
        confirmed_by_employee_id, confirmed_by_employee_name
      )
      VALUES (
        ${template.expense_type_id}, ${monthStart}, ${expenseName}, ${amount},
        ${templateId},
        ${markPaid || false},
        ${markPaid ? amount : null},
        ${markPaid ? new Date().toISOString() : null},
        ${userId}, ${userName},
        ${markPaid ? userId : null}, ${markPaid ? userName : null}
      )
      RETURNING *
    `;
    return Response.json({
      ok: true,
      expense: created
    });
  } catch (error) {
    console.error("expenses variable PUT error", error);
    return Response.json({
      error: "فشل حفظ المصروف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { PUT };
