// فواتير الاستقطاع الشهري للإيجارات: لكل دفعة معلّقة ولكل شهر من أشهر
// استقطاعها (حتى الشهر الحالي) فاتورة مشتريات غير مسددة تحت حساب
// «إيجار فرع / مستودع» أو «إيجار سكن»، مرتبطة بالعقد والدفعة والشهر
// (lease_contract_id / lease_payment_id / lease_month) وتظهر في فواتير
// المشتريات. «تأكيد التحويل» في الاستقطاع يجعلها مسددة، وإلغاؤه يعيدها.

import sql from "@/app/api/utils/sql";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";
import { hardDeletePurchaseInvoices } from "@/app/api/utils/purchaseInvoiceDelete";
import { createPurchaseInvoice } from "@/app/api/accounting/purchase-invoices/route";
import { setAsideSchedule, round2, CONTRACT_TYPE_LABELS, FREQUENCY_LABELS } from "@/utils/leaseMath";
import {
  ensureLeaseSchema,
  ensureLeaseInvoiceLinkColumns,
  getLeaseExpenseAccountId,
  listPayments,
  loadSetAsideSkips,
  todayRiyadh,
  purgeOrphanLeaseInvoices,
} from "@/app/api/utils/leaseContracts";

export function setAsideInvoiceNumber(contractId, seq, month) {
  return `LEASE-${contractId}-${seq}-${String(month).replace("-", "")}`;
}

function lastDayOfMonth(month) {
  const [y, m] = String(month).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

// مشروع تأسيس الفرع المرتبط بالعقد (إن وُجد): حالته وشهر افتتاحه الفعلي
// والقسم الذي تُنسب إليه فواتير الإيجار (template_key = 'lease' وإلا أول
// قسم بالترتيب). null إن لم يوجد مشروع أو لم تُنشأ جداوله بعد.
export async function loadProjectLeaseTarget(projectId) {
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const [row] = await sql`
      SELECT bp.id, bp.status,
             TO_CHAR(bp.actual_opening_date, 'YYYYMM') AS opening_month,
             (
               SELECT ph.id FROM branch_project_phases ph
               WHERE ph.project_id = bp.id
               ORDER BY CASE WHEN ph.template_key IN ('lease', 'contract') THEN 0
                             WHEN ph.default_account_code = '5301' THEN 1 ELSE 2 END ASC,
                        ph.sort_order ASC, ph.id ASC
               LIMIT 1
             ) AS phase_id
      FROM branch_projects bp
      WHERE bp.id = ${id}
    `;
    if (!row) return null;
    return {
      id: Number(row.id),
      status: row.status || "planning",
      opening_month: row.opening_month || null,
      phase_id: row.phase_id ? Number(row.phase_id) : null,
    };
  } catch (error) {
    console.error("load project lease target failed", error?.message);
    return null;
  }
}

// هل تُحسب فاتورة شهر الاستقطاع ضمن المشروع؟ قبل الافتتاح دائمًا؛ وبعده
// فقط الأشهر حتى شهر الافتتاح الفعلي.
export function monthWithinProject(target, month) {
  if (!target) return false;
  if (target.status === "cancelled") return false;
  if (target.status !== "opened") return true;
  if (!target.opening_month) return true;
  return String(month).replace("-", "") <= target.opening_month;
}

// ربط فاتورة الاستقطاع بالمشروع/القسم — لا يفشل التوليد أبدًا بسببه.
async function linkSetAsideInvoiceToProject(invoiceId, target) {
  if (!target) return;
  try {
    await sql`
      UPDATE accounting_purchase_invoices
      SET project_id = ${target.id}, project_phase_id = ${target.phase_id}
      WHERE id = ${Number(invoiceId)}
    `;
  } catch (error) {
    console.error("set-aside invoice project link failed", invoiceId, error?.message);
  }
}

