import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  REQUIRE_BRANCH_PROJECTS,
  ensureBranchProjectsSchema,
  parseContractInput,
  loadContract,
  logProjectAudit,
  parseId,
} from "@/app/api/utils/branchProjects";
import {
  fail,
  serverError,
  loadProjectHeader,
  projectLabel,
  resolvePhaseId,
  touchProject,
  purchaseInvoicesTableExists,
} from "../../../_lib";

// عقد واحد: تعديل / حذف.
// PUT    /api/accounting/branch-projects/[id]/contracts/[contractId] → { ok, contract }
//        الدفعات (إن أُرسلت): المرتبطة بفاتورة لا تُحذف (تُحدَّث إن أُرسلت بنفس id)؛
//        الباقي يُستبدل بالمرسل (بلا id = جديد؛ id موجود = تحديث؛ غير مُرسل = حذف).
// DELETE /api/accounting/branch-projects/[id]/contracts/[contractId] → { ok } | 409 has_invoices

// عدد فواتير المشتريات النشطة المرتبطة بالعقد (0 إن لم يوجد الجدول/العمود).
async function linkedInvoiceCount(contractId) {
  if (!(await purchaseInvoicesTableExists())) return 0;
  try {
    const [row] = await sql`
      SELECT COUNT(*)::int AS count FROM accounting_purchase_invoices
      WHERE project_contract_id = ${contractId} AND is_active = TRUE
    `;
    return Number(row?.count) || 0;
  } catch {
    return 0;
  }
}

async function linkedInstallmentCount(contractId) {
  const [row] = await sql`
    SELECT COUNT(*)::int AS count FROM branch_project_contract_installments
    WHERE contract_id = ${contractId} AND invoice_id IS NOT NULL
  `;
  return Number(row?.count) || 0;
}

