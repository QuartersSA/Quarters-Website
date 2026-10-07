import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  parseTaskInput,
  loadTask,
  logProjectAudit,
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
} from "../../../_lib";

// مهمة واحدة: تعديل / حذف.
// PUT    /api/accounting/branch-projects/[id]/tasks/[taskId] → { ok, task }
//        (الانتقال إلى done يسجّل done_by_employee_name = المستخدم الحالي)
// DELETE /api/accounting/branch-projects/[id]/tasks/[taskId] → { ok }

export async function PUT(request, { params } = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const taskId = parseId(params?.taskId);
    if (!taskId) return fail(404, "المهمة غير موجودة");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const existing = await loadTask(taskId, id);
    if (!existing) return fail(404, "المهمة غير موجودة");
    const body = await request.json().catch(() => ({}));
    const { value, error } = parseTaskInput(body, existing);
    if (error) return fail(400, error);
    const pick = (key) => (value[key] !== undefined ? value[key] : (existing[key] ?? null));
    const phase = await resolvePhaseId(id, pick("phase_id"));
    if (!phase.ok) return fail(400, phase.error);

    const status = pick("status") || "todo";
    const isDone = status === "done";
    const doneAt = isDone ? (pick("done_at") ?? null) : null;
    let doneBy = null;
    if (isDone) {
      doneBy = existing.status === "done" ? (existing.done_by_employee_name || actorName(auth)) : actorName(auth);
    }
    const sortOrder = value.sort_order ?? existing.sort_order ?? 0;

    await sql`
      UPDATE branch_project_tasks
      SET phase_id = ${phase.phaseId},
          title = ${pick("title")},
          status = ${status},
          is_milestone = ${pick("is_milestone") === true},
          due_date = ${pick("due_date")},
          done_at = ${doneAt},
          done_by_employee_name = ${doneBy},
          assignee_employee_id = ${pick("assignee_employee_id")},
          assignee_name = ${pick("assignee_name") ?? ""},
          sort_order = ${sortOrder},
          notes = ${pick("notes") ?? ""},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${taskId} AND project_id = ${id}
    `;
    await touchProject(id);
    const title = pick("title");
    let summary = `تعديل ${pick("is_milestone") === true ? "معلم" : "مهمة"} «${title}» في ${projectLabel(header)}`;
    if (status !== existing.status) {
      summary = isDone
        ? `إنجاز «${title}» في ${projectLabel(header)}${doneBy ? ` — بواسطة ${doneBy}` : ""}`
        : `${summary} (الحالة: ${existing.status} → ${status})`;
    }
    await logProjectAudit({
      projectId: id,
      action: isDone && existing.status !== "done" ? "task_done" : "task_updated",
      summary,
      actor: auth.user,
    });
    const task = await loadTask(taskId, id);
    return Response.json({ ok: true, task });
  } catch (error) {
    return serverError("task update", error, "فشل حفظ المهمة");
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
    const taskId = parseId(params?.taskId);
    if (!taskId) return fail(404, "المهمة غير موجودة");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const existing = await loadTask(taskId, id);
    if (!existing) return fail(404, "المهمة غير موجودة");
    await sql`DELETE FROM branch_project_tasks WHERE id = ${taskId} AND project_id = ${id}`;
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "task_deleted",
      summary: `حذف ${existing.is_milestone ? "معلم" : "مهمة"} «${existing.title}» من ${projectLabel(header)}`,
      actor: auth.user,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return serverError("task delete", error, "فشل حذف المهمة");
  }
}
