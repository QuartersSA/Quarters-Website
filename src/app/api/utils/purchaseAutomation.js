import sql from "@/app/api/utils/sql";
import { sendWhatsAppViaWasender, flushWaOutbox } from "@/app/api/utils/wasender";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";
import { notifyByPref, onceDaily } from "@/app/api/utils/waNotify";

// أتمتة قسم المشتريات بدون مجدول خارجي — بمسارين متكاملين:
//
//   1. مؤقّت داخل عملية الخادم (startPurchaseAutomationTimer يُستدعى
//      من نقطة الإقلاع): يفحص كل 5 دقائق، فالتقارير المجدولة تخرج
//      في وقتها (بعد 8:00 صباحاً بتوقيت الرياض يوم الاستحقاق) حتى
//      لو لم يفتح أحد النظام. الخادم على Railway عملية دائمة فلا
//      حاجة لخدمة cron خارجية، وحالة «ما الذي أُرسل» في قاعدة
//      البيانات (last_sent_key) فلا يضيع شيء عند إعادة النشر.
//   2. تشغيل كسول احتياطي من GET الفواتير — يغطي فترة ما بعد إعادة
//      تشغيل لم يعمل مؤقّتها بعد، وهو غير ضار لأن كل العمليات
//      idempotent (أرقام حتمية + last_sent_key).
//
// runPurchaseAutomation تبتلع أخطاءها بالكامل حتى لا تعطل الدفتر.

function todayRiyadh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function hourRiyadh() {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(hour) % 24;
}

// موعد خروج التقارير المجدولة — صباح يوم الاستحقاق بتوقيت الرياض.
const SEND_HOUR_RIYADH = 8;

function round2(value) {
  return Math.round(value * 100) / 100;
}

export async function ensureRecurringSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_recurring_purchase_invoices (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact_id INTEGER,
      supplier_name TEXT,
      branch_id INTEGER,
      expense_account_id INTEGER,
      description TEXT,
      amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 15,
      amount_includes_tax BOOLEAN NOT NULL DEFAULT TRUE,
      day_of_month INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_generated_period TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  // ربط الفاتورة بقالبها المتكرر: الفواتير المولّدة والفاتورة الأصل
  // تحمل معرف القالب، فتعديل آخر فاتورة يزامن القالب للشهر القادم.
  // ملفوف لأن جدول الفواتير قد لا يكون موجوداً بعد على تنصيب جديد.
  try {
    await sql`
      ALTER TABLE accounting_purchase_invoices
        ADD COLUMN IF NOT EXISTS recurring_template_id INTEGER
    `;
  } catch (error) {
    console.error(
      "recurring schema: invoices link column skipped:",
      error?.message,
    );
  }
}

export async function ensureScheduledReportsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_scheduled_purchase_reports (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      phone TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent_key TEXT,
      last_sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
}

