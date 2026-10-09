import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { h as hardDeletePurchaseInvoices } from './purchaseInvoiceDelete-CYPnydoW.js';
import { a as ensureLeaseInvoiceLinkColumns } from './leaseContracts-TE5yL-xw.js';
import { e as ensureBranchProjectsSchema, c as parseId, l as logProjectAudit, E as ESTABLISHMENT_ACCOUNTS, k as getEstablishmentAccountId, g as loadProjectInvoice, R as REQUIRE_BRANCH_PROJECTS, b as ensureProjectInvoiceLinkColumns } from './branchProjects-Dp7usULY.js';
import { f as fail, l as loadProjectHeader, p as projectLabel, t as touchProject, s as serverError, r as resolvePhaseId, d as phaseName } from './_lib-E-cBDqvJ.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './dateUtils-Bvji1KrH.js';

// فاتورة مرتبطة بالمشروع: تعديل القسم/الحساب، أو حذف نهائي.
// PUT    /api/accounting/branch-projects/[id]/invoices/[invoiceId] { phase_id?, expense_account_code? } → { ok, invoice }
// DELETE /api/accounting/branch-projects/[id]/invoices/[invoiceId] → { ok } | 409 lease_invoice

// الفاتورة النشطة المرتبطة بهذا المشروع (شكل ProjectInvoice) أو null.
async function loadLinkedInvoice(projectId, invoiceId) {
  const hasInvoices = await ensureProjectInvoiceLinkColumns();
  if (!hasInvoices) return null;
  await ensureLeaseInvoiceLinkColumns();
  const invoice = await loadProjectInvoice(invoiceId);
  if (!invoice || invoice.project_id !== projectId) return null;
  return invoice;
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
    const invoiceId = parseId(params?.invoiceId);
    if (!invoiceId) return fail(404, "الفاتورة غير موجودة");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const invoice = await loadLinkedInvoice(id, invoiceId);
    if (!invoice) return fail(404, "الفاتورة غير موجودة أو غير مرتبطة بهذا المشروع");
    const body = await request.json().catch(() => ({}));
    const changes = [];
    if (body.phase_id !== undefined) {
      const phase = await resolvePhaseId(id, body.phase_id);
      if (!phase.ok) return fail(400, phase.error);
      if (phase.phaseId !== invoice.phase_id) {
        await sql`
          UPDATE accounting_purchase_invoices
          SET project_phase_id = ${phase.phaseId}, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE id = ${invoiceId}
        `;
        const name = await phaseName(phase.phaseId);
        changes.push(`القسم → ${phase.phaseId ? name ? `«${name}»` : `#${phase.phaseId}` : "بلا قسم"}`);
      }
    }
    const codeRaw = body.expense_account_code;
    if (codeRaw !== undefined && codeRaw !== null && String(codeRaw).trim() !== "") {
      const code = String(codeRaw).trim();
      const known = ESTABLISHMENT_ACCOUNTS.find(a => a.code === code);
      if (!known) return fail(400, "حساب المصروف غير معروف — اختر من حسابات التأسيس (53)");
      const accountId = await getEstablishmentAccountId(code);
      if (!accountId) return fail(500, "تعذر تهيئة حساب المصروف");
      if (invoice.expense_account_id !== Number(accountId)) {
        await sql`
          UPDATE accounting_purchase_invoices
          SET expense_account_id = ${accountId}, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE id = ${invoiceId}
        `;
        // بنود الفاتورة تتبع حساب الرأس (الجدول قد لا يكون موجودًا بعد).
        try {
          await sql`
            UPDATE accounting_purchase_invoice_items SET account_id = ${accountId}
            WHERE invoice_id = ${invoiceId}
          `;
        } catch (itemsError) {
          console.warn("branch project invoice items repoint skipped", itemsError?.message);
        }
        changes.push(`الحساب → ${code} ${known.name}`);
      }
    }
    if (changes.length) {
      await logPurchaseAudit({
        entityType: "invoice",
        entityId: invoiceId,
        action: "project_updated",
        summary: `تعديل ربط الفاتورة ${invoice.invoice_number} بمشروع ${projectLabel(header)}: ${changes.join("، ")}`,
        actor: auth.user
      });
      await logProjectAudit({
        projectId: id,
        action: "invoice_updated",
        summary: `تعديل الفاتورة ${invoice.invoice_number}: ${changes.join("، ")}`,
        actor: auth.user
      });
      await touchProject(id);
    }
    const updated = await loadProjectInvoice(invoiceId);
    return Response.json({
      ok: true,
      invoice: updated
    });
  } catch (error) {
    return serverError("invoice update", error, "فشل حفظ الفاتورة");
  }
}
async function isCoffeeInvoice(invoiceId) {
  try {
    const [row] = await sql`
      SELECT inv.invoice_kind,
             EXISTS (
               SELECT 1 FROM accounting_purchase_invoices ch WHERE ch.source_invoice_id = inv.id
             ) AS has_child,
             EXISTS (
               SELECT 1 FROM accounting_purchase_invoice_items it
               WHERE it.invoice_id = inv.id
                 AND (it.item_id IS NOT NULL OR COALESCE(it.roast_enabled, FALSE))
             ) AS has_coffee
      FROM accounting_purchase_invoices inv
      WHERE inv.id = ${Number(invoiceId)}
    `;
    if (!row) return false;
    return row.invoice_kind === "roast" || !!row.has_child || !!row.has_coffee;
  } catch (error) {
    // أعمدة البن غير موجودة = الميزة غير مفعّلة.
    console.warn("coffee invoice check skipped", error?.message);
    return false;
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
    const invoiceId = parseId(params?.invoiceId);
    if (!invoiceId) return fail(404, "الفاتورة غير موجودة");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const invoice = await loadLinkedInvoice(id, invoiceId);
    if (!invoice) return fail(404, "الفاتورة غير موجودة أو غير مرتبطة بهذا المشروع");
    if (invoice.source === "lease") {
      return fail(409, "فاتورة استقطاع إيجار — تُدار من العقد", {
        code: "lease_invoice"
      });
    }
    // فواتير البن/التحميص لها إيداعات مخزون وفاتورة تحميص مرتبطة — تُحذف
    // من فواتير المشتريات حيث يُعكس الإيداع وتُحذف الفاتورة التابعة.
    if (await isCoffeeInvoice(invoiceId)) {
      return fail(409, "فاتورة بن/تحميص — تُحذف من فواتير المشتريات", {
        code: "coffee_invoice"
      });
    }
    const deleted = await hardDeletePurchaseInvoices([invoiceId], {
      actor: auth.user,
      reason: `حُذفت من مشروع التأسيس ${projectLabel(header)}`
    });
    if (!deleted.length) return fail(404, "الفاتورة غير موجودة");
    await logProjectAudit({
      projectId: id,
      action: "invoice_deleted",
      summary: `حذف نهائي للفاتورة ${invoice.invoice_number} (${invoice.total_amount.toFixed(2)} SAR) من المشروع`,
      actor: auth.user
    });
    await touchProject(id);
    return Response.json({
      ok: true
    });
  } catch (error) {
    return serverError("invoice delete", error, "فشل حذف الفاتورة");
  }
}

export { DELETE, PUT };
