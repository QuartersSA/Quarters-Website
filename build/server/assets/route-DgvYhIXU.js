import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { h as hardDeletePurchaseInvoices } from './purchaseInvoiceDelete-RdBVQHRn.js';
import { e as ensureLeaseSchema, w as loadPayment, R as REQUIRE_LEASE } from './leaseContracts-M1M5QWMp.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';

// التراجع عن سداد دفعة إيجار: توقَف فاتورة المشتريات المرتبطة (إيقاف
// لا حذف — مع سجل تدقيق) وتعود الدفعة معلّقة بلا بيانات سداد.
// POST /api/accounting/lease-contracts/payments/[id]/unpay

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
    const [row] = await sql`
      SELECT p.id, p.contract_id, p.seq, p.status, p.invoice_id, p.paid_amount,
             c.contract_number, c.lessor_name
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
    if (row.status !== "paid") {
      return Response.json({
        error: "الدفعة غير مسددة أصلًا",
        code: "not_paid"
      }, {
        status: 409
      });
    }
    if (row.invoice_id) {
      await hardDeletePurchaseInvoices([Number(row.invoice_id)], {
        actor: auth.user,
        reason: `تراجع عن سداد الدفعة ${row.seq} لعقد ${row.contract_number || `#${row.contract_id}`}`
      });
    }
    await sql`
      UPDATE accounting_lease_payments
      SET status = 'pending',
          paid_date = NULL,
          paid_amount = NULL,
          invoice_id = NULL,
          bank_account_id = NULL,
          receipt_url = NULL,
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
    `;
    await logPurchaseAudit({
      entityType: "lease_payment",
      entityId: id,
      action: "unpaid",
      summary: `تراجع عن سداد الدفعة ${row.seq} لعقد ${row.contract_number || `#${row.contract_id}`} — ${row.lessor_name} (كان المسدد ${Number(row.paid_amount || 0).toFixed(2)} SAR)`,
      actor: auth.user
    });
    const payment = await loadPayment(id);
    return Response.json({
      ok: true,
      payment
    });
  } catch (error) {
    console.error("lease payment unpay error", error);
    return Response.json({
      error: "فشل التراجع عن السداد",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
