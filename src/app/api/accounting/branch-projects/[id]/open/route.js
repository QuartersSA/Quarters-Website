import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  loadProject,
  pendingMilestones,
  logProjectAudit,
  parseId,
} from "@/app/api/utils/branchProjects";
import { fail, serverError, loadProjectHeader, projectLabel, parseDateKey, today } from "../../_lib";

// تأكيد افتتاح الفرع: status = 'opened' + actual_opening_date.
// POST /api/accounting/branch-projects/[id]/open  { actual_opening_date, force }
// 409 milestones_pending إن بقيت معالم غير مكتملة و!force.

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

    const dateProvided =
      body.actual_opening_date !== undefined &&
      body.actual_opening_date !== null &&
      String(body.actual_opening_date).trim() !== "";
    const openingDate = dateProvided ? parseDateKey(body.actual_opening_date) : today();
    if (!openingDate) return fail(400, "تاريخ الافتتاح غير صحيح (YYYY-MM-DD)");

    const force = body.force === true || body.force === "true" || body.force === 1;
    const pending = await pendingMilestones(id);
    if (Array.isArray(pending) && pending.length && !force) {
      return fail(409, "توجد معالم غير مكتملة", { code: "milestones_pending", pending });
    }

    await sql`
      UPDATE branch_projects
      SET status = 'opened',
          actual_opening_date = ${openingDate},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    await logProjectAudit({
      projectId: id,
      action: "opened",
      summary: `تأكيد افتتاح ${projectLabel(header)} بتاريخ ${openingDate}${pending?.length ? ` رغم ${pending.length} معلم غير مكتمل` : ""}`,
      actor: auth.user,
    });
    const project = await loadProject(id);
    return Response.json({ project });
  } catch (error) {
    return serverError("open", error, "فشل تأكيد الافتتاح");
  }
}
