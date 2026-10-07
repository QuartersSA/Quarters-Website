import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  parsePhaseInput,
  loadPhase,
  logProjectAudit,
  parseId,
} from "@/app/api/utils/branchProjects";
import {
  fail,
  serverError,
  loadProjectHeader,
  projectLabel,
  touchProject,
  purchaseInvoicesTableExists,
} from "../../../_lib";

// قسم واحد: تعديل / حذف.
// PUT    /api/accounting/branch-projects/[id]/phases/[phaseId] → { ok, phase } (sort_order يبقى)
// DELETE /api/accounting/branch-projects/[id]/phases/[phaseId] → { ok } | 409 has_invoices
// معرف غير رقمي (مثل "reorder" عند سوء توجيه) → 404.

async function linkedInvoiceCount(phaseId) {
  if (!(await purchaseInvoicesTableExists())) return 0;
  try {
    const [row] = await sql`
      SELECT COUNT(*)::int AS count FROM accounting_purchase_invoices
      WHERE project_phase_id = ${phaseId} AND is_active = TRUE
    `;
    return Number(row?.count) || 0;
  } catch {
    // العمود غير موجود بعد → لا فواتير مرتبطة.
    return 0;
  }
}

export async function PUT(request, { params } = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const phaseId = parseId(params?.phaseId);
    if (!phaseId) return fail(404, "القسم غير موجود");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const existing = await loadPhase(phaseId, id);
    if (!existing) return fail(404, "القسم غير موجود");
    const body = await request.json().catch(() => ({}));
    const { value, error } = parsePhaseInput(body, existing);
    if (error) return fail(400, error);
    const pick = (key) => (value[key] !== undefined ? value[key] : (existing[key] ?? null));

    await sql`
      UPDATE branch_project_phases
      SET name = ${pick("name")},
          planned_start = ${pick("planned_start")},
          planned_end = ${pick("planned_end")},
          actual_start = ${pick("actual_start")},
          actual_end = ${pick("actual_end")},
          status = ${pick("status") || "not_started"},
          budget = ${Number(pick("budget")) || 0},
          weight = ${Number(pick("weight")) || 1},
          progress_override = ${pick("progress_override")},
          owner_employee_id = ${pick("owner_employee_id")},
          owner_name = ${pick("owner_name") ?? ""},
          contractor_contact_id = ${pick("contractor_contact_id")},
          contractor_name = ${pick("contractor_name") ?? ""},
          color = ${pick("color") || "#64748b"},
          template_key = ${pick("template_key")},
          default_account_code = ${pick("default_account_code")},
          notes = ${pick("notes") ?? ""},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${phaseId} AND project_id = ${id}
    `;
    await touchProject(id);
    const nextStatus = pick("status") || "not_started";
    await logProjectAudit({
      projectId: id,
      action: "phase_updated",
      summary: `تعديل قسم «${pick("name")}» في ${projectLabel(header)}${nextStatus !== existing.status ? ` (الحالة: ${existing.status} → ${nextStatus})` : ""}`,
      actor: auth.user,
    });
    const phase = await loadPhase(phaseId, id);
    return Response.json({ ok: true, phase });
  } catch (error) {
    return serverError("phase update", error, "فشل حفظ القسم");
  }
}

export async function DELETE(request, { params } = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const phaseId = parseId(params?.phaseId);
    if (!phaseId) return fail(404, "القسم غير موجود");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const existing = await loadPhase(phaseId, id);
    if (!existing) return fail(404, "القسم غير موجود");

    const linked = await linkedInvoiceCount(phaseId);
    if (linked > 0) {
      return fail(409, `لا يمكن حذف القسم — مرتبط به ${linked} فاتورة. انقل الفواتير إلى قسم آخر أولاً`, {
        code: "has_invoices",
        count: linked,
      });
    }
    // المهام تُحذف تتابعًا؛ التطورات والمرفقات تفقد القسم (SET NULL).
    await sql`DELETE FROM branch_project_phases WHERE id = ${phaseId} AND project_id = ${id}`;
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "phase_deleted",
      summary: `حذف قسم «${existing.name}» من ${projectLabel(header)}`,
      actor: auth.user,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return serverError("phase delete", error, "فشل حذف القسم");
  }
}
