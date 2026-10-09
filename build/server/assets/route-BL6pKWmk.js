import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { a as ensureLeaseInvoiceLinkColumns } from './leaseContracts-TE5yL-xw.js';
import { e as ensureBranchProjectsSchema, c as parseId, f as loadContractHeader, b as ensureProjectInvoiceLinkColumns, g as loadProjectInvoice, l as logProjectAudit, h as loadInstallment, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-Dp7usULY.js';
import { f as fail, l as loadProjectHeader, p as projectLabel, t as touchProject, s as serverError } from './_lib-E-cBDqvJ.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './purchaseInvoiceDelete-CYPnydoW.js';
import './accountsTree-RnDnF4VP.js';
import './dateUtils-Bvji1KrH.js';

// ربط دفعة عقد بفاتورة مشتريات موجودة أو فك ربطها.
// PUT /api/accounting/branch-projects/[id]/contracts/[contractId]/installments/[installmentId]
//     { invoice_id: number | null } → { ok, installment, invoice }
// رقم: الفاتورة نشطة، غير مرتبطة بدفعة أخرى ولا بمشروع آخر (409 linked_elsewhere)؛
// تُكتب على الفاتورة project_id/project_phase_id (قسم العقد إن وُجد)/
// project_contract_id/project_installment_id، وعلى الدفعة invoice_id.
// null: فك الربط من الطرفين (الفاتورة تبقى مرتبطة بالمشروع).

async function loadInstallmentRow(installmentId, contractId) {
  const [row] = await sql`
    SELECT id, contract_id, seq, invoice_id
    FROM branch_project_contract_installments
    WHERE id = ${installmentId} AND contract_id = ${contractId}
    LIMIT 1
  `;
  return row || null;
}

// فك ربط الفاتورة من العقد/الدفعة (تبقى مرتبطة بالمشروع).
async function clearInvoiceContractLink(invoiceId, installmentId) {
  await sql`
    UPDATE accounting_purchase_invoices
    SET project_contract_id = NULL,
        project_installment_id = NULL,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = ${invoiceId} AND project_installment_id = ${installmentId}
  `;
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
    const contractId = parseId(params?.contractId);
    if (!contractId) return fail(404, "العقد غير موجود");
    const installmentId = parseId(params?.installmentId);
    if (!installmentId) return fail(404, "الدفعة غير موجودة");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const contract = await loadContractHeader(contractId, id);
    if (!contract) return fail(404, "العقد غير موجود");
    const installment = await loadInstallmentRow(installmentId, contractId);
    if (!installment) return fail(404, "الدفعة غير موجودة");
    const body = await request.json().catch(() => ({}));
    const unlink = body.invoice_id === undefined || body.invoice_id === null || body.invoice_id === "";
    const invoiceId = unlink ? null : parseId(body.invoice_id);
    if (!unlink && !invoiceId) return fail(400, "معرف الفاتورة غير صحيح");
    const hasInvoices = await ensureProjectInvoiceLinkColumns();
    if (hasInvoices) await ensureLeaseInvoiceLinkColumns();
    const previousInvoiceId = parseId(installment.invoice_id);
    const seqLabel = `الدفعة ${Number(installment.seq) || installmentId}`;
    if (unlink) {
      if (previousInvoiceId && hasInvoices) {
        try {
          await clearInvoiceContractLink(previousInvoiceId, installmentId);
        } catch (clearError) {
          console.warn("installment unlink: invoice clear skipped", clearError?.message);
        }
      }
      await sql`
        UPDATE branch_project_contract_installments
        SET invoice_id = NULL, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${installmentId} AND contract_id = ${contractId}
      `;
      if (previousInvoiceId) {
        const previous = hasInvoices ? await loadProjectInvoice(previousInvoiceId) : null;
        await logPurchaseAudit({
          entityType: "invoice",
          entityId: previousInvoiceId,
          action: "contract_unlinked",
          summary: `فك ربط الفاتورة ${previous?.invoice_number || `#${previousInvoiceId}`} من ${seqLabel} في عقد «${contract.title}» — ${projectLabel(header)}`,
          actor: auth.user
        });
        await logProjectAudit({
          projectId: id,
          action: "installment_unlinked",
          summary: `فك ربط ${seqLabel} في عقد «${contract.title}» من الفاتورة ${previous?.invoice_number || `#${previousInvoiceId}`}`,
          actor: auth.user
        });
        await touchProject(id);
        const updated = await loadInstallment(installmentId, contractId);
        return Response.json({
          ok: true,
          installment: updated,
          invoice: previous
        });
      }
      const updated = await loadInstallment(installmentId, contractId);
      return Response.json({
        ok: true,
        installment: updated,
        invoice: null
      });
    }

    // ربط: الفاتورة موجودة ونشطة، وليست مرتبطة بمشروع آخر أو دفعة أخرى.
    if (!hasInvoices) return fail(404, "الفاتورة غير موجودة");
    const invoice = await loadProjectInvoice(invoiceId);
    if (!invoice) return fail(404, "الفاتورة غير موجودة");
    if (invoice.project_id && invoice.project_id !== id) {
      return fail(409, "الفاتورة مرتبطة بمشروع تأسيس آخر", {
        code: "linked_elsewhere",
        project_id: invoice.project_id
      });
    }
    if (invoice.installment_id && invoice.installment_id !== installmentId) {
      return fail(409, "الفاتورة مرتبطة بدفعة عقد أخرى", {
        code: "linked_elsewhere",
        contract_id: invoice.contract_id,
        installment_id: invoice.installment_id
      });
    }
    const [other] = await sql`
      SELECT pci.id, pci.contract_id FROM branch_project_contract_installments pci
      WHERE pci.invoice_id = ${invoiceId} AND pci.id <> ${installmentId}
      LIMIT 1
    `;
    if (other) {
      return fail(409, "الفاتورة مرتبطة بدفعة عقد أخرى", {
        code: "linked_elsewhere",
        contract_id: Number(other.contract_id),
        installment_id: Number(other.id)
      });
    }

    // الدفعة كانت مرتبطة بفاتورة أخرى → تُفك أولًا حتى لا تبقى فاتورتان على دفعة.
    if (previousInvoiceId && previousInvoiceId !== invoiceId) {
      await clearInvoiceContractLink(previousInvoiceId, installmentId);
    }
    await sql`
      UPDATE accounting_purchase_invoices
      SET project_id = ${id},
          project_phase_id = COALESCE(${contract.phase_id}::int, project_phase_id),
          project_contract_id = ${contractId},
          project_installment_id = ${installmentId},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${invoiceId}
    `;
    await sql`
      UPDATE branch_project_contract_installments
      SET invoice_id = ${invoiceId}, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${installmentId} AND contract_id = ${contractId}
    `;
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoiceId,
      action: "contract_linked",
      summary: `ربط الفاتورة ${invoice.invoice_number} بـ${seqLabel} في عقد «${contract.title}» مع ${contract.party_name} — ${projectLabel(header)}`,
      actor: auth.user
    });
    await logProjectAudit({
      projectId: id,
      action: "installment_linked",
      summary: `ربط ${seqLabel} في عقد «${contract.title}» بالفاتورة ${invoice.invoice_number} (${invoice.total_amount.toFixed(2)} SAR)`,
      actor: auth.user
    });
    await touchProject(id);
    const [updated, linked] = await Promise.all([loadInstallment(installmentId, contractId), loadProjectInvoice(invoiceId)]);
    return Response.json({
      ok: true,
      installment: updated,
      invoice: linked
    });
  } catch (error) {
    return serverError("installment link", error, "فشل ربط الدفعة بالفاتورة");
  }
}

export { PUT };
