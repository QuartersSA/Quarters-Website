import sql from "@/app/api/utils/sql";
import {
  getSearchParams,
  requireWorkspaceEmployee,
} from "@/app/api/workspace/_utils";

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// GET /api/workspace/spaces?employeeId=...
export async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeId = params.get("employeeId");

    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const spaces = await sql`
      SELECT
        s.id,
        s.name,
        s.description,
        s.created_by_employee_id,
        COALESCE(NULLIF(e.display_name, ''), e.name, '—') as created_by_name,
        s.created_at,
        (SELECT COUNT(*) FROM workspace_tasks t WHERE t.space_id = s.id)::int as tasks_count
      FROM workspace_spaces s
      LEFT JOIN employees e ON e.id = s.created_by_employee_id
      ORDER BY s.id DESC
    `;

    return Response.json({ spaces });
  } catch (error) {
    console.error("workspace spaces GET error:", error);
    return Response.json({ error: "فشل تحميل الـ Spaces" }, { status: 500 });
  }
}

// POST /api/workspace/spaces
// body: { employeeId, name, description }
export async function POST(request) {
  try {
    const body = await request.json();
    const employeeId = toInt(body.employeeId);

    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const name = (body.name || "").trim();
    const description = (body.description || "").trim() || null;

    if (!name) {
      return Response.json({ error: "اسم الـ Space مطلوب" }, { status: 400 });
    }

    const [space] = await sql`
      INSERT INTO workspace_spaces (name, description, created_by_employee_id)
      VALUES (${name}, ${description}, ${employeeId})
      RETURNING *
    `;

    return Response.json({ space }, { status: 201 });
  } catch (error) {
    console.error("workspace spaces POST error:", error);
    return Response.json({ error: "فشل إنشاء الـ Space" }, { status: 500 });
  }
}
