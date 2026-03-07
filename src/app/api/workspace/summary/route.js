import sql from "@/app/api/utils/sql";
import {
  getSearchParams,
  requireWorkspaceEmployee,
} from "@/app/api/workspace/_utils";

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i <= 0) return null;
  return i;
}

// GET /api/workspace/summary?employeeId=...
export async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeIdRaw = params.get("employeeId");

    const auth = await requireWorkspaceEmployee(employeeIdRaw);
    if (!auth.ok) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const employeeId = toInt(employeeIdRaw);

    // Use Riyadh timezone for "today"
    const todayQuery =
      await sql`SELECT (NOW() AT TIME ZONE 'Asia/Riyadh')::date AS today`;
    const today = todayQuery[0]?.today;

    // 1. My tasks due today
    const myTasksToday = await sql(
      `SELECT
        t.id, t.title, t.status, t.priority, t.due_date, t.space_id,
        COALESCE(s.name, '') as space_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', a.id, 'name', a.name)
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as assignees
      FROM workspace_tasks t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      LEFT JOIN (
        SELECT task_id, employee_id FROM workspace_task_assignees
        UNION
        SELECT id as task_id, assignee_employee_id as employee_id
        FROM workspace_tasks WHERE assignee_employee_id IS NOT NULL
      ) ta ON ta.task_id = t.id
      LEFT JOIN employees a ON a.id = ta.employee_id
      WHERE t.due_date = $1
        AND (t.tags IS NULL OR NOT ('__system_deleted__' = ANY(t.tags)))
        AND EXISTS (
          SELECT 1 FROM (
            SELECT task_id, employee_id FROM workspace_task_assignees
            UNION
            SELECT id, assignee_employee_id FROM workspace_tasks WHERE assignee_employee_id IS NOT NULL
          ) x WHERE x.task_id = t.id AND x.employee_id = $2
        )
      GROUP BY t.id, s.name
      ORDER BY
        CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END,
        CASE t.priority
          WHEN 'Urgent' THEN 0
          WHEN 'High' THEN 1
          WHEN 'Normal' THEN 2
          WHEN 'Low' THEN 3
          ELSE 4
        END,
        t.id DESC
      LIMIT 50`,
      [today, employeeId],
    );

    // 2. My overdue tasks
    const myOverdueTasks = await sql(
      `SELECT
        t.id, t.title, t.status, t.priority, t.due_date, t.space_id,
        COALESCE(s.name, '') as space_name
      FROM workspace_tasks t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      WHERE t.due_date < $1
        AND t.status <> 'Done'
        AND (t.tags IS NULL OR NOT ('__system_deleted__' = ANY(t.tags)))
        AND EXISTS (
          SELECT 1 FROM (
            SELECT task_id, employee_id FROM workspace_task_assignees
            UNION
            SELECT id, assignee_employee_id FROM workspace_tasks WHERE assignee_employee_id IS NOT NULL
          ) x WHERE x.task_id = t.id AND x.employee_id = $2
        )
      ORDER BY t.due_date ASC, t.id DESC
      LIMIT 20`,
      [today, employeeId],
    );

    // 3. Unread messages count
    const unreadRows = await sql(
      `SELECT COALESCE(SUM(
        CASE WHEN tm.last_read_message_id IS NULL THEN
          (SELECT COUNT(*) FROM workspace_messages m WHERE m.thread_id = tm.thread_id)
        ELSE
          (SELECT COUNT(*) FROM workspace_messages m WHERE m.thread_id = tm.thread_id AND m.id > tm.last_read_message_id)
        END
      ), 0) as unread_count
      FROM workspace_thread_members tm
      WHERE tm.employee_id = $1`,
      [employeeId],
    );
    const unreadCount = Number(unreadRows[0]?.unread_count || 0);

    // 4. Stats: my total tasks breakdown
    const statsRows = await sql(
      `SELECT
        COUNT(*) FILTER (WHERE t.status = 'Todo') as todo_count,
        COUNT(*) FILTER (WHERE t.status = 'In Progress') as in_progress_count,
        COUNT(*) FILTER (WHERE t.status = 'Done') as done_count,
        COUNT(*) as total_count
      FROM workspace_tasks t
      WHERE (t.tags IS NULL OR NOT ('__system_deleted__' = ANY(t.tags)))
        AND EXISTS (
          SELECT 1 FROM (
            SELECT task_id, employee_id FROM workspace_task_assignees
            UNION
            SELECT id, assignee_employee_id FROM workspace_tasks WHERE assignee_employee_id IS NOT NULL
          ) x WHERE x.task_id = t.id AND x.employee_id = $1
        )`,
      [employeeId],
    );

    const stats = {
      todo: Number(statsRows[0]?.todo_count || 0),
      inProgress: Number(statsRows[0]?.in_progress_count || 0),
      done: Number(statsRows[0]?.done_count || 0),
      total: Number(statsRows[0]?.total_count || 0),
    };

    // 5. Recent activity (last 10 task events across team)
    const recentActivity = await sql(
      `SELECT
        e.id, e.event_type, e.summary, e.created_at,
        t.title as task_title, t.id as task_id,
        emp.name as actor_name
      FROM workspace_task_events e
      LEFT JOIN workspace_tasks t ON t.id = e.task_id
      LEFT JOIN employees emp ON emp.id = e.actor_employee_id
      WHERE e.event_type IN ('created', 'updated')
      ORDER BY e.created_at DESC
      LIMIT 10`,
    );

    // 6. Upcoming tasks (next 7 days, not today)
    const upcomingTasks = await sql(
      `SELECT
        t.id, t.title, t.status, t.priority, t.due_date,
        COALESCE(s.name, '') as space_name
      FROM workspace_tasks t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      WHERE t.due_date > $1
        AND t.due_date <= ($1::date + INTERVAL '7 days')
        AND t.status <> 'Done'
        AND (t.tags IS NULL OR NOT ('__system_deleted__' = ANY(t.tags)))
        AND EXISTS (
          SELECT 1 FROM (
            SELECT task_id, employee_id FROM workspace_task_assignees
            UNION
            SELECT id, assignee_employee_id FROM workspace_tasks WHERE assignee_employee_id IS NOT NULL
          ) x WHERE x.task_id = t.id AND x.employee_id = $2
        )
      ORDER BY t.due_date ASC, t.id DESC
      LIMIT 20`,
      [today, employeeId],
    );

    // 7. Monthly health score
    // "late" = tasks that entered the overdue log (was_overdue = true) this month
    // "onTime" = tasks completed this month that were NOT ever overdue
    // "totalDone" = all tasks completed (set to Done) this month
    const healthRows = await sql(
      `SELECT
        COUNT(*) as total_done,
        COUNT(*) FILTER (WHERE COALESCE(t.was_overdue, false) = false) as on_time,
        COUNT(*) FILTER (WHERE COALESCE(t.was_overdue, false) = true) as late
      FROM workspace_tasks t
      WHERE t.status = 'Done'
        AND t.completed_at IS NOT NULL
        AND DATE_TRUNC('month', t.completed_at AT TIME ZONE 'Asia/Riyadh') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Riyadh')
        AND (t.tags IS NULL OR NOT ('__system_deleted__' = ANY(t.tags)))
        AND EXISTS (
          SELECT 1 FROM (
            SELECT task_id, employee_id FROM workspace_task_assignees
            UNION
            SELECT id, assignee_employee_id FROM workspace_tasks WHERE assignee_employee_id IS NOT NULL
          ) x WHERE x.task_id = t.id AND x.employee_id = $1
        )`,
      [employeeId],
    );

    const totalDoneThisMonth = Number(healthRows[0]?.total_done || 0);
    const onTimeCount = Number(healthRows[0]?.on_time || 0);
    const lateCount = Number(healthRows[0]?.late || 0);
    const healthPercent =
      totalDoneThisMonth > 0
        ? Math.round((onTimeCount / totalDoneThisMonth) * 100)
        : null;

    const healthScore = {
      percent: healthPercent,
      onTime: onTimeCount,
      late: lateCount,
      totalDone: totalDoneThisMonth,
    };

    return Response.json({
      today: String(today),
      myTasksToday,
      myOverdueTasks,
      unreadCount,
      stats,
      recentActivity,
      upcomingTasks,
      healthScore,
    });
  } catch (error) {
    console.error("workspace summary GET error:", error);
    return Response.json({ error: "فشل تحميل الملخص" }, { status: 500 });
  }
}
