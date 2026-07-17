import sql from './sql-CSDV1lSC.js';
import { g as getSearchParams, r as requireWorkspaceEmployee } from './_utils-B08qkxFa.js';
import { e as getTaskAssigneeEmployeeIds, h as clipText, c as getEmployeeNames, f as formatTaskLine, b as buildTaskLinkLine, n as notifyAssigneesOnTaskWhatsApp, d as notifyTaskCreatorOnTaskWhatsApp } from './_notify-DbeUWLIe.js';
import '@neondatabase/serverless';
import './sessionToken-DDNn6nuk.js';
import 'crypto';
import './employeeDisplayName-CwZGtUC2.js';
import './wasender-DEtMgWCV.js';
import './dateUtils-DCPDkvv9.js';

// NEW: attachments limits
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 60 * 1024 * 1024;
function toInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}
function normalizeText(value) {
  const s = String(value || "").trim();
  return s ? s : "";
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

// GET /api/workspace/tasks/:id/updates?employeeId=...
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
    const updates = await sql`
      SELECT
        u.id,
        u.task_id,
        u.author_employee_id,
        COALESCE(NULLIF(emp.display_name, ''), emp.name, '—') as author_name,
        u.body,
        u.image_url,
        u.image_mime_type,
        u.image_name,
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'id', wa.id,
                'url', wa.url,
                'mimeType', wa.mime_type,
                'name', wa.name,
                'sizeBytes', wa.size_bytes,
                'createdAt', wa.created_at
              )
              ORDER BY wa.created_at DESC, wa.id DESC
            )
            FROM workspace_attachments wa
            WHERE wa.update_id = u.id
          ),
          '[]'::json
        ) as attachments,
        u.created_at
      FROM workspace_task_updates u
      LEFT JOIN employees emp ON emp.id = u.author_employee_id
      WHERE u.task_id = ${taskId}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT 200
    `;

    // Backward-compat: if old update has image_url but no rows in workspace_attachments, expose it as attachments[0]
    const fixed = (updates || []).map(u => {
      const atts = Array.isArray(u.attachments) ? u.attachments : [];
      const hasLegacy = !!u?.image_url;
      if (atts.length === 0 && hasLegacy) {
        return {
          ...u,
          attachments: [{
            id: null,
            url: u.image_url,
            mimeType: u.image_mime_type || null,
            name: u.image_name || null,
            sizeBytes: null,
            createdAt: u.created_at
          }]
        };
      }
      return u;
    });
    return Response.json({
      updates: fixed
    });
  } catch (error) {
    console.error("workspace task updates GET error:", error);
    return Response.json({
      error: "فشل تحميل تحديثات المهمة"
    }, {
      status: 500
    });
  }
}

// POST /api/workspace/tasks/:id/updates
// body: { employeeId, body, attachments?, imageUrl?, imageMimeType?, imageName? }
async function POST(request, {
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

    // Ensure task exists (and isn't missing)
    const [task] = await sql`
      SELECT
        id,
        title,
        created_by_employee_id
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
    const text = normalizeText(body.body);
    if (!text) {
      return Response.json({
        error: "نص التحديث مطلوب"
      }, {
        status: 400
      });
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

    const [update] = await sql(`
      INSERT INTO workspace_task_updates (
        task_id,
        author_employee_id,
        body,
        image_url,
        image_mime_type,
        image_name
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `, [taskId, employeeId, text, imageUrl, imageMimeType, imageName]);

    // NEW: persist attachments
    if (update?.id && attachments.length > 0) {
      const insertValues = [];
      const tuples = [];
      let j = 1;
      for (const a of attachments) {
        tuples.push(`($${j}, $${j + 1}, $${j + 2}, $${j + 3}, $${j + 4}, $${j + 5})`);
        insertValues.push(update.id, a.url, a.mimeType, a.name, a.sizeBytes, employeeId);
        j += 6;
      }
      await sql(`
        INSERT INTO workspace_attachments (update_id, url, mime_type, name, size_bytes, created_by_employee_id)
        VALUES ${tuples.join(", ")}
        `, insertValues);
    }

    // Also write an audit event (so it shows in سجل التغييرات)
    if (update?.id) {
      const meta = {
        update_id: update.id,
        body: update.body,
        image_url: update.image_url,
        image_mime_type: update.image_mime_type,
        image_name: update.image_name
      };
      await sql("INSERT INTO workspace_task_events (task_id, event_type, actor_employee_id, summary, meta) VALUES ($1, $2, $3, $4, $5::jsonb)", [taskId, "updated", employeeId, update.image_url ? "تمت إضافة تحديث مع مرفق" : "تمت إضافة تحديث", JSON.stringify(meta)]);

      // WhatsApp notify (best-effort)
      const actorName = auth.employee?.name || "—";
      const assigneeIds = await getTaskAssigneeEmployeeIds(taskId);
      const clipped = clipText(text, 600);
      const assigneeNames = await getEmployeeNames(assigneeIds);
      const assigneesText = assigneeNames.length ? assigneeNames.join("، ") : "—";
      const lines = ["ملاحظة/تحديث جديد على المهمة", formatTaskLine("العنوان", task.title || ""), formatTaskLine("المكلّف", assigneesText), formatTaskLine("بواسطة", actorName), "الملاحظة:", clipped, formatTaskLine("رقم المهمة", `#${taskId}`)];
      const message = `${lines.join("\n")}${buildTaskLinkLine(taskId)}`.trim();
      const creatorEmployeeId = task?.created_by_employee_id;
      const creatorMessage = message.replace("ملاحظة/تحديث جديد على المهمة", "ملاحظة/تحديث جديد على مهمة أنشأتها");

      // 1) notify assignees (exclude creator to prevent duplicate)
      const assigneesWithoutCreator = Array.isArray(assigneeIds) ? assigneeIds.filter(x => String(x) !== String(creatorEmployeeId)) : [];
      await Promise.allSettled([withTimeout(notifyAssigneesOnTaskWhatsApp({
        taskId,
        assigneeEmployeeIds: assigneesWithoutCreator,
        // ملاحظة: في التحديثات/الملاحظات، نرسل حتى للكاتب نفسه
        // لأن كثير من المستخدمين يتوقعون وصول إشعار “تمت إضافة ملاحظة” كتأكيد.
        excludeEmployeeId: null,
        message
      }), 8000), withTimeout(notifyTaskCreatorOnTaskWhatsApp({
        taskId,
        creatorEmployeeId,
        message: creatorMessage
      }), 8000)]);
    }
    return Response.json({
      update
    }, {
      status: 201
    });
  } catch (error) {
    console.error("workspace task updates POST error:", error);
    const details = process.env.NODE_ENV !== "production" ? String(error?.message || "") : undefined;
    return Response.json(details ? {
      error: "فشل إضافة تحديث للمهمة",
      details
    } : {
      error: "فشل إضافة تحديث للمهمة"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
