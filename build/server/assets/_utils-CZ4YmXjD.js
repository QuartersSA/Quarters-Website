import { s as sql } from './sql-BfhTxwII.js';

async function requireWorkspaceEmployee(employeeId) {
  if (!employeeId) {
    return {
      ok: false,
      status: 400,
      error: "employeeId مطلوب",
      employee: null
    };
  }
  const [employee] = await sql`
    SELECT id, name, role, COALESCE(can_access_workspace, false) as can_access_workspace
    FROM employees
    WHERE id = ${employeeId}
  `;
  if (!employee) {
    return {
      ok: false,
      status: 404,
      error: "المستخدم غير موجود",
      employee: null
    };
  }
  const allowed = employee.role === "Admin" || employee.can_access_workspace;
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: "هذا المستخدم لا يملك صلاحية الدخول إلى Workspace",
      employee: null
    };
  }
  return {
    ok: true,
    status: 200,
    error: null,
    employee
  };
}
function getSearchParams(request) {
  const url = new URL(request.url);
  return url.searchParams;
}

export { getSearchParams as g, requireWorkspaceEmployee as r };