// هل أي من الحسابات المحددة «مصروف ثابت» أو أحد فروعه؟ الفحص بالاسم
// صعوداً في سلسلة الآباء (translate يوحّد الهمزات) لأن الشجرة قابلة
// للتعديل من المستخدم ولا كود ثابتاً يُعتمد عليه. سقف العمق يمنع
// الدوران لو فسدت parent_id.
export async function anyFixedExpenseAccount(accountIds = []) {
  const ids = accountIds
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return false;
  const [match] = await sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id, name, 0 AS depth
      FROM accounting_accounts
      WHERE id = ANY(${ids})
      UNION ALL
      SELECT a.id, a.parent_id, a.name, c.depth + 1
      FROM accounting_accounts a
      JOIN chain c ON a.id = c.parent_id
      WHERE c.depth < 20
    )
    SELECT 1 AS hit FROM chain
    WHERE translate(name, 'أإآ', 'ااا') LIKE '%ثابت%'
      AND (translate(name, 'أإآ', 'ااا') LIKE '%مصروف%'
        OR translate(name, 'أإآ', 'ااا') LIKE '%مصاريف%')
    LIMIT 1
  `;
  return !!match;
}

// خيار «فاتورة متكررة بشكل شهري» في نافذة الفاتورة والرفع الجماعي:
// ينشئ قالباً في accounting_recurring_purchase_invoices من بيانات
// الفاتورة المُنشأة للتو، بشرط أن يكون أحد حساباتها «مصروف ثابت» أو
// فرعاً منه. last_generated_period يُضبط على شهر الفاتورة الحالي حتى
// يبدأ التوليد التلقائي من الشهر التالي — فاتورة هذا الشهر هي الأصل
// الذي أنشأه المستخدم بنفسه.
export async function createRecurringTemplateFromInvoice({
  payload,
  accountIds = [],
  description = null,
  invoiceId = null,
  actor = null,
}) {
  await ensureRecurringSchema();

  const isFixed = await anyFixedExpenseAccount(accountIds);
  if (!isFixed) return { created: false, reason: "not_fixed_expense" };

  // ربط الفاتورة الأصل بقالبها حتى تسري تعديلاتها اللاحقة على
  // فواتير الأشهر القادمة (مزامنة القالب في PUT الفواتير).
  const linkInvoice = async (templateId) => {
    if (!invoiceId) return;
    await sql`
      UPDATE accounting_purchase_invoices
      SET recurring_template_id = ${templateId}
      WHERE id = ${invoiceId}
    `;
  };

  const amount = round2(Number(payload.totalAmount) || 0);
  if (amount <= 0) return { created: false, reason: "zero_amount" };

  // معدل الضريبة مشتق من نسب الفاتورة نفسها — المبلغ المخزن شامل
  // الضريبة فيعيد التوليد نفس الإجمالي.
  const subtotal = Number(payload.subtotalAmount) || 0;
  const tax = Number(payload.taxAmount) || 0;
  const taxRate =
    subtotal > 0
      ? Math.min(Math.max(round2((tax / subtotal) * 100), 0), 100)
      : 0;

  let supplierLabel = payload.supplierName || null;
  if (!supplierLabel && payload.contactId) {
    const [contact] = await sql`
      SELECT name FROM accounting_contacts WHERE id = ${payload.contactId}
    `;
    supplierLabel = contact?.name || null;
  }
  const name = [supplierLabel || `مورد #${payload.contactId}`, description]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 200);

  // نفس المورد + نفس الحساب + نفس المبلغ وقالب نشط قائم = تكرار
  // ضغطة، لا قالب جديد.
  const [existing] = await sql`
    SELECT id FROM accounting_recurring_purchase_invoices
    WHERE is_active = TRUE
      AND amount = ${amount}
      AND COALESCE(contact_id, 0) = ${payload.contactId || 0}
      AND COALESCE(supplier_name, '') = ${payload.supplierName || ""}
      AND COALESCE(expense_account_id, 0) = ${payload.expenseAccountId || 0}
  `;
  if (existing) {
    await linkInvoice(existing.id);
    return { created: false, reason: "duplicate", id: existing.id };
  }

  const period = todayRiyadh().slice(0, 7);
  const [created] = await sql`
    INSERT INTO accounting_recurring_purchase_invoices (
      name, contact_id, supplier_name, branch_id, expense_account_id,
      description, amount, tax_rate, amount_includes_tax,
      day_of_month, is_active, last_generated_period,
      created_by_employee_id, created_by_employee_name
    )
    VALUES (
      ${name}, ${payload.contactId || null}, ${payload.supplierName || null},
      ${payload.branchId || null}, ${payload.expenseAccountId || null},
      ${description}, ${amount}, ${taxRate}, TRUE,
      1, TRUE, ${period},
      ${actor?.id ? Number(actor.id) : null},
      ${actor?.name ? String(actor.name) : null}
    )
    RETURNING id
  `;
  await linkInvoice(created.id);
  await logPurchaseAudit({
    entityType: "recurring",
    entityId: created.id,
    action: "created",
    summary: `إنشاء قالب فاتورة متكررة «${name}» من فاتورة ${payload.invoiceNumber} — ${amount.toFixed(2)} SAR مع بداية كل شهر، استحقاق نهاية الشهر`,
    actor,
  });
  return { created: true, id: created.id };
}

