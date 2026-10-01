// فاتورة مشتريات مسير الرواتب: عند تقفيل شهر الرواتب تُنشأ فاتورة تحت
// حساب «رواتب وأجور» (5201) بتاريخ آخر يوم في الشهر المقفل، بند لكل
// موظف (الوصف = اسم الموظف، السعر = الراتب الصافي)، وتكون مدفوعة.
// عند فتح الشهر تُوقف الفاتورة (إيقاف لا حذف)، وعند التقفيل مجددًا تُعاد
// الفاتورة نفسها إلى النشاط وتُحدَّث بنودها وإجماليها من آخر بيانات
// الشهر المقفل (نفس الرقم والمعرّف — لا نسخة جديدة).

import sql from "@/app/api/utils/sql";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";
import { hardDeletePurchaseInvoices } from "@/app/api/utils/purchaseInvoiceDelete";
import { createPurchaseInvoice } from "@/app/api/accounting/purchase-invoices/route";
import { insertLineStatement, reserveIds } from "@/app/api/utils/coffeeInvoices";

const SALARIES_CODE = "5201";
const SALARIES_NAME = "رواتب وأجور";

export function payrollInvoiceNumber(month) {
  return `PAY-${month}`;
}

// آخر يوم في الشهر (YYYY-MM → YYYY-MM-DD).
export function lastDayOfMonth(month) {
  const [y, m] = String(month).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

// حساب «رواتب وأجور»: بالرمز 5201 أولًا، ثم بالاسم تحت 52، وإلا يُنشأ.
export async function getSalariesAccountId() {
  const [byCode] = await sql`
    SELECT id FROM accounting_accounts
    WHERE code = ${SALARIES_CODE} AND account_type = 'expense' AND is_active
    LIMIT 1
  `;
  if (byCode) return Number(byCode.id);
  const [parent] = await sql`
    SELECT id, code FROM accounting_accounts
    WHERE code = '52' AND is_system AND is_active
    LIMIT 1
  `;
  if (!parent) return null;
  const [byName] = await sql`
    SELECT id FROM accounting_accounts
    WHERE parent_id = ${parent.id} AND is_active AND account_type = 'expense'
      AND TRIM(name) = ${SALARIES_NAME}
    LIMIT 1
  `;
  if (byName) return Number(byName.id);
  const [created] = await sql`
    INSERT INTO accounting_accounts (code, name, name_en, account_type, parent_id, is_postable, is_system)
    VALUES (${SALARIES_CODE}, ${SALARIES_NAME}, 'Salaries & Wages', 'expense', ${parent.id}, TRUE, TRUE)
    RETURNING id
  `;
  return Number(created.id);
}

// إيقاف فواتير الرواتب النشطة لهذا الشهر (فتح الشهر أو قبل إعادة الإنشاء).
// (لا إيقاف للفواتير — قرار المالك: فتح الشهر يحذف فاتورته نهائيًا، والتقفيل
// مجددًا ينشئها من جديد بنفس الرقم.)
export async function deactivatePayrollInvoices(month, actor, reason) {
  const number = payrollInvoiceNumber(month);
  const rows = await sql`
    SELECT id FROM accounting_purchase_invoices WHERE invoice_number = ${number}
  `;
  const deleted = await hardDeletePurchaseInvoices(
    rows.map((r) => r.id),
    { actor, reason: `فاتورة الرواتب ${number} — ${reason}` },
  );
  return deleted.length;
}

// إنشاء فاتورة الرواتب لشهر مقفل. تعيد { ok, invoice_number, total, count }
// أو { ok:false, error }.
export async function syncPayrollInvoice({ runId, month, actor }) {
  const accountId = await getSalariesAccountId();
  if (!accountId) {
    return { ok: false, error: "حساب «رواتب وأجور» غير موجود في شجرة الحسابات (المجموعة 52 مفقودة)" };
  }
  const entries = await sql`
    SELECT employee_name, net_salary
    FROM accounting_payroll_entries
    WHERE run_id = ${runId}
    ORDER BY employee_name ASC, employee_id ASC
  `;
  const items = entries
    .map((row) => ({
      description: String(row.employee_name || "موظف").trim(),
      account_id: accountId,
      quantity: 1,
      unit_price: Math.round((Number(row.net_salary) || 0) * 100) / 100,
      tax_rate: 0,
      amount_includes_tax: false,
    }))
    .filter((line) => line.unit_price > 0);
  if (!items.length) {
    return { ok: false, error: "لا رواتب صافية أكبر من صفر في هذا الشهر" };
  }
  const total = Math.round(items.reduce((sum, line) => sum + line.unit_price, 0) * 100) / 100;
  const invoiceDate = lastDayOfMonth(month);
  const number = payrollInvoiceNumber(month);

  // تقفيل متكرر لنفس الشهر: الفاتورة القائمة (ولو موقوفة) تُحدَّث في
  // مكانها — بنودها وإجماليها ودفعتها — وتعود نشطة.
  const [existing] = await sql`
    SELECT id, is_active FROM accounting_purchase_invoices
    WHERE invoice_number = ${number} AND invoice_kind = 'purchase' AND is_active = TRUE
    ORDER BY id DESC
    LIMIT 1
  `;
  const supplierName = `مسير الرواتب — ${month}`;
  const notes = `فاتورة مسير الرواتب لشهر ${month} — أُنشئت تلقائيًا عند تقفيل الشهر (${items.length} موظف).`;
  const actorId = actor?.id ? Number(actor.id) : null;
  const actorName = actor?.name ? String(actor.name) : null;

  if (existing) {
    const invoiceId = Number(existing.id);
    const lineIds = await reserveIds("accounting_purchase_invoice_items", items.length);
    const lines = items.map((line, index) => ({
      position: index,
      description: line.description,
      accountId: accountId,
      quantity: 1,
      unitPrice: line.unit_price,
      amount: line.unit_price,
      taxRate: 0,
      includesTax: false,
      subtotal: line.unit_price,
      tax: 0,
      total: line.unit_price,
      lineDiscount: 0,
      lineNet: line.unit_price,
      coffee: null,
    }));
    await sql.transaction([
      sql`
        UPDATE accounting_purchase_invoices
        SET supplier_name = ${supplierName}, contact_id = NULL,
            expense_account_id = ${accountId},
            invoice_date = ${invoiceDate}, due_date = ${invoiceDate}, currency = 'SAR',
            subtotal_amount = ${total}, discount_amount = 0, tax_amount = 0,
            total_amount = ${total}, paid_amount = ${total},
            workflow_status = 'pending_payment', notes = ${notes},
            is_active = TRUE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${invoiceId}
      `,
      sql`DELETE FROM accounting_purchase_invoice_items WHERE invoice_id = ${invoiceId}`,
      ...lines.map((line, index) => insertLineStatement(lineIds[index], invoiceId, line)),
      sql`DELETE FROM accounting_purchase_invoice_payments WHERE invoice_id = ${invoiceId}`,
      sql`
        INSERT INTO accounting_purchase_invoice_payments (
          invoice_id, amount, payment_date, bank_account_id, receipt_url, notes,
          created_by_employee_id, created_by_employee_name
        )
        VALUES (
          ${invoiceId}, ${total}, ${invoiceDate}, NULL, NULL,
          'دفعة مسير الرواتب — تُحدَّث مع تقفيل الشهر',
          ${actorId}, ${actorName}
        )
      `,
    ]);
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoiceId,
      action: "updated",
      summary: `تحديث فاتورة الرواتب ${number} عند تقفيل الشهر مجددًا: ${items.length} موظف، الإجمالي ${total.toFixed(2)}${existing.is_active === false ? " — أُعيد تفعيلها" : ""}`,
      actor,
    });
    return {
      ok: true,
      invoice_id: invoiceId,
      invoice_number: number,
      invoice_date: invoiceDate,
      total,
      count: items.length,
      updated: true,
    };
  }

  const result = await createPurchaseInvoice(
    {
      invoice_number: number,
      supplier_name: supplierName,
      expense_account_id: accountId,
      invoice_date: invoiceDate,
      due_date: invoiceDate,
      currency: "SAR",
      items,
      subtotal_amount: total,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: total,
      paid_amount: total,
      workflow_status: "pending_payment",
      notes,
    },
    actor,
  );
  if (!result?.ok) {
    return { ok: false, error: result?.error || "فشل إنشاء فاتورة الرواتب" };
  }
  return {
    ok: true,
    invoice_id: result.invoice?.id ?? null,
    invoice_number: number,
    invoice_date: invoiceDate,
    total,
    count: items.length,
  };
}
