import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { e as ensureLeaseSchema, k as parseDate, m as parseMoney, d as deactivateSetAsideInvoicesForPayments, o as installmentAmounts, q as recomputeContractTotal, n as loadPayment, R as REQUIRE_LEASE } from './leaseContracts-5fHmsgHE.js';
import '@neondatabase/serverless';
import 'crypto';

// تعديل دفعة معلّقة/ملغاة (تاريخ الاستحقاق، المبلغ قبل الضريبة، نسبة
// الضريبة، ملاحظة، الحالة pending|cancelled). المسددة لا تُعدَّل هنا.
// PUT /api/accounting/lease-contracts/payments/[id]

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
    const id = Number(params?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف الدفعة غير صحيح"
      }, {
        status: 400
      });
    }
    const body = await request.json().catch(() => ({}));
    const [payment] = await sql`
      SELECT p.id, p.contract_id, p.seq, p.status,
             TO_CHAR(p.due_date, 'YYYY-MM-DD') AS due_date,
             p.amount_excl, p.fixed_exempt_excl, p.vat_rate, p.notes,
             c.contract_number, c.lessor_name
      FROM accounting_lease_payments p
      JOIN accounting_lease_contracts c ON c.id = p.contract_id
      WHERE p.id = ${id}
    `;
    if (!payment) {
      return Response.json({
        error: "الدفعة غير موجودة"
      }, {
        status: 404
      });
    }
    if (payment.status === "paid") {
      return Response.json({
        error: "الدفعة مسددة — تراجع عن السداد أولًا قبل تعديلها",
        code: "paid_row"
      }, {
        status: 409
      });
    }
    let dueDate = payment.due_date;
    if (body.due_date !== undefined) {
      const parsedDue = parseDate(body.due_date);
      if (!parsedDue) {
        return Response.json({
          error: "تاريخ الاستحقاق غير صحيح (YYYY-MM-DD)"
        }, {
          status: 400
        });
      }
      dueDate = parsedDue;
    }
    let amountExcl = Number(payment.amount_excl) || 0;
    if (body.amount_excl !== undefined) {
      amountExcl = parseMoney(body.amount_excl, 0);
      if (!(amountExcl > 0)) {
        return Response.json({
          error: "مبلغ الدفعة يجب أن يكون أكبر من صفر"
        }, {
          status: 400
        });
      }
    }
    let vatRate = Number(payment.vat_rate) || 0;
    if (body.vat_rate !== undefined && body.vat_rate !== null && body.vat_rate !== "") {
      const rate = Number(body.vat_rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return Response.json({
          error: "نسبة الضريبة يجب أن تكون بين 0 و100"
        }, {
          status: 400
        });
      }
      vatRate = Math.round(rate * 100) / 100;
    }
    let status = payment.status;
    if (body.status !== undefined) {
      if (!["pending", "cancelled"].includes(body.status)) {
        return Response.json({
          error: "حالة الدفعة غير صالحة"
        }, {
          status: 400
        });
      }
      status = body.status;
    }
    if (status === "cancelled" && payment.status !== "cancelled") {
      await deactivateSetAsideInvoicesForPayments([id], auth.user, "أُلغيت الدفعة");
    }
    const notes = body.notes === undefined ? payment.notes : body.notes ? String(body.notes).trim().slice(0, 2000) : null;

    // الضريبة على (المبلغ − الثابت المعفى) فقط؛ المعفى يُضاف بعدها.
    const exemptFixed = Math.min(Math.max(Number(payment.fixed_exempt_excl) || 0, 0), amountExcl);
    const taxed = installmentAmounts({
      amount: amountExcl - exemptFixed,
      vatRate,
      amountIncludesVat: false
    });
    const money = {
      amount_excl: Math.round((taxed.amount_excl + exemptFixed) * 100) / 100,
      vat_rate: taxed.vat_rate,
      vat_amount: taxed.vat_amount,
      amount_incl: Math.round((taxed.amount_incl + exemptFixed) * 100) / 100
    };
    await sql`
      UPDATE accounting_lease_payments
      SET due_date = ${dueDate},
          amount_excl = ${money.amount_excl},
          vat_rate = ${money.vat_rate},
          vat_amount = ${money.vat_amount},
          amount_incl = ${money.amount_incl},
          status = ${status},
          notes = ${notes},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    await recomputeContractTotal(Number(payment.contract_id));
    await logPurchaseAudit({
      entityType: "lease_payment",
      entityId: id,
      action: status !== payment.status ? status === "cancelled" ? "cancelled" : "reactivated" : "updated",
      summary: `تعديل الدفعة ${payment.seq} لعقد ${payment.contract_number || `#${payment.contract_id}`} — ${payment.lessor_name}: استحقاق ${dueDate}، ${money.amount_incl.toFixed(2)} SAR شامل، الحالة ${status}`,
      actor: auth.user
    });
    const updated = await loadPayment(id);
    return Response.json({
      ok: true,
      payment: updated
    });
  } catch (error) {
    console.error("lease payment PUT error", error);
    return Response.json({
      error: "فشل تعديل الدفعة",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { PUT };
