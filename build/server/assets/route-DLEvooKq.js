import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

async function GET(request, {
  params
}) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_access_hr"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const {
      id
    } = params;
    const employeeId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(employeeId)) {
      return Response.json({
        error: "Invalid employee id"
      }, {
        status: 400
      });
    }
    const rows = await sql`
      SELECT
        id,
        employee_id,
        employee_name,
        action,
        actor_employee_id,
        actor_name,
        summary,
        changes,
        created_at
      FROM hr_employee_logs
      WHERE employee_id = ${employeeId}
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `;
    return Response.json(rows);
  } catch (error) {
    console.error("HR: Error fetching employee logs:", error);
    return Response.json({
      error: "Failed to fetch employee logs"
    }, {
      status: 500
    });
  }
}

export { GET };