// مزامنة القالب من تعديل فاتورة مرتبطة به: عدّل المستخدم آخر فاتورة
// متكررة (المبلغ 5000 → 4000 مثلاً) فيُطبَّق التعديل على فواتير
// الأشهر القادمة تلقائياً. تُزامَن آخر فاتورة فقط — تعديل فاتورة شهر
// قديم لا يغيّر المستقبل. الفواتير المولّدة قبل عمود الربط تُلحق عبر
// رقمها الحتمي REC-YYYYMM-قالب.
export async function syncRecurringTemplateFromInvoice({
  invoiceId,
  payload,
  items = null,
  actor = null,
}) {
  await ensureRecurringSchema();

  const [invoice] = await sql`
    SELECT id, invoice_number, recurring_template_id
    FROM accounting_purchase_invoices
    WHERE id = ${invoiceId}
  `;
  if (!invoice) return { synced: false, reason: "invoice_not_found" };

  let templateId = Number(invoice.recurring_template_id) || null;
  if (!templateId) {
    // فواتير مولّدة قبل إضافة عمود الربط — الرقم الحتمي يدل عليها.
    const match = /^REC-\d{6}-(\d+)$/.exec(
      String(invoice.invoice_number || ""),
    );
    if (!match) return { synced: false, reason: "not_recurring" };
    templateId = Number(match[1]);
    await sql`
      UPDATE accounting_purchase_invoices
      SET recurring_template_id = ${templateId}
      WHERE id = ${invoiceId}
    `;
  }

  const [template] = await sql`
    SELECT id, name, amount FROM accounting_recurring_purchase_invoices
    WHERE id = ${templateId} AND is_active = TRUE
  `;
  if (!template) return { synced: false, reason: "template_not_found" };

  // آخر فاتورة مرتبطة بالقالب هي وحدها من يقود المستقبل.
  const [latest] = await sql`
    SELECT id FROM accounting_purchase_invoices
    WHERE recurring_template_id = ${templateId} AND is_active = TRUE
    ORDER BY invoice_date DESC, id DESC
    LIMIT 1
  `;
  if (latest && Number(latest.id) !== Number(invoiceId)) {
    return { synced: false, reason: "not_latest" };
  }

  const amount = round2(Number(payload.totalAmount) || 0);
  if (amount <= 0) return { synced: false, reason: "zero_amount" };
  const subtotal = Number(payload.subtotalAmount) || 0;
  const tax = Number(payload.taxAmount) || 0;
  const taxRate =
    subtotal > 0
      ? Math.min(Math.max(round2((tax / subtotal) * 100), 0), 100)
      : 0;
  const description =
    (Array.isArray(items) ? items : []).find((item) => item.description)
      ?.description || null;

  await sql`
    UPDATE accounting_recurring_purchase_invoices
    SET contact_id = ${payload.contactId || null},
        supplier_name = ${payload.supplierName || null},
        branch_id = ${payload.branchId || null},
        expense_account_id = ${payload.expenseAccountId || null},
        description = COALESCE(${description}, description),
        amount = ${amount},
        tax_rate = ${taxRate},
        amount_includes_tax = TRUE
    WHERE id = ${templateId}
  `;

  const previousAmount = round2(Number(template.amount) || 0);
  if (Math.abs(previousAmount - amount) > 0.004) {
    await logPurchaseAudit({
      entityType: "recurring",
      entityId: templateId,
      action: "updated",
      summary: `تحديث قالب الفاتورة المتكررة «${template.name}» من تعديل الفاتورة ${payload.invoiceNumber} — المبلغ ${previousAmount.toFixed(2)} → ${amount.toFixed(2)} SAR لفواتير الأشهر القادمة`,
      actor,
    });
  }
  return { synced: true, id: templateId };
}

