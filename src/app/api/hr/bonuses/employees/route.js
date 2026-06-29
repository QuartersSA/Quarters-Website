import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureEmployeeDisplayNameSchema } from "@/app/api/utils/employeeDisplayName";

// Minimal employees list for the bonuses entry UI
export async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_access_hr" },
      { role: "Admin", permission: "can_manage_accounting" },
    ],
  });

  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureEmployeeDisplayNameSchema();
    // Pull employee + first associated branch name. We surface the
    // branch on bonus / overtime / loan selectors so the operator can
    // disambiguate employees with the same first name across branches.
    //
    // Resolution: prefer employees.branch_id (primary branch); fall
    // back to the lowest-id row in employee_branches. Same priority
    // the payroll route uses internally.
    const rows = await sql`
      SELECT
        e.id,
        e.name AS official_name,
        COALESCE(NULLIF(e.display_name, ''), e.name) AS name,
        br.name AS branch_name
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT b.name
        FROM branches b
        WHERE b.id = COALESCE(
          e.branch_id,
          (
            SELECT eb.branch_id
            FROM employee_branches eb
            WHERE eb.employee_id = e.id
            ORDER BY eb.id ASC
            LIMIT 1
          )
        )
        LIMIT 1
      ) br ON true
      ORDER BY COALESCE(NULLIF(e.display_name, ''), e.name) ASC, e.id ASC
    `;

    return Response.json(rows);
  } catch (error) {
    console.error("HR: Error fetching bonuses employees:", error);
    return Response.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}
