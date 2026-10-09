// حذف فواتير المشتريات نهائيًا (قرار المالك: لا «إيقاف» للفواتير — كل
// إزالة حذف كامل): الدفعات والبنود والمرفقات ثم الفاتورة، في معاملة
// واحدة، مع تسجيل في سجل التدقيق. تُستخدم من كل المسارات التي كانت توقف
// الفواتير (الرواتب، التحميص، الاستقطاع، التراجع عن السداد).

import sql from "@/app/api/utils/sql";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";

// فك ربط دفعات عقود المقاولين (مشاريع التأسيس) من فواتير على وشك الحذف:
// الدفعة تعود «بلا فاتورة» فتُحسب حالتها من جديد. الجدول قد لا يكون موجودًا
// (ميزة المشاريع غير مهيأة) — to_regclass + try/catch حتى لا يتعطل الحذف.
// يعيد عدد الدفعات التي فُك ربطها.
export async function unlinkInvoicesFromInstallments(invoiceIds) {
  const ids = [...new Set((invoiceIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return 0;
  try {
    const [reg] = await sql`SELECT to_regclass('branch_project_contract_installments') AS t`;
    if (!reg?.t) return 0;
    const rows = await sql`
      UPDATE branch_project_contract_installments
      SET invoice_id = NULL, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE invoice_id = ANY(${ids})
      RETURNING id
    `;
    return rows.length;
  } catch (error) {
    console.warn("contract installment unlink skipped", error?.message);
    return 0;
  }
}

export async function hardDeletePurchaseInvoices(invoiceIds, { actor = null, reason = "" } = {}) {
  const ids = [...new Set((invoiceIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return [];
  const rows = await sql`
    SELECT id, invoice_number, paid_amount FROM accounting_purchase_invoices WHERE id = ANY(${ids})
  `;
  if (!rows.length) return [];
  const found = rows.map((r) => Number(r.id));
  // دفعات عقود المقاولين المرتبطة بهذه الفواتير تعود بلا فاتورة.
  await unlinkInvoicesFromInstallments(found);
  await sql.transaction([
    sql`DELETE FROM accounting_purchase_invoice_payments WHERE invoice_id = ANY(${found})`,
    sql`DELETE FROM accounting_purchase_invoice_items WHERE invoice_id = ANY(${found})`,
    sql`DELETE FROM accounting_purchase_invoice_attachments WHERE invoice_id = ANY(${found})`,
    sql`DELETE FROM accounting_purchase_invoices WHERE id = ANY(${found})`,
  ]);
  for (const row of rows) {
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: Number(row.id),
      action: "deleted",
      summary: `حذف نهائي للفاتورة ${row.invoice_number}${Number(row.paid_amount) > 0 ? ` (كانت مدفوعة ${Number(row.paid_amount).toFixed(2)})` : ""}${reason ? ` — ${reason}` : ""}`,
      actor,
    });
  }
  return rows.map((r) => ({ id: Number(r.id), invoice_number: r.invoice_number }));
}

// تحويل كل الفواتير الموقوفة القديمة إلى محذوفة نهائيًا (مرة لكل تشغيل).
export async function purgeInactivePurchaseInvoices() {
  const rows = await sql`SELECT id FROM accounting_purchase_invoices WHERE is_active = FALSE`;
  if (!rows.length) return 0;
  const deleted = await hardDeletePurchaseInvoices(
    rows.map((r) => r.id),
    { reason: "تحويل الفواتير الموقوفة إلى محذوفة (إلغاء خاصية الإيقاف)" },
  );
  return deleted.length;
}
