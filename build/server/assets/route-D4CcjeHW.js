import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { b as reconcileLeaseInvoicesProject } from './leaseSetAsideInvoices-TfdFUbE3.js';
import { e as ensureLeaseSchema, d as deleteAllLeaseContractInvoices, f as loadContract, h as parseContractInput, i as sameInstant, j as buildScheduleRows, k as replaceSchedule, m as repointLeaseInvoiceAccounts, R as REQUIRE_LEASE } from './leaseContracts-CiucmYFP.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './wasender-vtNAxFgq.js';
import './waNotify-BPFQhIP4.js';
import './coffeeInvoices-CYk167p4.js';
import './accountsTree-RnDnF4VP.js';
import './purchaseInvoiceDelete-RdBVQHRn.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';
import './route-OABtNaJh.js';
import './branchProjects-D3H72PHO.js';
import './dateUtils-Bvji1KrH.js';

// عقد تأجيري واحد: عرض / تعديل / إيقاف أو حذف.
// GET    /api/accounting/lease-contracts/[id]
// PUT    /api/accounting/lease-contracts/[id]   (+ regenerate_schedule, expected_updated_at)
// DELETE /api/accounting/lease-contracts/[id]?force=1

function parseId(params) {
  const id = Number(params?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}
async function GET(request, {
  params
} = {}) {
  const auth = requireAuth(request, REQUIRE_LEASE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const id = parseId(params);
    if (!id) {
      return Response.json({
        error: "معرف العقد غير صحيح"
      }, {
        status: 400
      });
    }
    const contract = await loadContract(id);
    if (!contract) {
      return Response.json({
        error: "العقد غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      contract
    });
  } catch (error) {
    console.error("lease contract GET error", error);
    return Response.json({
      error: "فشل تحميل العقد",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function PUT(request, {
  params
} = {}) {
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
    const id = parseId(params);
    if (!id) {
      return Response.json({
        error: "معرف العقد غير صحيح"
      }, {
        status: 400
      });
    }
    const body = await request.json().catch(() => ({}));
    const [existing] = await sql`
      SELECT id, contract_number, lessor_name, updated_at, is_active, contract_type, project_id
      FROM accounting_lease_contracts WHERE id = ${id}
    `;
    if (!existing) {
      return Response.json({
        error: "العقد غير موجود"
      }, {
        status: 404
      });
    }

    // إعادة تفعيل عقد موقوف — جسم مختصر { reactivate: true } بلا بقية الحقول.
    if (body.reactivate === true) {
      await sql`
        UPDATE accounting_lease_contracts
        SET is_active = TRUE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${id}
      `;
      await logPurchaseAudit({
        entityType: "lease_contract",
        entityId: id,
        action: "reactivated",
        summary: `إعادة تفعيل عقد الإيجار ${existing.contract_number || `#${id}`} — ${existing.lessor_name}`,
        actor: auth.user
      });
      const contract = await loadContract(id);
      return Response.json({
        ok: true,
        contract,
        warnings: []
      });
    }
    const parsed = parseContractInput(body, {
      requireSchedule: body.regenerate_schedule === true
    });
    if (!parsed.ok) {
      return Response.json({
        error: parsed.error
      }, {
        status: 400
      });
    }
    const value = parsed.value;
    if (value.expected_updated_at && !sameInstant(existing.updated_at, value.expected_updated_at)) {
      return Response.json({
        error: "العقد تغيّر من مستخدم آخر — أعد فتحه ثم كرّر التعديل",
        code: "stale_contract"
      }, {
        status: 409
      });
    }
    if (value.contract_number) {
      const [dup] = await sql`
        SELECT id, display_name, lessor_name FROM accounting_lease_contracts
        WHERE is_active = TRUE AND TRIM(contract_number) = ${value.contract_number} AND id <> ${id}
        LIMIT 1
      `;
      if (dup) {
        return Response.json({
          error: `يوجد عقد نشط آخر بنفس الرقم (${value.contract_number}) — ${dup.display_name || dup.lessor_name}`,
          code: "duplicate_contract",
          existing_id: Number(dup.id)
        }, {
          status: 409
        });
      }
    }
    const warnings = [];
    let rows = [];
    if (value.regenerate_schedule) {
      rows = buildScheduleRows(value);
      if (!rows.length) {
        return Response.json({
          error: "تعذر توليد جدول الدفعات — تحقق من التواريخ وقيمة الدفعة"
        }, {
          status: 400
        });
      }
    }
    await sql`
      UPDATE accounting_lease_contracts
      SET contract_number = ${value.contract_number},
          contract_type = ${value.contract_type},
          display_name = ${value.display_name},
          is_renewal = ${value.is_renewal},
          lessor_name = ${value.lessor_name},
          lessor_contact_id = ${value.lessor_contact_id},
          lessor_vat_number = ${value.lessor_vat_number},
          location = ${value.location},
          branch_id = ${value.branch_id},
          -- مشروع التأسيس يُكتب فقط إن أرسلته الحمولة.
          project_id = CASE WHEN ${value.project_id !== undefined} THEN ${value.project_id ?? null} ELSE project_id END,
          start_date = ${value.start_date},
          end_date = ${value.end_date},
          notice_period_days = ${value.notice_period_days},
          notice_period_text = ${value.notice_period_text},
          payment_frequency = ${value.payment_frequency},
          installment_amount = ${value.installment_amount},
          vat_rate = ${value.vat_rate},
          amount_includes_vat = ${value.amount_includes_vat},
          fixed_charges = ${JSON.stringify(value.fixed_charges || [])}::jsonb,
          fixed_amount = ${value.fixed_amount || 0},
          first_due_date = ${value.first_due_date},
          status = COALESCE(${value.status}, status),
          notes = ${value.notes},
          attachment_url = ${value.attachment_url},
          attachment_name = ${value.attachment_name},
          analysis_json = COALESCE(${value.analysis_json ? JSON.stringify(value.analysis_json) : null}::jsonb, analysis_json),
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    let summary = `تعديل عقد الإيجار ${value.contract_number || existing.contract_number || `#${id}`} — ${value.lessor_name}`;
    if (value.regenerate_schedule) {
      const result = await replaceSchedule(id, rows, {
        keepPaid: true,
        matchBySeq: value.payment_frequency !== "custom"
      });
      if (result.kept_paid > 0) {
        warnings.push(`أُبقيت ${result.kept_paid} دفعة مسددة كما هي${result.skipped > 0 ? ` وأُهملت ${result.skipped} دفعة مولَّدة بنفس التسلسل` : ""}`);
      }
      summary += ` — أُعيد توليد الجدول (${result.inserted} دفعة جديدة، الإجمالي ${result.total_value.toFixed(2)} SAR)`;
    }
    if (value.project_id !== undefined && (value.project_id ?? null) !== (existing.project_id ?? null)) {
      const moved = await reconcileLeaseInvoicesProject(id, value.project_id ?? null);
      if (moved > 0) warnings.push(`أُعيدت نسبة ${moved} فاتورة استقطاع إلى مشروع التأسيس الجديد`);
    }
    const prevType = existing.contract_type || "branch";
    if (value.contract_type && value.contract_type !== prevType) {
      const moved = await repointLeaseInvoiceAccounts(id, value.contract_type);
      if (moved.updated > 0) {
        warnings.push(`حُوِّلت ${moved.updated} فاتورة استقطاع إلى حساب «${moved.account_name}»`);
        summary += ` — نُقلت ${moved.updated} فاتورة استقطاع إلى حساب «${moved.account_name}»`;
      }
    }
    await logPurchaseAudit({
      entityType: "lease_contract",
      entityId: id,
      action: "updated",
      summary,
      actor: auth.user
    });
    const contract = await loadContract(id);
    return Response.json({
      ok: true,
      contract,
      warnings
    });
  } catch (error) {
    console.error("lease contract PUT error", error);
    return Response.json({
      error: "فشل تعديل العقد",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request, {
  params
} = {}) {
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
    const id = parseId(params);
    if (!id) {
      return Response.json({
        error: "معرف العقد غير صحيح"
      }, {
        status: 400
      });
    }
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const [contract] = await sql`
      SELECT id, contract_number, lessor_name, is_active
      FROM accounting_lease_contracts WHERE id = ${id}
    `;
    if (!contract) {
      return Response.json({
        error: "العقد غير موجود"
      }, {
        status: 404
      });
    }
    const label = contract.contract_number || `#${id}`;
    if (force) {
      const [paid] = await sql`
        SELECT COUNT(*)::int AS count FROM accounting_lease_payments
        WHERE contract_id = ${id} AND status = 'paid'
      `;
      if (Number(paid?.count) > 0) {
        return Response.json({
          error: "لا يمكن الحذف النهائي لعقد له دفعات مسددة — أوقفه بدل حذفه",
          code: "has_paid"
        }, {
          status: 409
        });
      }
      // حذف العقد نهائيًا يحذف كل فواتيره (حتى المسددة — لا يبقى أثر)،
      // ثم الدفعات تُحذف تتابعًا (CASCADE).
      const deletedInvoices = await deleteAllLeaseContractInvoices(id, auth.user, `حُذف العقد ${label} نهائيًا`);
      await sql`DELETE FROM accounting_lease_contracts WHERE id = ${id}`;
      await logPurchaseAudit({
        entityType: "lease_contract",
        entityId: id,
        action: "deleted",
        summary: `حذف نهائي لعقد الإيجار ${label} — ${contract.lessor_name}${deletedInvoices ? ` — حُذفت ${deletedInvoices} فاتورة مرتبطة` : ""}`,
        actor: auth.user
      });
      return Response.json({
        ok: true,
        hard: true,
        deleted_invoices: deletedInvoices
      });
    }
    await sql`
      UPDATE accounting_lease_contracts
      SET is_active = FALSE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    // إيقاف العقد يحذف كل فواتيره المرتبطة نهائيًا — حتى المسددة (قرار المالك).
    const deletedInvoices = await deleteAllLeaseContractInvoices(id, auth.user, `أُوقف العقد ${label}`);
    await logPurchaseAudit({
      entityType: "lease_contract",
      entityId: id,
      action: "deactivated",
      summary: `إيقاف عقد الإيجار ${label} — ${contract.lessor_name}${deletedInvoices ? ` — حُذفت ${deletedInvoices} فاتورة مرتبطة` : ""}`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      hard: false,
      deleted_invoices: deletedInvoices
    });
  } catch (error) {
    console.error("lease contract DELETE error", error);
    return Response.json({
      error: "فشل حذف العقد",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, PUT };
