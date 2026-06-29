import { s as sql } from './sql-BfhTxwII.js';
import { g as getSearchParams, r as requireWorkspaceEmployee, a as getWorkspaceEmployee } from './_utils-CbLHH82L.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-Ba9mYj5Z.js';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// GET /api/workspace/threads?employeeId=...
async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeId = params.get("employeeId");
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const rows = await sql`
      WITH my_threads AS (
        SELECT tm.thread_id, tm.last_read_message_id
        FROM workspace_thread_members tm
        WHERE tm.employee_id = ${employeeId}
      ),
      last_msg AS (
        SELECT DISTINCT ON (m.thread_id)
          m.thread_id,
          m.id as last_message_id,
          m.body as last_message_body,
          m.created_at as last_message_at
        FROM workspace_messages m
        ORDER BY m.thread_id, m.id DESC
      )
      SELECT
        t.id,
        t.kind,
        t.title,
        t.created_at,
        mt.last_read_message_id,
        lm.last_message_id,
        lm.last_message_body,
        lm.last_message_at,
        (
          SELECT COUNT(*)
          FROM workspace_messages um
          WHERE um.thread_id = t.id
            AND (mt.last_read_message_id IS NULL OR um.id > mt.last_read_message_id)
        )::int as unread_count,
        (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', e.id,
                'name', COALESCE(NULLIF(e.display_name, ''), e.name),
                'role', e.role
              )
            ) FILTER (WHERE e.id IS NOT NULL),
            '[]'
          )
          FROM workspace_thread_members tm2
          JOIN employees e ON e.id = tm2.employee_id
          WHERE tm2.thread_id = t.id
        ) as members
      FROM my_threads mt
      JOIN workspace_threads t ON t.id = mt.thread_id
      LEFT JOIN last_msg lm ON lm.thread_id = t.id
      ORDER BY COALESCE(lm.last_message_at, t.created_at) DESC, t.id DESC
    `;
    return Response.json({
      threads: rows
    });
  } catch (error) {
    console.error("workspace threads GET error:", error);
    return Response.json({
      error: "فشل تحميل المحادثات"
    }, {
      status: 500
    });
  }
}

// POST /api/workspace/threads
// body: { employeeId, otherEmployeeId, title }
async function POST(request) {
  try {
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const otherEmployeeId = toInt(body.otherEmployeeId);
    const title = body.title || null;
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!otherEmployeeId || otherEmployeeId === employeeId) {
      return Response.json({
        error: "otherEmployeeId غير صحيح"
      }, {
        status: 400
      });
    }

    // Make sure the other user can access workspace too
    const other = await getWorkspaceEmployee(otherEmployeeId);
    if (!other.ok) {
      return Response.json({
        error: "المستخدم الآخر لا يملك صلاحية Workspace"
      }, {
        status: 400
      });
    }

    // Reuse existing DM thread if exists
    const existing = await sql`
      SELECT t.id
      FROM workspace_threads t
      JOIN workspace_thread_members a ON a.thread_id = t.id AND a.employee_id = ${employeeId}
      JOIN workspace_thread_members b ON b.thread_id = t.id AND b.employee_id = ${otherEmployeeId}
      WHERE t.kind = 'dm'
      ORDER BY t.id DESC
      LIMIT 1
    `;
    if (existing.length > 0) {
      return Response.json({
        threadId: existing[0].id,
        reused: true
      });
    }

    // Create thread and add members
    const [created] = await sql(`INSERT INTO workspace_threads (kind, title, created_by_employee_id) VALUES ('dm', $1, $2) RETURNING id`, [title, employeeId]);
    await sql(`INSERT INTO workspace_thread_members (thread_id, employee_id) VALUES ($1, $2), ($1, $3)`, [created.id, employeeId, otherEmployeeId]);
    return Response.json({
      threadId: created.id,
      reused: false
    });
  } catch (error) {
    console.error("workspace threads POST error:", error);
    return Response.json({
      error: "فشل إنشاء محادثة"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
