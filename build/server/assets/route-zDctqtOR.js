import sql from './sql-CSDV1lSC.js';
import { r as requireWorkspaceEmployee, g as getSearchParams } from './_utils-B08qkxFa.js';
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

// GET /api/workspace/templates?employeeId=...
async function GET(request) {
  try {
    const params = getSearchParams(request);
    const employeeIdRaw = params.get("employeeId");
    const auth = await requireWorkspaceEmployee(request, employeeIdRaw);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    const templates = await sql`
      SELECT
        t.id, t.name, t.title, t.description, t.priority,
        t.space_id, COALESCE(s.name, '') as space_name,
        t.tags, t.checklist_items,
        t.created_by_employee_id,
        COALESCE(NULLIF(emp.display_name, ''), emp.name) as created_by_name,
        t.created_at
      FROM workspace_task_templates t
      LEFT JOIN workspace_spaces s ON s.id = t.space_id
      LEFT JOIN employees emp ON emp.id = t.created_by_employee_id
      ORDER BY t.created_at DESC
      LIMIT 100
    `;
    return Response.json({
      templates
    });
  } catch (error) {
    console.error("templates GET error:", error);
    return Response.json({
      error: "فشل تحميل القوالب"
    }, {
      status: 500
    });
  }
}

// POST /api/workspace/templates
// body: { employeeId, name, title, description?, priority?, spaceId?, tags?, checklistItems? }
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
    const name = String(body.name || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim() || null;
    const priority = body.priority || "Normal";
    const spaceId = toInt(body.spaceId);
    const tags = Array.isArray(body.tags) ? body.tags.filter(Boolean).slice(0, 20) : null;
    const checklistItems = Array.isArray(body.checklistItems) ? body.checklistItems : [];
    if (!name) {
      return Response.json({
        error: "اسم القالب مطلوب"
      }, {
        status: 400
      });
    }
    if (!title) {
      return Response.json({
        error: "عنوان المهمة مطلوب"
      }, {
        status: 400
      });
    }
    const safeChecklist = checklistItems.map(item => String(item?.title || item || "").trim()).filter(Boolean).slice(0, 30).map((t, i) => ({
      title: t,
      sort_order: i
    }));
    const [template] = await sql(`INSERT INTO workspace_task_templates 
        (name, title, description, priority, space_id, tags, checklist_items, created_by_employee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING *`, [name, title, description, priority, spaceId, tags, JSON.stringify(safeChecklist), employeeId]);
    return Response.json({
      template
    }, {
      status: 201
    });
  } catch (error) {
    console.error("templates POST error:", error);
    return Response.json({
      error: "فشل إنشاء القالب"
    }, {
      status: 500
    });
  }
}

// DELETE /api/workspace/templates
// body: { employeeId, templateId }
async function DELETE(request) {
  try {
    const body = await request.json();
    const employeeId = toInt(body.employeeId);
    const templateId = toInt(body.templateId);
    const auth = await requireWorkspaceEmployee(request, employeeId);
    if (!auth.ok) {
      return Response.json({
        error: auth.error
      }, {
        status: auth.status
      });
    }
    if (!templateId) {
      return Response.json({
        error: "templateId مطلوب"
      }, {
        status: 400
      });
    }
    await sql`DELETE FROM workspace_task_templates WHERE id = ${templateId}`;
    return Response.json({
      success: true
    });
  } catch (error) {
    console.error("templates DELETE error:", error);
    return Response.json({
      error: "فشل حذف القالب"
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST };
