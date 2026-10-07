import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  logProjectAudit,
  parseId,
} from "@/app/api/utils/branchProjects";
import { fail, serverError, loadProjectHeader, projectLabel, touchProject } from "../../../_lib";

// إعادة ترتيب الأقسام: sort_order = موضع المعرف في المصفوفة.
// POST /api/accounting/branch-projects/[id]/phases/reorder  { ids: number[] } → { ok }
// (مسجَّل كمسار ثابت؛ [phaseId] لا يصدّر POST فلا تعارض.)

export async function POST(request, { params } = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];
    if (!ids.length || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      return fail(400, "قائمة الأقسام غير صحيحة");
    }
    if (new Set(ids).size !== ids.length) return fail(400, "قائمة الأقسام تحوي معرفات مكررة");

    const rows = await sql`
      SELECT id FROM branch_project_phases WHERE project_id = ${id} ORDER BY sort_order, id
    `;
    const owned = new Set(rows.map((r) => Number(r.id)));
    if (ids.some((n) => !owned.has(n))) return fail(400, "بعض الأقسام لا تخص هذا المشروع");

    // الأقسام غير المذكورة تُلحق بعد المذكورة بترتيبها الحالي.
    const ordered = [...ids, ...rows.map((r) => Number(r.id)).filter((n) => !ids.includes(n))];
    await sql.transaction(
      ordered.map(
        (phaseId, index) => sql`
          UPDATE branch_project_phases
          SET sort_order = ${index}, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE id = ${phaseId} AND project_id = ${id}
        `,
      ),
    );
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "phases_reordered",
      summary: `إعادة ترتيب ${ordered.length} قسم في ${projectLabel(header)}`,
      actor: auth.user,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return serverError("phase reorder", error, "فشل إعادة ترتيب الأقسام");
  }
}
