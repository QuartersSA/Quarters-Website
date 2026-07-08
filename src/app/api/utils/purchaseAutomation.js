import sql from "@/app/api/utils/sql";
import { sendWhatsAppViaWasender } from "@/app/api/utils/wasender";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";

// أتمتة قسم المشتريات بدون مجدول خارجي: لا يوجد cron في بيئة
// Railway لهذا التطبيق، فالتوليد يتم «كسولاً» — أول تحميل لدفتر
// الفواتير بعد حلول الموعد يولّد الفواتير المتكررة المستحقة ويرسل
// التقارير المجدولة. runPurchaseAutomation تُستدعى من GET الفواتير
// وتبتلع أخطاءها بالكامل حتى لا تعطل الدفتر نفسه.

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

// فاتورة متكررة → فاتورة فعلية «بانتظار الاعتماد» ببند واحد مصنّف
// على حساب القالب. رقم الفاتورة حتمي (REC-YYYYMM-قالب) فلا يتكرر
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

    const [invoice] = await sql`
      INSERT INTO accounting_purchase_invoices (
        invoice_number, contact_id, supplier_name, expense_account_id,
        invoice_date, currency,
        subtotal_amount, discount_amount, tax_amount, total_amount,
        paid_amount, branch_id, workflow_status, notes,
        created_by_employee_name
      )
      VALUES (
        ${invoiceNumber},
        ${template.contact_id || null},
        ${template.supplier_name || null},
        ${template.expense_account_id || null},
        ${today}, 'SAR',
        ${subtotal}, 0, ${tax}, ${total},
        0, ${template.branch_id || null}, 'pending_payment',
        ${`فاتورة متكررة — ${template.name}`},
        'النظام — فواتير متكررة'
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
    SELECT COALESCE(NULLIF(inv.supplier_name, ''), c.name, 'بدون مورد') AS name,
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

let automationRunning = false;

export async function runPurchaseAutomation() {
  if (automationRunning) return;
  automationRunning = true;
  try {
    await ensureRecurringSchema();
    await ensureScheduledReportsSchema();
    await generateRecurringInvoices();
    await sendDueScheduledReports();
  } catch (error) {
    console.error("purchase automation failed", error);
  } finally {
    automationRunning = false;
  }
}
