// فاتورة مشتريات مسير الرواتب: عند تقفيل شهر الرواتب تُنشأ فاتورة تحت
// حساب «رواتب وأجور» (5201) بتاريخ آخر يوم في الشهر المقفل، بند لكل
// موظف (الوصف = اسم الموظف، السعر = الراتب الصافي)، وتكون مدفوعة.
// عند فتح الشهر تُوقف الفاتورة (إيقاف لا حذف) حتى يُعاد إنشاؤها عند
// التقفيل التالي.

import sql from "@/app/api/utils/sql";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";
import { createPurchaseInvoice } from "@/app/api/accounting/purchase-invoices/route";

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
export async function deactivatePayrollInvoices(month, actor, reason) {
  const number = payrollInvoiceNumber(month);
  const rows = await sql`
    UPDATE accounting_purchase_invoices
    SET is_active = FALSE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE invoice_number = ${number} AND is_active = TRUE
    RETURNING id
  `;
  for (const row of rows) {
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: Number(row.id),
      action: "deactivated",
      summary: `إيقاف فاتورة الرواتب ${number} — ${reason}`,
      actor,
    });
  }
  return rows.length;
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

  // تقفيل متكرر لنفس الشهر: تُوقف السابقة وتُنشأ نسخة جديدة بنفس الرقم.
  await deactivatePayrollInvoices(month, actor, "أُعيد إنشاؤها عند تقفيل الشهر مجددًا");

  const result = await createPurchaseInvoice(
    {
      invoice_number: number,
      supplier_name: `مسير الرواتب — ${month}`,
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
      notes: `فاتورة مسير الرواتب لشهر ${month} — أُنشئت تلقائيًا عند تقفيل الشهر (${items.length} موظف).`,
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