// فاتورة متكررة → فاتورة فعلية غير مدفوعة (بانتظار الدفع) ببند
// واحد مصنّف على حساب القالب، بتاريخ يوم القالب من الشهر واستحقاق
// نهاية الشهر نفسه. رقم الفاتورة حتمي (REC-YYYYMM-قالب) فلا يتكرر
// التوليد لنفس الشهر حتى لو تسابق طلبان.
async function generateRecurringInvoices() {
  const today = todayRiyadh();
  const period = today.slice(0, 7); // YYYY-MM
  const dayOfMonth = Number(today.slice(8, 10));

  const due = await sql`
    SELECT * FROM accounting_recurring_purchase_invoices
    WHERE is_active = TRUE
      AND day_of_month <= ${dayOfMonth}
      AND (last_generated_period IS NULL OR last_generated_period < ${period})
  `;

  const pad = (value) => String(value).padStart(2, "0");
  const [periodYear, periodMonth] = period.split("-").map(Number);
  // اليوم الأخير من شهر التوليد — تاريخ استحقاق كل فواتير الشهر.
  const monthLastDay = new Date(periodYear, periodMonth, 0).getDate();
  const dueDate = `${period}-${pad(monthLastDay)}`;

  for (const template of due) {
    const invoiceNumber = `REC-${period.replace("-", "")}-${template.id}`;
    const [exists] = await sql`
      SELECT id FROM accounting_purchase_invoices
      WHERE invoice_number = ${invoiceNumber}
    `;
    if (exists) {
      await sql`
        UPDATE accounting_recurring_purchase_invoices
        SET last_generated_period = ${period}
        WHERE id = ${template.id}
      `;
      continue;
    }

    const amount = round2(Number(template.amount) || 0);
    if (amount <= 0) continue;
    const rate = Math.min(Math.max(Number(template.tax_rate) || 0, 0), 100);
    const includesTax = template.amount_includes_tax !== false;
    const subtotal = includesTax ? round2(amount / (1 + rate / 100)) : amount;
    const tax = includesTax ? round2(amount - subtotal) : round2((amount * rate) / 100);
    const total = round2(subtotal + tax);

    // تاريخ الفاتورة = يوم القالب من الشهر (لا يوم التوليد الفعلي —
    // خادم متأخر أياماً لا يغيّر تواريخ الدفتر).
    const templateDay = Math.min(
      Math.max(Number(template.day_of_month) || 1, 1),
      28,
    );
    const invoiceDate = `${period}-${pad(templateDay)}`;

    const [invoice] = await sql`
      INSERT INTO accounting_purchase_invoices (
        invoice_number, contact_id, supplier_name, expense_account_id,
        invoice_date, due_date, currency,
        subtotal_amount, discount_amount, tax_amount, total_amount,
        paid_amount, branch_id, workflow_status, notes,
        recurring_template_id, created_by_employee_name
      )
      VALUES (
        ${invoiceNumber},
        ${template.contact_id || null},
        ${template.supplier_name || null},
        ${template.expense_account_id || null},
        ${invoiceDate}, ${dueDate}, 'SAR',
        ${subtotal}, 0, ${tax}, ${total},
        0, ${template.branch_id || null}, 'pending_payment',
        ${`فاتورة متكررة — ${template.name}`},
        ${template.id}, 'النظام — فواتير متكررة'
      )
      RETURNING id
    `;
    await sql`
      INSERT INTO accounting_purchase_invoice_items (
        invoice_id, position, description, account_id,
        quantity, unit_price,
        amount, tax_rate, amount_includes_tax,
        line_subtotal, line_tax, line_total
      )
      VALUES (
        ${invoice.id}, 0,
        ${template.description || template.name},
        ${template.expense_account_id || null},
        1, ${amount},
        ${amount}, ${rate}, ${includesTax},
        ${subtotal}, ${tax}, ${total}
      )
    `;
    await sql`
      UPDATE accounting_recurring_purchase_invoices
      SET last_generated_period = ${period}
      WHERE id = ${template.id}
    `;
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoice.id,
      action: "recurring",
      summary: `توليد تلقائي للفاتورة المتكررة «${template.name}» — ${invoiceNumber} بمبلغ ${total.toFixed(2)} SAR`,
      actor: { name: "النظام" },
    });
  }
}

