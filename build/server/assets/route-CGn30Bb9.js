import { s as sql } from './sql-BfhTxwII.js';
import { r as requireWorkspaceEmployee } from './_utils-CbLHH82L.js';
import { g as getSpaceName, c as getEmployeeNames, f as formatTaskLine, a as formatDateOnly, b as buildTaskLinkLine, n as notifyAssigneesOnTaskWhatsApp } from './_notify-D9jvNXSH.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-Ba9mYj5Z.js';
import './wasender-CtjKFWCW.js';
import './dateUtils-DCPDkvv9.js';

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i <= 0) return null;
  return i;
}

// GET /api/workspace/tasks/:id/subtasks?employeeId=...
// Returns subtasks of the given parent task
async function GET(request, {
  params
}) {
  try {
    const parentId = toInt(params.id);
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
    if (!parentId) {
      return Response.json({
        error: "parentId غير صحيح"
      }, {
        status: 400
      });
    }
    const subtasks = await sql(`SELECT
        t.id, t.title, t.status, t.priority, t.due_date, t.space_id,
        t.parent_task_id, t.created_at, t.completed_at,
        COALESCE(s.name, '') as space_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', a.id, 'name', COALESCE(NULLIF(a.display_name, ''), a.name))
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
      WHERE t.parent_task_id = $1
        AND (t.tags IS NULL OR NOT ('__system_deleted__' = ANY(t.tags)))
      GROUP BY t.id, s.name
      ORDER BY
        CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END,
        t.id DESC`, [parentId]);
    return Response.json({
      subtasks
    });
  } catch (error) {
    console.error("subtasks GET error:", error);
    return Response.json({
      error: "فشل تحميل المهام الفرعية"
    }, {
      status: 500
    });
  }
}

// POST /api/workspace/tasks/:id/subtasks
// body: { employeeId, title, priority?, dueDate?, assigneeEmployeeIds? }
// Creates a new task as a subtask of the given parent task, inheriting space from parent
async function POST(request, {
  params
}) {
  try {
    const parentId = toInt(params.id);
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const title = String(body.title || "").trim();
    const priority = body.priority || "Normal";
    const dueDate = body.dueDate || null;
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!parentId) {
      return Response.json({
        error: "parentId غير صحيح"
      }, {
        status: 400
      });
    }
    if (!title) {
      return Response.json({
        error: "عنوان المهمة الفرعية مطلوب"
      }, {
        status: 400
      });
    }

    // Fetch parent task to inherit space_id and due_date
    const parentRows = await sql`SELECT id, space_id, due_date, title FROM workspace_tasks WHERE id = ${parentId}`;
    const parent = parentRows[0];
    if (!parent) {
      return Response.json({
        error: "المهمة الرئيسية غير موجودة"
      }, {
        status: 404
      });
    }
    const spaceId = parent.space_id || null;
    const subtaskDueDate = dueDate || null;
    const actorName = auth.employee?.name || null;
    const assigneeIds = [];
    const rawIds = Array.isArray(body.assigneeEmployeeIds) ? body.assigneeEmployeeIds : [];
    for (const v of rawIds) {
      const id = toInt(v);
      if (id) assigneeIds.push(id);
    }
    // Default: assign to creator
    if (assigneeIds.length === 0) {
      assigneeIds.push(employeeId);
    }
    const [task] = await sql(`INSERT INTO workspace_tasks (
        parent_task_id, space_id, title, status, priority, due_date,
        assignee_employee_id, created_by_employee_id, created_by_employee_name
      ) VALUES ($1, $2, $3, 'Todo', $4, $5, NULL, $6, $7)
      RETURNING *`, [parentId, spaceId, title, priority, subtaskDueDate, employeeId, actorName]);

    // Insert assignees
    if (task?.id && assigneeIds.length > 0) {
      const insertValues = [];
      const tuples = [];
      let j = 1;
      for (const aid of assigneeIds) {
        tuples.push(`($${j}, $${j + 1})`);
        insertValues.push(task.id, aid);
        j += 2;
      }
      await sql(`INSERT INTO workspace_task_assignees (task_id, employee_id) VALUES ${tuples.join(", ")} ON CONFLICT DO NOTHING`, insertValues);
    }

    // Log event
    if (task?.id) {
      await sql("INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta) VALUES ($1, $2, $3, $4, $5::jsonb)", [task.id, "created", employeeId, "تم إنشاء مهمة فرعية", JSON.stringify({
        parent_task_id: parentId,
        title: task.title
      })]);
    }

    // WhatsApp notify (best-effort, same as main task creation)
    if (task?.id) {
      const spaceName = await getSpaceName(spaceId);
      const assigneeNames = await getEmployeeNames(assigneeIds);
      const assigneesText = assigneeNames.length ? assigneeNames.join("، ") : "—";
      const lines = ["مهمة فرعية جديدة", formatTaskLine("العنوان", task.title), formatTaskLine("المهمة الرئيسية", parent.title || `#${parentId}`), formatTaskLine("المساحة", spaceName), formatTaskLine("الأولوية", task.priority), formatTaskLine("الاستحقاق", task.due_date ? formatDateOnly(task.due_date) : "—"), formatTaskLine("المكلّف", assigneesText), formatTaskLine("أنشأها", actorName), formatTaskLine("رقم المهمة", `#${task.id}`)];
      const message = `${lines.join("\n")}${buildTaskLinkLine(task.id)}`.trim();
      notifyAssigneesOnTaskWhatsApp({
        taskId: task.id,
        assigneeEmployeeIds: assigneeIds,
        excludeEmployeeId: employeeId,
        message
      }).catch(e => console.error("WhatsApp subtask notify error", e));
    }
    return Response.json({
      task
    }, {
      status: 201
    });
  } catch (error) {
    console.error("subtasks POST error:", error);
    return Response.json({
      error: "فشل إنشاء المهمة الفرعية"
    }, {
      status: 500
    });
  }
}