export async function PUT(request, { params } = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const contractId = parseId(params?.contractId);
    if (!contractId) return fail(404, "العقد غير موجود");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const existing = await loadContract(contractId, id);
    if (!existing) return fail(404, "العقد غير موجود");
    const body = await request.json().catch(() => ({}));
    const { value, error } = parseContractInput(body, existing);
    if (error) return fail(400, error);
    const phase = await resolvePhaseId(id, value.phase_id);
    if (!phase.ok) return fail(400, phase.error);

    const statements = [
      sql`
        UPDATE branch_project_contracts
        SET phase_id = ${phase.phaseId},
            kind = ${value.kind},
            title = ${value.title},
            party_name = ${value.party_name},
            party_contact_id = ${value.party_contact_id},
            agreed_amount = ${value.agreed_amount},
            vat_included = ${value.vat_included},
            start_date = ${value.start_date},
            end_date = ${value.end_date},
            status = ${value.status},
            attachment_url = ${value.attachment_url},
            attachment_name = ${value.attachment_name},
            notes = ${value.notes ?? ""},
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${contractId} AND project_id = ${id}
      `,
    ];

    let installmentsSummary = "";
    if (value.installments !== null) {
      const current = await sql`
        SELECT id, seq, invoice_id FROM branch_project_contract_installments
        WHERE contract_id = ${contractId}
        ORDER BY seq ASC, id ASC
      `;
      const currentById = new Map(current.map((row) => [Number(row.id), row]));
      const sentIds = new Set();
      const inserts = [];
      let updated = 0;
      for (const inst of value.installments) {
        const row = inst.id ? currentById.get(inst.id) : null;
        if (row) {
          sentIds.add(inst.id);
          updated += 1;
          statements.push(sql`
            UPDATE branch_project_contract_installments
            SET seq = ${inst.seq},
                label = ${inst.label || ""},
                due_date = ${inst.due_date},
                amount = ${inst.amount},
                notes = ${inst.notes || ""},
                updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
            WHERE id = ${inst.id} AND contract_id = ${contractId}
          `);
        } else {
          // بلا id (أو id لا يخص هذا العقد) = دفعة جديدة.
          inserts.push({
            seq: inst.seq,
            label: inst.label || "",
            due_date: inst.due_date,
            amount: inst.amount,
            notes: inst.notes || "",
          });
        }
      }
      // غير المرسلة وبلا فاتورة تُحذف؛ المرتبطة بفاتورة تبقى كما هي.
      const toDelete = current
        .filter((row) => !sentIds.has(Number(row.id)) && !row.invoice_id)
        .map((row) => Number(row.id));
      if (toDelete.length) {
        statements.push(sql`
          DELETE FROM branch_project_contract_installments
          WHERE contract_id = ${contractId} AND id = ANY(${toDelete}::int[]) AND invoice_id IS NULL
        `);
      }
      if (inserts.length) {
        statements.push(sql`
          INSERT INTO branch_project_contract_installments (
            contract_id, seq, label, due_date, amount, notes
          )
          SELECT ${contractId}, r.seq, r.label, r.due_date::date, r.amount, r.notes
          FROM json_to_recordset(${JSON.stringify(inserts)}::json) AS r(
            seq int, label text, due_date text, amount numeric, notes text
          )
          ORDER BY r.seq
        `);
      }
      // إعادة الترقيم حتى تبقى seq متسلسلة وفريدة (الدفعات المحفوظة
      // بفاتورة وغير المرسلة تحتفظ بترتيبها النسبي).
      statements.push(sql`
        UPDATE branch_project_contract_installments AS pci
        SET seq = ranked.rn
        FROM (
          SELECT id, ROW_NUMBER() OVER (ORDER BY seq ASC, id ASC) AS rn
          FROM branch_project_contract_installments
          WHERE contract_id = ${contractId}
        ) AS ranked
        WHERE pci.id = ranked.id AND pci.contract_id = ${contractId} AND pci.seq <> ranked.rn
      `);
      const kept = current.length - toDelete.length - updated;
      installmentsSummary = ` — الدفعات: ${updated} تعديل، ${inserts.length} إضافة، ${toDelete.length} حذف${kept > 0 ? `، ${kept} محفوظة بفاتورة` : ""}`;
    }

    await sql.transaction(statements);
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "contract_updated",
      summary: `تعديل عقد «${value.title}» مع ${value.party_name} في ${projectLabel(header)}${value.status !== existing.status ? ` (الحالة: ${existing.status} → ${value.status})` : ""}${installmentsSummary}`,
      actor: auth.user,
    });
    const contract = await loadContract(contractId, id);
    return Response.json({ ok: true, contract });
  } catch (error) {
    return serverError("contract update", error, "فشل حفظ العقد");
  }
}

export async function DELETE(request, { params } = {}) {
  const auth = requireAuth(request, REQUIRE_BRANCH_PROJECTS);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureBranchProjectsSchema();
    const id = parseId(params?.id);
    if (!id) return fail(400, "معرف المشروع غير صحيح");
    const contractId = parseId(params?.contractId);
    if (!contractId) return fail(404, "العقد غير موجود");
    const header = await loadProjectHeader(id);
    if (!header) return fail(404, "المشروع غير موجود");
    const existing = await loadContract(contractId, id);
    if (!existing) return fail(404, "العقد غير موجود");

    const [invoices, installments] = await Promise.all([
      linkedInvoiceCount(contractId),
      linkedInstallmentCount(contractId),
    ]);
    const linked = Math.max(invoices, installments);
    if (linked > 0) {
      return fail(409, `لا يمكن حذف العقد — مرتبط به ${linked} فاتورة. فك ربط الفواتير أو احذفها أولاً`, {
        code: "has_invoices",
        count: linked,
      });
    }
    // الدفعات تُحذف تتابعًا (CASCADE).
    await sql`DELETE FROM branch_project_contracts WHERE id = ${contractId} AND project_id = ${id}`;
    await touchProject(id);
    await logProjectAudit({
      projectId: id,
      action: "contract_deleted",
      summary: `حذف عقد «${existing.title}» مع ${existing.party_name} (${existing.agreed_amount.toFixed(2)} SAR) من ${projectLabel(header)}`,
      actor: auth.user,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return serverError("contract delete", error, "فشل حذف العقد");
  }
}
