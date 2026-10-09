import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureBranchProjectsSchema, c as parseId, l as logProjectAudit, o as loadProject, s as parseProjectInput, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-Dp7usULY.js';
import { f as fail, c as purchaseInvoicesTableExists, s as serverError } from './_lib-E-cBDqvJ.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseAudit-DZMMDeLJ.js';
import './dateUtils-Bvji1KrH.js';

// مشروع تأسيس واحد: عرض / تعديل / حذف.
// GET    /api/accounting/branch-projects/[id]  → { project }
// PUT    /api/accounting/branch-projects/[id]  → { project }  (حقول جزئية)
// DELETE /api/accounting/branch-projects/[id]  → { ok: true } (يفك ربط الفواتير والعقود ثم يحذف)

async function loadExisting(id) {
  const [row] = await sql`
    SELECT id, code, name, city, district, address, area_sqm, status,
           TO_CHAR(contract_signed_date, 'YYYY-MM-DD') AS contract_signed_date,
           TO_CHAR(target_opening_date, 'YYYY-MM-DD') AS target_opening_date,
           TO_CHAR(actual_opening_date, 'YYYY-MM-DD') AS actual_opening_date,
           budget_total, manager_employee_id, manager_name,
           lease_contract_id, lease_contract_number, branch_id, notes, cover_url, is_active
    FROM branch_projects
    WHERE id = ${id} AND is_active = TRUE
  `;
  return row || null;
}
async function GET(request, {
  params
} = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const project = await loadProject(id);
    if (!project) return fail(404, "المشروع غير موجود");
    return Response.json({
      project
    });
  } catch (error) {
    return serverError("get", error, "فشل تحميل المشروع");
  }
}
async function PUT(request, {
  params
} = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const existing = await loadExisting(id);
    if (!existing) return fail(404, "المشروع غير موجود");
    const body = await request.json().catch(() => ({}));
    const {
      value,
      error
    } = parseProjectInput(body, existing);
    if (error) return fail(400, error);

    // الحالة 'opened' لا تُضبط من التعديل (مسار open فقط)، ولا تُلغى منه.
    let status = existing.status;
    if (existing.status !== "opened" && value.status && value.status !== "opened") {
      status = value.status;
    }
    const pick = key => value[key] !== undefined ? value[key] : existing[key] ?? null;
    const budgetTotal = Number(pick("budget_total")) || 0;
    await sql`
      UPDATE branch_projects
      SET name = ${pick("name")},
          city = ${pick("city")},
          district = ${pick("district")},
          address = ${pick("address")},
          area_sqm = ${pick("area_sqm")},
          status = ${status},
          contract_signed_date = ${pick("contract_signed_date")},
          target_opening_date = ${pick("target_opening_date")},
          actual_opening_date = ${pick("actual_opening_date")},
          budget_total = ${budgetTotal},
          manager_employee_id = ${pick("manager_employee_id")},
          manager_name = ${pick("manager_name")},
          lease_contract_id = ${pick("lease_contract_id")},
          lease_contract_number = ${pick("lease_contract_number")},
          branch_id = ${pick("branch_id")},
          notes = ${pick("notes")},
          cover_url = ${pick("cover_url")},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    const changes = [];
    const nextName = pick("name");
    if (nextName !== existing.name) changes.push(`الاسم: ${existing.name} → ${nextName}`);
    if (status !== existing.status) changes.push(`الحالة: ${existing.status} → ${status}`);
    if (Math.abs(budgetTotal - (Number(existing.budget_total) || 0)) > 0.005) {
      changes.push(`الميزانية: ${(Number(existing.budget_total) || 0).toFixed(2)} → ${budgetTotal.toFixed(2)}`);
    }
    const nextTarget = pick("target_opening_date");
    if (nextTarget !== existing.target_opening_date) {
      changes.push(`موعد الافتتاح: ${existing.target_opening_date || "—"} → ${nextTarget || "—"}`);
    }
    await logProjectAudit({
      projectId: id,
      action: "updated",
      summary: `تعديل مشروع ${existing.code || `#${id}`} — ${nextName}${changes.length ? ` (${changes.join("، ")})` : ""}`,
      actor: auth.user
    });
    const project = await loadProject(id);
    return Response.json({
      project
    });
  } catch (error) {
    return serverError("update", error, "فشل حفظ المشروع");
  }
}
async function DELETE(request, {
  params
} = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const existing = await loadExisting(id);
    if (!existing) return fail(404, "المشروع غير موجود");

    // فك ربط الفواتير والعقود (إن وُجدت الجداول/الأعمدة) — لا تُحذف الفواتير.
    // يشمل عقود المقاولين ودفعاتها: الفاتورة تفقد project_contract_id/
    // project_installment_id، والدفعة تفقد invoice_id، والعقود تُوقَف ناعمًا
    // حتى لا تقبلها مسارات الربط لاحقًا.
    let unlinkedInvoices = 0;
    if (await purchaseInvoicesTableExists()) {
      try {
        const rows = await sql`
          UPDATE accounting_purchase_invoices
          SET project_id = NULL, project_phase_id = NULL,
              project_contract_id = NULL, project_installment_id = NULL
          WHERE project_id = ${id}
             OR project_contract_id IN (
               SELECT id FROM branch_project_contracts WHERE project_id = ${id}
             )
          RETURNING id
        `;
        unlinkedInvoices = rows.length;
      } catch (unlinkError) {
        console.warn("branch project delete: invoice unlink skipped", unlinkError?.message);
      }
    }
    try {
      const [reg] = await sql`SELECT to_regclass('branch_project_contract_installments') AS t`;
      if (reg?.t) {
        await sql`
          UPDATE branch_project_contract_installments
          SET invoice_id = NULL, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE invoice_id IS NOT NULL
            AND contract_id IN (SELECT id FROM branch_project_contracts WHERE project_id = ${id})
        `;
        await sql`
          UPDATE branch_project_contracts
          SET is_active = FALSE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE project_id = ${id} AND is_active = TRUE
        `;
      }
    } catch (unlinkError) {
      console.warn("branch project delete: contract unlink skipped", unlinkError?.message);
    }
    try {
      const [reg] = await sql`SELECT to_regclass('accounting_lease_contracts') AS t`;
      if (reg?.t) {
        await sql`UPDATE accounting_lease_contracts SET project_id = NULL WHERE project_id = ${id}`;
      }
    } catch (unlinkError) {
      console.warn("branch project delete: lease unlink skipped", unlinkError?.message);
    }

    // إيقاف ناعم: يبقى الكود محجوزًا وسجل التدقيق مقروءًا؛ كل المحمّلات
    // تُرشّح is_active = TRUE.
    await sql`
      UPDATE branch_projects
      SET is_active = FALSE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    await logProjectAudit({
      projectId: id,
      action: "deleted",
      summary: `حذف مشروع التأسيس ${existing.code || `#${id}`} — ${existing.name}${unlinkedInvoices ? ` — فُكّ ربط ${unlinkedInvoices} فاتورة` : ""}`,
      actor: auth.user
    });
    return Response.json({
      ok: true
    });
  } catch (error) {
    return serverError("delete", error, "فشل حذف المشروع");
  }
}

export { DELETE, GET, PUT };
