import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DX8U_Szq.js';
import { n as notifyByPref } from './waNotify-B7OcatGW.js';
import '@neondatabase/serverless';
import 'crypto';
import './wasender-CtjKFWCW.js';

const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};
function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Riyadh"
  });
}
function parseMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}
function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

// سجل دفعات الفاتورة — الإضافة والحذف هنا يحدّثان رأس الفاتورة
// (paid_amount) في نفس العملية فيبقى مجموع السجل مطابقاً للرأس
// الذي تُحسب منه الحالة.

async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const url = new URL(request.url);
    const invoiceId = Number(url.searchParams.get("invoice_id"));
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return Response.json({
        error: "معرف الفاتورة غير صحيح"
      }, {
        status: 400
      });
    }
    const rows = await sql`
      SELECT p.id, p.invoice_id, p.amount,
             TO_CHAR(p.payment_date, 'YYYY-MM-DD') AS payment_date,
             p.bank_account_id, bank.name AS bank_name,
             p.receipt_url, p.notes, p.created_by_employee_name
      FROM accounting_purchase_invoice_payments p
      LEFT JOIN accounting_bank_accounts bank ON bank.id = p.bank_account_id
      WHERE p.invoice_id = ${invoiceId}
      ORDER BY p.payment_date, p.id
    `;
    return Response.json({
      payments: rows
    });
  } catch (error) {
    console.error("invoice payments GET error", error);
    return Response.json({
      error: "فشل تحميل سجل الدفعات",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const invoiceId = Number(body.invoice_id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return Response.json({
        error: "معرف الفاتورة غير صحيح"
      }, {
        status: 400
      });
    }
    const amount = parseMoney(body.amount);
    if (amount <= 0) {
      return Response.json({
        error: "مبلغ الدفعة مطلوب"
      }, {
        status: 400
      });
    }
    const [invoice] = await sql`
      SELECT inv.id, inv.invoice_number, inv.currency,
             inv.total_amount, inv.paid_amount,
             inv.created_by_employee_id,
             COALESCE(NULLIF(inv.supplier_name, ''), c.name) AS supplier
      FROM accounting_purchase_invoices inv
      LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
      WHERE inv.id = ${invoiceId} AND inv.is_active = TRUE
    `;
    if (!invoice) {
      return Response.json({
        error: "الفاتورة غير موجودة"
      }, {
        status: 404
      });
    }
    const total = Number(invoice.total_amount || 0);
    const paid = Number(invoice.paid_amount || 0);
    const balance = Math.max(total - paid, 0);
    if (amount > balance + 0.005) {
      return Response.json({
        error: "الدفعة أكبر من الرصيد المتبقي"
      }, {
        status: 400
      });
    }
    const paymentDate = parseDate(body.payment_date) || todayRiyadh();
    const bankIdRaw = Number(body.bank_account_id);
    const bankAccountId = Number.isInteger(bankIdRaw) && bankIdRaw > 0 ? bankIdRaw : null;
    const receiptUrl = body.receipt_url ? String(body.receipt_url).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const actorId = auth.user?.id ? Number(auth.user.id) : null;
    const actorName = auth.user?.name ? String(auth.user.name) : null;
    const [payment] = await sql`
      INSERT INTO accounting_purchase_invoice_payments (
        invoice_id, amount, payment_date, bank_account_id,
        receipt_url, notes,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${invoiceId}, ${amount}, ${paymentDate}, ${bankAccountId},
        ${receiptUrl}, ${notes}, ${actorId}, ${actorName}
      )
      RETURNING id
    `;
    const newPaid = Math.min(Math.round((paid + amount) * 100) / 100, total);
    const [updated] = await sql`
      UPDATE accounting_purchase_invoices
      SET paid_amount = ${newPaid},
          paid_bank_account_id = COALESCE(${bankAccountId}, paid_bank_account_id),
          payment_receipt_url = COALESCE(${receiptUrl}, payment_receipt_url),
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${invoiceId}
      RETURNING *
    `;
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoiceId,
      action: "payment",
      summary: `تسجيل دفعة ${amount.toFixed(2)} ${invoice.currency || "SAR"} بتاريخ ${paymentDate} على الفاتورة ${invoice.invoice_number} — إجمالي المدفوع ${newPaid.toFixed(2)} من ${total.toFixed(2)}`,
      actor: auth.user
    });

    // إشعار واتساب لمنشئ الفاتورة (إن اشترك في «إيصال التحويل»).
    if (invoice.created_by_employee_id) {
      let bankName = null;
      if (bankAccountId) {
        const [bank] = await sql`
          SELECT name, bank_name FROM accounting_bank_accounts
          WHERE id = ${bankAccountId}
        `;
        bankName = bank ? `${bank.name}${bank.bank_name ? ` — ${bank.bank_name}` : ""}` : null;
      }
      const lines = ["💳 تم تسجيل دفعة على فاتورتك", `الفاتورة: ${invoice.invoice_number}`, invoice.supplier ? `المورد: ${invoice.supplier}` : null, `الدفعة: ${amount.toFixed(2)} ${invoice.currency || "SAR"} بتاريخ ${paymentDate}`, bankName ? `البنك: ${bankName}` : null, `الإجمالي المدفوع: ${newPaid.toFixed(2)} من ${total.toFixed(2)}`, actorName ? `سجلها: ${actorName}` : null, receiptUrl ? `الإيصال: ${receiptUrl}` : null].filter(Boolean);
      notifyByPref("acc_payment_receipt", lines.join("\n"), {
        onlyEmployeeId: invoice.created_by_employee_id
      });
    }
    return Response.json({
      ok: true,
      payment_id: payment.id,
      invoice: updated
    }, {
      status: 201
    });
  } catch (error) {
    console.error("invoice payments POST error", error);
    return Response.json({
      error: "فشل تسجيل الدفعة",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف الدفعة غير صحيح"
      }, {
        status: 400
      });
    }
    const [payment] = await sql`
      SELECT p.*, inv.invoice_number, inv.paid_amount AS invoice_paid
      FROM accounting_purchase_invoice_payments p
      JOIN accounting_purchase_invoices inv ON inv.id = p.invoice_id
      WHERE p.id = ${id}
    `;
    if (!payment) {
      return Response.json({
        error: "الدفعة غير موجودة"
      }, {
        status: 404
      });
    }
    await sql`
      DELETE FROM accounting_purchase_invoice_payments
      WHERE id = ${id}
    `;
    const newPaid = Math.max(Math.round((Number(payment.invoice_paid) - Number(payment.amount)) * 100) / 100, 0);
    await sql`
      UPDATE accounting_purchase_invoices
      SET paid_amount = ${newPaid},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${payment.invoice_id}
    `;
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: Number(payment.invoice_id),
      action: "payment_removed",
      summary: `حذف دفعة ${Number(payment.amount).toFixed(2)} (بتاريخ ${payment.payment_date instanceof Date ? payment.payment_date.toISOString().slice(0, 10) : payment.payment_date}) من الفاتورة ${payment.invoice_number} — المدفوع الآن ${newPaid.toFixed(2)}`,
      actor: auth.user
    });
    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("invoice payments DELETE error", error);
    return Response.json({
      error: "فشل حذف الدفعة",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST };
