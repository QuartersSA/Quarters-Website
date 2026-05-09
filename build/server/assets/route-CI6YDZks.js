import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import '@neondatabase/serverless';
import 'crypto';

// POST /api/accounting/fixed-expenses/:id/confirm
// Materializes a fixed-expense template into a real accounting_expenses row
// for the given month, optionally with a custom confirmed amount and note.
//
// body: { month: "YYYY-MM", confirmed_amount?: number, confirmed_note?: string }
//
// Behavior:
//   - If a row for (fixed_expense_id, month) already exists, it is updated to
//     mark it confirmed (idempotent).
//   - Otherwise a new accounting_expenses row is inserted with is_confirmed=true.
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
    const fixedId = Number(params.id);
    if (!fixedId) {
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
        error: "صيغة الشهر غير صحيحة (YYYY-MM)"
      }, {
        status: 400
      });
    }
    const monthStart = `${monthRaw}-01`;

    // Load the template
    const [tpl] = await sql`
      SELECT * FROM accounting_fixed_expenses WHERE id = ${fixedId}
    `;
    if (!tpl) {
      return Response.json({
        error: "المصروف الثابت غير موجود"
      }, {
        status: 404
      });
    }
    if (!tpl.is_active) {
      return Response.json({
        error: "هذا المصروف الثابت غير نشط"
      }, {
        status: 400
      });
    }

    // Confirmed amount: use override if provided, else default_amount
    const confirmedAmount = body.confirmed_amount !== undefined && body.confirmed_amount !== null && body.confirmed_amount !== "" ? Number(body.confirmed_amount) : Number(tpl.default_amount || 0);
    if (!Number.isFinite(confirmedAmount) || confirmedAmount < 0) {
      return Response.json({
        error: "المبلغ المؤكد غير صالح"
      }, {
        status: 400
      });
    }
    const confirmedNote = body.confirmed_note ? String(body.confirmed_note).trim() || null : null;
    const userId = auth.user?.id ? Number(auth.user.id) : null;
    const userName = auth.user?.name ? String(auth.user.name) : null;
    const nowIso = new Date().toISOString();

    // Check if row already exists for this template + month
    const [existing] = await sql`
      SELECT id FROM accounting_expenses
      WHERE fixed_expense_id = ${fixedId}
        AND expense_month = ${monthStart}
      LIMIT 1
    `;
    let resultRow;
    if (existing) {
      const [updated] = await sql`
        UPDATE accounting_expenses
        SET is_confirmed = TRUE,
            confirmed_amount = ${confirmedAmount},
            confirmed_note = ${confirmedNote},
            confirmed_at = ${nowIso},
            confirmed_by_employee_id = ${userId},
            confirmed_by_employee_name = ${userName},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing.id}
        RETURNING *
      `;
      resultRow = updated;
    } else {
      const [inserted] = await sql`
        INSERT INTO accounting_expenses (
          expense_type_id, expense_month, expense_name, amount,
          fixed_expense_id,
          is_confirmed, confirmed_amount, confirmed_note,
          confirmed_at, confirmed_by_employee_id, confirmed_by_employee_name,
          created_by_employee_id, created_by_employee_name
        )
        VALUES (
          ${tpl.expense_type_id}, ${monthStart}, ${tpl.expense_name},
          ${tpl.default_amount},
          ${fixedId},
          TRUE, ${confirmedAmount}, ${confirmedNote},
          ${nowIso}, ${userId}, ${userName},
          ${userId}, ${userName}
        )
        RETURNING *
      `;
      resultRow = inserted;
    }
    return Response.json({
      ok: true,
      expense: resultRow
    });
  } catch (error) {
    console.error("fixed-expense confirm error", error);
    return Response.json({
      error: "فشل تأكيد دفع المصروف الثابت",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
