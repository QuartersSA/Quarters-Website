import { s as sql } from './sql-BfhTxwII.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-CZ4YmXjD.js';
import '@neondatabase/serverless';

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
async function requireMember(threadId, employeeId) {
  const rows = await sql`
    SELECT 1
    FROM workspace_thread_members
    WHERE thread_id = ${threadId} AND employee_id = ${employeeId}
    LIMIT 1
  `;
  return rows.length > 0;
}

// GET /api/workspace/threads/:threadId/messages?employeeId=...
async function GET(request, {
  params
}) {
  try {
    const threadId = toInt(params.threadId);
    const searchParams = getSearchParams(request);
    const employeeId = searchParams.get("employeeId");
    const auth = await requireWorkspaceEmployee(employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!threadId) {
      return Response.json({
        error: "threadId غير صحيح"
      }, {
        status: 400
      });
    }
    const isMember = await requireMember(threadId, employeeId);
    if (!isMember) {
      return Response.json({
        error: "لا تملك صلاحية لهذه المحادثة"
      }, {
        status: 403
      });
    }
    const messages = await sql`
      SELECT
        m.id,
        m.thread_id,
        m.sender_employee_id,
        COALESCE(e.name, '—') as sender_name,
        m.body,
        m.created_at
      FROM workspace_messages m
      LEFT JOIN employees e ON e.id = m.sender_employee_id
      WHERE m.thread_id = ${threadId}
      ORDER BY m.id ASC
      LIMIT 500
    `;
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (lastId) {
      await sql`
        UPDATE workspace_thread_members
        SET last_read_message_id = ${lastId}
        WHERE thread_id = ${threadId} AND employee_id = ${employeeId}
      `;
    }
    return Response.json({
      messages
    });
  } catch (error) {
    console.error("workspace messages GET error:", error);
    return Response.json({
      error: "فشل تحميل الرسائل"
    }, {
      status: 500
    });
  }
}

// POST /api/workspace/threads/:threadId/messages
// body: { employeeId, body }
async function POST(request, {
  params
}) {
  try {
    const threadId = toInt(params.threadId);
    const payload = await request.json();
    const employeeId = toInt(payload.employeeId);
    const bodyText = (payload.body || "").trim();
    const auth = await requireWorkspaceEmployee(employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!threadId) {
      return Response.json({
        error: "threadId غير صحيح"
      }, {
        status: 400
      });
    }
    if (!bodyText) {
      return Response.json({
        error: "نص الرسالة مطلوب"
      }, {
        status: 400
      });
    }
    const isMember = await requireMember(threadId, employeeId);
    if (!isMember) {
      return Response.json({
        error: "لا تملك صلاحية لهذه المحادثة"
      }, {
        status: 403
      });
    }
    const [msg] = await sql`
      INSERT INTO workspace_messages (thread_id, sender_employee_id, body)
      VALUES (${threadId}, ${employeeId}, ${bodyText})
      RETURNING id, thread_id, sender_employee_id, body, created_at
    `;

    // Sender has read their own latest message
    await sql`
      UPDATE workspace_thread_members
      SET last_read_message_id = ${msg.id}
      WHERE thread_id = ${threadId} AND employee_id = ${employeeId}
    `;
    return Response.json({
      message: msg
    }, {
      status: 201
    });
  } catch (error) {
    console.error("workspace messages POST error:", error);
    return Response.json({
      error: "فشل إرسال الرسالة"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
