import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// PUT    /api/accounting/employee-loans/:id
//   body: { total_amount?, installments_count?, start_month?, note?, is_active? }
// DELETE /api/accounting/employee-loans/:id
//   Soft-delete via is_active=false. Past payroll runs that already
//   deducted from the loan keep their stored values.

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
    if (body.total_amount !== undefined) {
      const v = Number(body.total_amount);
      if (!Number.isFinite(v) || v <= 0) {
        return Response.json({
          error: "مبلغ القرض غير صحيح"
        }, {
          status: 400
        });
      }
      sets.push(`total_amount = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.installments_count !== undefined) {
      const v = Number(body.installments_count);
      if (!Number.isFinite(v) || v <= 0) {
        return Response.json({
          error: "عدد الأقساط غير صحيح"
        }, {
          status: 400
        });
      }
      sets.push(`installments_count = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.start_month !== undefined) {
      const raw = String(body.start_month).trim();
      if (!/^\d{4}-\d{2}$/.test(raw)) {
        return Response.json({
          error: "صيغة شهر البدء غير صحيحة (YYYY-MM)"
        }, {
          status: 400
        });
      }
      sets.push(`start_month = $${idx}`);
      values.push(`${raw}-01`);
      idx += 1;
    }
    if (body.note !== undefined) {
      sets.push(`note = $${idx}`);
      values.push(body.note ? String(body.note).trim() : null);
      idx += 1;
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
    // Same TO_CHAR trick as the GET / POST routes — keep start_month
    // as a string so the JS Date / JSON round-trip doesn't drift the
    // day when the server is in a positive timezone.
    const query = `
      WITH upd AS (
        UPDATE accounting_employee_loans
           SET ${sets.join(", ")}
         WHERE id = $${idx}
         RETURNING *
      )
      SELECT
        id, employee_id, total_amount, installments_count,
        TO_CHAR(start_month, 'YYYY-MM-DD') AS start_month,
        note, is_active, created_at, updated_at,
        created_by_employee_id, created_by_employee_name
      FROM upd
    `;
    const [updated] = await sql(query, values);
    if (!updated) {
      return Response.json({
        error: "القرض غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      loan: updated
    });
  } catch (error) {
    console.error("employee-loans PUT error", error);
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
      const [deleted] = await sql`
        DELETE FROM accounting_employee_loans WHERE id = ${id} RETURNING id
      `;
      if (!deleted) {
        return Response.json({
          error: "القرض غير موجود"
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
      WITH upd AS (
        UPDATE accounting_employee_loans
           SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE id = ${id}
         RETURNING *
      )
      SELECT
        id, employee_id, total_amount, installments_count,
        TO_CHAR(start_month, 'YYYY-MM-DD') AS start_month,
        note, is_active, created_at, updated_at,
        created_by_employee_id, created_by_employee_name
      FROM upd
    `;
    if (!updated) {
      return Response.json({
        error: "القرض غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      loan: updated
    });
  } catch (error) {
    console.error("employee-loans DELETE error", error);
    return Response.json({
      error: "فشل الحذف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, PUT };
