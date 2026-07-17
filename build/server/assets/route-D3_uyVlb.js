import { s as sql } from './sql-BfhTxwII.js';
import { r as requireCronSecret } from './cronAuth-B_fASQ0w.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-Ba9mYj5Z.js';
import { n as notifyAssigneesOnTaskWhatsApp, f as formatTaskLine, a as formatDateOnly, b as buildTaskLinkLine } from './_notify-DTWosVL6.js';
import '@neondatabase/serverless';
import 'node:crypto';
import './wasender-Dikp1ve9.js';
import './dateUtils-DCPDkvv9.js';

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

// Delay helper to avoid WasenderAPI rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function fetchEmployeeNameMap(employeeIds) {
  const ids = Array.from(new Set((employeeIds || []).map(toInt).filter(Boolean)));
  if (ids.length === 0) return new Map();
  const vals = [];
  const placeholders = [];
  let i = 1;
  for (const id of ids) {
    placeholders.push(`$${i}`);
    vals.push(id);
    i += 1;
  }
  await ensureEmployeeDisplayNameSchema();
  const rows = await sql(`SELECT id, COALESCE(NULLIF(display_name, ''), name) AS name FROM employees WHERE id IN (${placeholders.join(",")})`, vals);
  return new Map(rows.map(r => [r.id, r.name]));
}
function assigneesTextFromIds(ids, nameMap) {
  const safe = Array.isArray(ids) ? ids : [];
  const names = safe.map(id => toInt(id)).filter(Boolean).map(id => nameMap.get(id) || `#${id}`);
  return names.length ? names.join("، ") : "—";
}
function spaceName(value) {
  const s = String(value || "").trim();
  return s ? s : "بدون مساحة";
}
function buildDueTomorrowMessage(task, assigneesText) {
  const lines = ["تذكير: باقي يوم واحد على الاستحقاق", formatTaskLine("العنوان", task.title)];
  if (task.parent_title) {
    lines.push(formatTaskLine("المهمة الرئيسية", task.parent_title));
  }
  lines.push(formatTaskLine("المساحة", spaceName(task.space_name)), formatTaskLine("الحالة", task.status), formatTaskLine("الأولوية", task.priority), formatTaskLine("الاستحقاق", task.due_date ? formatDateOnly(task.due_date) : "—"), formatTaskLine("المكلّف", assigneesText), formatTaskLine("رقم المهمة", `#${task.id}`), "سيتم إرسال تذكير كل 4 ساعات حتى يوم الاستحقاق.");
  return `${lines.join("\n")}${buildTaskLinkLine(task.id)}`.trim();
}
function buildDueTodayMessage(task, assigneesText) {
  const lines = ["تذكير عاجل: استحقاق المهمة اليوم", "ملاحظة: هذه المهمة ضمن قائمة (استحقاق اليوم).", "الرجاء سرعة تنفيذ المهمة.", formatTaskLine("العنوان", task.title)];
  if (task.parent_title) {
    lines.push(formatTaskLine("المهمة الرئيسية", task.parent_title));
  }
  lines.push(formatTaskLine("المساحة", spaceName(task.space_name)), formatTaskLine("الحالة", task.status), formatTaskLine("الأولوية", task.priority), formatTaskLine("الاستحقاق", task.due_date ? formatDateOnly(task.due_date) : "—"), formatTaskLine("المكلّف", assigneesText), formatTaskLine("رقم المهمة", `#${task.id}`), "سيتم إرسال تذكير كل 4 ساعات حتى نهاية اليوم.", "إذا لم يتم تنفيذها سيتم تسجيلها متأخرة وإرسال تنبيه الخصم.");
  return `${lines.join("\n")}${buildTaskLinkLine(task.id)}`.trim();
}
function buildOverdueMessage(task, assigneesText) {
  const lines = ["تنبيه: تم تسجيل المهمة متأخرة", formatTaskLine("العنوان", task.title)];
  if (task.parent_title) {
    lines.push(formatTaskLine("المهمة الرئيسية", task.parent_title));
  }
  lines.push(formatTaskLine("المساحة", spaceName(task.space_name)), formatTaskLine("الحالة", task.status), formatTaskLine("الاستحقاق", task.due_date ? formatDateOnly(task.due_date) : "—"), formatTaskLine("المكلّف", assigneesText), formatTaskLine("رقم المهمة", `#${task.id}`), "تم تسجيل المهمة كمتأخرة وسيتم خصم من الراتب.");
  return `${lines.join("\n")}${buildTaskLinkLine(task.id)}`.trim();
}

