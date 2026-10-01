import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-DZMMDeLJ.js';
import { h as hardDeletePurchaseInvoices } from './purchaseInvoiceDelete-RdBVQHRn.js';
import { createPurchaseInvoice } from './route-BtBPyhQx.js';
import { i as reserveIds, j as insertLineStatement } from './coffeeInvoices-CYk167p4.js';
import '@neondatabase/serverless';
import 'crypto';
import './ensureOnce-D_53iNPN.js';
import './accountsTree-RnDnF4VP.js';
import './leaseContracts-BKxI_7YM.js';
import './leaseSetAsideInvoices-DH_e2jVc.js';
import './wasender-vtNAxFgq.js';
import './waNotify-BPFQhIP4.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';

// فاتورة مشتريات مسير الرواتب: عند تقفيل شهر الرواتب تُنشأ فاتورة تحت
// حساب «رواتب وأجور» (5201) بتاريخ آخر يوم في الشهر المقفل، بند لكل
// موظف (الوصف = اسم الموظف، السعر = الراتب الصافي)، وتكون مدفوعة.
// عند فتح الشهر تُوقف الفاتورة (إيقاف لا حذف)، وعند التقفيل مجددًا تُعاد
// الفاتورة نفسها إلى النشاط وتُحدَّث بنودها وإجماليها من آخر بيانات
// الشهر المقفل (نفس الرقم والمعرّف — لا نسخة جديدة).

const SALARIES_CODE = "5201";
const SALARIES_NAME = "رواتب وأجور";
function payrollInvoiceNumber(month) {
  return `PAY-${month}`;
}

// آخر يوم في الشهر (YYYY-MM → YYYY-MM-DD).
function lastDayOfMonth(month) {
  const [y, m] = String(month).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

// حساب «رواتب وأجور»: بالرمز 5201 أولًا، ثم بالاسم تحت 52، وإلا يُنشأ.
async function getSalariesAccountId() {
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
async function deactivatePayrollInvoices(month, actor, reason) {
  const number = payrollInvoiceNumber(month);
  const rows = await sql`
    SELECT id FROM accounting_purchase_invoices WHERE invoice_number = ${number}
  `;
  const deleted = await hardDeletePurchaseInvoices(rows.map(r => r.id), {
    actor,
    reason: `فاتورة الرواتب ${number} — ${reason}`
  });
  return deleted.length;
}

// إنشاء فاتورة الرواتب لشهر مقفل. تعيد { ok, invoice_number, total, count }
// أو { ok:false, error }.
async function syncPayrollInvoice({
  runId,
  month,
  actor
}) {
  const accountId = await getSalariesAccountId();
  if (!accountId) {
    return {
      ok: false,
      error: "حساب «رواتب وأجور» غير موجود في شجرة الحسابات (المجموعة 52 مفقودة)"
    };
  }
  const entries = await sql`
    SELECT employee_name, net_salary
    FROM accounting_payroll_entries
    WHERE run_id = ${runId}
    ORDER BY employee_name ASC, employee_id ASC
  `;
  const items = entries.map(row => ({
    description: String(row.employee_name || "موظف").trim(),
    account_id: accountId,
    quantity: 1,
    unit_price: Math.round((Number(row.net_salary) || 0) * 100) / 100,
    tax_rate: 0,
    amount_includes_tax: false
  })).filter(line => line.unit_price > 0);
  if (!items.length) {
    return {
      ok: false,
      error: "لا رواتب صافية أكبر من صفر في هذا الشهر"
    };
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
      coffee: null
    }));
    await sql.transaction([sql`
        UPDATE accounting_purchase_invoices
        SET supplier_name = ${supplierName}, contact_id = NULL,
            expense_account_id = ${accountId},
            invoice_date = ${invoiceDate}, due_date = ${invoiceDate}, currency = 'SAR',
            subtotal_amount = ${total}, discount_amount = 0, tax_amount = 0,
            total_amount = ${total}, paid_amount = ${total},
            workflow_status = 'pending_payment', notes = ${notes},
            is_active = TRUE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${invoiceId}
      `, sql`DELETE FROM accounting_purchase_invoice_items WHERE invoice_id = ${invoiceId}`, ...lines.map((line, index) => insertLineStatement(lineIds[index], invoiceId, line)), sql`DELETE FROM accounting_purchase_invoice_payments WHERE invoice_id = ${invoiceId}`, sql`
        INSERT INTO accounting_purchase_invoice_payments (
          invoice_id, amount, payment_date, bank_account_id, receipt_url, notes,
          created_by_employee_id, created_by_employee_name
        )
        VALUES (
          ${invoiceId}, ${total}, ${invoiceDate}, NULL, NULL,
          'دفعة مسير الرواتب — تُحدَّث مع تقفيل الشهر',
          ${actorId}, ${actorName}
        )
      `]);
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoiceId,
      action: "updated",
      summary: `تحديث فاتورة الرواتب ${number} عند تقفيل الشهر مجددًا: ${items.length} موظف، الإجمالي ${total.toFixed(2)}${existing.is_active === false ? " — أُعيد تفعيلها" : ""}`,
      actor
    });
    return {
      ok: true,
      invoice_id: invoiceId,
      invoice_number: number,
      invoice_date: invoiceDate,
      total,
      count: items.length,
      updated: true
    };
  }
  const result = await createPurchaseInvoice({
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
    notes
  }, actor);
  if (!result?.ok) {
    return {
      ok: false,
      error: result?.error || "فشل إنشاء فاتورة الرواتب"
    };
  }
  return {
    ok: true,
    invoice_id: result.invoice?.id ?? null,
    invoice_number: number,
    invoice_date: invoiceDate,
    total,
    count: items.length
  };
}

