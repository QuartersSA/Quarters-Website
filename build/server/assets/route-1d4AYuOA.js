import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureBranchProjectsSchema, c as parseId, l as logProjectAudit, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-D3H72PHO.js';
import { f as fail, l as loadProjectHeader, t as touchProject, p as projectLabel, s as serverError } from './_lib-CtoJcMUN.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseAudit-DZMMDeLJ.js';
import './dateUtils-Bvji1KrH.js';

// حذف تطور.
// DELETE /api/accounting/branch-projects/[id]/updates/[updateId] → { ok }

async function DELETE(request, {
  params
} = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const updateId = parseId(params?.updateId);
    if (!updateId) return fail(404, "التطور غير موجود");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const deleted = await sql`
      DELETE FROM branch_project_updates
      WHERE id = ${updateId} AND project_id = ${id}
      RETURNING id, body
    `;
    if (!deleted.length) return fail(404, "التطور غير موجود");
    await touchProject(id);
    const text = String(deleted[0].body || "");
    await logProjectAudit({
      projectId: id,
      action: "update_deleted",
      summary: `حذف تطور من ${projectLabel(header)}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}`,
      actor: auth.user
    });
    return Response.json({
      ok: true
    });
  } catch (error) {
    return serverError("update delete", error, "فشل حذف التطور");
  }
}

export { DELETE };