// PATCH /api/workspace/tasks/:id/subtasks
// body: { employeeId, childTaskId }
// Links an existing task as a subtask of the given parent
async function PATCH(request, {
  params
}) {
  try {
    const parentId = toInt(params.id);
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const childTaskId = toInt(body.childTaskId);
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!parentId || !childTaskId) {
      return Response.json({
        error: "بيانات غير صحيحة"
      }, {
        status: 400
      });
    }
    if (parentId === childTaskId) {
      return Response.json({
        error: "لا يمكن ربط المهمة بنفسها"
      }, {
        status: 400
      });
    }

    // Check parent exists
    const parentRows = await sql`SELECT id FROM workspace_tasks WHERE id = ${parentId}`;
    if (!parentRows.length) {
      return Response.json({
        error: "المهمة الرئيسية غير موجودة"
      }, {
        status: 404
      });
    }

    // Check child exists and is not already a parent with subtasks
    const childRows = await sql`SELECT id, parent_task_id FROM workspace_tasks WHERE id = ${childTaskId}`;
    if (!childRows.length) {
      return Response.json({
        error: "المهمة المراد ربطها غير موجودة"
      }, {
        status: 404
      });
    }

    // Prevent circular: child can't be parent of the parent
    const circularCheck = await sql`SELECT id FROM workspace_tasks WHERE parent_task_id = ${childTaskId} LIMIT 1`;
    if (circularCheck.length > 0) {
      return Response.json({
        error: "لا يمكن ربط مهمة لها مهام فرعية كمهمة فرعية"
      }, {
        status: 400
      });
    }

    // Prevent nesting: parent itself can't be a subtask
    const parentRow = parentRows[0];
    // Actually check if the parent is already a subtask
    const parentParentCheck = await sql`SELECT parent_task_id FROM workspace_tasks WHERE id = ${parentId}`;
    if (parentParentCheck[0]?.parent_task_id) {
      return Response.json({
        error: "لا يمكن إضافة مهمة فرعية لمهمة فرعية"
      }, {
        status: 400
      });
    }

    // Link
    await sql`UPDATE workspace_tasks SET parent_task_id = ${parentId} WHERE id = ${childTaskId}`;
    return Response.json({
      success: true
    });
  } catch (error) {
    console.error("subtasks PATCH error:", error);
    return Response.json({
      error: "فشل ربط المهمة الفرعية"
    }, {
      status: 500
    });
  }
}

// DELETE /api/workspace/tasks/:id/subtasks
// body: { employeeId, childTaskId }
// Unlinks a subtask (does NOT delete it, just removes parent_task_id)
async function DELETE(request, {
  params
}) {
  try {
    const parentId = toInt(params.id);
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const childTaskId = toInt(body.childTaskId);
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!parentId || !childTaskId) {
      return Response.json({
        error: "بيانات غير صحيحة"
      }, {
        status: 400
      });
    }
    await sql`UPDATE workspace_tasks SET parent_task_id = NULL WHERE id = ${childTaskId} AND parent_task_id = ${parentId}`;
    return Response.json({
      success: true
    });
  } catch (error) {
    console.error("subtasks DELETE error:", error);
    return Response.json({
      error: "فشل إلغاء ربط المهمة الفرعية"
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, PATCH, POST };
