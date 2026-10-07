import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  logProjectAudit,
  parseId,
} from "@/app/api/utils/branchProjects";
import { fail, serverError, loadProjectHeader, projectLabel, touchProject } from "../../../_lib";

// حذف مرفق.
// DELETE /api/accounting/branch-projects/[id]/attachments/[attachmentId] → { ok }

export async function DELETE(request, { params } = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const attachmentId = parseId(params?.attachmentId);
    if (!attachmentId) return fail(404, "المرفق غير موجود");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const deleted = await sql`
      DELETE FROM branch_project_attachments
      WHERE id = ${attachmentId} AND project_id = ${id}
      RETURNING id, label, kind
    `;
    if (!deleted.length) return fail(404, "المرفق غير موجود");
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "attachment_deleted",
      summary: `حذف مرفق${deleted[0].label ? ` «${deleted[0].label}»` : ""} من ${projectLabel(header)}`,
      actor: auth.user,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return serverError("attachment delete", error, "فشل حذف المرفق");
  }
}
