import { s as sql } from './sql-BfhTxwII.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-CbLHH82L.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-Ba9mYj5Z.js';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// GET /api/workspace/tasks/:id/history?employeeId=...
async function GET(request, {
  params
}) {
  try {
    const taskId = toInt(params.id);
    if (!taskId) {
      return Response.json({
        error: "id غير صحيح"
      }, {
        status: 400
      });
    }
    const sp = getSearchParams(request);
    const employeeIdRaw = sp.get("employeeId");
    const auth = await requireWorkspaceEmployee(request, employeeIdRaw);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const events = await sql`
      SELECT
        e.id,
        e.task_id,
        e.event_type,
        e.summary,
        e.meta,
        e.created_at,
        e.actor_employee_id,
        COALESCE(NULLIF(emp.display_name, ''), emp.name, '—') as actor_name
      FROM workspace_task_events e
      LEFT JOIN employees emp ON emp.id = e.actor_employee_id
      WHERE e.task_id = ${taskId}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 200
    `;
    return Response.json({
      events
    });
  } catch (error) {
    console.error("workspace task history GET error:", error);
    return Response.json({
      error: "فشل تحميل سجل المهمة"
    }, {
      status: 500
    });
  }
}

export { GET };
