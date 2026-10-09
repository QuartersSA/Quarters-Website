import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { e as ensureLeaseSchema, r as round2, t as todayRiyadh, u as parseMoney, z as loadReservesByPayment, R as REQUIRE_LEASE } from './leaseContracts-CiucmYFP.js';
import { d as resetSetAsideInvoice, m as markSetAsideInvoicePaid } from './leaseSetAsideInvoices-CtqlEtoU.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './purchaseInvoiceDelete-RdBVQHRn.js';
import './wasender-vtNAxFgq.js';
import './waNotify-BPFQhIP4.js';
import './coffeeInvoices-CYk167p4.js';
import './accountsTree-RnDnF4VP.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';
import './route-CqbhOu7v.js';
import './branchProjects-CcA6x5SF.js';
import './dateUtils-Bvji1KrH.js';

// تأكيد الاستقطاع الشهري لدفعة: تسجيل المبلغ المحوَّل إلى حساب الاستقطاع
// عن شهر معيّن لدفعة معلّقة (سجل accounting_lease_reserves؛ صف لكل دفعة/شهر).
// POST   /api/accounting/lease-contracts/reserve/confirm
//        { payment_id, month: "YYYY-MM", amount, note?, suggested_amount?, revenue_basis? }
//        amount = 0 يحذف صف الشهر.
// DELETE /api/accounting/lease-contracts/reserve/confirm?payment_id=&month=
// لا يُقبل شهر مستقبلي (لم تتحقق إيراداته بعد) ولا دفعة مسددة/ملغاة.

