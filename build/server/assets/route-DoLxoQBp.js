import sql from './sql-CSDV1lSC.js';
import { r as requireWorkspaceEmployee } from './_utils-B08qkxFa.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-CwZGtUC2.js';

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i <= 0) return null;
  return i;
}

/**
 * After any checklist change, re-compute the parent task's due_date
 * to equal the MAX due_date across all its checklist items.
 * If no checklist item has a due_date, we leave the task's due_date unchanged.
 */
async function syncParentTaskDueDate(taskId) {
  const rows = await sql`
    SELECT MAX(due_date) AS max_due
    FROM workspace_task_checklist_items
    WHERE task_id = ${taskId}
      AND due_date IS NOT NULL
  `;
  const maxDue = rows[0]?.max_due || null;
  if (maxDue) {
    await sql`
      UPDATE workspace_tasks
      SET due_date = ${maxDue}
      WHERE id = ${taskId}
    `;
  }
}

// GET /api/workspace/tasks/:id/checklist?employeeId=...
async function GET(request, {
  params
}) {
  try {
    const taskId = toInt(params.id);
    const url = new URL(request.url);
    const employeeIdRaw = url.searchParams.get("employeeId");
    const auth = await requireWorkspaceEmployee(request, employeeIdRaw);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!taskId) {
      return Response.json({
        error: "taskId غير صحيح"
      }, {
        status: 400
      });
    }
    const items = await sql`
      SELECT 
        ci.id, ci.title, ci.is_completed, ci.sort_order,
        ci.completed_by_employee_id, ci.completed_at, ci.created_at,
        ci.assignee_employee_id, ci.due_date,
        COALESCE(NULLIF(emp.display_name, ''), emp.name) as completed_by_name,
        COALESCE(NULLIF(assignee.display_name, ''), assignee.name) as assignee_name
      FROM workspace_task_checklist_items ci
      LEFT JOIN employees emp ON emp.id = ci.completed_by_employee_id
      LEFT JOIN employees assignee ON assignee.id = ci.assignee_employee_id
      WHERE ci.task_id = ${taskId}
      ORDER BY ci.sort_order ASC, ci.id ASC
    `;
    return Response.json({
      items
    });
  } catch (error) {
    console.error("checklist GET error:", error);
    return Response.json({
      error: "فشل تحميل القائمة"
    }, {
      status: 500
    });
  }
}

// POST /api/workspace/tasks/:id/checklist
// body: { employeeId, title, assignee_employee_id?, due_date? }
async function POST(request, {
  params
}) {
  try {
    const taskId = toInt(params.id);
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const title = String(body.title || "").trim();
    const assigneeEmployeeId = toInt(body.assignee_employee_id);
    const dueDate = body.due_date || null;
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!taskId) {
      return Response.json({
        error: "taskId غير صحيح"
      }, {
        status: 400
      });
    }
    if (!title) {
      return Response.json({
        error: "عنوان العنصر مطلوب"
      }, {
        status: 400
      });
    }

    // Get max sort_order
    const maxRows = await sql`
      SELECT COALESCE(MAX(sort_order), -1) as max_order
      FROM workspace_task_checklist_items
      WHERE task_id = ${taskId}
    `;
    const nextOrder = (maxRows[0]?.max_order ?? -1) + 1;
    const [item] = await sql`
      INSERT INTO workspace_task_checklist_items (task_id, title, sort_order, assignee_employee_id, due_date)
      VALUES (${taskId}, ${title}, ${nextOrder}, ${assigneeEmployeeId}, ${dueDate})
      RETURNING *
    `;

    // Sync parent task due_date
    if (dueDate) {
      await syncParentTaskDueDate(taskId);
    }
    return Response.json({
      item
    }, {
      status: 201
    });
  } catch (error) {
    console.error("checklist POST error:", error);
    return Response.json({
      error: "فشل إضافة العنصر"
    }, {
      status: 500
    });
  }
}

// PATCH /api/workspace/tasks/:id/checklist
// body: { employeeId, itemId, is_completed?, title?, assignee_employee_id?, due_date? }
async function PATCH(request, {
  params
}) {
  try {
    const taskId = toInt(params.id);
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const itemId = toInt(body.itemId);
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!taskId || !itemId) {
      return Response.json({
        error: "بيانات غير صحيحة"
      }, {
        status: 400
      });
    }
    const fields = [];
    const values = [];
    let idx = 1;
    let dueDateChanged = false;
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) {
        return Response.json({
          error: "عنوان العنصر مطلوب"
        }, {
          status: 400
        });
      }
      fields.push(`title = $${idx}`);
      values.push(title);
      idx++;
    }
    if (body.is_completed !== undefined) {
      const completed = !!body.is_completed;
      fields.push(`is_completed = $${idx}`);
      values.push(completed);
      idx++;
      if (completed) {
        fields.push(`completed_by_employee_id = $${idx}`);
        values.push(employeeId);
        idx++;
        fields.push(`completed_at = NOW()`);
      } else {
        fields.push(`completed_by_employee_id = NULL`);
        fields.push(`completed_at = NULL`);
      }
    }
    if (body.assignee_employee_id !== undefined) {
      const assigneeId = toInt(body.assignee_employee_id);
      fields.push(`assignee_employee_id = $${idx}`);
      values.push(assigneeId);
      idx++;
    }
    if (body.due_date !== undefined) {
      const dueDateVal = body.due_date || null;
      fields.push(`due_date = $${idx}`);
      values.push(dueDateVal);
      idx++;
      dueDateChanged = true;
    }
    if (fields.length === 0) {
      return Response.json({
        error: "لا يوجد تعديلات"
      }, {
        status: 400
      });
    }
    values.push(itemId);
    values.push(taskId);
    const query = `
      UPDATE workspace_task_checklist_items
      SET ${fields.join(", ")}
      WHERE id = $${idx} AND task_id = $${idx + 1}
      RETURNING *
    `;
    const rows = await sql(query, values);
    if (!rows.length) {
      return Response.json({
        error: "العنصر غير موجود"
      }, {
        status: 404
      });
    }

    // Sync parent task due_date if due_date changed
    if (dueDateChanged) {
      await syncParentTaskDueDate(taskId);
    }
    return Response.json({
      item: rows[0]
    });
  } catch (error) {
    console.error("checklist PATCH error:", error);
    return Response.json({
      error: "فشل تعديل العنصر"
    }, {
      status: 500
    });
  }
}

// DELETE /api/workspace/tasks/:id/checklist
// body: { employeeId, itemId }
async function DELETE(request, {
  params
}) {
  try {
    const taskId = toInt(params.id);
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const itemId = toInt(body.itemId);
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!taskId || !itemId) {
      return Response.json({
        error: "بيانات غير صحيحة"
      }, {
        status: 400
      });
    }

    // Check if the deleted item had a due_date so we know to re-sync
    const deletedRows = await sql`
      DELETE FROM workspace_task_checklist_items
      WHERE id = ${itemId} AND task_id = ${taskId}
      RETURNING due_date
    `;
    const hadDueDate = deletedRows.length > 0 && deletedRows[0].due_date;

    // Sync parent task due_date if the deleted item had a due_date
    if (hadDueDate) {
      await syncParentTaskDueDate(taskId);
    }
    return Response.json({
      success: true
    });
  } catch (error) {
    console.error("checklist DELETE error:", error);
    return Response.json({
      error: "فشل حذف العنصر"
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, PATCH, POST };
