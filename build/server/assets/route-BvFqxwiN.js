import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureCoffeeSchema, c as loadInvoiceLines, f as reverseDeposits, d as recomputeItemCost, p as recordArrival, C as CoffeeError } from './coffeeInvoices-CqLuS3xh.js';
import '@neondatabase/serverless';
import 'crypto';
import './accountsTree-BiYqjwch.js';
import './purchaseAudit-CVdAiEPz.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';

// POST /api/accounting/purchase-invoices/arrival
//
// تسجيل وصول بنود البن لفاتورة مشتريات (الكمية الواصلة، تاريخ الوصول،
// اكتمال الوصول) + الإيداع في المخزون + إعادة حساب تكلفة الصنف.
// body: {
//   invoice_id, expected_updated_at?,
//   lines: [{ id, received_kg | null, arrival_date, arrival_complete, arrival_note, confirm_high_waste }],
//   deposit: { enabled, branch_id } | null,
//   reverse_deposit: true   ← عكس إيداع الفاتورة كاملًا (إدارة فقط)
// }
// الصلاحيات: إدارة المحاسبة/المشتريات/المخزون تعتمد الوصول؛ موظف
// الإدخال الميداني (can_add_purchase_invoices) يبلّغ الكمية فقط.

const REQUIRE_ARRIVAL = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }, {
    role: "Admin",
    permission: "can_manage_inventory"
  }, {
    permission: "can_add_purchase_invoices"
  }]
};
function canFinalize(user) {
  return user?.role === "Admin" && !!(user?.can_manage_accounting || user?.can_manage_purchases || user?.can_manage_inventory);
}
function sameInstant(a, b) {
  if (!a || !b) return true;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) < 1000;
}
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ARRIVAL);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureCoffeeSchema();
    const body = await request.json().catch(() => ({}));
    const invoiceId = Number(body.invoice_id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return Response.json({
        error: "معرف الفاتورة غير صحيح"
      }, {
        status: 400
      });
    }
    const [invoice] = await sql`
      SELECT id, invoice_number, invoice_kind, is_active, branch_id, updated_at
      FROM accounting_purchase_invoices WHERE id = ${invoiceId}
    `;
    if (!invoice) return Response.json({
      error: "الفاتورة غير موجودة"
    }, {
      status: 404
    });
    if (invoice.is_active === false) {
      return Response.json({
        error: "الفاتورة موقوفة",
        code: "inactive_invoice"
      }, {
        status: 409
      });
    }
    if (invoice.invoice_kind === "roast") {
      return Response.json({
        error: "فاتورة التحميص لا تحمل وصولًا — سجّله على فاتورة البن"
      }, {
        status: 400
      });
    }
    if (body.expected_updated_at && !sameInstant(invoice.updated_at, body.expected_updated_at)) {
      return Response.json({
        error: "الفاتورة تغيّرت من مستخدم آخر — أعد فتحها ثم كرّر التعديل",
        code: "stale_invoice"
      }, {
        status: 409
      });
    }
    const finalize = canFinalize(auth.user);
    if (body.reverse_deposit === true) {
      if (!finalize) return Response.json({
        error: "Forbidden"
      }, {
        status: 403
      });
      const lines = await loadInvoiceLines(invoiceId);
      const count = await reverseDeposits(invoiceId, auth.user);
      await sql`
        UPDATE accounting_purchase_invoices SET updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh') WHERE id = ${invoiceId}
      `;
      for (const itemId of new Set(lines.map(l => l.item_id).filter(Boolean).map(Number))) {
        await recomputeItemCost(itemId, auth.user);
      }
      return Response.json({
        ok: true,
        reversed: count
      });
    }
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length) return Response.json({
      error: "لا بنود لتسجيل وصولها"
    }, {
      status: 400
    });

    // الإيداع: موظف المخزون يودع في فرع الفاتورة فقط.
    let deposit = null;
    if (finalize && body.deposit && body.deposit.enabled) {
      const branchId = Number(body.deposit.branch_id) || Number(invoice.branch_id) || null;
      const inventoryOnly = !auth.user?.can_manage_accounting && !auth.user?.can_manage_purchases;
      if (inventoryOnly && invoice.branch_id && Number(invoice.branch_id) !== branchId) {
        return Response.json({
          error: "يمكن الإيداع في فرع الفاتورة فقط"
        }, {
          status: 403
        });
      }
      deposit = {
        enabled: true,
        branch_id: branchId
      };
    }
    const result = await recordArrival(invoice, lines, {
      deposit,
      actor: auth.user,
      canFinalize: finalize
    });
    const updatedLines = await loadInvoiceLines(invoiceId);
    return Response.json({
      ok: true,
      mode: finalize ? "finalized" : "reported",
      lines: updatedLines,
      touched_items: result.touchedItems
    });
  } catch (error) {
    if (error instanceof CoffeeError) {
      return Response.json({
        error: error.message,
        ...(error.extra || {})
      }, {
        status: error.status || 400
      });
    }
    console.error("coffee arrival POST error", error);
    return Response.json({
      error: "فشل تسجيل الوصول",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
