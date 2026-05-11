import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// PATCH /api/accounting/fixed-expenses/:id
// body: { expense_type_id?, expense_name?, default_amount?, is_active?, start_month? }
async function PATCH(request, {
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
    const id = Number(params.id);
    if (!id) {
      return Response.json({
        error: "Invalid ID"
      }, {
        status: 400
      });
    }
    const body = await request.json().catch(() => ({}));
    const setClauses = [];
    const values = [];
    let paramIdx = 1;
    if (body.expense_type_id !== undefined) {
      setClauses.push(`expense_type_id = $${paramIdx++}`);
      values.push(Number(body.expense_type_id));
    }
    if (body.expense_name !== undefined) {
      const name = String(body.expense_name).trim();
      if (!name) {
        return Response.json({
          error: "اسم المصروف مطلوب"
        }, {
          status: 400
        });
      }
      setClauses.push(`expense_name = $${paramIdx++}`);
      values.push(name);
    }
    if (body.default_amount !== undefined) {
      const amt = Number(body.default_amount);
      if (!Number.isFinite(amt) || amt < 0) {
        return Response.json({
          error: "المبلغ الافتراضي يجب أن يكون أكبر أو يساوي صفر"
        }, {
          status: 400
        });
      }
      setClauses.push(`default_amount = $${paramIdx++}`);
      values.push(amt);
    }
    if (body.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIdx++}`);
      values.push(!!body.is_active);
    }
    if (body.start_month !== undefined) {
      if (body.start_month === null || body.start_month === "") {
        setClauses.push(`start_month = NULL`);
      } else {
        const raw = String(body.start_month).trim();
        if (!/^\d{4}-\d{2}$/.test(raw)) {
          return Response.json({
            error: "صيغة شهر البداية غير صحيحة (YYYY-MM)"
          }, {
            status: 400
          });
        }
        setClauses.push(`start_month = $${paramIdx++}`);
        values.push(`${raw}-01`);
      }
    }
    if (setClauses.length === 0) {
      return Response.json({
        error: "لا يوجد بيانات للتحديث"
      }, {
        status: 400
      });
    }
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const query = `UPDATE accounting_fixed_expenses SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`;
    const [updated] = await sql(query, values);
    if (!updated) {
      return Response.json({
        error: "المصروف الثابت غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      fixed_expense: updated
    });
  } catch (error) {
    console.error("fixed-expense PATCH error", error);
    return Response.json({
      error: "فشل تحديث المصروف الثابت",
      details: error.message
    }, {
      status: 500
    });
  }
}

// DELETE /api/accounting/fixed-expenses/:id
// Soft-delete via is_active=false to preserve historical links
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
    const id = Number(params.id);
    if (!id) {
      return Response.json({
        error: "Invalid ID"
      }, {
        status: 400
      });
    }
    const url = new URL(request.url);
    const hard = url.searchParams.get("hard") === "1";
    if (hard) {
      // Hard delete only allowed if no confirmed expense references it
      const [{
        refs
      }] = await sql`
        SELECT COUNT(*)::int AS refs
        FROM accounting_expenses
        WHERE fixed_expense_id = ${id}
      `;
      if (refs > 0) {
        return Response.json({
          error: "لا يمكن الحذف نهائياً لأن هناك مصروفات مؤكدة مرتبطة. استخدم إلغاء التنشيط بدلاً من ذلك."
        }, {
          status: 409
        });
      }
      const [deleted] = await sql`
        DELETE FROM accounting_fixed_expenses WHERE id = ${id} RETURNING id
      `;
      if (!deleted) {
        return Response.json({
          error: "المصروف الثابت غير موجود"
        }, {
          status: 404
        });
      }
      return Response.json({
        ok: true,
        hard: true
      });
    }

    // Soft delete (deactivate)
    const [updated] = await sql`
      UPDATE accounting_fixed_expenses
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated) {
      return Response.json({
        error: "المصروف الثابت غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      fixed_expense: updated
    });
  } catch (error) {
    console.error("fixed-expense DELETE error", error);
    return Response.json({
      error: "فشل حذف المصروف الثابت",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, PATCH };
