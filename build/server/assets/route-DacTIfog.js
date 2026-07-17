import sql from './sql-CSDV1lSC.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-B08qkxFa.js';
import { g as getSpaceName, c as getEmployeeNames, f as formatTaskLine, a as formatDateOnly, b as buildTaskLinkLine, n as notifyAssigneesOnTaskWhatsApp } from './_notify-DbeUWLIe.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-CwZGtUC2.js';
import './wasender-DEtMgWCV.js';
import './dateUtils-DCPDkvv9.js';

const SYSTEM_CLOSED_TAG = "__closed_not_completed__";

// NEW: attachments limits
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 60 * 1024 * 1024;
function toInt(value) {
  // Treat empty values as null (prevents accidentally turning "" into 0)
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  const i = Math.trunc(n);
  // IDs are positive integers in this app
  if (i <= 0) {
    return null;
  }
  return i;
}
function normalizeAssigneeIds(input, fallbackId) {
  const arr = Array.isArray(input) ? input : [];
  const set = new Set();
  for (const v of arr) {
    const id = toInt(v);
    if (id) set.add(id);
  }
  if (set.size === 0 && fallbackId) {
    set.add(fallbackId);
  }
  return Array.from(set);
}
function normalizeTags(input) {
  if (!input) return null;
  if (Array.isArray(input)) {
    const cleaned = input.map(t => String(t || "").trim()).filter(Boolean).slice(0, 20);
    return cleaned.length ? cleaned : null;
  }
  const s = String(input).trim();
  if (!s) return null;
  const cleaned = s.split(",").map(t => t.trim()).filter(Boolean).slice(0, 20);
  return cleaned.length ? cleaned : null;
}
function normalizeAttachments(input) {
  const arr = Array.isArray(input) ? input : [];
  const out = [];
  for (const raw of arr) {
    if (!raw) continue;
    const url = String(raw.url || "").trim();
    if (!url) continue;
    const mimeType = raw.mimeType === null || raw.mimeType === undefined ? null : String(raw.mimeType).trim() || null;
    const name = raw.name === null || raw.name === undefined ? null : String(raw.name).trim() || null;
    let sizeBytes = null;
    if (raw.sizeBytes !== null && raw.sizeBytes !== undefined && raw.sizeBytes !== "") {
      const n = Number(raw.sizeBytes);
      if (Number.isFinite(n) && n >= 0) {
        sizeBytes = Math.trunc(n);
      }
    }
    if (typeof sizeBytes === "number" && sizeBytes > MAX_ATTACHMENT_BYTES) {
      // hard reject (client should prevent this too)
      throw new Error("attachment_too_large");
    }
    out.push({
      url,
      mimeType,
      name,
      sizeBytes
    });
    if (out.length >= MAX_ATTACHMENTS) break;
  }

  // de-dupe by URL
  const seen = new Set();
  const deduped = [];
  for (const a of out) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    deduped.push(a);
  }
  return deduped;
}

