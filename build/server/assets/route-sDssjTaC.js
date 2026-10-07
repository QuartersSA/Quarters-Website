import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureBranchProjectsSchema, c as parseId, A as ATTACHMENT_KINDS, l as logProjectAudit, d as ATTACHMENT_KIND_LABELS, m as mapAttachmentRow, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-D3H72PHO.js';
import { f as fail, l as loadProjectHeader, r as resolvePhaseId, a as actorId, b as actorName, t as touchProject, p as projectLabel, s as serverError } from './_lib-CtoJcMUN.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseAudit-DZMMDeLJ.js';
import './dateUtils-Bvji1KrH.js';

// مرفقات المشروع — الإضافة.
// POST /api/accounting/branch-projects/[id]/attachments { phase_id, url, label, kind } → 201 { ok, attachment }
// url مطلوب؛ kind من ATTACHMENT_KINDS وإلا 'other'.

async function POST(request, {
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
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const body = await request.json().catch(() => ({}));
    const url = String(body.url ?? "").trim();
    if (!url) return fail(400, "رابط المرفق مطلوب");
    if (url.length > 2048) return fail(400, "رابط المرفق طويل جدًا");
    const label = String(body.label ?? "").trim().slice(0, 300);
    const kindRaw = String(body.kind ?? "").trim();
    const kind = ATTACHMENT_KINDS.includes(kindRaw) ? kindRaw : "other";
    const phase = await resolvePhaseId(id, body.phase_id);
    if (!phase.ok) return fail(400, phase.error);
    const [row] = await sql`
      INSERT INTO branch_project_attachments (
        project_id, phase_id, url, label, kind, created_by_employee_id, created_by_name
      )
      VALUES (
        ${id}, ${phase.phaseId}, ${url}, ${label}, ${kind},
        ${actorId(auth)}, ${actorName(auth) || "الإدارة"}
      )
      RETURNING id, project_id, phase_id, url, label, kind, created_by_employee_id, created_by_name, created_at
    `;
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "attachment_added",
      summary: `إضافة مرفق (${ATTACHMENT_KIND_LABELS?.[kind] || kind})${label ? ` «${label}»` : ""} إلى ${projectLabel(header)}`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      attachment: mapAttachmentRow(row)
    }, {
      status: 201
    });
  } catch (error) {
    return serverError("attachment create", error, "فشل إضافة المرفق");
  }
}

export { POST };
