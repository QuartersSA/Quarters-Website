import sql from "@/app/api/utils/sql";
import {
  getSearchParams,
  requireWorkspaceEmployee,
} from "@/app/api/workspace/_utils";

// GET /api/workspace/users?employeeId=...
// Returns employees that can use Workspace
export async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeId = params.get("employeeId");

    const auth = await requireWorkspaceEmployee(employeeId);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const users = await sql`
      SELECT id, name, role, COALESCE(can_access_workspace, false) as can_access_workspace
      FROM employees
      WHERE role = 'Admin' OR COALESCE(can_access_workspace, false) = true
      ORDER BY role DESC, name ASC
    `;

    return Response.json({ users });
  } catch (error) {
    console.error("workspace users GET error:", error);
    return Response.json(
      { error: "فشل تحميل مستخدمين Workspace" },
      { status: 500 },
    );
  }
}
