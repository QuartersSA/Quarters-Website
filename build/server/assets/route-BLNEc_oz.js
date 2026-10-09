import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { a as ensureLeaseInvoiceLinkColumns } from './leaseContracts-TE5yL-xw.js';
import { e as ensureBranchProjectsSchema, c as parseId, b as ensureProjectInvoiceLinkColumns, g as loadProjectInvoice, l as logProjectAudit, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-Dp7usULY.js';
import { f as fail, l as loadProjectHeader, r as resolvePhaseId, d as phaseName, p as projectLabel, t as touchProject, s as serverError } from './_lib-E-cBDqvJ.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './purchaseInvoiceDelete-CYPnydoW.js';
import './accountsTree-RnDnF4VP.js';
import './dateUtils-Bvji1KrH.js';

// ربط فاتورة مشتريات موجودة بالمشروع.
// POST /api/accounting/branch-projects/[id]/invoices { invoice_id, phase_id } → { ok, invoice }
// 404 إن الفاتورة غير موجودة/غير نشطة؛ 409 linked_elsewhere إن مرتبطة بمشروع آخر.

async function POST(request, {
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
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const body = await request.json().catch(() => ({}));
    const invoiceId = parseId(body.invoice_id);
    if (!invoiceId) return fail(400, "معرف الفاتورة غير صحيح");

    // أعمدة الربط (المشروع + الإيجار) قبل القراءة؛ بلا جدول فواتير → لا فاتورة.
    const hasInvoices = await ensureProjectInvoiceLinkColumns();
    if (!hasInvoices) return fail(404, "الفاتورة غير موجودة");
    await ensureLeaseInvoiceLinkColumns();
    const invoice = await loadProjectInvoice(invoiceId);
    if (!invoice) return fail(404, "الفاتورة غير موجودة");
    if (invoice.project_id && invoice.project_id !== id) {
      return fail(409, "الفاتورة مرتبطة بمشروع تأسيس آخر", {
        code: "linked_elsewhere",
        project_id: invoice.project_id
      });
    }
    const phase = await resolvePhaseId(id, body.phase_id);
    if (!phase.ok) return fail(400, phase.error);
    await sql`
      UPDATE accounting_purchase_invoices
      SET project_id = ${id},
          project_phase_id = ${phase.phaseId},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${invoiceId}
    `;
    const name = await phaseName(phase.phaseId);
    const phaseText = name ? ` — قسم «${name}»` : "";
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoiceId,
      action: "project_linked",
      summary: `ربط الفاتورة ${invoice.invoice_number} بمشروع التأسيس ${projectLabel(header)}${phaseText}`,
      actor: auth.user
    });
    await logProjectAudit({
      projectId: id,
      action: "invoice_linked",
      summary: `ربط الفاتورة ${invoice.invoice_number} (${invoice.total_amount.toFixed(2)} SAR) بالمشروع${phaseText}`,
      actor: auth.user
    });
    await touchProject(id);
    const linked = await loadProjectInvoice(invoiceId);
    return Response.json({
      ok: true,
      invoice: linked
    });
  } catch (error) {
    return serverError("invoice link", error, "فشل ربط الفاتورة");
  }
}

export { POST };