const PAYROLL_CATEGORY_NAME = "رواتب";
const PAYROLL_TEMPLATE_NAME = "رواتب الموظفين";

/**
 * Sync the closed payroll month to the fixed-expenses tab.
 *
 *  - Idempotent: re-running on the same month updates in place.
 *  - Creates the "رواتب" expense category if missing (scope='fixed').
 *  - Creates the "رواتب الموظفين" fixed template if missing
 *    (frequency='monthly', start_month = the closed month).
 *  - Updates the template's default_amount to the closed-month total
 *    so future months default to the same number.
 *  - Replaces any existing accounting_expenses row for (template,
 *    month) with a confirmed row carrying the closed-month total.
 */
async function syncPayrollToFixedExpense({
  monthStart,
  totalAmount,
  userId,
  userName
}) {
  // 1) Category — find or create. Match by name; user may have added
  //    the "رواتب" category manually before payroll close.
  let [category] = await sql`
    SELECT id FROM accounting_expense_types
    WHERE name = ${PAYROLL_CATEGORY_NAME}
    LIMIT 1
  `;
  if (!category) {
    [category] = await sql`
      INSERT INTO accounting_expense_types (name, scope, is_active)
      VALUES (${PAYROLL_CATEGORY_NAME}, 'fixed', TRUE)
      RETURNING id
    `;
  }

  // 2) Template — try the canonical name first, fall back to any
  //    active template under the "رواتب" category. This handles the
  //    case where the admin created the template manually with a
  //    slightly different name; we still keep their template in sync.
  let [template] = await sql`
    SELECT id FROM accounting_fixed_expenses
    WHERE expense_name = ${PAYROLL_TEMPLATE_NAME}
      AND expense_type_id = ${category.id}
    LIMIT 1
  `;
  if (!template) {
    [template] = await sql`
      SELECT id FROM accounting_fixed_expenses
      WHERE expense_type_id = ${category.id}
        AND is_active = TRUE
      ORDER BY id ASC
      LIMIT 1
    `;
  }
  if (!template) {
    [template] = await sql`
      INSERT INTO accounting_fixed_expenses (
        expense_type_id, expense_name, default_amount,
        is_active, start_month, frequency,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${category.id}, ${PAYROLL_TEMPLATE_NAME}, ${totalAmount},
        TRUE, ${monthStart}, 'monthly',
        ${userId}, ${userName}
      )
      RETURNING id
    `;
  } else {
    await sql`
      UPDATE accounting_fixed_expenses
         SET default_amount = ${totalAmount},
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${template.id}
    `;
  }

  // 3) Replace the accounting_expenses row for (template, month).
  await sql`
    DELETE FROM accounting_expenses
    WHERE fixed_expense_id = ${template.id}
      AND expense_month = ${monthStart}
  `;
  await sql`
    INSERT INTO accounting_expenses (
      expense_type_id, expense_month, expense_name, amount,
      fixed_expense_id, is_confirmed, confirmed_amount, confirmed_at,
      created_by_employee_id, created_by_employee_name,
      confirmed_by_employee_id, confirmed_by_employee_name
    )
    VALUES (
      ${category.id}, ${monthStart}, ${PAYROLL_TEMPLATE_NAME}, ${totalAmount},
      ${template.id}, TRUE, ${totalAmount}, NOW(),
      ${userId}, ${userName},
      ${userId}, ${userName}
    )
  `;
  return {
    categoryId: category.id,
    templateId: template.id,
    totalAmount
  };
}

/**
 * On payroll-month re-open: drop the accounting_expenses row that
 * the previous close created. Leaves the template + category in
 * place so the next close re-fills cleanly.
 */
