// DELETE /api/hr/overtime/:id
//   Hard delete — overtime rows are simple grants without audit
//   weight beyond the payroll snapshot they fed into. Closed payroll
//   months keep their stored numbers regardless.

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

const REQUIRE_HR = { role: "Admin", permission: "can_access_hr" };

export async function DELETE(request, { params }) {
  const auth = requireAuth(request, REQUIRE_HR);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: "Invalid ID" }, { status: 400 });
    }
    const [deleted] = await sql`
      DELETE FROM hr_employee_overtime WHERE id = ${id} RETURNING id
    `;
    if (!deleted) {
      return Response.json({ error: "السجل غير موجود" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("hr overtime DELETE", error);
    return Response.json(
      { error: "فشل الحذف", details: error.message },
      { status: 500 },
    );
  }
}