// POST /api/workspace/reminders
// Runs WhatsApp reminders (Riyadh time):
// - Due soon: due tomorrow ("باقي يوم واحد") OR due today ("استحقاق اليوم"), every 4 hours
// - Overdue: once when a task becomes overdue (next day after due_date)
async function POST(request) {
  const auth = requireCronSecret(request, "WORKSPACE_CRON_SECRET");
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    // 1) Mark newly overdue tasks once (for consistency) + add history event
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

    // 2) Load tasks that are due today or tomorrow (Riyadh) and throttle every 4 hours
    const dueSoonTasks = await sql`
      WITH vars AS (
        SELECT
          (NOW() AT TIME ZONE 'Asia/Riyadh')::date AS today,
          ((NOW() AT TIME ZONE 'Asia/Riyadh')::date + 1) AS tomorrow
      ),
      ta AS (
        SELECT task_id, employee_id FROM workspace_task_assignees
        UNION
        SELECT id as task_id, assignee_employee_id as employee_id
        FROM workspace_tasks
        WHERE assignee_employee_id IS NOT NULL
      )
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        COALESCE(s.name, '') as space_name,
        pt.title as parent_title,
        COALESCE(array_remove(array_agg(DISTINCT ta.employee_id), NULL), '{}') as assignee_ids,
        (t.due_date = (SELECT today FROM vars)) as is_due_today
      FROM workspace_tasks t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      LEFT JOIN workspace_tasks pt ON pt.id = t.parent_task_id
      LEFT JOIN ta ON ta.task_id = t.id
      WHERE t.due_date IS NOT NULL
        AND t.status <> 'Done'
        AND (
          t.due_date = (SELECT today FROM vars)
          OR t.due_date = (SELECT tomorrow FROM vars)
        )
        AND (
          t.due_soon_last_notified_at IS NULL
          OR (NOW() - t.due_soon_last_notified_at) >= INTERVAL '4 hours'
          -- If the task becomes "due today" (new Riyadh day), send immediately even if the last reminder was <4h ago (sent yesterday).
          OR (
            t.due_date = (SELECT today FROM vars)
            AND (
              (t.due_soon_last_notified_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Riyadh')::date < (SELECT today FROM vars)
            )
          )
        )
      GROUP BY t.id, s.name, pt.title
      ORDER BY t.due_date ASC, t.id DESC
      LIMIT 200
    `;
    const dueSoonAssigneeIds = [];
    for (const t of dueSoonTasks) {
      const ids = Array.isArray(t.assignee_ids) ? t.assignee_ids : [];
      for (const id of ids) dueSoonAssigneeIds.push(id);
    }
    const nameMap = await fetchEmployeeNameMap(dueSoonAssigneeIds);
    const dueSoonSentTaskIds = [];
    for (const t of dueSoonTasks) {
      const assigneesText = assigneesTextFromIds(t.assignee_ids, nameMap);
      const message = t.is_due_today ? buildDueTodayMessage(t, assigneesText) : buildDueTomorrowMessage(t, assigneesText);
      const res = await notifyAssigneesOnTaskWhatsApp({
        taskId: t.id,
        assigneeEmployeeIds: t.assignee_ids,
        excludeEmployeeId: null,
        message
      });
      const attempted = Array.isArray(res?.results) && res.results.length > 0;
      const anyOk = attempted && res.results.some(r => r.ok);
      if (anyOk) {
        dueSoonSentTaskIds.push(t.id);
      }

      // Rate-limit: wait 4 seconds between sends to avoid WasenderAPI throttling
      if (dueSoonTasks.indexOf(t) < dueSoonTasks.length - 1) {
        await delay(4000);
      }
    }
    if (dueSoonSentTaskIds.length > 0) {
      await sql("UPDATE workspace_tasks SET due_soon_started_at = COALESCE(due_soon_started_at, NOW()), due_soon_last_notified_at = NOW() WHERE id = ANY($1::int[])", [dueSoonSentTaskIds]);
    }

    // 3) Send overdue notifications once
    const overdueTasks = await sql`
      WITH ta AS (
        SELECT task_id, employee_id FROM workspace_task_assignees
        UNION
        SELECT id as task_id, assignee_employee_id as employee_id
        FROM workspace_tasks
        WHERE assignee_employee_id IS NOT NULL
      )
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        COALESCE(s.name, '') as space_name,
        pt.title as parent_title,
        COALESCE(array_remove(array_agg(DISTINCT ta.employee_id), NULL), '{}') as assignee_ids
      FROM workspace_tasks t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      LEFT JOIN workspace_tasks pt ON pt.id = t.parent_task_id
      LEFT JOIN ta ON ta.task_id = t.id
      WHERE t.was_overdue = true
        AND t.overdue_notified_at IS NULL
        AND t.due_date IS NOT NULL
      GROUP BY t.id, s.name, pt.title
      ORDER BY COALESCE(t.first_overdue_at, t.created_at) DESC, t.id DESC
      LIMIT 200
    `;
    const overdueAssigneeIds = [];
    for (const t of overdueTasks) {
      const ids = Array.isArray(t.assignee_ids) ? t.assignee_ids : [];
      for (const id of ids) overdueAssigneeIds.push(id);
    }
    const overdueNameMap = await fetchEmployeeNameMap(overdueAssigneeIds);
    const overdueSentTaskIds = [];
    for (const t of overdueTasks) {
      const assigneesText = assigneesTextFromIds(t.assignee_ids, overdueNameMap);
      const message = buildOverdueMessage(t, assigneesText);
      const res = await notifyAssigneesOnTaskWhatsApp({
        taskId: t.id,
        assigneeEmployeeIds: t.assignee_ids,
        excludeEmployeeId: null,
        message
      });
      const attempted = Array.isArray(res?.results) && res.results.length > 0;
      const anyOk = attempted && res.results.some(r => r.ok);
      if (anyOk) {
        overdueSentTaskIds.push(t.id);
      }

      // Rate-limit: wait 4 seconds between sends to avoid WasenderAPI throttling
      if (overdueTasks.indexOf(t) < overdueTasks.length - 1) {
        await delay(4000);
      }
    }
    if (overdueSentTaskIds.length > 0) {
      await sql("UPDATE workspace_tasks SET overdue_notified_at = NOW() WHERE id = ANY($1::int[])", [overdueSentTaskIds]);
    }
    return Response.json({
      ok: true,
      dueSoon: {
        candidates: dueSoonTasks.length,
        sent: dueSoonSentTaskIds.length
      },
      overdue: {
        candidates: overdueTasks.length,
        sent: overdueSentTaskIds.length
      }
    });
  } catch (error) {
    console.error("workspace reminders POST error:", error);
    return Response.json({
      ok: false,
      error: "فشل تشغيل التذكيرات"
    }, {
      status: 500
    });
  }
}

export { POST };
