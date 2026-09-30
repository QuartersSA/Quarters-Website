import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { createPurchaseInvoice } from './route-CU6b0Pr9.js';
import { e as ensureLeaseSchema, a as parseDate, t as todayRiyadh, c as parseMoney, g as getRentAccountId, d as loadPayment, R as REQUIRE_LEASE } from './leaseContracts-DG6L4did.js';
import '@neondatabase/serverless';
import 'crypto';
import './accountsTree-BiYqjwch.js';
import './purchaseAutomation-DG3aaNSa.js';
import './wasender-DykD1wlV.js';
import './waNotify-CtLfIpXX.js';
import './coffeeInvoices-tatr7e1X.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';
import './leaseMath-rcRs1QEf.js';

// سداد دفعة إيجار: تُنشأ فاتورة مشتريات مدفوعة تحت حساب «إيجارات»
// (رقمها LEASE-<العقد>-<التسلسل>) ثم تُعلَّم الدفعة مسددة وتُربط بها.
// POST /api/accounting/lease-contracts/payments/[id]/pay
// body: { paid_date, paid_amount?, bank_account_id?, receipt_url?, notes? }

async function POST(request, {
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
    const [row] = await sql`
      SELECT p.id, p.contract_id, p.seq, p.status,
             TO_CHAR(p.due_date, 'YYYY-MM-DD') AS due_date,
             TO_CHAR(p.period_start, 'YYYY-MM-DD') AS period_start,
             TO_CHAR(p.period_end, 'YYYY-MM-DD') AS period_end,
             p.amount_excl, p.fixed_excl, p.vat_rate, p.vat_amount, p.amount_incl, p.notes,
             c.contract_number, c.lessor_name, c.lessor_contact_id, c.location,
             c.branch_id, c.is_active AS contract_active, c.fixed_charges
      FROM accounting_lease_payments p
      JOIN accounting_lease_contracts c ON c.id = p.contract_id
      WHERE p.id = ${id}
    `;
    if (!row) {
      return Response.json({
        error: "الدفعة غير موجودة"
      }, {
        status: 404
      });
    }
    if (row.status === "paid") {
      return Response.json({
        error: "الدفعة مسددة مسبقًا",
        code: "already_paid"
      }, {
        status: 409
      });
    }
    if (row.status === "cancelled") {
      return Response.json({
        error: "الدفعة ملغاة — أعدها إلى «معلّقة» قبل سدادها",
        code: "cancelled_row"
      }, {
        status: 409
      });
    }
    if (row.contract_active === false) {
      return Response.json({
        error: "العقد موقوف — أعد تفعيله قبل السداد",
        code: "inactive_contract"
      }, {
        status: 409
      });
    }

    // تاريخ السداد: اليوم إن لم يُرسل، ويُرفض إن أُرسل بصيغة خاطئة.
    const dateProvided = body.paid_date !== undefined && body.paid_date !== null && String(body.paid_date).trim() !== "";
    const paidDate = dateProvided ? parseDate(body.paid_date) : todayRiyadh();
    if (!paidDate) {
      return Response.json({
        error: "تاريخ السداد غير صحيح (YYYY-MM-DD)"
      }, {
        status: 400
      });
    }
    const amountExcl = Number(row.amount_excl) || 0;
    const vatAmount = Number(row.vat_amount) || 0;
    const amountIncl = Number(row.amount_incl) || 0;
    const paidAmount = body.paid_amount === undefined || body.paid_amount === null || body.paid_amount === "" ? amountIncl : parseMoney(body.paid_amount, 0);
    if (!(paidAmount > 0)) {
      return Response.json({
        error: "مبلغ السداد يجب أن يكون أكبر من صفر"
      }, {
        status: 400
      });
    }
    if (paidAmount > amountIncl + 0.005) {
      return Response.json({
        error: "مبلغ السداد لا يمكن أن يتجاوز قيمة الدفعة شامل الضريبة"
      }, {
        status: 400
      });
    }
    // لا سداد جزئي: الصف يُعلَّم مسددًا بكامل قيمته وإلا اختل مجموع
    // المدفوع + المعلّق مقابل إجمالي العقد. للتقسيم يُعدَّل الجدول.
    if (paidAmount < amountIncl - 0.005) {
      return Response.json({
        error: "السداد الجزئي غير مدعوم — أدخل كامل قيمة الدفعة شامل الضريبة، أو قسّم الدفعة من جدول العقد",
        code: "partial_payment"
      }, {
        status: 400
      });
    }
    const bankIdRaw = Number(body.bank_account_id);
    const bankAccountId = Number.isInteger(bankIdRaw) && bankIdRaw > 0 ? bankIdRaw : null;
    const receiptUrl = body.receipt_url ? String(body.receipt_url).trim() : null;
    const notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;
    const invoiceNumber = `LEASE-${row.contract_id}-${row.seq}`;
    const [existingInvoice] = await sql`
      SELECT id FROM accounting_purchase_invoices
      WHERE invoice_number = ${invoiceNumber} AND is_active = TRUE
      LIMIT 1
    `;
    if (existingInvoice) {
      return Response.json({
        error: `توجد فاتورة نشطة بالرقم ${invoiceNumber} — أوقفها أو تراجع عن سدادها أولًا`,
        code: "invoice_exists",
        invoice_id: existingInvoice.id
      }, {
        status: 409
      });
    }
    const rentAccountId = await getRentAccountId();
    if (!rentAccountId) {
      return Response.json({
        error: "حساب «إيجارات» غير موجود في شجرة الحسابات (المجموعة 52 مفقودة)"
      }, {
        status: 500
      });
    }
    const period = row.period_start && row.period_end ? ` (${row.period_start} → ${row.period_end})` : "";
    // بند الأجرة + بند المبالغ الثابتة (إن وُجدت) — كلاهما تحت «إيجارات».
    const fixedExcl = Math.min(Math.max(Number(row.fixed_excl) || 0, 0), amountExcl);
    const rentExcl = Math.round((amountExcl - fixedExcl) * 100) / 100;
    const taxRate = Number(row.vat_rate) || 0;
    const invoiceLines = [];
    if (rentExcl > 0) {
      invoiceLines.push({
        description: `إيجار ${row.location || row.contract_number || ""} — الدفعة ${row.seq}`.replace(/\s+/g, " ").trim() + period,
        account_id: rentAccountId,
        quantity: 1,
        unit_price: rentExcl,
        tax_rate: taxRate,
        amount_includes_tax: false
      });
    }
    if (fixedExcl > 0) {
      const labels = Array.isArray(row.fixed_charges) ? row.fixed_charges.map(c => c?.label).filter(Boolean).join("، ") : "";
      invoiceLines.push({
        description: `مبالغ ثابتة${labels ? ` (${labels})` : ""} — الدفعة ${row.seq}${period}`,
        account_id: rentAccountId,
        quantity: 1,
        unit_price: fixedExcl,
        tax_rate: taxRate,
        amount_includes_tax: false
      });
    }
    const result = await createPurchaseInvoice({
      invoice_number: invoiceNumber,
      contact_id: row.lessor_contact_id || null,
      supplier_name: row.lessor_name,
      expense_account_id: rentAccountId,
      invoice_date: paidDate,
      due_date: row.due_date,
      currency: "SAR",
      items: invoiceLines,
      subtotal_amount: amountExcl,
      discount_amount: 0,
      tax_amount: vatAmount,
      total_amount: amountIncl,
      paid_amount: paidAmount,
      paid_bank_account_id: bankAccountId || null,
      payment_receipt_url: receiptUrl || null,
      workflow_status: "pending_payment",
      branch_id: row.branch_id || null,
      notes: `دفعة عقد إيجار ${row.contract_number || row.contract_id} — ${row.lessor_name}`
    }, auth.user);
    if (!result?.ok) {
      const {
        ok,
        status,
        error,
        ...extra
      } = result || {};
      return Response.json({
        error: error || "فشل إنشاء فاتورة الإيجار",
        ...extra
      }, {
        status: status || 400
      });
    }
    const invoiceId = Number(result.invoice?.id);
    await sql`
      UPDATE accounting_lease_payments
      SET status = 'paid',
          paid_date = ${paidDate},
          paid_amount = ${paidAmount},
          invoice_id = ${invoiceId},
          bank_account_id = ${bankAccountId},
          receipt_url = ${receiptUrl},
          notes = COALESCE(${notes}, notes),
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    await logPurchaseAudit({
      entityType: "lease_payment",
      entityId: id,
      action: "paid",
      summary: `سداد الدفعة ${row.seq} لعقد ${row.contract_number || `#${row.contract_id}`} — ${row.lessor_name}: ${paidAmount.toFixed(2)} SAR بتاريخ ${paidDate} (فاتورة ${invoiceNumber})`,
      actor: auth.user
    });
    const payment = await loadPayment(id);
    return Response.json({
      ok: true,
      payment,
      invoice: {
        id: invoiceId,
        invoice_number: invoiceNumber
      }
    });
  } catch (error) {
    console.error("lease payment pay error", error);
    return Response.json({
      error: "فشل تسجيل سداد الدفعة",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