// GET /api/workspace/tasks?employeeId=...&scope=my|team&status=...&q=...&spaceId=...
async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeIdRaw = params.get("employeeId");
    const scope = params.get("scope") || "my";
    const status = params.get("status") || "";
    const q = (params.get("q") || "").trim();
    const spaceId = params.get("spaceId");
    const auth = await requireWorkspaceEmployee(request, employeeIdRaw);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const employeeId = toInt(employeeIdRaw);

    // Mark any currently overdue tasks once (so the overdue log is consistent)
    // + write an event to workspace_task_events for any task that becomes overdue now.
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
    const values = [];
    let where = "WHERE 1=1";
    let idx = 1;

    // NEW: hide soft-deleted tasks from all task lists
    // (we keep them in the DB so they can remain in overdue history)
    where += " AND (t.tags IS NULL OR NOT ('__system_deleted__' = ANY(t.tags)))";

    // Filter: scope
    if (scope === "my") {
      where += ` AND EXISTS (
        SELECT 1
        FROM (
          SELECT task_id, employee_id FROM workspace_task_assignees
          UNION
          SELECT id as task_id, assignee_employee_id as employee_id
          FROM workspace_tasks
          WHERE assignee_employee_id IS NOT NULL
        ) ta
        WHERE ta.task_id = t.id AND ta.employee_id = $${idx}
      )`;
      values.push(employeeId);
      idx += 1;
    }

    // Filter: status
    if (status && status !== "all") {
      where += ` AND t.status = $${idx}`;
      values.push(status);
      idx += 1;
    }

    // Filter: spaceId
    const spaceIdInt = toInt(spaceId);
    if (spaceIdInt) {
      where += ` AND t.space_id = $${idx}`;
      values.push(spaceIdInt);
      idx += 1;
    }

    // Filter: q search
    if (q) {
      where += ` AND (
        LOWER(t.title) LIKE LOWER($${idx})
        OR LOWER(COALESCE(t.description, '')) LIKE LOWER($${idx})
      )`;
      values.push(`%${q}%`);
      idx += 1;
    }
    const query = `
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
        t.parent_task_id,
        COALESCE(s.name, '') as space_name,
        t.created_by_employee_id,
        COALESCE(NULLIF(cb.display_name, ''), t.created_by_employee_name, cb.name, '—') as created_by_name,
        t.created_at,
        t.was_overdue,
        t.first_overdue_at,
        t.completed_at,
        COALESCE(att.attachments_count, 0) as attachments_count,
        COALESCE(sub.subtasks_total, 0) as subtasks_total,
        COALESCE(sub.subtasks_done, 0) as subtasks_done,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', a.id,
              'name', COALESCE(NULLIF(a.display_name, ''), a.name),
              'role', a.role
            )
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as assignees
      FROM workspace_tasks t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      LEFT JOIN employees cb ON cb.id = t.created_by_employee_id
      LEFT JOIN (
        SELECT task_id, COUNT(*)::int as attachments_count
        FROM workspace_attachments
        WHERE task_id IS NOT NULL
        GROUP BY task_id
      ) att ON att.task_id = t.id
      LEFT JOIN (
        SELECT parent_task_id,
          COUNT(*)::int as subtasks_total,
          COUNT(*) FILTER (WHERE status = 'Done')::int as subtasks_done
        FROM workspace_tasks
        WHERE parent_task_id IS NOT NULL
          AND (tags IS NULL OR NOT ('__system_deleted__' = ANY(tags)))
        GROUP BY parent_task_id
      ) sub ON sub.parent_task_id = t.id
      LEFT JOIN (
        SELECT task_id, employee_id FROM workspace_task_assignees
        UNION
        SELECT id as task_id, assignee_employee_id as employee_id
        FROM workspace_tasks
        WHERE assignee_employee_id IS NOT NULL
      ) ta ON ta.task_id = t.id
      LEFT JOIN employees a ON a.id = ta.employee_id
      ${where}
      GROUP BY
        t.id,
        s.name,
        cb.name,
        cb.display_name,
        t.created_by_employee_name,
        att.attachments_count,
        sub.subtasks_total,
        sub.subtasks_done
      ORDER BY
        CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END,
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC NULLS LAST,
        t.id DESC
      LIMIT 500
    `;
    const tasks = await sql(query, values);
    return Response.json({
      tasks
    });
  } catch (error) {
    console.error("workspace tasks GET error:", error);
    return Response.json({
      error: "فشل تحميل المهام"
    }, {
      status: 500
    });
  }
}

