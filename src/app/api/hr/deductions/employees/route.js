import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureEmployeeDisplayNameSchema } from "@/app/api/utils/employeeDisplayName";

// Minimal employees list for the deductions page
export async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_access_hr" },
      { role: "Admin", permission: "can_manage_deductions" },
    ],
  });

  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureEmployeeDisplayNameSchema();
    const rows = await sql`
      SELECT e.id,
             e.name AS official_name,
             COALESCE(NULLIF(e.display_name, ''), e.name) AS name,
             COALESCE(b.name, eb_b.branch_name) AS branch_name
      FROM employees e
      LEFT JOIN branches b ON b.id = e.branch_id
      LEFT JOIN LATERAL (
        SELECT br.name AS branch_name
        FROM employee_branches eb
        JOIN branches br ON br.id = eb.branch_id
        WHERE eb.employee_id = e.id
        LIMIT 1
      ) eb_b ON true
      ORDER BY COALESCE(NULLIF(e.display_name, ''), e.name) ASC, e.id ASC
    `;

    return Response.json(rows);
  } catch (error) {
    console.error("HR: Error fetching deductions employees:", error);
    return Response.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}
