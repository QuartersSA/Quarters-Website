import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// PATCH /api/accounting/expenses/:id
// For confirming / editing an expense
// body: { is_confirmed, confirmed_amount, confirmed_note }
// OR body: { expense_type_id, expense_name, amount } for editing unconfirmed
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

    // Check if this is a confirmation update
    const isConfirmation = body.is_confirmed !== undefined;
    if (isConfirmation) {
      const isConfirmed = !!body.is_confirmed;
      const confirmedAmount = body.confirmed_amount !== undefined && body.confirmed_amount !== null && body.confirmed_amount !== "" ? Number(body.confirmed_amount) : null;
      const confirmedNote = body.confirmed_note || null;
      const confirmedById = auth.user?.id ? Number(auth.user.id) : null;
      const confirmedByName = auth.user?.name ? String(auth.user.name) : null;
      const confirmedAt = isConfirmed ? new Date().toISOString() : null;
      const [updated] = await sql`
        UPDATE accounting_expenses
        SET is_confirmed = ${isConfirmed},
            confirmed_amount = ${confirmedAmount},
            confirmed_note = ${confirmedNote},
            confirmed_at = ${confirmedAt},
            confirmed_by_employee_id = ${confirmedById},
            confirmed_by_employee_name = ${confirmedByName},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;
      if (!updated) {
        return Response.json({
          error: "المصروف غير موجود"
        }, {
          status: 404
        });
      }
      return Response.json({
        ok: true,
        expense: updated
      });
    }

    // Regular edit (expense_type_id, expense_name, amount)
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
    if (body.amount !== undefined) {
      const amt = Number(body.amount);
      if (amt < 0) {
        return Response.json({
          error: "المبلغ يجب أن يكون أكبر من صفر"
        }, {
          status: 400
        });
      }
      setClauses.push(`amount = $${paramIdx++}`);
      values.push(amt);
    }
    if (setClauses.length === 0) {
      return Response.json({
        error: "No fields to update"
      }, {
        status: 400
      });
    }
    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const query = `UPDATE accounting_expenses SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING *`;
    const [updated] = await sql(query, values);
    if (!updated) {
      return Response.json({
        error: "المصروف غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      expense: updated
    });
  } catch (error) {
    console.error("expense PATCH error", error);
    return Response.json({
      error: "فشل تحديث المصروف",
      details: error.message
    }, {
      status: 500
    });
  }
}

// DELETE /api/accounting/expenses/:id
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
    const [deleted] = await sql`
      DELETE FROM accounting_expenses WHERE id = ${id} RETURNING id
    `;
    if (!deleted) {
      return Response.json({
        error: "المصروف غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("expense DELETE error", error);
    return Response.json({
      error: "فشل حذف المصروف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, PATCH };