async function removePayrollFixedExpense({
  monthStart
}) {
  const [template] = await sql`
    SELECT id FROM accounting_fixed_expenses
    WHERE expense_name = ${PAYROLL_TEMPLATE_NAME}
    LIMIT 1
  `;
  if (!template) return;
  await sql`
    DELETE FROM accounting_expenses
    WHERE fixed_expense_id = ${template.id}
      AND expense_month = ${monthStart}
  `;
}

// POST /api/accounting/payroll/close
// body: { month: 'YYYY-MM' }
// Closes (or reopens) the payroll month
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const monthRaw = body.month ? String(body.month).trim() : "";
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({
        error: "Invalid month"
      }, {
        status: 400
      });
    }
    const [y, m] = monthRaw.split("-");
    const monthStart = `${y}-${m}-01`;
    const closedById = auth.user?.id ? Number(auth.user.id) : null;
    const closedByName = auth.user?.name ? String(auth.user.name) : null;

    // Find the run
    const [run] = await sql("SELECT * FROM accounting_payroll_runs WHERE payroll_month = $1 LIMIT 1", [monthStart]);
    if (!run) {
      return Response.json({
        error: "لا يوجد مسير لهذا الشهر"
      }, {
        status: 404
      });
    }

    // Toggle close/open
    const newIsClosed = !run.is_closed;
    const [updated] = await sql(`UPDATE accounting_payroll_runs
       SET is_closed = $1,
           closed_at = $2,
           closed_by_employee_id = $3,
           closed_by_employee_name = $4
       WHERE id = $5
       RETURNING *`, [newIsClosed, newIsClosed ? new Date().toISOString() : null, newIsClosed ? closedById : null, newIsClosed ? closedByName : null, run.id]);

    // Sync to fixed-expenses when closing; tear down on reopen. Wrapped
    // in try/catch so a sync failure never blocks the payroll-close
    // operation itself.
    let payrollSync = null;
    let payrollSyncError = null;
    try {
      if (newIsClosed) {
        // Prefer the actual paid total ("الإجمالي تم الدفع"). Fall
        // back to net_salary for entries that weren't marked paid, so
        // the template stays useful even before disbursement is
        // recorded.
        const [{
          total_paid,
          total_net
        }] = await sql(`SELECT
             COALESCE(SUM(
               CASE WHEN is_paid = TRUE
                    THEN COALESCE(paid_amount, net_salary, 0)
                    ELSE 0
               END
             ), 0)::numeric AS total_paid,
             COALESCE(SUM(COALESCE(net_salary, 0)), 0)::numeric AS total_net
             FROM accounting_payroll_entries
            WHERE run_id = $1`, [run.id]);
        const totalAmount = Number(total_paid) > 0 ? Number(total_paid) : Number(total_net) || 0;
        payrollSync = await syncPayrollToFixedExpense({
          monthStart,
          totalAmount,
          userId: closedById,
          userName: closedByName
        });
      } else {
        await removePayrollFixedExpense({
          monthStart
        });
      }
    } catch (syncErr) {
      console.error("payroll close → fixed-expense sync failed", syncErr);
      payrollSyncError = syncErr?.message || String(syncErr);
    }

    // فاتورة مشتريات الرواتب تحت «رواتب وأجور» بتاريخ آخر يوم في الشهر:
    // بند لكل موظف بصافي راتبه، مدفوعة. تُوقف عند فتح الشهر. فشلها لا
    // يمنع التقفيل — يُعاد للواجهة كتحذير.
    let payrollInvoice = null;
    let payrollInvoiceError = null;
    try {
      if (newIsClosed) {
        const result = await syncPayrollInvoice({
          runId: run.id,
          month: monthRaw,
          actor: auth.user
        });
        if (result.ok) payrollInvoice = result;else payrollInvoiceError = result.error;
      } else {
        const count = await deactivatePayrollInvoices(monthRaw, auth.user, "فُتح شهر الرواتب");
        payrollInvoice = {
          deactivated: count
        };
      }
    } catch (invoiceErr) {
      console.error("payroll close → purchase invoice sync failed", invoiceErr);
      payrollInvoiceError = invoiceErr?.message || String(invoiceErr);
    }
    return Response.json({
      ok: true,
      run: updated,
      payroll_sync: payrollSync,
      payroll_sync_error: payrollSyncError,
      payroll_invoice: payrollInvoice,
      payroll_invoice_error: payrollInvoiceError
    });
  } catch (error) {
    console.error("payroll close POST error", error);
    return Response.json({
      error: "فشل تقفيلة الشهر",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
