import sql from './sql-CSDV1lSC.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-B08qkxFa.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-CwZGtUC2.js';

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
      SELECT
        id,
        name AS official_name,
        display_name,
        COALESCE(NULLIF(display_name, ''), name) AS name,
        role,
        COALESCE(can_access_workspace, false) as can_access_workspace
      FROM employees
      WHERE role = 'Admin' OR COALESCE(can_access_workspace, false) = true
      ORDER BY role DESC, COALESCE(NULLIF(display_name, ''), name) ASC
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
