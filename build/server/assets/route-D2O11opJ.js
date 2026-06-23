import { s as sql } from './sql-BfhTxwII.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-CDFiiX1V.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// GET /api/workspace/overdue?employeeId=...
// Returns tasks that were ever overdue (was_overdue = true)
async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeIdRaw = params.get("employeeId");
    const auth = await requireWorkspaceEmployee(request, employeeIdRaw);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const employeeId = toInt(employeeIdRaw);
    if (!employeeId) {
      return Response.json({
        error: "employeeId غير صحيح"
      }, {
        status: 400
      });
    }

    // Ensure any currently overdue tasks are marked once.
    // Also write a history event for any task that becomes overdue now.
    // NOTE: We use Riyadh date because DB server time is UTC.
    await sql`
      WITH vars AS (
        SELECT (NOW() AT TIME ZONE 'Asia/Riyadh')::date AS today
      ),
      newly AS (
        UPDATE workspace_tasks
        SET was_overdue = true,
            first_overdue_at = COALESCE(first_overdue_at, NOW())
        FROM vars
        WHERE due_date IS NOT NULL
          AND due_date < vars.today
          AND status <> 'Done'
          AND was_overdue = false
        RETURNING id, due_date
      )
      INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta)
      SELECT
        newly.id,
        'overdue',
        NULL,
        'تم تسجيل المهمة كمتأخرة',
        jsonb_build_object('due_date', newly.due_date, 'reason', 'due_date_passed')
      FROM newly
    `;
    const tasks = await sql`
      WITH vars AS (
        SELECT (NOW() AT TIME ZONE 'Asia/Riyadh')::date AS today
      )
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.tags,
        t.space_id,
        t.image_url,
        t.image_mime_type,
        t.image_name,
        COALESCE(s.name, '') as space_name,
        t.created_by_employee_id,
        COALESCE(t.created_by_employee_name, cb.name, '—') as created_by_name,
        t.created_at,
        t.was_overdue,
        t.first_overdue_at,
        t.completed_at,
        CASE
          WHEN t.due_date IS NOT NULL AND t.status <> 'Done' AND t.due_date < (SELECT today FROM vars) THEN true
          ELSE false
        END as is_currently_overdue,
        CASE
          WHEN t.due_date IS NOT NULL AND t.completed_at IS NOT NULL AND ((t.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh')::date > t.due_date) THEN true
          ELSE false
        END as was_completed_late,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', a.id,
              'name', a.name,
              'role', a.role
            )
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as assignees
      FROM workspace_tasks t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      LEFT JOIN employees cb ON cb.id = t.created_by_employee_id
      LEFT JOIN (
        SELECT task_id, employee_id FROM workspace_task_assignees
        UNION
        SELECT id as task_id, assignee_employee_id as employee_id
        FROM workspace_tasks
        WHERE assignee_employee_id IS NOT NULL
      ) ta ON ta.task_id = t.id
      LEFT JOIN employees a ON a.id = ta.employee_id
      WHERE t.was_overdue = true
      GROUP BY
        t.id,
        s.name,
        cb.name,
        t.created_by_employee_name
      ORDER BY
        COALESCE(t.first_overdue_at, t.created_at) DESC,
        t.id DESC
      LIMIT 500
    `;
    return Response.json({
      tasks
    });
  } catch (error) {
    console.error("workspace overdue GET error:", error);
    return Response.json({
      error: "فشل تحميل المهام المتأخرة"
    }, {
      status: 500
    });
  }
}

export { GET };
