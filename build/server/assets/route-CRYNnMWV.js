import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureBranchProjectsSchema, c as parseId, j as parseContractInput, l as logProjectAudit, i as loadContract, R as REQUIRE_BRANCH_PROJECTS } from './branchProjects-Dp7usULY.js';
import { f as fail, l as loadProjectHeader, r as resolvePhaseId, a as actorId, b as actorName, t as touchProject, d as phaseName, p as projectLabel, s as serverError } from './_lib-E-cBDqvJ.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseAudit-DZMMDeLJ.js';
import './dateUtils-Bvji1KrH.js';

// عقود المقاولين/الموردين داخل المشروع — الإضافة.
// POST /api/accounting/branch-projects/[id]/contracts → 201 { ok, contract }
// الرأس أولًا ثم الدفعات دفعة واحدة؛ فشل الدفعات يحذف الرأس (CASCADE).

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
    const {
      value,
      error
    } = parseContractInput(body);
    if (error) return fail(400, error);
    const phase = await resolvePhaseId(id, value.phase_id);
    if (!phase.ok) return fail(400, phase.error);
    const [created] = await sql`
      INSERT INTO branch_project_contracts (
        project_id, phase_id, kind, title, party_name, party_contact_id,
        agreed_amount, vat_included, start_date, end_date, status,
        attachment_url, attachment_name, notes,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${id}, ${phase.phaseId}, ${value.kind}, ${value.title}, ${value.party_name}, ${value.party_contact_id},
        ${value.agreed_amount}, ${value.vat_included}, ${value.start_date}, ${value.end_date}, ${value.status},
        ${value.attachment_url}, ${value.attachment_name}, ${value.notes ?? ""},
        ${actorId(auth)}, ${actorName(auth)}
      )
      RETURNING id
    `;
    const contractId = Number(created.id);
    const installments = value.installments || [];
    if (installments.length) {
      try {
        const rows = installments.map(inst => ({
          seq: inst.seq,
          label: inst.label || "",
          due_date: inst.due_date,
          amount: inst.amount,
          notes: inst.notes || ""
        }));
        await sql`
          INSERT INTO branch_project_contract_installments (
            contract_id, seq, label, due_date, amount, notes
          )
          SELECT ${contractId}, r.seq, r.label, r.due_date::date, r.amount, r.notes
          FROM json_to_recordset(${JSON.stringify(rows)}::json) AS r(
            seq int, label text, due_date text, amount numeric, notes text
          )
          ORDER BY r.seq
        `;
      } catch (installmentsError) {
        try {
          await sql`DELETE FROM branch_project_contracts WHERE id = ${contractId}`;
        } catch (cleanupError) {
          console.error("branch project contract rollback failed", cleanupError);
        }
        throw installmentsError;
      }
    }
    await touchProject(id);
    const name = await phaseName(phase.phaseId);
    await logProjectAudit({
      projectId: id,
      action: "contract_added",
      summary: `إضافة عقد «${value.title}» مع ${value.party_name} بمبلغ ${value.agreed_amount.toFixed(2)} SAR (${installments.length} دفعة) إلى ${projectLabel(header)}${name ? ` — قسم «${name}»` : ""}`,
      actor: auth.user
    });
    const contract = await loadContract(contractId, id);
    return Response.json({
      ok: true,
      contract
    }, {
      status: 201
    });
  } catch (error) {
    return serverError("contract create", error, "فشل حفظ العقد");
  }
}

export { POST };