// نص ملخص لفترة [from, to] يُرسل واتساب — يقرأ نفس أعمدة الدفتر.
export async function buildPurchasesSummaryText({ title, from, to }) {
  const [totals] = await sql`
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(total_amount), 0) AS total,
           COALESCE(SUM(paid_amount), 0) AS paid,
           COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) AS balance
    FROM accounting_purchase_invoices
    WHERE is_active = TRUE
      AND invoice_date >= ${from}::date
      AND invoice_date <= ${to}::date
  `;
  const [overdue] = await sql`
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) AS balance
    FROM accounting_purchase_invoices
    WHERE is_active = TRUE
      AND due_date IS NOT NULL
      AND due_date < ${todayRiyadh()}::date
      AND paid_amount < total_amount
  `;
  const topSuppliers = await sql`
    SELECT COALESCE(NULLIF(c.name, ''), NULLIF(inv.supplier_name, ''), 'بدون مورد') AS name,
           SUM(inv.total_amount) AS total
    FROM accounting_purchase_invoices inv
    LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
    WHERE inv.is_active = TRUE
      AND inv.invoice_date >= ${from}::date
      AND inv.invoice_date <= ${to}::date
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 3
  `;

  const money = (value) =>
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const lines = [
    `📊 ${title}`,
    `الفترة: ${from} → ${to}`,
    "",
    `عدد الفواتير: ${totals.count}`,
    `إجمالي المشتريات: ${money(totals.total)} SAR`,
    `المدفوع: ${money(totals.paid)} SAR`,
    `الرصيد المتبقي: ${money(totals.balance)} SAR`,
    "",
    `⚠️ المتأخرات حالياً (كل الفترات): ${overdue.count} فاتورة بمبلغ ${money(overdue.balance)} SAR`,
  ];
  if (topSuppliers.length > 0) {
    lines.push("", "أعلى الموردين في الفترة:");
    for (const supplier of topSuppliers) {
      lines.push(`• ${supplier.name}: ${money(supplier.total)} SAR`);
    }
  }
  lines.push("", "— نظام مشتريات كوارترز");
  return lines.join("\n");
}

// مفتاح الإرسال يمنع التكرار: شهري = شهر الإرسال، أسبوعي = يوم
// الاثنين للأسبوع الحالي. تغيّر المفتاح ⇒ إرسال مستحق.
function scheduleState(frequency, today) {
  const [y, m, d] = today.split("-").map(Number);
  if (frequency === "weekly") {
    const date = new Date(Date.UTC(y, m - 1, d));
    const dow = date.getUTCDay(); // 0 = Sunday
    const sinceMonday = (dow + 6) % 7;
    const monday = new Date(date);
    monday.setUTCDate(monday.getUTCDate() - sinceMonday);
    const key = monday.toISOString().slice(0, 10);
    const prevEnd = new Date(monday);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevStart.getUTCDate() - 6);
    return {
      key: `w:${key}`,
      from: prevStart.toISOString().slice(0, 10),
      to: prevEnd.toISOString().slice(0, 10),
      rangeLabel: "الأسبوع الماضي",
    };
  }
  // monthly: أرسل ملخص الشهر السابق مرة واحدة كل شهر جديد.
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(prevY, prevM, 0).getDate();
  return {
    key: `m:${y}-${pad(m)}`,
    from: `${prevY}-${pad(prevM)}-01`,
    to: `${prevY}-${pad(prevM)}-${pad(lastDay)}`,
    rangeLabel: "الشهر الماضي",
  };
}

async function sendDueScheduledReports() {
  if (!process.env.WASENDER_API_KEY) return;
  // قبل الثامنة صباحاً لا يخرج شيء — الموعد المعلن للمستخدم، ويمنع
  // وصول التقارير في منتصف الليل عند حلول مفتاح فترة جديد.
  if (hourRiyadh() < SEND_HOUR_RIYADH) return;
  const today = todayRiyadh();
  const schedules = await sql`
    SELECT * FROM accounting_scheduled_purchase_reports
    WHERE is_active = TRUE
  `;
  for (const schedule of schedules) {
    const state = scheduleState(schedule.frequency, today);
    if (schedule.last_sent_key === state.key) continue;
    const text = await buildPurchasesSummaryText({
      title: `${schedule.title} — ملخص مشتريات ${state.rangeLabel}`,
      from: state.from,
      to: state.to,
    });
    const result = await sendWhatsAppViaWasender({
      to: schedule.phone,
      text,
    });
    if (!result.ok) {
      console.error("scheduled purchases report send failed", result);
      continue; // يُعاد المحاولة في التحميل القادم
    }
    await sql`
      UPDATE accounting_scheduled_purchase_reports
      SET last_sent_key = ${state.key},
          last_sent_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${schedule.id}
    `;
    await logPurchaseAudit({
      entityType: "report",
      entityId: schedule.id,
      action: "scheduled_report",
      summary: `إرسال تقرير مجدول «${schedule.title}» (${state.from} → ${state.to}) إلى واتساب`,
      actor: { name: "النظام" },
    });
  }
}