function parseMonth(value) {
  const text = String(value || "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}
async function loadPendingPayment(paymentId) {
  const [row] = await sql`
    SELECT p.id, p.contract_id, p.seq, p.status, p.amount_incl,
           TO_CHAR(p.due_date, 'YYYY-MM-DD') AS due_date,
           c.contract_number, c.lessor_name, c.is_renewal
    FROM accounting_lease_payments p
    JOIN accounting_lease_contracts c ON c.id = p.contract_id
    WHERE p.id = ${paymentId}
  `;
  return row || null;
}
function guardPayment(row) {
  if (!row) return {
    error: "الدفعة غير موجودة",
    status: 404
  };
  if (row.status === "paid") {
    return {
      error: "الدفعة مسددة — لا يُعدَّل استقطاعها بعد السداد",
      status: 409,
      code: "paid_row"
    };
  }
  if (row.status === "cancelled") {
    return {
      error: "الدفعة ملغاة — لا استقطاع لها",
      status: 409,
      code: "cancelled_row"
    };
  }
  return null;
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
    const body = await request.json().catch(() => ({}));
    const paymentId = Number(body.payment_id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return Response.json({
        error: "معرف الدفعة غير صحيح"
      }, {
        status: 400
      });
    }
    const month = parseMonth(body.month);
    if (!month) {
      return Response.json({
        error: "الشهر غير صحيح (YYYY-MM)"
      }, {
        status: 400
      });
    }
    const currentMonth = todayRiyadh().slice(0, 7);
    if (month > currentMonth) {
      return Response.json({
        error: "لا يمكن تأكيد استقطاع لشهر مستقبلي — إيراداته لم تتحقق بعد",
        code: "future_month"
      }, {
        status: 400
      });
    }
    const amount = round2(parseMoney(body.amount, -1));
    if (!(amount >= 0)) {
      return Response.json({
        error: "مبلغ الاستقطاع غير صحيح"
      }, {
        status: 400
      });
    }
    await ensureLeaseSchema();
    const row = await loadPendingPayment(paymentId);
    const guard = guardPayment(row);
    if (guard) {
      return Response.json({
        error: guard.error,
        code: guard.code
      }, {
        status: guard.status
      });
    }
    const amountIncl = Number(row.amount_incl) || 0;
    if (Number(row.seq) === 1 && row.is_renewal !== true && amount > 0) {
      return Response.json({
        error: "الدفعة الأولى في العقد الجديد بلا استقطاع شهري — تُسدَّد مباشرة من سداد المستحق (فعّل «عقد مجدد» إن كان كذلك)",
        code: "first_installment"
      }, {
        status: 400
      });
    }
    // لا استقطاع في شهر الاستحقاق أو بعده — الشهر لا ينتهي قبل موعد السداد.
    if (String(row.due_date || "").slice(0, 7) <= month && amount > 0) {
      return Response.json({
        error: `الاستقطاع يكون في الأشهر السابقة لشهر الاستحقاق (${String(row.due_date).slice(0, 7)})`,
        code: "due_month"
      }, {
        status: 400
      });
    }
    const existing = (await loadReservesByPayment([paymentId]))[paymentId] || [];
    const othersTotal = round2(existing.filter(e => e.month !== month).reduce((acc, e) => acc + e.amount, 0));
    if (othersTotal + amount > amountIncl + 0.005) {
      return Response.json({
        error: `مجموع الاستقطاعات (${round2(othersTotal + amount).toFixed(2)}) يتجاوز قيمة الدفعة شامل الضريبة (${amountIncl.toFixed(2)})`,
        code: "over_reserved"
      }, {
        status: 400
      });
    }
    const label = `الدفعة ${row.seq} لعقد ${row.contract_number || `#${row.contract_id}`} — ${row.lessor_name}`;
    const actorId = auth.user?.id ? Number(auth.user.id) : null;
    const actorName = auth.user?.name ? String(auth.user.name) : null;
    if (amount === 0) {
      const deleted = await sql`
        DELETE FROM accounting_lease_reserves
        WHERE payment_id = ${paymentId} AND month = ${month}
        RETURNING id
      `;
      if (deleted.length) {
        await logPurchaseAudit({
          entityType: "lease_payment",
          entityId: paymentId,
          action: "reserve_cleared",
          summary: `إلغاء استقطاع شهر ${month} عن ${label}`,
          actor: auth.user
        });
      }
      const resetInvoice = await resetSetAsideInvoice({
        paymentId,
        month,
        actor: auth.user
      }).catch(() => null);
      return Response.json({
        ok: true,
        removed: deleted.length > 0,
        invoice: resetInvoice,
        reserves: (await loadReservesByPayment([paymentId]))[paymentId] || []
      });
    }
    const suggested = body.suggested_amount === undefined || body.suggested_amount === null || body.suggested_amount === "" ? null : round2(parseMoney(body.suggested_amount, 0));
    const revenueBasis = body.revenue_basis === undefined || body.revenue_basis === null || body.revenue_basis === "" ? null : round2(parseMoney(body.revenue_basis, 0));
    const note = body.note ? String(body.note).trim().slice(0, 500) : null;
    const [saved] = await sql`
      INSERT INTO accounting_lease_reserves (
        payment_id, contract_id, month, amount, suggested_amount, revenue_basis, note,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${paymentId}, ${Number(row.contract_id)}, ${month}, ${amount}, ${suggested}, ${revenueBasis}, ${note},
        ${actorId}, ${actorName}
      )
      ON CONFLICT (payment_id, month) DO UPDATE
        SET amount = EXCLUDED.amount,
            suggested_amount = EXCLUDED.suggested_amount,
            revenue_basis = EXCLUDED.revenue_basis,
            note = EXCLUDED.note,
            created_by_employee_id = EXCLUDED.created_by_employee_id,
            created_by_employee_name = EXCLUDED.created_by_employee_name,
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      RETURNING id, (xmax = 0) AS inserted
    `;
    await logPurchaseAudit({
      entityType: "lease_payment",
      entityId: paymentId,
      action: "reserved",
      summary: `${saved?.inserted ? "تأكيد" : "تعديل"} استقطاع شهر ${month} عن ${label}: ${amount.toFixed(2)} SAR${suggested !== null && Math.abs(suggested - amount) > 0.005 ? ` (المقترح ${suggested.toFixed(2)})` : ""}`,
      actor: auth.user
    });
    // فاتورة الاستقطاع لهذا الشهر تصبح مسددة.
    const bankIdRaw = Number(body.bank_account_id);
    const bankAccountId = Number.isInteger(bankIdRaw) && bankIdRaw > 0 ? bankIdRaw : null;
    const invoice = await markSetAsideInvoicePaid({
      paymentId,
      month,
      amount,
      bankAccountId,
      actor: auth.user
    }).catch(error => {
      console.error("set-aside invoice pay failed", error?.message);
      return null;
    });
    const reserves = (await loadReservesByPayment([paymentId]))[paymentId] || [];
    return Response.json({
      ok: true,
      reserve: reserves.find(e => e.month === month) || null,
      reserves,
      invoice,
      reserved_total: round2(reserves.reduce((acc, e) => acc + e.amount, 0))
    });
  } catch (error) {
    console.error("lease reserve confirm error", error);
    return Response.json({
      error: "فشل تأكيد الاستقطاع",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
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
    const paymentId = Number(url.searchParams.get("payment_id"));
    const month = parseMonth(url.searchParams.get("month"));
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return Response.json({
        error: "معرف الدفعة غير صحيح"
      }, {
        status: 400
      });
    }
    if (!month) {
      return Response.json({
        error: "الشهر غير صحيح (YYYY-MM)"
      }, {
        status: 400
      });
    }
    await ensureLeaseSchema();
    const row = await loadPendingPayment(paymentId);
    const guard = guardPayment(row);
    if (guard) {
      return Response.json({
        error: guard.error,
        code: guard.code
      }, {
        status: guard.status
      });
    }
    const deleted = await sql`
      DELETE FROM accounting_lease_reserves
      WHERE payment_id = ${paymentId} AND month = ${month}
      RETURNING id, amount
    `;
    await resetSetAsideInvoice({
      paymentId,
      month,
      actor: auth.user
    }).catch(() => null);
    if (deleted.length) {
      await logPurchaseAudit({
        entityType: "lease_payment",
        entityId: paymentId,
        action: "reserve_cleared",
        summary: `إلغاء استقطاع شهر ${month} (${round2(deleted[0].amount).toFixed(2)} SAR) عن الدفعة ${row.seq} لعقد ${row.contract_number || `#${row.contract_id}`} — ${row.lessor_name}`,
        actor: auth.user
      });
    }
    return Response.json({
      ok: true,
      removed: deleted.length > 0
    });
  } catch (error) {
    console.error("lease reserve delete error", error);
    return Response.json({
      error: "فشل إلغاء الاستقطاع",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, POST };
