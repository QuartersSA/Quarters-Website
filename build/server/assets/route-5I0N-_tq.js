import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { j as listContracts, e as ensureLeaseSchema, p as parseContractInput, b as buildScheduleRows, r as replaceSchedule, l as loadContract, R as REQUIRE_LEASE } from './leaseContracts-DG6L4did.js';
import '@neondatabase/serverless';
import 'crypto';
import './leaseMath-rcRs1QEf.js';

// العقود التأجيرية — القائمة والإضافة.
// GET  /api/accounting/lease-contracts?includeInactive=1&q=
// POST /api/accounting/lease-contracts  (مدخلات العقد → عقد + جدول دفعات)

async function GET(request) {
  const auth = requireAuth(request, REQUIRE_LEASE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const q = url.searchParams.get("q") || "";
    const contracts = await listContracts({
      includeInactive,
      q
    });
    return Response.json({
      contracts
    });
  } catch (error) {
    console.error("lease contracts GET error", error);
    return Response.json({
      error: "فشل تحميل العقود التأجيرية",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_LEASE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureLeaseSchema();
    const body = await request.json().catch(() => ({}));
    const parsed = parseContractInput(body);
    if (!parsed.ok) {
      return Response.json({
        error: parsed.error
      }, {
        status: 400
      });
    }
    const value = parsed.value;
    const rows = buildScheduleRows(value);
    if (!rows.length) {
      return Response.json({
        error: "تعذر توليد جدول الدفعات — تحقق من التواريخ وقيمة الدفعة"
      }, {
        status: 400
      });
    }
    const actorId = auth.user?.id ? Number(auth.user.id) : null;
    const actorName = auth.user?.name ? String(auth.user.name) : null;
    const [created] = await sql`
      INSERT INTO accounting_lease_contracts (
        contract_number, lessor_name, lessor_contact_id, lessor_vat_number,
        location, branch_id, start_date, end_date,
        notice_period_days, notice_period_text,
        payment_frequency, installment_amount, vat_rate, amount_includes_vat,
        fixed_charges, fixed_amount, first_due_date,
        total_value, status, notes, attachment_url, attachment_name, analysis_json,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${value.contract_number}, ${value.lessor_name}, ${value.lessor_contact_id}, ${value.lessor_vat_number},
        ${value.location}, ${value.branch_id}, ${value.start_date}, ${value.end_date},
        ${value.notice_period_days}, ${value.notice_period_text},
        ${value.payment_frequency}, ${value.installment_amount}, ${value.vat_rate}, ${value.amount_includes_vat},
        ${JSON.stringify(value.fixed_charges || [])}::jsonb, ${value.fixed_amount || 0}, ${value.first_due_date},
        0, ${value.status || "active"}, ${value.notes}, ${value.attachment_url}, ${value.attachment_name},
        ${value.analysis_json ? JSON.stringify(value.analysis_json) : null}::jsonb,
        ${actorId}, ${actorName}
      )
      RETURNING id
    `;
    const contractId = Number(created.id);
    let schedule;
    try {
      schedule = await replaceSchedule(contractId, rows, {
        keepPaid: false
      });
    } catch (scheduleError) {
      // لا عقد بلا جدول: يُحذف الرأس اليتيم ثم يُبلَّغ الخطأ.
      await sql`DELETE FROM accounting_lease_contracts WHERE id = ${contractId}`.catch(() => {});
      throw scheduleError;
    }
    await logPurchaseAudit({
      entityType: "lease_contract",
      entityId: contractId,
      action: "created",
      summary: `إنشاء عقد إيجار ${value.contract_number || `#${contractId}`} — ${value.lessor_name} (${rows.length} دفعة، الإجمالي ${schedule.total_value.toFixed(2)} SAR)`,
      actor: auth.user
    });
    const contract = await loadContract(contractId);
    return Response.json({
      ok: true,
      contract
    }, {
      status: 201
    });
  } catch (error) {
    console.error("lease contracts POST error", error);
    return Response.json({
      error: "فشل إضافة العقد التأجيري",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
