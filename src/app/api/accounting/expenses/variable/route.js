// PUT /api/accounting/expenses/variable
// body: { month: "YYYY-MM", expense_type_id, amount, mark_paid? }
//
// Upsert one variable expense row per (type, month). The "bands"
// (categories) are unified across months — only the amount changes.
// Setting amount to 0/null deletes the row for that (type, month).
//
// Returns { ok: true, expense: row|null }.

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

export async function PUT(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const monthRaw = body.month ? String(body.month).trim() : "";
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({ error: "الشهر مطلوب" }, { status: 400 });
    }
    const monthStart = `${monthRaw}-01`;

    const typeId = body.expense_type_id ? Number(body.expense_type_id) : null;
    if (!typeId) {
      return Response.json({ error: "نوع المصروف مطلوب" }, { status: 400 });
    }

    const amountRaw = body.amount;
    const amount =
      amountRaw === null || amountRaw === undefined || amountRaw === ""
        ? null
        : Number(amountRaw);

    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      return Response.json(
        { error: "المبلغ غير صحيح" },
        { status: 400 },
      );
    }

    const [type] = await sql`
      SELECT id, name FROM accounting_expense_types WHERE id = ${typeId}
    `;
    if (!type) {
      return Response.json({ error: "نوع المصروف غير موجود" }, { status: 404 });
    }

    // We pick the canonical variable row for this (type, month) — the
    // one with NO fixed_expense_id link, oldest first. Multiple rows
    // are tolerated from legacy data but new writes always update the
    // canonical row.
    const [existing] = await sql`
      SELECT id FROM accounting_expenses
      WHERE expense_type_id = ${typeId}
        AND expense_month = ${monthStart}
        AND fixed_expense_id IS NULL
      ORDER BY id ASC
      LIMIT 1
    `;

    // amount=null or 0 → remove the row (treated as "not entered").
    if (amount === null || amount === 0) {
      if (existing) {
        await sql`DELETE FROM accounting_expenses WHERE id = ${existing.id}`;
      }
      return Response.json({ ok: true, expense: null });
    }

    const markPaid = !!body.mark_paid;
    const userId = auth.user?.id ? Number(auth.user.id) : null;
    const userName = auth.user?.name ? String(auth.user.name) : null;

    if (existing) {
      const [updated] = await sql`
        UPDATE accounting_expenses
           SET amount = ${amount},
               expense_name = ${type.name},
               is_confirmed = ${markPaid || false},
               confirmed_amount = ${markPaid ? amount : null},
               confirmed_at = ${markPaid ? new Date().toISOString() : null},
               confirmed_by_employee_id = ${markPaid ? userId : null},
               confirmed_by_employee_name = ${markPaid ? userName : null},
               updated_at = CURRENT_TIMESTAMP
         WHERE id = ${existing.id}
         RETURNING *
      `;
      return Response.json({ ok: true, expense: updated });
    }

    const [created] = await sql`
      INSERT INTO accounting_expenses (
        expense_type_id, expense_month, expense_name, amount,
        is_confirmed, confirmed_amount, confirmed_at,
        created_by_employee_id, created_by_employee_name,
        confirmed_by_employee_id, confirmed_by_employee_name
      )
      VALUES (
        ${typeId}, ${monthStart}, ${type.name}, ${amount},
        ${markPaid || false},
        ${markPaid ? amount : null},
        ${markPaid ? new Date().toISOString() : null},
        ${userId}, ${userName},
        ${markPaid ? userId : null}, ${markPaid ? userName : null}
      )
      RETURNING *
    `;

    return Response.json({ ok: true, expense: created });
  } catch (error) {
    console.error("expenses variable PUT error", error);
    return Response.json(
      { error: "فشل حفظ المصروف", details: error.message },
      { status: 500 },
    );
  }
}