// تغيّر مشروع العقد: تُعاد نسبة فواتير استقطاعه الموجودة (ربط أو فك ربط)
// حتى لا تبقى فواتير سابقة منسوبة لمشروع قديم أو بلا مشروع.
export async function reconcileLeaseInvoicesProject(contractId, projectId) {
  const cid = Number(contractId);
  if (!Number.isInteger(cid) || cid <= 0) return 0;
  try {
    const linked = await ensureLeaseInvoiceLinkColumns();
    if (!linked) return 0;
    const [reg] = await sql`SELECT to_regclass('branch_projects') AS t`;
    if (!reg?.t) return 0;
    const target = projectId ? await loadProjectLeaseTarget(projectId) : null;
    if (!target) {
      const rows = await sql`
        UPDATE accounting_purchase_invoices
        SET project_id = NULL, project_phase_id = NULL
        WHERE lease_contract_id = ${cid} AND project_id IS NOT NULL
        RETURNING id
      `;
      return rows.length;
    }
    const rows = await sql`
      SELECT id, lease_month FROM accounting_purchase_invoices
      WHERE lease_contract_id = ${cid} AND is_active = TRUE
    `;
    let changed = 0;
    for (const row of rows) {
      const inside = monthWithinProject(target, row.lease_month || "");
      await sql`
        UPDATE accounting_purchase_invoices
        SET project_id = ${inside ? target.id : null},
            project_phase_id = ${inside ? target.phase_id : null}
        WHERE id = ${Number(row.id)}
      `;
      changed += 1;
    }
    return changed;
  } catch (error) {
    console.error("reconcile lease invoices project failed", error?.message);
    return 0;
  }
}

