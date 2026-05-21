import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

const VALID_SCOPES = new Set(["fixed", "variable", "both"]);

// PUT /api/accounting/expense-types/:id
// body: { name?, scope? }
export async function PUT(request, { params }) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const sets = [];
    const values = [];
    let idx = 1;

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return Response.json({ error: "اسم النوع مطلوب" }, { status: 400 });
      }
      sets.push(`name = $${idx}`);
      values.push(name);
      idx += 1;
    }
    if (body.scope !== undefined) {
      if (!VALID_SCOPES.has(body.scope)) {
        return Response.json({ error: "نطاق غير صالح" }, { status: 400 });
      }
      sets.push(`scope = $${idx}`);
      values.push(body.scope);
      idx += 1;
    }

    if (sets.length === 0) {
      return Response.json({ error: "لا توجد حقول للتعديل" }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE accounting_expense_types
         SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, scope
    `;
    const [updated] = await sql(query, values);
    if (!updated) {
      return Response.json({ error: "النوع غير موجود" }, { status: 404 });
    }
    return Response.json({ ok: true, type: updated });
  } catch (error) {
    console.error("expense-types PUT error", error);
    if (String(error?.code) === "23505") {
      return Response.json(
        { error: "هذا الاسم موجود بالفعل" },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "فشل تحديث النوع", details: error.message },
      { status: 500 },
    );
  }
}

// DELETE /api/accounting/expense-types/:id
// Refuses delete if any accounting_expenses or accounting_fixed_expenses
// still point at this type — admin must reassign / delete those first.
export async function DELETE(request, { params }) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [usedInExpenses] = await sql`
      SELECT 1 FROM accounting_expenses WHERE expense_type_id = ${id} LIMIT 1
    `;
    const [usedInFixed] = await sql`
      SELECT 1 FROM accounting_fixed_expenses WHERE expense_type_id = ${id} LIMIT 1
    `;
    if (usedInExpenses || usedInFixed) {
      return Response.json(
        {
          error:
            "لا يمكن حذف هذا النوع لأنه مستخدم في مصروفات. احذف أو انقل المصروفات أولاً.",
        },
        { status: 409 },
      );
    }

    const [deleted] = await sql`
      DELETE FROM accounting_expense_types WHERE id = ${id} RETURNING id
    `;
    if (!deleted) {
      return Response.json({ error: "النوع غير موجود" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("expense-types DELETE error", error);
    return Response.json(
      { error: "فشل الحذف", details: error.message },
      { status: 500 },
    );
  }
}
