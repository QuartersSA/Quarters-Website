import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

export async function getWorkspaceEmployee(employeeId) {
  if (!employeeId) {
    return {
      ok: false,
      status: 400,
      error: "employeeId مطلوب",
      employee: null,
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
      employee: null,
    };
  }

  const allowed = employee.role === "Admin" || employee.can_access_workspace;
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: "هذا المستخدم لا يملك صلاحية الدخول إلى Workspace",
      employee: null,
    };
  }

  return { ok: true, status: 200, error: null, employee };
}

export async function requireWorkspaceEmployee(request, employeeId) {
  const session = requireAuth(request, {
    role: "Admin",
    permission: "can_access_workspace",
  });
  if (!session.ok) {
    return {
      ok: false,
      status: session.status,
      error: session.error,
      employee: null,
    };
  }

  const requestedId = Number(employeeId);
  const sessionId = Number(session.user?.id);
  if (
    !Number.isFinite(requestedId) ||
    !Number.isFinite(sessionId) ||
    requestedId !== sessionId
  ) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      employee: null,
    };
  }

  // Re-read the account so permission revocation takes effect immediately,
  // even when an older signed token is still within its expiry window.
  return getWorkspaceEmployee(requestedId);
}

export function getSearchParams(request) {
  const url = new URL(request.url);
  return url.searchParams;
}
