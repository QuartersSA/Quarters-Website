import sql from "@/app/api/utils/sql";
import { requireWorkspaceEmployee } from "@/app/api/workspace/_utils";

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i <= 0) return null;
  return i;
}

const VALID_STATUSES = ["Todo", "In Progress", "Done"];

// PATCH /api/workspace/tasks/quick-status
// body: { employeeId, taskId, status }
export async function PATCH(request) {
  try {
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const taskId = toInt(body.taskId);
    const newStatus = body.status;

    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    if (!taskId) {
      return Response.json({ error: "taskId مطلوب" }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      return Response.json({ error: "حالة غير صالحة" }, { status: 400 });
    }

    // Get current task
    const rows =
      await sql`SELECT id, status, title FROM workspace_tasks WHERE id = ${taskId}`;
    const task = rows[0];
    if (!task) {
      return Response.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    const oldStatus = task.status;
    if (oldStatus === newStatus) {
      return Response.json({ task, changed: false });
    }

    // Update status
    if (newStatus === "Done") {
      await sql`UPDATE workspace_tasks SET status = ${newStatus}, completed_at = COALESCE(completed_at, NOW()) WHERE id = ${taskId}`;
    } else {
      await sql`UPDATE workspace_tasks SET status = ${newStatus} WHERE id = ${taskId}`;
    }

    // Log event
    const diff = { status: { from: oldStatus, to: newStatus } };
    const meta = JSON.stringify({ diff });
    await sql(
      "INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta) VALUES ($1, $2, $3, $4, $5::jsonb)",
      [taskId, "updated", employeeId, "تم تغيير حالة المهمة", meta],
    );

    // Mark overdue if needed (Riyadh time)
    if (newStatus === "Done") {
      await sql`
        WITH vars AS (
          SELECT (NOW() AT TIME ZONE 'Asia/Riyadh')::date AS today
        )
        UPDATE workspace_tasks
        SET was_overdue = true,
            first_overdue_at = COALESCE(first_overdue_at, NOW())
        FROM vars
        WHERE id = ${taskId}
          AND was_overdue = false
          AND due_date IS NOT NULL
          AND completed_at IS NOT NULL
          AND ((completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh')::date > due_date)
      `;
    }

    const updated =
      await sql`SELECT * FROM workspace_tasks WHERE id = ${taskId}`;

    return Response.json({ task: updated[0], changed: true });
  } catch (error) {
    console.error("quick-status PATCH error:", error);
    return Response.json({ error: "فشل تغيير الحالة" }, { status: 500 });
  }
}
