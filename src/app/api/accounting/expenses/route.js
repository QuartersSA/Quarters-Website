import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// GET /api/accounting/expenses?month=YYYY-MM
export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const url = new URL(request.url);
    const monthRaw = url.searchParams.get("month");

    // Always return expense types
    const types =
      await sql`SELECT * FROM accounting_expense_types ORDER BY name ASC`;

    if (!monthRaw) {
      return Response.json({ types, expenses: [] });
    }

    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({ error: "Invalid month format" }, { status: 400 });
    }

    const monthStart = `${monthRaw}-01`;

    const expenses = await sql`
      SELECT e.*, t.name AS expense_type_name
      FROM accounting_expenses e
      JOIN accounting_expense_types t ON t.id = e.expense_type_id
      WHERE e.expense_month = ${monthStart}
      ORDER BY t.name ASC, e.expense_name ASC, e.id ASC
    `;

    return Response.json({ types, expenses });
  } catch (error) {
    console.error("expenses GET error", error);
    return Response.json({ error: "فشل تحميل المصروفات" }, { status: 500 });
  }
}

// POST /api/accounting/expenses
// body: { expense_type_id, expense_name, amount, month }
export async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const typeId = body.expense_type_id ? Number(body.expense_type_id) : null;
    const expenseName = body.expense_name
      ? String(body.expense_name).trim()
      : "";
    const amount =
      body.amount !== undefined && body.amount !== null
        ? Number(body.amount)
        : null;
    const monthRaw = body.month ? String(body.month).trim() : "";

    if (!typeId) {
      return Response.json({ error: "نوع المصروف مطلوب" }, { status: 400 });
    }
    if (!expenseName) {
      return Response.json({ error: "اسم المصروف مطلوب" }, { status: 400 });
    }
    if (amount === null || amount < 0) {
      return Response.json(
        { error: "المبلغ مطلوب ويجب أن يكون أكبر من صفر" },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({ error: "الشهر مطلوب" }, { status: 400 });
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

    return Response.json({ ok: true, expense });
  } catch (error) {
    console.error("expenses POST error", error);
    return Response.json(
      { error: "فشل إضافة المصروف", details: error.message },
      { status: 500 },
    );
  }
}
