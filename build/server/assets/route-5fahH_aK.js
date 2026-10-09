import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureBranchProjectsSchema, c as parseId, q as parseTaskInput, l as logProjectAudit, o as loadTask, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-CcA6x5SF.js';
import { f as fail, l as loadProjectHeader, r as resolvePhaseId, b as actorName, t as touchProject, p as projectLabel, s as serverError } from './_lib-D2U1lqMJ.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseAudit-DZMMDeLJ.js';
import './dateUtils-Bvji1KrH.js';

// مهام المشروع — الإضافة.
// POST /api/accounting/branch-projects/[id]/tasks → 201 { ok, task }
// phase_id اختياري ويجب أن يخص المشروع؛ sort_order = max+1 داخل القسم.

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
    } = parseTaskInput(body);
    if (error) return fail(400, error);
    const phase = await resolvePhaseId(id, value.phase_id);
    if (!phase.ok) return fail(400, phase.error);
    const [{
      next_sort
    }] = await sql`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort
      FROM branch_project_tasks
      WHERE project_id = ${id} AND phase_id IS NOT DISTINCT FROM ${phase.phaseId}
    `;
    const isDone = value.status === "done";
    const [created] = await sql`
      INSERT INTO branch_project_tasks (
        project_id, phase_id, title, status, is_milestone, due_date, done_at, done_by_employee_name,
        assignee_employee_id, assignee_name, sort_order, notes
      )
      VALUES (
        ${id}, ${phase.phaseId}, ${value.title}, ${value.status || "todo"}, ${value.is_milestone === true},
        ${value.due_date ?? null}, ${isDone ? value.done_at ?? null : null}, ${isDone ? actorName(auth) : null},
        ${value.assignee_employee_id ?? null}, ${value.assignee_name ?? ""}, ${Number(next_sort) || 1},
        ${value.notes ?? ""}
      )
      RETURNING id
    `;
    const taskId = Number(created.id);
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "task_added",
      summary: `إضافة ${value.is_milestone ? "معلم" : "مهمة"} «${value.title}» إلى ${projectLabel(header)}`,
      actor: auth.user
    });
    const task = await loadTask(taskId, id);
    return Response.json({
      ok: true,
      task
    }, {
      status: 201
    });
  } catch (error) {
    return serverError("task create", error, "فشل حفظ المهمة");
  }
}

export { POST };
