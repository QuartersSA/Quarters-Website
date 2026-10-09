import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureBranchProjectsSchema, c as parseId, r as parsePhaseInput, l as logProjectAudit, q as loadPhase, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-Dp7usULY.js';
import { f as fail, l as loadProjectHeader, t as touchProject, p as projectLabel, s as serverError } from './_lib-E-cBDqvJ.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseAudit-DZMMDeLJ.js';
import './dateUtils-Bvji1KrH.js';

// أقسام المشروع — الإضافة.
// POST /api/accounting/branch-projects/[id]/phases  → 201 { ok, phase }

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
    const {
      value,
      error
    } = parsePhaseInput(body);
    if (error) return fail(400, error);
    const [{
      next_sort
    }] = await sql`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort
      FROM branch_project_phases WHERE project_id = ${id}
    `;
    const [created] = await sql`
      INSERT INTO branch_project_phases (
        project_id, name, sort_order, planned_start, planned_end, actual_start, actual_end,
        status, budget, weight, progress_override, owner_employee_id, owner_name,
        contractor_contact_id, contractor_name, color, template_key, default_account_code, notes
      )
      VALUES (
        ${id}, ${value.name}, ${Number(next_sort) || 1},
        ${value.planned_start ?? null}, ${value.planned_end ?? null},
        ${value.actual_start ?? null}, ${value.actual_end ?? null},
        ${value.status || "not_started"}, ${Number(value.budget) || 0}, ${Number(value.weight) || 1},
        ${value.progress_override ?? null}, ${value.owner_employee_id ?? null}, ${value.owner_name ?? ""},
        ${value.contractor_contact_id ?? null}, ${value.contractor_name ?? ""},
        ${value.color || "#64748b"}, ${value.template_key ?? null}, ${value.default_account_code ?? null},
        ${value.notes ?? ""}
      )
      RETURNING id
    `;
    const phaseId = Number(created.id);
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "phase_added",
      summary: `إضافة قسم «${value.name}» إلى ${projectLabel(header)}`,
      actor: auth.user
    });
    const phase = await loadPhase(phaseId, id);
    return Response.json({
      ok: true,
      phase
    }, {
      status: 201
    });
  } catch (error) {
    return serverError("phase create", error, "فشل حفظ القسم");
  }
}

export { POST };
