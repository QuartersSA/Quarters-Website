import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// DELETE /api/hr/employees/:id/suspensions/:sid
//   Default: soft-cancel (is_active=false) — keeps the audit trail.
//   ?force=1: hard delete from the table.

const REQUIRE_HR = {
  role: "Admin",
  permission: "can_access_hr"
};
async function DELETE(request, {
  params
}) {
  const auth = requireAuth(request, REQUIRE_HR);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const resolved = await params;
    const employeeId = Number(resolved?.id);
    const suspensionId = Number(resolved?.sid);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return Response.json({
        error: "Invalid employee id"
      }, {
        status: 400
      });
    }
    if (!Number.isFinite(suspensionId) || suspensionId <= 0) {
      return Response.json({
        error: "Invalid suspension id"
      }, {
        status: 400
      });
    }
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    if (force) {
      const [deleted] = await sql`
        DELETE FROM employee_suspensions
         WHERE id = ${suspensionId}
           AND employee_id = ${employeeId}
         RETURNING id
      `;
      if (!deleted) {
        return Response.json({
          error: "الإيقاف غير موجود"
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
      UPDATE employee_suspensions
         SET is_active = FALSE
       WHERE id = ${suspensionId}
         AND employee_id = ${employeeId}
       RETURNING
         id, employee_id, kind,
         TO_CHAR(month, 'YYYY-MM-DD') AS month,
         TO_CHAR(effective_from, 'YYYY-MM-DD') AS effective_from,
         reason, is_active, created_at
    `;
    if (!updated) {
      return Response.json({
        error: "الإيقاف غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      suspension: updated
    });
  } catch (error) {
    console.error("hr suspensions DELETE", error);
    return Response.json({
      error: "فشل إلغاء الإيقاف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE };
