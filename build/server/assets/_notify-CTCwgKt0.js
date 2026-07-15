import { s as sql } from './sql-BfhTxwII.js';
import { s as sendWhatsAppViaWasender } from './wasender-4ILI3THM.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-Ba9mYj5Z.js';
import { f as formatRiyadhDateForInput } from './dateUtils-DCPDkvv9.js';

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}
async function getTaskAssigneeEmployeeIds(taskId) {
  const id = toInt(taskId);
  if (!id) return [];
  const rows = await sql`
    SELECT employee_id
    FROM (
      SELECT employee_id
      FROM workspace_task_assignees
      WHERE task_id = ${id}
      UNION
      SELECT assignee_employee_id as employee_id
      FROM workspace_tasks
      WHERE id = ${id} AND assignee_employee_id IS NOT NULL
    ) t
    ORDER BY employee_id ASC
  `;
  return rows.map(r => r.employee_id).filter(Boolean);
}

// NEW: shared helpers for WhatsApp templates
function formatDateOnly(value) {
  if (!value) return "—";
  try {
    // pg may return Date or string
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) {
      const s = String(value);
      return s.length >= 10 ? s.slice(0, 10) : s;
    }
    return formatRiyadhDateForInput(d);
  } catch (e) {
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
}
function buildTaskUrl() {
  if (!process.env.APP_URL) return "";
  return `${process.env.APP_URL}/workspace/tasks`;
}
async function getEmployeesByIds(employeeIds) {
  const ids = Array.from(new Set((employeeIds || []).map(toInt).filter(Boolean)));
  if (ids.length === 0) return [];
  const vals = [];
  const placeholders = [];
  let i = 1;
  for (const id of ids) {
    placeholders.push(`$${i}`);
    vals.push(id);
    i += 1;
  }
  await ensureEmployeeDisplayNameSchema();
  return sql(`SELECT
       id,
       COALESCE(NULLIF(display_name, ''), name) AS name,
       phone
     FROM employees
     WHERE id IN (${placeholders.join(",")})`, vals);
}
async function getEmployeeNames(employeeIds) {
  const rows = await getEmployeesByIds(employeeIds);
  const map = new Map(rows.map(r => [r.id, r.name]));
  return Array.from(new Set((employeeIds || []).map(toInt).filter(Boolean))).map(id => map.get(id) || `#${id}`);
}
async function getSpaceName(spaceId) {
  const id = toInt(spaceId);
  if (!id) return "بدون مساحة";
  const [row] = await sql`SELECT name FROM workspace_spaces WHERE id = ${id}`;
  return row?.name ? String(row.name) : `#${id}`;
}
function buildTaskLinkLine(taskId) {
  const url = buildTaskUrl();
  if (!url) return "";
  const id = toInt(taskId);
  const suffix = id ? ` (رقم #${id})` : "";
  return `\nالرابط: ${url}${suffix}`;
}
function formatTaskLine(label, value) {
  const v = value === null || value === undefined || String(value).trim() === "" ? "—" : String(value);
  return `${label}: ${v}`;
}
function clipText(input, maxLen = 600) {
  const s = String(input || "");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}...`;
}
async function getPhonesForEmployees(employeeIds) {
  const ids = Array.from(new Set((employeeIds || []).map(toInt).filter(Boolean)));
  if (ids.length === 0) return [];
  const vals = [];
  const placeholders = [];
  let i = 1;
  for (const id of ids) {
    placeholders.push(`$${i}`);
    vals.push(id);
    i += 1;
  }
  await ensureEmployeeDisplayNameSchema();

  // IMPORTANT: trim/validate phone at the DB layer so we don't attempt to send to blank strings.
  const rows = await sql(`SELECT
       id,
       COALESCE(NULLIF(display_name, ''), name) AS name,
       phone
     FROM employees
     WHERE id IN (${placeholders.join(",")})
       AND phone IS NOT NULL
       AND TRIM(phone) <> ''`, vals);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    phone: r.phone
  })).filter(r => r.id && r.phone && String(r.phone).trim() !== "");
}
async function notifyAssigneesOnTaskWhatsApp({
  taskId,
  assigneeEmployeeIds,
  excludeEmployeeId,
  message
}) {
  try {
    const excludeId = toInt(excludeEmployeeId);
    const allIds = Array.from(new Set((assigneeEmployeeIds || []).map(toInt).filter(Boolean)));

    // Normally we exclude the actor so they don't get spammed by their own updates.
    // BUT: if the actor is the *only* assignee, we should still notify them
    // (common case: user assigns a task to themselves and expects a WhatsApp ping).
    let ids = allIds.filter(id => excludeId ? id !== excludeId : true);
    if (ids.length === 0 && excludeId && allIds.includes(excludeId)) {
      ids = [excludeId];
    }
    if (ids.length === 0) {
      return {
        ok: true,
        skipped: true,
        reason: "no_assignees"
      };
    }
    const employees = await getPhonesForEmployees(ids);
    if (employees.length === 0) {
      return {
        ok: true,
        skipped: true,
        reason: "no_phones"
      };
    }
    const text = String(message || "").trim();
    if (!text) {
      return {
        ok: true,
        skipped: true,
        reason: "empty_message"
      };
    }
    const results = await Promise.all(employees.map(async emp => {
      const r = await sendWhatsAppViaWasender({
        to: emp.phone,
        text
      });
      if (!r.ok) {
        console.error("WhatsApp notify failed", {
          taskId,
          employeeId: emp.id,
          error: r.error,
          details: r.details
        });
      }
      return {
        employeeId: emp.id,
        ok: r.ok
      };
    }));
    return {
      ok: true,
      results
    };
  } catch (error) {
    console.error("notifyAssigneesOnTaskWhatsApp error", error);
    return {
      ok: false,
      error: "notify_failed"
    };
  }
}

// NEW: notify task creator (even if they are not assigned)
async function notifyTaskCreatorOnTaskWhatsApp({
  taskId,
  creatorEmployeeId,
  message
}) {
  try {
    const creatorId = toInt(creatorEmployeeId);
    if (!creatorId) {
      return {
        ok: true,
        skipped: true,
        reason: "no_creator"
      };
    }
    const employees = await getPhonesForEmployees([creatorId]);
    if (employees.length === 0) {
      return {
        ok: true,
        skipped: true,
        reason: "no_phone"
      };
    }
    const text = String(message || "").trim();
    if (!text) {
      return {
        ok: true,
        skipped: true,
        reason: "empty_message"
      };
    }
    const emp = employees[0];
    const r = await sendWhatsAppViaWasender({
      to: emp.phone,
      text
    });
    if (!r.ok) {
      console.error("WhatsApp creator notify failed", {
        taskId,
        employeeId: emp.id,
        error: r.error,
        details: r.details
      });
      return {
        ok: false,
        error: r.error,
        details: r.details
      };
    }
    return {
      ok: true,
      employeeId: emp.id
    };
  } catch (error) {
    console.error("notifyTaskCreatorOnTaskWhatsApp error", error);
    return {
      ok: false,
      error: "notify_failed"
    };
  }
}

export { formatDateOnly as a, buildTaskLinkLine as b, getEmployeeNames as c, notifyTaskCreatorOnTaskWhatsApp as d, getTaskAssigneeEmployeeIds as e, formatTaskLine as f, getSpaceName as g, clipText as h, notifyAssigneesOnTaskWhatsApp as n };
