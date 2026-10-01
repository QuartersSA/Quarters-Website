import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { t as todayRiyadh, e as ensureLeaseSchema, R as REQUIRE_LEASE } from './leaseContracts-CF8g7tmp.js';
import { g as generateSetAsideInvoices, l as loadSetAsideInvoices } from './leaseSetAsideInvoices-BtBZrrpi.js';
import '@neondatabase/serverless';
import 'crypto';
import './purchaseInvoiceDelete-RdBVQHRn.js';
import './purchaseAudit-DZMMDeLJ.js';
import './ensureOnce-D_53iNPN.js';
import './wasender-vtNAxFgq.js';
import './waNotify-BPFQhIP4.js';
import './coffeeInvoices-CYk167p4.js';
import './accountsTree-RnDnF4VP.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';
import './route-dJGGy3uD.js';

// إنشاء فاتورة استقطاع شهر واحد لدفعة واحدة (مثلًا بعد حذفها يدويًا):
// يُزال الشهر من قائمة الاستثناء ثم تُولَّد الفاتورة إن لم تكن موجودة.
// POST /api/accounting/lease-contracts/reserve/invoice { payment_id, month }

function parseMonth(value) {
  const text = String(value || "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
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
    const month = parseMonth(body.month);
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
    if (month > todayRiyadh().slice(0, 7)) {
      return Response.json({
        error: "لا تُنشأ فاتورة لشهر لم يحل بعد"
      }, {
        status: 400
      });
    }
    await ensureLeaseSchema();
    await sql`DELETE FROM accounting_lease_setaside_skips WHERE payment_id = ${paymentId} AND month = ${month}`;
    const result = await generateSetAsideInvoices({
      upToMonth: month,
      actor: auth.user,
      only: {
        paymentId,
        month
      }
    });
    const invoice = (await loadSetAsideInvoices([paymentId]))[paymentId]?.[month] || null;
    if (!invoice) {
      return Response.json({
        error: "تعذر إنشاء الفاتورة — تأكد أن الدفعة معلّقة وأن الشهر ضمن أشهر استقطاعها"
      }, {
        status: 400
      });
    }
    return Response.json({
      ok: true,
      created: result.created,
      invoice
    });
  } catch (error) {
    console.error("lease set-aside invoice create error", error);
    return Response.json({
      error: "فشل إنشاء فاتورة الاستقطاع",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