// فواتير الاستقطاع النشطة لمجموعة دفعات: { [payment_id]: { [month]: inv } }.
export async function loadSetAsideInvoices(paymentIds) {
  const ids = [...new Set((paymentIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return {};
  const linked = await ensureLeaseInvoiceLinkColumns();
  if (!linked) return {};
  const rows = await sql`
    SELECT id, invoice_number, lease_payment_id, lease_month, total_amount, paid_amount,
           workflow_status, is_active
    FROM accounting_purchase_invoices
    WHERE lease_payment_id = ANY(${ids}) AND is_active = TRUE
    ORDER BY id ASC
  `;
  const map = {};
  for (const row of rows) {
    const pid = Number(row.lease_payment_id);
    if (!map[pid]) map[pid] = {};
    const total = Number(row.total_amount) || 0;
    const paid = Number(row.paid_amount) || 0;
    map[pid][row.lease_month] = {
      id: Number(row.id),
      invoice_number: row.invoice_number,
      total_amount: round2(total),
      paid_amount: round2(paid),
      status: total > 0 && paid >= total ? "paid" : paid > 0 ? "partial_paid" : "pending_payment",
    };
  }
  return map;
}

// إنشاء الفواتير الناقصة لكل أشهر الاستقطاع التي حلّت (≤ upToMonth).
// تعيد عدد الفواتير المنشأة. أخطاء فاتورة واحدة لا توقف البقية.
// only: { paymentId, month } يولّد فاتورة شهر واحد لدفعة واحدة متجاهلًا
// قائمة الاستثناء (إعادة إنشاء فاتورة حُذفت يدويًا).
export async function generateSetAsideInvoices({ upToMonth = null, actor = null, only = null } = {}) {
  await ensureLeaseSchema();
  const linked = await ensureLeaseInvoiceLinkColumns();
  if (!linked) return { created: 0, skipped: 0 };
  // فواتير عقود محذوفة/موقوفة لا تبقى في النظام.
  await purgeOrphanLeaseInvoices().catch((error) =>
    console.error("purgeOrphanLeaseInvoices failed", error),
  );
  const limitMonth = upToMonth || todayRiyadh().slice(0, 7);
  let pending = await listPayments({ status: "pending", excludeTerminated: true });
  if (only?.paymentId) pending = pending.filter((p) => Number(p.id) === Number(only.paymentId));
  if (!pending.length) return { created: 0, skipped: 0 };
  const existing = await loadSetAsideInvoices(pending.map((p) => p.id));
  const skips = only ? new Set() : await loadSetAsideSkips(pending.map((p) => p.id));
  const accountCache = new Map();
  // مشروع التأسيس لكل عقد (يُحمَّل مرة واحدة لكل مشروع).
  const projectCache = new Map();
  let created = 0;
  let skipped = 0;
  // أسباب فشل الإنشاء تُعاد للواجهة بدل ابتلاعها في السجل فقط.
  const errors = [];

  for (const payment of pending) {
    // قاعدة المالك: الدفعة الأولى في العقد الجديد بلا استقطاع شهري وبلا فواتير
    // (العقد المجدد مستثنى من القاعدة).
    if (payment.setaside_exempt) {
      const stale = Object.values(existing[payment.id] || {}).filter((inv) => inv.status === "pending_payment");
      if (stale.length) {
        await hardDeletePurchaseInvoices(
          stale.map((inv) => inv.id),
          { actor, reason: "الدفعة الأولى في عقد جديد بلا استقطاع" },
        ).catch((error) => console.error("first-installment invoice delete failed", error?.message));
      }
      continue;
    }
    const schedule = setAsideSchedule({
      amountIncl: payment.amount_incl,
      dueDate: payment.due_date,
      windowMonths: payment.window_months,
    });
    const n = schedule.length;
    if (!n) continue;
    // نصيب الشهر من الأجرة الخاضعة (شامل الضريبة) ومن الثابت المعفى.
    const exempt = Math.min(Math.max(Number(payment.fixed_exempt_excl) || 0, 0), payment.amount_incl);
    const taxableIncl = round2(payment.amount_incl - exempt);
    const taxableMonthly = round2(taxableIncl / n);
    const exemptMonthly = round2(exempt / n);
    const label = `${payment.contract_number || `#${payment.contract_id}`}`;
    const site = payment.display_name || payment.location || label;
    const typeLabel = CONTRACT_TYPE_LABELS[payment.contract_type] || "";
    for (const item of schedule) {
      if (only?.month && item.month !== only.month) continue;
      if (item.month > limitMonth) continue;
      if (skips.has(`${payment.id}|${item.month}`)) continue;
      if (existing[payment.id]?.[item.month]) {
        skipped += 1;
        continue;
      }
      try {
        const type = payment.contract_type || "branch";
        if (!accountCache.has(type)) accountCache.set(type, await getLeaseExpenseAccountId(type));
        const accountId = accountCache.get(type);
        if (!accountId) {
          errors.push({ payment_id: Number(payment.id), month: item.month, error: "حساب مصروف الإيجار غير موجود (المجموعة 52 مفقودة)" });
          continue;
        }
        const last = item.seq === n;
        const taxableShare = last ? round2(taxableIncl - round2(taxableMonthly * (n - 1))) : taxableMonthly;
        const exemptShare = last ? round2(exempt - round2(exemptMonthly * (n - 1))) : exemptMonthly;
        const monthDate = lastDayOfMonth(item.month);
        const period =
          payment.period_start && payment.period_end
            ? ` (فترة ${payment.period_start} → ${payment.period_end})`
            : "";
        const items = [];
        if (taxableShare > 0) {
          items.push({
            description: `استقطاع ${item.seq}/${n} لشهر ${item.month} — الدفعة ${payment.seq} المستحقة ${payment.due_date} — إيجار ${site}${period}`,
            account_id: accountId,
            quantity: 1,
            unit_price: taxableShare,
            tax_rate: Number(payment.vat_rate) || 0,
            amount_includes_tax: true,
          });
        }
        if (exemptShare > 0) {
          items.push({
            description: `مبالغ ثابتة (بلا ضريبة) — استقطاع ${item.seq}/${n} لشهر ${item.month} — الدفعة ${payment.seq}`,
            account_id: accountId,
            quantity: 1,
            unit_price: exemptShare,
            tax_rate: 0,
            amount_includes_tax: false,
          });
        }
        if (!items.length) continue;
        const invoiceNumber = setAsideInvoiceNumber(payment.contract_id, payment.seq, item.month);
        const result = await createPurchaseInvoice(
          {
            invoice_number: invoiceNumber,
            contact_id: payment.lessor_contact_id || null,
            supplier_name: payment.lessor_name,
            expense_account_id: accountId,
            invoice_date: monthDate,
            due_date: monthDate,
            currency: "SAR",
            items,
            paid_amount: 0,
            workflow_status: "pending_payment",
            branch_id: payment.branch_id || null,
            notes:
              `استقطاع شهري للإيجار — ${payment.display_name ? `${payment.display_name} — ` : ""}عقد ${label}${typeLabel ? ` (${typeLabel})` : ""} — ${payment.lessor_name}` +
              `${payment.location ? ` — ${payment.location}` : ""}\n` +
              `الدفعة ${payment.seq}${payment.payment_frequency ? ` (${FREQUENCY_LABELS[payment.payment_frequency] || payment.payment_frequency})` : ""} تستحق ${payment.due_date} بقيمة ${round2(payment.amount_incl).toFixed(2)} SAR شامل الضريبة، ` +
              `مقسومة على ${n} أشهر: هذا استقطاع الشهر ${item.seq} من ${n} (${item.month}). ` +
              `تُعلَّم مسددة عند تأكيد تحويل الاستقطاع إلى حساب الاستقطاع.`,
          },
          actor,
        );
        if (!result?.ok) {
          console.error("set-aside invoice create failed", invoiceNumber, result?.error);
          errors.push({ payment_id: Number(payment.id), month: item.month, error: result?.error || "خطأ غير معروف" });
          continue;
        }
        await sql`
          UPDATE accounting_purchase_invoices
          SET lease_contract_id = ${Number(payment.contract_id)},
              lease_payment_id = ${Number(payment.id)},
              lease_month = ${item.month}
          WHERE id = ${Number(result.invoice.id)}
        `;
        created += 1;
        // عقد مرتبط بمشروع تأسيس: إيجار ما قبل الافتتاح يُحسب ضمن المشروع.
        if (payment.project_id) {
          const key = Number(payment.project_id);
          if (!projectCache.has(key)) projectCache.set(key, await loadProjectLeaseTarget(key));
          const target = projectCache.get(key);
          if (monthWithinProject(target, item.month)) {
            await linkSetAsideInvoiceToProject(result.invoice.id, target);
          }
        }
        // شهر مؤكَّد تحويله مسبقًا (أُنشئت فاتورته لاحقًا) → تصبح مسددة فورًا.
        const [confirmedRow] = await sql`
          SELECT amount FROM accounting_lease_reserves
          WHERE payment_id = ${Number(payment.id)} AND month = ${item.month}
          LIMIT 1
        `;
        if (confirmedRow && Number(confirmedRow.amount) > 0) {
          await markSetAsideInvoicePaid({
            paymentId: payment.id,
            month: item.month,
            amount: Number(confirmedRow.amount),
            actor,
          }).catch((error) => console.error("set-aside invoice sync-paid failed", error?.message));
        }
      } catch (error) {
        console.error("set-aside invoice error", payment.id, item.month, error?.message);
        errors.push({ payment_id: Number(payment.id), month: item.month, error: error?.message || "خطأ غير معروف" });
      }
    }
  }
  return { created, skipped, errors };
}

// تأكيد التحويل → الفاتورة مسددة (المدفوع = الإجمالي، وسطر دفعة بتاريخ اليوم).
export async function markSetAsideInvoicePaid({ paymentId, month, amount, bankAccountId = null, actor = null }) {
  const linked = await ensureLeaseInvoiceLinkColumns();
  if (!linked) return null;
  const [inv] = await sql`
    SELECT id, invoice_number, total_amount FROM accounting_purchase_invoices
    WHERE lease_payment_id = ${Number(paymentId)} AND lease_month = ${month} AND is_active = TRUE
    ORDER BY id DESC LIMIT 1
  `;
  if (!inv) return null;
  const total = round2(Number(inv.total_amount) || 0);
  // فرق تقريب صغير أو مبلغ أكبر = سداد كامل؛ أقل بوضوح = جزئي.
  const paid = Math.abs(round2(amount) - total) <= 0.05 || round2(amount) > total ? total : round2(amount);
  const today = todayRiyadh();
  const actorId = actor?.id ? Number(actor.id) : null;
  const actorName = actor?.name ? String(actor.name) : null;
  await sql.transaction([
    sql`
      UPDATE accounting_purchase_invoices
      SET paid_amount = ${paid}, paid_bank_account_id = ${bankAccountId},
          workflow_status = 'pending_payment',
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${Number(inv.id)}
    `,
    sql`DELETE FROM accounting_purchase_invoice_payments WHERE invoice_id = ${Number(inv.id)}`,
    sql`
      INSERT INTO accounting_purchase_invoice_payments (
        invoice_id, amount, payment_date, bank_account_id, receipt_url, notes,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${Number(inv.id)}, ${paid}, ${today}, ${bankAccountId}, NULL,
        ${`تأكيد تحويل استقطاع شهر ${month} إلى حساب الاستقطاع`},
        ${actorId}, ${actorName}
      )
    `,
  ]);
  await logPurchaseAudit({
    entityType: "invoice",
    entityId: Number(inv.id),
    action: "paid",
    summary: `سداد فاتورة الاستقطاع ${inv.invoice_number} (${paid.toFixed(2)} SAR) — تأكيد تحويل شهر ${month}`,
    actor,
  });
  return { id: Number(inv.id), invoice_number: inv.invoice_number, paid_amount: paid, total_amount: total };
}

// إلغاء التأكيد → الفاتورة تعود غير مسددة.
export async function resetSetAsideInvoice({ paymentId, month, actor = null }) {
  const linked = await ensureLeaseInvoiceLinkColumns();
  if (!linked) return null;
  const [inv] = await sql`
    SELECT id, invoice_number FROM accounting_purchase_invoices
    WHERE lease_payment_id = ${Number(paymentId)} AND lease_month = ${month} AND is_active = TRUE
    ORDER BY id DESC LIMIT 1
  `;
  if (!inv) return null;
  await sql.transaction([
    sql`
      UPDATE accounting_purchase_invoices
      SET paid_amount = 0, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${Number(inv.id)}
    `,
    sql`DELETE FROM accounting_purchase_invoice_payments WHERE invoice_id = ${Number(inv.id)}`,
  ]);
  await logPurchaseAudit({
    entityType: "invoice",
    entityId: Number(inv.id),
    action: "updated",
    summary: `إلغاء سداد فاتورة الاستقطاع ${inv.invoice_number} — أُلغي تأكيد تحويل شهر ${month}`,
    actor,
  });
  return { id: Number(inv.id), invoice_number: inv.invoice_number };
}

// مطابقة السجل مع الفواتير: شهر مؤكَّد وفاتورته غير مسددة → تُسدَّد؛ فاتورة
// مسددة (من فواتير المشتريات مثلًا) بلا تأكيد في السجل → يُسجَّل التأكيد.
export async function reconcileSetAside({ ledger, invoices, actor = null }) {
  let fixed = 0;
  for (const [paymentIdKey, byMonth] of Object.entries(invoices || {})) {
    const paymentId = Number(paymentIdKey);
    const entries = ledger?.[paymentId] || [];
    for (const [month, inv] of Object.entries(byMonth)) {
      const confirmed = entries.find((e) => e.month === month && Number(e.amount) > 0) || null;
      try {
        if (confirmed && inv.status !== "paid") {
          await markSetAsideInvoicePaid({ paymentId, month, amount: confirmed.amount, actor });
          inv.status = "paid";
          inv.paid_amount = inv.total_amount;
          fixed += 1;
        } else if (!confirmed && inv.status === "paid" && inv.paid_amount > 0) {
          await sql`
            INSERT INTO accounting_lease_reserves (payment_id, contract_id, month, amount, note)
            SELECT ${paymentId}, p.contract_id, ${month}, ${inv.paid_amount},
                   ${`سُدِّدت الفاتورة ${inv.invoice_number} من فواتير المشتريات`}
            FROM accounting_lease_payments p WHERE p.id = ${paymentId}
            ON CONFLICT (payment_id, month) DO UPDATE SET amount = EXCLUDED.amount
          `;
          if (!ledger[paymentId]) ledger[paymentId] = [];
          ledger[paymentId].push({ month, amount: inv.paid_amount, note: null, created_by_employee_name: null });
          fixed += 1;
        }
      } catch (error) {
        console.error("set-aside reconcile failed", paymentId, month, error?.message);
      }
    }
  }
  return fixed;
}
