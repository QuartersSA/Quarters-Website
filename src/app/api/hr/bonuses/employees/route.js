import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

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
    const rows = await sql`
      SELECT id, name
      FROM employees
      ORDER BY name ASC, id ASC
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
