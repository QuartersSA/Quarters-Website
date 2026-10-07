import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  logProjectAudit,
  mapAttachmentRow,
  parseId,
} from "@/app/api/utils/branchProjects";
import { ATTACHMENT_KINDS, ATTACHMENT_KIND_LABELS } from "@/utils/branchProjectMath";
import {
  fail,
  serverError,
  loadProjectHeader,
  projectLabel,
  resolvePhaseId,
  touchProject,
  actorName,
  actorId,
} from "../../_lib";

// مرفقات المشروع — الإضافة.
// POST /api/accounting/branch-projects/[id]/attachments { phase_id, url, label, kind } → 201 { ok, attachment }
// url مطلوب؛ kind من ATTACHMENT_KINDS وإلا 'other'.

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
      actor: auth.user,
    });
    return Response.json({ ok: true, attachment: mapAttachmentRow(row) }, { status: 201 });
  } catch (error) {
    return serverError("attachment create", error, "فشل إضافة المرفق");
  }
}
