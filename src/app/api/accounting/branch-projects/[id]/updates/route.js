import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  logProjectAudit,
  mapUpdateRow,
  parseId,
} from "@/app/api/utils/branchProjects";
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

// تطورات المشروع — الإضافة.
// POST /api/accounting/branch-projects/[id]/updates { phase_id, body, photos[] } → 201 { ok, update }
// body مطلوب؛ photos مصفوفة روابط نصية (≤ 20).

const MAX_PHOTOS = 20;
const MAX_BODY = 5000;

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

    const text = String(body.body ?? "").trim();
    if (!text) return fail(400, "نص التطور مطلوب");
    if (text.length > MAX_BODY) return fail(400, `نص التطور طويل جدًا (الحد ${MAX_BODY} حرف)`);
    if (body.photos !== undefined && body.photos !== null && !Array.isArray(body.photos)) {
      return fail(400, "الصور يجب أن تكون مصفوفة روابط");
    }
    const photos = (Array.isArray(body.photos) ? body.photos : [])
      .filter((p) => typeof p === "string" && p.trim())
      .map((p) => p.trim());
    if (photos.length > MAX_PHOTOS) return fail(400, `الحد الأقصى ${MAX_PHOTOS} صورة لكل تطور`);
    const phase = await resolvePhaseId(id, body.phase_id);
    if (!phase.ok) return fail(400, phase.error);

    const [row] = await sql`
      INSERT INTO branch_project_updates (
        project_id, phase_id, body, photos, created_by_employee_id, created_by_name
      )
      VALUES (
        ${id}, ${phase.phaseId}, ${text}, ${JSON.stringify(photos)}::jsonb,
        ${actorId(auth)}, ${actorName(auth) || "الإدارة"}
      )
      RETURNING id, project_id, phase_id, body, photos, created_by_employee_id, created_by_name, created_at
    `;
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "update_added",
      summary: `إضافة تطور إلى ${projectLabel(header)}: ${text.slice(0, 80)}${text.length > 80 ? "…" : ""}${photos.length ? ` (${photos.length} صورة)` : ""}`,
      actor: auth.user,
    });
    return Response.json({ ok: true, update: mapUpdateRow(row) }, { status: 201 });
  } catch (error) {
    return serverError("update create", error, "فشل إضافة التطور");
  }
}
