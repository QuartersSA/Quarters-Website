import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// PUT    /api/accounting/variable-templates/:id
//   body: { name?, expense_type_id?, expected_amount?, is_active? }
// DELETE /api/accounting/variable-templates/:id
//   Soft-delete via is_active=false. The accounting_expenses rows
//   that link to it stay intact (FK ON DELETE SET NULL only fires
//   on hard delete).

const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting"
};
async function PUT(request, {
  params
}) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
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
      const v = String(body.name).trim();
      if (!v) {
        return Response.json({
          error: "اسم البند مطلوب"
        }, {
          status: 400
        });
      }
      sets.push(`name = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.expense_type_id !== undefined) {
      const v = Number(body.expense_type_id);
      if (!Number.isFinite(v) || v <= 0) {
        return Response.json({
          error: "التصنيف غير صالح"
        }, {
          status: 400
        });
      }
      sets.push(`expense_type_id = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.expected_amount !== undefined) {
      if (body.expected_amount === null || body.expected_amount === "") {
        sets.push(`expected_amount = NULL`);
      } else {
        const v = Number(body.expected_amount);
        if (!Number.isFinite(v) || v < 0) {
          return Response.json({
            error: "المبلغ المتوقع غير صحيح"
          }, {
            status: 400
          });
        }
        sets.push(`expected_amount = $${idx}`);
        values.push(v);
        idx += 1;
      }
    }
    if (body.is_active !== undefined) {
      sets.push(`is_active = $${idx}`);
      values.push(!!body.is_active);
      idx += 1;
    }
    if (sets.length === 0) {
      return Response.json({
        error: "لا توجد حقول للتعديل"
      }, {
        status: 400
      });
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const query = `
      UPDATE accounting_variable_templates
         SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING *
    `;
    const [updated] = await sql(query, values);
    if (!updated) {
      return Response.json({
        error: "القالب غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      template: updated
    });
  } catch (error) {
    console.error("variable-templates PUT error", error);
    return Response.json({
      error: "فشل التعديل",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request, {
  params
}) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
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
    if (force) {
      const stmts = [sql`DELETE FROM accounting_expenses WHERE variable_template_id = ${id}`, sql`DELETE FROM accounting_variable_templates WHERE id = ${id} RETURNING id`];
      const results = await sql.transaction(stmts);
      const deletedRows = results[results.length - 1] || [];
      if (deletedRows.length === 0) {
        return Response.json({
          error: "القالب غير موجود"
        }, {
          status: 404
        });
      }
      return Response.json({
        ok: true,
        hard: true
      });
    }
    const [updated] = await sql`
      UPDATE accounting_variable_templates
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = ${id}
       RETURNING *
    `;
    if (!updated) {
      return Response.json({
        error: "القالب غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      template: updated
    });
  } catch (error) {
    console.error("variable-templates DELETE error", error);
    return Response.json({
      error: "فشل الحذف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, PUT };