// ملخص المتأخرات اليومي (بعد 8 صباحاً) لمشتركي «فاتورة متأخرة» من
// تفضيلات إشعارات الموظفين.
async function sendOverdueDigest() {
  if (hourRiyadh() < SEND_HOUR_RIYADH) return;
  const today = todayRiyadh();
  const rows = await sql`
    SELECT inv.invoice_number,
           COALESCE(NULLIF(c.name, ''), NULLIF(inv.supplier_name, ''), 'بدون مورد') AS supplier,
           TO_CHAR(inv.due_date, 'YYYY-MM-DD') AS due_date,
           GREATEST(inv.total_amount - inv.paid_amount, 0) AS balance
    FROM accounting_purchase_invoices inv
    LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
    WHERE inv.is_active = TRUE
      AND inv.paid_amount < inv.total_amount
      AND inv.due_date IS NOT NULL
      AND inv.due_date < ${today}::date
    ORDER BY inv.due_date ASC
    LIMIT 15
  `;
  if (!rows.length) return;
  // الحجز اليومي بعد التأكد من وجود متأخرات — يوم بلا متأخرات لا
  // يستهلك الإرسال.
  if (!(await onceDaily("acc_invoice_overdue"))) return;
  const total = rows.reduce((acc, row) => acc + Number(row.balance || 0), 0);
  const lines = [
    `⏰ فواتير متأخرة (${rows.length})`,
    ...rows.map(
      (row) =>
        `• ${row.invoice_number} — ${row.supplier}: ${Number(row.balance).toFixed(2)} SAR (استحقاق ${row.due_date})`,
    ),
    "",
    `الإجمالي المتأخر: ${total.toFixed(2)} SAR`,
  ];
  await notifyByPref("acc_invoice_overdue", lines.join("\n"));
}

let automationRunning = false;

export async function runPurchaseAutomation() {
  if (automationRunning) return;
  automationRunning = true;
  try {
    await ensureRecurringSchema();
    await ensureScheduledReportsSchema();
    await generateRecurringInvoices();
    await sendDueScheduledReports();
    await sendOverdueDigest();
    // رسائل فشلت أثناء انقطاع الواتساب — أعد إرسالها بعد عودته.
    await flushWaOutbox();
  } catch (error) {
    console.error("purchase automation failed", error);
  } finally {
    automationRunning = false;
  }
}

// المجدول الداخلي — يُستدعى مرة واحدة من نقطة إقلاع الخادم.
const TIMER_INTERVAL_MS = 5 * 60 * 1000;
let timerStarted = false;

export function startPurchaseAutomationTimer() {
  if (timerStarted) return;
  timerStarted = true;
  const tick = () => {
    runPurchaseAutomation().catch(() => {});
  };
  // مهلة قصيرة بعد الإقلاع حتى لا تتزاحم مع تهيئة الخادم.
  const first = setTimeout(tick, 45 * 1000);
  const interval = setInterval(tick, TIMER_INTERVAL_MS);
  // لا يمسكان العملية لو أُغلق الخادم — الويب سيرفر هو من يبقيها حية.
  first.unref?.();
  interval.unref?.();
  console.log(
    `purchase automation timer started (every ${TIMER_INTERVAL_MS / 60000} min, sends after ${SEND_HOUR_RIYADH}:00 Riyadh)`,
  );
}
