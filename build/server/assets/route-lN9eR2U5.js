import { s as sql } from './sql-BfhTxwII.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-CZ4YmXjD.js';
import '@neondatabase/serverless';

function toInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

// GET /api/workspace/tasks/:id/attachments?employeeId=...
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
    const auth = await requireWorkspaceEmployee(employeeIdRaw);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const [task] = await sql`
      SELECT id, image_url, image_mime_type, image_name, created_at
      FROM workspace_tasks
      WHERE id = ${taskId}
    `;
    if (!task) {
      return Response.json({
        error: "المهمة غير موجودة"
      }, {
        status: 404
      });
    }
    const attachments = await sql`
      SELECT
        id,
        task_id,
        update_id,
        url,
        mime_type as "mimeType",
        name,
        size_bytes as "sizeBytes",
        created_by_employee_id as "createdByEmployeeId",
        created_at as "createdAt"
      FROM workspace_attachments
      WHERE task_id = ${taskId}
      ORDER BY created_at DESC, id DESC
      LIMIT 50
    `;
    const safe = Array.isArray(attachments) ? attachments : [];

    // Backward-compat: if old task has image_url but no rows in workspace_attachments
    if (safe.length === 0 && task.image_url) {
      return Response.json({
        attachments: [{
          id: null,
          taskId,
          updateId: null,
          url: task.image_url,
          mimeType: task.image_mime_type || null,
          name: task.image_name || null,
          sizeBytes: null,
          createdByEmployeeId: null,
          createdAt: task.created_at
        }]
      });
    }
    return Response.json({
      attachments: safe
    });
  } catch (error) {
    console.error("workspace task attachments GET error:", error);
    return Response.json({
      error: "فشل تحميل المرفقات"
    }, {
      status: 500
    });
  }
}

export { GET };