// POST /api/workspace/tasks
// body: { employeeId, title, description, status, priority, dueDate, assigneeEmployeeIds, tags, spaceId, imageUrl, imageMimeType, imageName, attachments?, closeNotCompleted }
async function POST(request) {
  try {
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const title = (body.title || "").trim();
    const description = (body.description || "").trim() || null;
    const closeNotCompleted = body.closeNotCompleted === true;
    const statusRaw = body.status || "Todo";
    const status = closeNotCompleted ? "Done" : statusRaw;
    const priority = body.priority || "Normal";
    const dueDate = body.dueDate || null;
    const spaceId = toInt(body.spaceId);
    let tags = normalizeTags(body.tags);
    if (closeNotCompleted) {
      if (tags === null) {
        tags = [SYSTEM_CLOSED_TAG];
      } else if (Array.isArray(tags) && !tags.includes(SYSTEM_CLOSED_TAG)) {
        tags = [...tags, SYSTEM_CLOSED_TAG];
      }
    }
    if (!title) {
      return Response.json({
        error: "عنوان المهمة مطلوب"
      }, {
        status: 400
      });
    }

    // NEW: require due date + space when creating a task
    if (!dueDate) {
      return Response.json({
        error: "تاريخ الاستحقاق مطلوب"
      }, {
        status: 400
      });
    }
    if (!spaceId) {
      return Response.json({
        error: "المساحة مطلوبة"
      }, {
        status: 400
      });
    }
    if (spaceId) {
      const [space] = await sql`SELECT id FROM workspace_spaces WHERE id = ${spaceId}`;
      if (!space) {
        return Response.json({
          error: "المساحة غير موجودة"
        }, {
          status: 400
        });
      }
    }
    const requestedAssignees = normalizeAssigneeIds(body.assigneeEmployeeIds, employeeId);

    // Validate assignees without relying on array params (more robust)
    let assigneeEmployeeIds = [employeeId];
    if (requestedAssignees.length > 0) {
      const vals = [];
      const placeholders = [];
      let i = 1;
      for (const id of requestedAssignees) {
        placeholders.push(`$${i}`);
        vals.push(id);
        i += 1;
      }
      const rows = await sql(`SELECT id FROM employees WHERE id IN (${placeholders.join(", ")})`, vals);
      const validIds = rows.map(r => r.id).filter(Boolean);
      if (validIds.length > 0) {
        assigneeEmployeeIds = validIds;
      }
    }

    // NEW: multi attachments (preferred)
    let attachments = [];
    try {
      attachments = normalizeAttachments(body.attachments);
    } catch (e) {
      if (String(e?.message) === "attachment_too_large") {
        return Response.json({
          error: "حجم أحد المرفقات أكبر من المسموح (60MB)"
        }, {
          status: 400
        });
      }
      throw e;
    }

    // Backward-compat: single attachment fields
    const imageUrlRaw = body.imageUrl;
    const imageMimeTypeRaw = body.imageMimeType;
    const imageNameRaw = body.imageName;
    const legacyUrl = imageUrlRaw === null || imageUrlRaw === undefined ? null : String(imageUrlRaw).trim() || null;
    const legacyMimeType = imageMimeTypeRaw === null || imageMimeTypeRaw === undefined ? null : String(imageMimeTypeRaw).trim() || null;
    const legacyName = imageNameRaw === null || imageNameRaw === undefined ? null : String(imageNameRaw).trim() || null;
    if (legacyUrl) {
      const exists = attachments.some(a => a.url === legacyUrl);
      if (!exists) {
        attachments = [{
          url: legacyUrl,
          mimeType: legacyMimeType,
          name: legacyName,
          sizeBytes: null
        }, ...attachments].slice(0, MAX_ATTACHMENTS);
      }
    }
    const first = attachments[0] || null;
    const imageUrl = first?.url || null;
    const imageMimeType = first?.mimeType || null;
    const imageName = first?.name || null;

    // NOTE: we now allow attaching ANY file type (pdf/excel/images/etc)

    const actorNameRaw = auth.employee?.name;
    const actorName = actorNameRaw ? String(actorNameRaw).trim() : null;
    const [task] = await sql(`
      INSERT INTO workspace_tasks (
        space_id,
        title,
        description,
        status,
        priority,
        due_date,
        tags,
        image_url,
        image_mime_type,
        image_name,
        assignee_employee_id,
        created_by_employee_id,
        created_by_employee_name,
        completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12, CASE WHEN $4 = 'Done' THEN NOW() ELSE NULL END)
      RETURNING *
      `, [spaceId || null, title, description, status, priority, dueDate, tags, imageUrl, imageMimeType, imageName, employeeId, actorName]);

    // NEW: persist attachments
    if (task?.id && attachments.length > 0) {
      const insertValues = [];
      const tuples = [];
      let j = 1;
      for (const a of attachments) {
        tuples.push(`($${j}, $${j + 1}, $${j + 2}, $${j + 3}, $${j + 4}, $${j + 5})`);
        insertValues.push(task.id, a.url, a.mimeType, a.name, a.sizeBytes, employeeId);
        j += 6;
      }
      await sql(`
        INSERT INTO workspace_attachments (task_id, url, mime_type, name, size_bytes, created_by_employee_id)
        VALUES ${tuples.join(", ")}
        `, insertValues);
    }
    if (task?.id && assigneeEmployeeIds.length > 0) {
      const insertValues = [];
      const tuples = [];
      let j = 1;
      for (const aid of assigneeEmployeeIds) {
        tuples.push(`($${j}, $${j + 1})`);
        insertValues.push(task.id, aid);
        j += 2;
      }
      await sql(`
        INSERT INTO workspace_task_assignees (task_id, employee_id)
        VALUES ${tuples.join(", ")}
        ON CONFLICT DO NOTHING
        `, insertValues);
    }
    if (task?.id) {
      const meta = {
        title: task.title,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        space_id: task.space_id,
        image_url: task.image_url,
        image_mime_type: task.image_mime_type,
        image_name: task.image_name,
        assignee_ids: assigneeEmployeeIds
      };
      await sql("INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta) VALUES ($1, $2, $3, $4, $5::jsonb)", [task.id, "created", employeeId, "تم إنشاء المهمة", JSON.stringify(meta)]);

      // WhatsApp notify (best-effort, never blocks task creation)
      const spaceName = await getSpaceName(task.space_id);
      const assigneeNames = await getEmployeeNames(assigneeEmployeeIds);
      const assigneesText = assigneeNames.length ? assigneeNames.join("، ") : "—";
      const lines = ["مهمة جديدة", formatTaskLine("العنوان", task.title)];
      if (task.description) {
        lines.push(formatTaskLine("الوصف", task.description));
      }
      lines.push(formatTaskLine("المساحة", spaceName), formatTaskLine("الحالة", task.status), formatTaskLine("الأولوية", task.priority), formatTaskLine("الاستحقاق", task.due_date ? formatDateOnly(task.due_date) : "—"), formatTaskLine("المكلّف", assigneesText), formatTaskLine("أنشأها", actorName), formatTaskLine("رقم المهمة", `#${task.id}`));
      const message = `${lines.join("\n")}${buildTaskLinkLine(task.id)}`.trim();
      notifyAssigneesOnTaskWhatsApp({
        taskId: task.id,
        assigneeEmployeeIds,
        excludeEmployeeId: employeeId,
        message
      }).catch(e => console.error("WhatsApp notify error", e));
    }
    return Response.json({
      task
    }, {
      status: 201
    });
  } catch (error) {
    // ... existing catch, but add friendlier 400 for too many attachments ...
    if (String(error?.message) === "attachment_too_large") {
      return Response.json({
        error: "حجم أحد المرفقات أكبر من المسموح (60MB)"
      }, {
        status: 400
      });
    }
    console.error("workspace tasks POST error:", error);
    const details = process.env.NODE_ENV !== "production" ? String(error?.message || "") : undefined;
    return Response.json(details ? {
      error: "فشل إنشاء المهمة",
      details
    } : {
      error: "فشل إنشاء المهمة"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
