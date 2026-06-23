import { s as sql } from './sql-BfhTxwII.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-CDFiiX1V.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';

// GET /api/workspace/users?employeeId=...
// Returns employees that can use Workspace
async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeId = params.get("employeeId");
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const users = await sql`
      SELECT id, name, role, COALESCE(can_access_workspace, false) as can_access_workspace
      FROM employees
      WHERE role = 'Admin' OR COALESCE(can_access_workspace, false) = true
      ORDER BY role DESC, name ASC
    `;
    return Response.json({
      users
    });
  } catch (error) {
    console.error("workspace users GET error:", error);
    return Response.json({
      error: "فشل تحميل مستخدمين Workspace"
    }, {
      status: 500
    });
  }
}

export { GET };
