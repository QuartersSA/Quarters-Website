import { s as sql } from './sql-BfhTxwII.js';
import { r as requireWorkspaceEmployee } from './_utils-CbLHH82L.js';
import { g as getSpaceName, c as getEmployeeNames, f as formatTaskLine, b as buildTaskLinkLine, n as notifyAssigneesOnTaskWhatsApp, d as notifyTaskCreatorOnTaskWhatsApp, a as formatDateOnly } from './_notify-2pRP5009.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-Ba9mYj5Z.js';
import './wasender-D2lmIJ7B.js';
import './dateUtils-DCPDkvv9.js';

// NEW: attachments limits
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 60 * 1024 * 1024;
function toInt(value) {
  // Treat empty values as null (important for nullable FK fields like space_id)
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  const i = Math.trunc(n);
  // IDs in this app are positive integers; avoid accidentally turning null into 0
  if (i <= 0) {
    return null;
  }
  return i;
}
function normalizeAssigneeIds(input) {
  const arr = Array.isArray(input) ? input : [];
  const set = new Set();
  for (const v of arr) {
    const id = toInt(v);
    if (id) set.add(id);
  }
  return Array.from(set);
}
function normalizeTags(input) {
  if (input === null) return null;
  if (input === undefined) return undefined;
  if (Array.isArray(input)) {
    const cleaned = input.map(t => String(t || "").trim()).filter(Boolean).slice(0, 20);
    return cleaned.length ? cleaned : null;
  }
  const s = String(input || "").trim();
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
  const seen = new Set();
  const deduped = [];
  for (const a of out) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    deduped.push(a);
  }
  return deduped;
}
function normalizeComparable(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}
function same(a, b) {
  const aa = normalizeComparable(a);
  const bb = normalizeComparable(b);
  return JSON.stringify(aa) === JSON.stringify(bb);
}
function buildDiff(before, after) {
  const diff = {};

  // Regular field diffs
  const keys = ["title", "description", "status", "priority", "due_date", "space_id", "image_url", "image_name"];
  for (const k of keys) {
    if (!same(before?.[k], after?.[k])) {
      diff[k] = {
        from: before?.[k] ?? null,
        to: after?.[k] ?? null
      };
    }
  }

  // Tags diff (hide system tags)
  const beforeTags = sanitizeTagsForUi(before?.tags);
  const afterTags = sanitizeTagsForUi(after?.tags);
  if (!same(beforeTags, afterTags)) {
    diff.tags = {
      from: beforeTags,
      to: afterTags
    };
  }

  // Closed-not-completed flag diff
  const beforeClosed = isClosedNotCompleted(before?.tags);
  const afterClosed = isClosedNotCompleted(after?.tags);
  if (!same(beforeClosed, afterClosed)) {
    diff.closed_not_completed = {
      from: beforeClosed,
      to: afterClosed
    };
  }
  return diff;
}
function summaryFromDiff(diff) {
  if (diff.closed_not_completed) {
    return diff.closed_not_completed.to ? "تم إغلاق المهمة لعدم إتمامها" : "تم إلغاء إغلاق المهمة";
  }
  if (diff.status && diff.status.to === "Done") {
    return "تم إكمال المهمة";
  }
  if (diff.image_url || diff.image_name) {
    const hasAttachment = diff.image_url && diff.image_url.to || false;
    return hasAttachment ? "تم إرفاق مرفق" : "تم إزالة المرفق";
  }
  if (diff.status) {
    return "تم تغيير حالة المهمة";
  }
  if (diff.due_date) {
    return "تم تعديل تاريخ الاستحقاق";
  }
  if (diff.priority) {
    return "تم تعديل أولوية المهمة";
  }
  if (diff.title) {
    return "تم تعديل عنوان المهمة";
  }
  return "تم تحديث المهمة";
}
function sanitizeTagsForUi(tags) {
  const arr = Array.isArray(tags) ? tags : [];
  return arr.filter(t => String(t) !== SYSTEM_DELETED_TAG && String(t) !== SYSTEM_CLOSED_TAG);
}
function isClosedNotCompleted(tags) {
  const arr = Array.isArray(tags) ? tags : [];
  return arr.includes(SYSTEM_CLOSED_TAG);
}
async function getAssigneeIds(txn, taskId) {
  const rows = await txn`
    SELECT employee_id
    FROM workspace_task_assignees
    WHERE task_id = ${taskId}
    ORDER BY employee_id ASC
  `;
  return rows.map(r => r.employee_id).filter(Boolean);
}
const SYSTEM_DELETED_TAG = "__system_deleted__";
const SYSTEM_CLOSED_TAG = "__closed_not_completed__";
function withTimeout(promise, ms) {
  let timeoutId = null;
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve({
      ok: true,
      skipped: true,
      reason: "timeout"
    }), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

// PATCH /api/workspace/tasks/:id
// body: { employeeId, title?, description?, status?, priority?, dueDate?, tags?, assigneeEmployeeIds?, spaceId?, imageUrl?, imageMimeType?, closeNotCompleted? }
async function PATCH(request, {
  params
}) {
  try {
    const id = toInt(params.id);
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
    if (!id) {
      return Response.json({
        error: "id غير صحيح"
      }, {
        status: 400
      });
    }

    // Fetch before state
    const beforeRows = await sql`
      SELECT *
      FROM workspace_tasks
      WHERE id = ${id}
    `;
    const beforeTask = beforeRows[0];
    if (!beforeTask) {
      return Response.json({
        error: "المهمة غير موجودة"
      }, {
        status: 404
      });
    }
    const beforeAssignees = await getAssigneeIds(sql, id);
    const beforeIsSoftDeleted = Array.isArray(beforeTask.tags) && beforeTask.tags.includes(SYSTEM_DELETED_TAG);
    const closeNotCompletedProvided = body.closeNotCompleted !== undefined;
    const closeNotCompleted = body.closeNotCompleted === true;
    const attachmentsProvided = body.attachments !== undefined;
    let attachmentsToWrite = undefined;

    // Update task fields (dynamic)
    const fields = [];
    const values = [];
    let idx = 1;
    if (body.title !== undefined) {
      fields.push(`title = $${idx}`);
      values.push(String(body.title).trim());
      idx += 1;
    }
    if (body.description !== undefined) {
      const desc = String(body.description || "").trim();
      fields.push(`description = $${idx}`);
      values.push(desc ? desc : null);
      idx += 1;
    }

    // Status can be forced by closeNotCompleted
    const hasStatusUpdate = body.status !== undefined || closeNotCompleted;
    if (hasStatusUpdate) {
      const nextStatus = closeNotCompleted ? "Done" : body.status;
      fields.push(`status = $${idx}`);
      values.push(nextStatus);
      idx += 1;
      if (nextStatus === "Done") {
        fields.push(`completed_at = COALESCE(completed_at, NOW())`);
      }
    }
    if (body.priority !== undefined) {
      fields.push(`priority = $${idx}`);
      values.push(body.priority);
      idx += 1;
    }
    if (body.dueDate !== undefined) {
      fields.push(`due_date = $${idx}`);
      values.push(body.dueDate || null);
      idx += 1;
    }

    // Tags update (user tags + system tags)
    let tagsToWrite = undefined;
    if (body.tags !== undefined) {
      tagsToWrite = normalizeTags(body.tags);
    }
    if (closeNotCompletedProvided) {
      // If user did not send tags, start from existing tags.
      if (tagsToWrite === undefined) {
        tagsToWrite = Array.isArray(beforeTask.tags) ? [...beforeTask.tags] : [];
      }

      // Normalize null -> [] so we can manipulate.
      const baseArr = Array.isArray(tagsToWrite) ? [...tagsToWrite] : [];
      const withoutClosed = baseArr.filter(t => String(t) !== SYSTEM_CLOSED_TAG);
      const nextArr = closeNotCompleted ? [...withoutClosed, SYSTEM_CLOSED_TAG] : withoutClosed;
      tagsToWrite = nextArr;
    }
    if (tagsToWrite !== undefined) {
      let tagsArr = Array.isArray(tagsToWrite) ? [...tagsToWrite] : [];

      // If the task was soft-deleted, never allow removing that tag.
      if (beforeIsSoftDeleted) {
        if (!tagsArr.includes(SYSTEM_DELETED_TAG)) {
          tagsArr.push(SYSTEM_DELETED_TAG);
        }
      }

      // Ensure closed tag is applied/removed as requested
      if (closeNotCompletedProvided) {
        tagsArr = tagsArr.filter(t => String(t) !== SYSTEM_CLOSED_TAG);
        if (closeNotCompleted) {
          tagsArr.push(SYSTEM_CLOSED_TAG);
        }
      }
      const cleaned = tagsArr.map(t => String(t)).filter(Boolean).slice(0, 40);
      const finalTags = cleaned.length ? cleaned : null;
      fields.push(`tags = $${idx}`);
      values.push(finalTags);
      idx += 1;
    }
    if (body.spaceId !== undefined) {
      fields.push(`space_id = $${idx}`);
      values.push(toInt(body.spaceId));
      idx += 1;
    }

    // NEW: multi attachments override legacy single attachment fields
    if (attachmentsProvided) {
      try {
        attachmentsToWrite = normalizeAttachments(body.attachments);
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
      const first = attachmentsToWrite[0] || null;
      const nextUrl = first?.url || null;
      const nextMime = first?.mimeType || null;
      const nextName = first?.name || null;
      fields.push(`image_url = $${idx}`);
      values.push(nextUrl);
      idx += 1;
      fields.push(`image_mime_type = $${idx}`);
      values.push(nextMime);
      idx += 1;
      fields.push(`image_name = $${idx}`);
      values.push(nextName);
      idx += 1;
    }

    // Backward-compat: single attachment fields (only if multi attachments not provided)
    if (!attachmentsProvided && body.imageUrl !== undefined) {
      const imageUrlRaw = body.imageUrl;
      const imageMimeTypeRaw = body.imageMimeType;
      const imageNameRaw = body.imageName;
      const imageUrl = imageUrlRaw === null || imageUrlRaw === undefined ? null : String(imageUrlRaw).trim() || null;
      const imageMimeType = imageMimeTypeRaw === null || imageMimeTypeRaw === undefined ? null : String(imageMimeTypeRaw).trim() || null;
      const imageName = imageNameRaw === null || imageNameRaw === undefined ? null : String(imageNameRaw).trim() || null;

      // NOTE: we now allow attaching ANY file type (pdf/excel/images/etc)

      fields.push(`image_url = $${idx}`);
      values.push(imageUrl);
      idx += 1;
      fields.push(`image_mime_type = $${idx}`);
      values.push(imageMimeType);
      idx += 1;
      fields.push(`image_name = $${idx}`);
      values.push(imageName);
      idx += 1;

      // If using legacy, also write to attachments table so the UI stays consistent
      if (imageUrl) {
        attachmentsToWrite = [{
          url: imageUrl,
          mimeType: imageMimeType,
          name: imageName,
          sizeBytes: null
        }];
      } else {
        attachmentsToWrite = [];
      }
    }
    if (fields.length > 0) {
      values.push(id);
      const updateQuery = `UPDATE workspace_tasks SET ${fields.join(", ")} WHERE id = $${idx}`;
      await sql(updateQuery, values);
    }

    // Update assignees
    if (body.assigneeEmployeeIds !== undefined) {
      const assigneeIds = normalizeAssigneeIds(body.assigneeEmployeeIds);
      await sql`UPDATE workspace_tasks SET assignee_employee_id = NULL WHERE id = ${id}`;
      await sql`DELETE FROM workspace_task_assignees WHERE task_id = ${id}`;
      if (assigneeIds.length > 0) {
        const insertValues = [];
        const tuples = [];
        let j = 1;
        for (const aid of assigneeIds) {
          tuples.push(`($${j}, $${j + 1})`);
          insertValues.push(id, aid);
          j += 2;
        }
        const insertQuery = `
          INSERT INTO workspace_task_assignees (task_id, employee_id)
          VALUES ${tuples.join(", ")}
          ON CONFLICT DO NOTHING
        `;
        await sql(insertQuery, insertValues);
      }
    }

    // NEW: persist attachments if provided
    if (attachmentsToWrite !== undefined) {
      await sql`DELETE FROM workspace_attachments WHERE task_id = ${id}`;
      if (attachmentsToWrite.length > 0) {
        const insertValues = [];
        const tuples = [];
        let j = 1;
        for (const a of attachmentsToWrite) {
          tuples.push(`($${j}, $${j + 1}, $${j + 2}, $${j + 3}, $${j + 4}, $${j + 5})`);
          insertValues.push(id, a.url, a.mimeType, a.name, a.sizeBytes, employeeId);
          j += 6;
        }
        await sql(`
          INSERT INTO workspace_attachments (task_id, url, mime_type, name, size_bytes, created_by_employee_id)
          VALUES ${tuples.join(", ")}
          `, insertValues);
      }
    }

    // One-time overdue mark + overdue event
    // NOTE: Use Riyadh-local date because DB server time is UTC.
    await sql`
      WITH vars AS (
        SELECT (NOW() AT TIME ZONE 'Asia/Riyadh')::date AS today
      ),
      newly AS (
        UPDATE workspace_tasks
        SET was_overdue = true,
            first_overdue_at = COALESCE(first_overdue_at, NOW())
        FROM vars
        WHERE id = ${id}
          AND was_overdue = false
          AND due_date IS NOT NULL
          AND (
            (status <> 'Done' AND due_date < vars.today)
            OR (
              status = 'Done'
              AND completed_at IS NOT NULL
              AND ((completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh')::date > due_date)
            )
          )
        RETURNING id, due_date, status, completed_at
      )
      INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta)
      SELECT
        newly.id,
        'overdue',
        NULL,
        'تم تسجيل المهمة كمتأخرة',
        jsonb_build_object(
          'due_date', newly.due_date,
          'reason', CASE WHEN newly.status = 'Done' THEN 'completed_late' ELSE 'due_date_passed' END,
          'completed_at', newly.completed_at
        )
      FROM newly
    `;

    // Fetch after state
    const afterRows = await sql`
      SELECT *
      FROM workspace_tasks
      WHERE id = ${id}
    `;
    const afterTask = afterRows[0] || beforeTask;
    const afterAssignees = await getAssigneeIds(sql, id);
    const diff = buildDiff(beforeTask, afterTask);
    if (JSON.stringify(beforeAssignees) !== JSON.stringify(afterAssignees)) {
      diff.assignees = {
        from: beforeAssignees,
        to: afterAssignees
      };
    }
    if (Object.keys(diff).length > 0) {
      const summary = summaryFromDiff(diff);
      const meta = {
        diff,
        before: {
          assignee_ids: beforeAssignees
        },
        after: {
          assignee_ids: afterAssignees
        }
      };
      await sql("INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta) VALUES ($1, $2, $3, $4, $5::jsonb)", [id, "updated", employeeId, summary, JSON.stringify(meta)]);

      // WhatsApp notify (best-effort, never blocks task update)
      const actorName = auth.employee?.name || "—";
      const spaceName = await getSpaceName(afterTask?.space_id);
      const assigneeNames = await getEmployeeNames(afterAssignees);
      const assigneesText = assigneeNames.length ? assigneeNames.join("، ") : "—";
      const details = diffDetailsLines(diff);
      const detailsBlock = details.length ? `\nالتفاصيل:\n${details.join("\n")}` : "";
      const lines = ["تحديث مهمة", formatTaskLine("العنوان", afterTask?.title || ""), formatTaskLine("المساحة", spaceName), formatTaskLine("نوع التحديث", summary), formatTaskLine("المكلّف", assigneesText), formatTaskLine("بواسطة", actorName), formatTaskLine("رقم المهمة", `#${id}`)];
      const message = `${lines.join("\n")}${detailsBlock}${buildTaskLinkLine(id)}`.trim();
      const creatorEmployeeId = afterTask?.created_by_employee_id;
      const creatorMessage = message.replace("تحديث مهمة", "تحديث على مهمة أنشأتها");

      // 1) notify assignees (exclude actor + exclude creator to prevent duplicate)
      const assigneesWithoutCreator = Array.isArray(afterAssignees) ? afterAssignees.filter(x => String(x) !== String(creatorEmployeeId)) : [];

      // IMPORTANT: On Anything, un-awaited network requests may be cut off when the request finishes.
      // We await WhatsApp sends with a short timeout so they are reliable, but never block too long.
      await Promise.allSettled([withTimeout(notifyAssigneesOnTaskWhatsApp({
        taskId: id,
        assigneeEmployeeIds: assigneesWithoutCreator,
        excludeEmployeeId: employeeId,
        message
      }), 8000), withTimeout(notifyTaskCreatorOnTaskWhatsApp({
        taskId: id,
        creatorEmployeeId,
        message: creatorMessage
      }), 8000)]);
    }
    return Response.json({
      task: afterTask
    }, {
      status: 200
    });
  } catch (error) {
    console.error("workspace tasks PATCH error:", error);
    const details = process.env.NODE_ENV !== "production" ? String(error?.message || "") : undefined;
    return Response.json(details ? {
      error: "فشل تحديث المهمة",
      details
    } : {
      error: "فشل تحديث المهمة"
    }, {
      status: 500
    });
  }
}
function diffDetailsLines(diff) {
  const lines = [];
  if (diff.status) {
    lines.push(`- الحالة: ${diff.status.from ?? "—"} → ${diff.status.to ?? "—"}`);
  }
  if (diff.priority) {
    lines.push(`- الأولوية: ${diff.priority.from ?? "—"} → ${diff.priority.to ?? "—"}`);
  }
  if (diff.due_date) {
    const from = diff.due_date.from ? formatDateOnly(diff.due_date.from) : "—";
    const to = diff.due_date.to ? formatDateOnly(diff.due_date.to) : "—";
    lines.push(`- الاستحقاق: ${from} → ${to}`);
  }
  if (diff.title) {
    lines.push(`- العنوان: ${diff.title.from ?? "—"} → ${diff.title.to ?? "—"}`);
  }
  if (diff.space_id) {
    lines.push(`- المساحة: ${diff.space_id.from ?? "—"} → ${diff.space_id.to ?? "—"}`);
  }
  if (diff.assignees) {
    const from = Array.isArray(diff.assignees.from) ? diff.assignees.from.join(",") : "—";
    const to = Array.isArray(diff.assignees.to) ? diff.assignees.to.join(",") : "—";
    lines.push(`- المكلّفون (IDs): ${from || "—"} → ${to || "—"}`);
  }
  return lines;
}

// DELETE /api/workspace/tasks/:id
// body: { employeeId }
async function DELETE(request, {
  params
}) {
  try {
    const id = toInt(params.id);
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
    if (!id) {
      return Response.json({
        error: "id غير صحيح"
      }, {
        status: 400
      });
    }

    // Fetch task + assignees snapshot BEFORE "delete" (we will soft-delete)
    const rows = await sql`
      SELECT *
      FROM workspace_tasks
      WHERE id = ${id}
    `;
    const t = rows[0];
    if (!t) {
      return Response.json({
        error: "المهمة غير موجودة"
      }, {
        status: 404
      });
    }
    const assigneeIds = await getAssigneeIds(sql, id);

    // Soft-delete instead of hard delete so overdue history always keeps full task data.
    // - Add a system tag
    // - Mark as Done and set completed_at (so it can be marked "completed late" if needed)
    await sql`
      UPDATE workspace_tasks
      SET
        tags = CASE
          WHEN tags IS NULL THEN ARRAY[${SYSTEM_DELETED_TAG}]::text[]
          WHEN NOT (${SYSTEM_DELETED_TAG} = ANY(tags)) THEN tags || ${SYSTEM_DELETED_TAG}::text
          ELSE tags
        END,
        status = 'Done',
        completed_at = COALESCE(completed_at, NOW())
      WHERE id = ${id}
    `;

    // One-time overdue mark + overdue event (covers "deleted while overdue" and "completed late")
    // NOTE: Use Riyadh-local date because DB server time is UTC.
    await sql`
      WITH vars AS (
        SELECT (NOW() AT TIME ZONE 'Asia/Riyadh')::date AS today
      ),
      newly AS (
        UPDATE workspace_tasks
        SET was_overdue = true,
            first_overdue_at = COALESCE(first_overdue_at, NOW())
        FROM vars
        WHERE id = ${id}
          AND was_overdue = false
          AND due_date IS NOT NULL
          AND (
            (status <> 'Done' AND due_date < vars.today)
            OR (
              status = 'Done'
              AND completed_at IS NOT NULL
              AND ((completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh')::date > due_date)
            )
          )
        RETURNING id, due_date, status, completed_at
      )
      INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta)
      SELECT
        newly.id,
        'overdue',
        NULL,
        'تم تسجيل المهمة كمتأخرة',
        jsonb_build_object(
          'due_date', newly.due_date,
          'reason', CASE WHEN newly.status = 'Done' THEN 'completed_late' ELSE 'due_date_passed' END,
          'completed_at', newly.completed_at
        )
      FROM newly
    `;

    // Write a delete event (snapshot) for audit
    const deleteMeta = {
      snapshot: {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        tags: t.tags,
        space_id: t.space_id,
        image_url: t.image_url,
        image_mime_type: t.image_mime_type,
        image_name: t.image_name,
        created_by_employee_id: t.created_by_employee_id,
        created_at: t.created_at,
        was_overdue: t.was_overdue,
        first_overdue_at: t.first_overdue_at,
        completed_at: t.completed_at,
        assignee_ids: assigneeIds
      },
      soft_deleted: true
    };
    await sql("INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta) VALUES ($1, $2, $3, $4, $5::jsonb)", [id, "deleted", employeeId, "تم حذف المهمة", JSON.stringify(deleteMeta)]);
    return Response.json({
      success: true,
      softDeleted: true
    });
  } catch (error) {
    console.error("workspace tasks DELETE error:", error);
    const details = process.env.NODE_ENV !== "production" ? String(error?.message || "") : undefined;
    return Response.json(details ? {
      error: "فشل حذف المهمة",
      details
    } : {
      error: "فشل حذف المهمة"
    }, {
      status: 500
    });
  }
}

export { DELETE, PATCH };
