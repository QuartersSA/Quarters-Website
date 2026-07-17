import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

const VALID_SCOPES = new Set(["fixed", "variable", "both"]);

// PUT /api/accounting/expense-types/:id
// body: { name?, scope? }
async function PUT(request, {
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
    const sets = [];
    const values = [];
    let idx = 1;
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return Response.json({
          error: "اسم النوع مطلوب"
        }, {
          status: 400
        });
      }
      sets.push(`name = $${idx}`);
      values.push(name);
      idx += 1;
    }
    if (body.scope !== undefined) {
      if (!VALID_SCOPES.has(body.scope)) {
        return Response.json({
          error: "نطاق غير صالح"
        }, {
          status: 400
        });
      }
      sets.push(`scope = $${idx}`);
      values.push(body.scope);
      idx += 1;
    }
    if (body.is_active !== undefined) {
      sets.push(`is_active = $${idx}`);
      values.push(!!body.is_active);
      idx += 1;
    }
    if (body.is_template !== undefined) {
      sets.push(`is_template = $${idx}`);
      values.push(!!body.is_template);
      idx += 1;
    }
    if (body.expected_amount !== undefined) {
      if (body.expected_amount === null || body.expected_amount === "") {
        sets.push(`expected_amount = NULL`);
      } else {
        const n = Number(body.expected_amount);
        if (!Number.isFinite(n) || n < 0) {
          return Response.json({
            error: "المبلغ المتوقع غير صحيح"
          }, {
            status: 400
          });
        }
        sets.push(`expected_amount = $${idx}`);
        values.push(n);
        idx += 1;
      }
    }
    if (sets.length === 0) {
      return Response.json({
        error: "لا توجد حقول للتعديل"
      }, {
        status: 400
      });
    }
    values.push(id);
    const query = `
      UPDATE accounting_expense_types
         SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, scope, is_active, expected_amount, is_template
    `;
    const [updated] = await sql(query, values);
    if (!updated) {
      return Response.json({
        error: "النوع غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      type: updated
    });
  } catch (error) {
    console.error("expense-types PUT error", error);
    if (String(error?.code) === "23505") {
      return Response.json({
        error: "هذا الاسم موجود بالفعل"
      }, {
        status: 409
      });
    }
    return Response.json({
      error: "فشل تحديث النوع",
      details: error.message
    }, {
      status: 500
    });
  }
}

// DELETE /api/accounting/expense-types/:id[?force=1]
//
// Default (no force): refuses with 409 if any accounting_expenses or
// accounting_fixed_expenses row still points at this type — the
// response includes the offending counts so the UI can ask the admin
// to confirm a cascade delete.
//
// ?force=1: cascade. Drops every referencing accounting_expenses +
// accounting_fixed_expenses row first, then the type itself. Wrapped
// in sql.transaction so the partial state can't survive a mid-op
// error.
async function DELETE(request, {
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
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    if (!force) {
      const [{
        expense_refs,
        fixed_refs
      }] = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM accounting_expenses WHERE expense_type_id = ${id}) AS expense_refs,
          (SELECT COUNT(*)::int FROM accounting_fixed_expenses WHERE expense_type_id = ${id}) AS fixed_refs
      `;
      if (expense_refs > 0 || fixed_refs > 0) {
        return Response.json({
          error: "لا يمكن حذف هذا البند لأنه مستخدم في مصروفات. أعد المحاولة مع التأكيد للحذف النهائي مع جميع المصاريف المرتبطة.",
          expense_refs,
          fixed_refs
        }, {
          status: 409
        });
      }
    }

    // sql.transaction so we never leave the type behind with its
    // referencing rows already gone (or vice versa).
    const stmts = [sql`DELETE FROM accounting_expenses WHERE expense_type_id = ${id}`, sql`DELETE FROM accounting_fixed_expenses WHERE expense_type_id = ${id}`, sql`DELETE FROM accounting_expense_types WHERE id = ${id} RETURNING id`];
    const results = await sql.transaction(stmts);
    const deletedRows = results[results.length - 1] || [];
    if (deletedRows.length === 0) {
      return Response.json({
        error: "النوع غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      force
    });
  } catch (error) {
    console.error("expense-types DELETE error", error);
    return Response.json({
      error: "فشل الحذف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, PUT };
