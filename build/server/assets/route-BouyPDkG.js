import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureLeaseSchema, t as todayRiyadh, c as listPayments, u as loadReservesByPayment, f as setAsideSchedule, g as round2, R as REQUIRE_LEASE } from './leaseContracts-5fHmsgHE.js';
import { g as generateSetAsideInvoices, l as loadSetAsideInvoices } from './leaseSetAsideInvoices-BIZpvJrr.js';
import 'crypto';
import './sql-CSDV1lSC.js';
import '@neondatabase/serverless';
import './purchaseAudit-CVdAiEPz.js';
import './wasender-DykD1wlV.js';
import './waNotify-CtLfIpXX.js';
import './coffeeInvoices-DsQXXppv.js';
import './accountsTree-BiYqjwch.js';
import './inventoryUnitSnapshots-B5krAOBv.js';
import './employeeDisplayName-CwZGtUC2.js';
import './branchVisibility-CPqSH5sT.js';
import './route-BUl4vftO.js';

// الاستقطاع الشهري: كل دفعة معلّقة تُقسَّم على أشهر تكرارها (ربعي 3،
// نصفي 6، سنوي 12) في الأشهر السابقة لشهر الاستحقاق؛ كل شهر يُحوَّل
// نصيبه إلى حساب الاستقطاع المنفصل ويُؤكَّد هنا، فيتجمع المبلغ ويُسدَّد
// عند الاستحقاق من «سداد المستحق». لا علاقة له بالإيرادات.
// GET /api/accounting/lease-contracts/reserve?month=YYYY-MM&branch_id=

function parseMonth(value) {
  const text = String(value || "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_LEASE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureLeaseSchema();
    const url = new URL(request.url);
    const currentMonth = todayRiyadh().slice(0, 7);
    const month = parseMonth(url.searchParams.get("month")) || currentMonth;
    const branchRaw = Number(url.searchParams.get("branch_id"));
    const branchId = Number.isInteger(branchRaw) && branchRaw > 0 ? branchRaw : null;

    // فواتير الاستقطاع للأشهر التي حلّت تُنشأ هنا أيضًا (إضافة إلى الأتمتة).
    try {
      await generateSetAsideInvoices({
        upToMonth: currentMonth,
        actor: auth.user
      });
    } catch (error) {
      console.error("set-aside invoice generation failed", error?.message);
    }
    const pending = await listPayments({
      status: "pending",
      excludeTerminated: true
    });
    const filtered = branchId ? pending.filter(payment => Number(payment.branch_id) === branchId) : pending;
    const ledger = await loadReservesByPayment(filtered.map(payment => payment.id));
    const invoices = await loadSetAsideInvoices(filtered.map(payment => payment.id));
    const canConfirm = month <= currentMonth;
    const rows = filtered.map(payment => {
      const entries = ledger[Number(payment.id)] || [];
      const byMonth = new Map(entries.map(e => [e.month, e]));
      const plan = setAsideSchedule({
        amountIncl: payment.amount_incl,
        dueDate: payment.due_date,
        windowMonths: payment.window_months
      });
      const planMonths = new Set(plan.map(p => p.month));
      // أشهر مؤكدة خارج الخطة (تحويل إضافي/تعويضي) تُعرض أيضًا.
      const extra = entries.filter(e => !planMonths.has(e.month)).map(e => ({
        month: e.month,
        seq: null,
        amount: 0,
        extra: true
      }));
      const schedule = [...plan, ...extra].sort((a, b) => a.month.localeCompare(b.month)).map(item => {
        const confirmed = byMonth.get(item.month) || null;
        const invoice = invoices[Number(payment.id)]?.[item.month] || null;
        return {
          month: item.month,
          seq: item.seq,
          planned_amount: round2(item.amount),
          invoice_id: invoice ? invoice.id : null,
          invoice_number: invoice ? invoice.invoice_number : null,
          invoice_status: invoice ? invoice.status : null,
          confirmed_amount: confirmed ? confirmed.amount : null,
          confirmed_by: confirmed ? confirmed.created_by_employee_name : null,
          note: confirmed ? confirmed.note : null,
          extra: item.extra === true,
          is_current: item.month === month,
          // متأخر: شهر مضى بلا تحويل
          overdue: !confirmed && item.month < currentMonth && !item.extra,
          confirmable: item.month <= currentMonth
        };
      });
      const reservedTotal = round2(entries.reduce((acc, e) => acc + e.amount, 0));
      const thisMonth = schedule.find(item => item.month === month) || null;
      const overdueItems = schedule.filter(item => item.overdue);
      const dueMonth = String(payment.due_date || "").slice(0, 7);
      return {
        ...payment,
        schedule,
        months_total: plan.length,
        months_confirmed: schedule.filter(item => item.confirmed_amount !== null && !item.extra).length,
        this_month_planned: thisMonth ? thisMonth.planned_amount : 0,
        confirmed_amount: thisMonth ? thisMonth.confirmed_amount : null,
        confirmed_by: thisMonth ? thisMonth.confirmed_by : null,
        invoice_id: thisMonth ? thisMonth.invoice_id : null,
        invoice_number: thisMonth ? thisMonth.invoice_number : null,
        invoice_status: thisMonth ? thisMonth.invoice_status : null,
        in_window: !!thisMonth && !thisMonth.extra,
        reserved_total: reservedTotal,
        remaining_to_reserve: round2(Math.max(payment.amount_incl - reservedTotal, 0)),
        overdue_setaside_count: overdueItems.length,
        overdue_setaside_amount: round2(overdueItems.reduce((acc, item) => acc + item.planned_amount, 0)),
        due_this_month: dueMonth === month,
        overdue: payment.overdue === true,
        window_start_month: plan.length ? plan[0].month : null,
        window_end_month: plan.length ? plan[plan.length - 1].month : null
      };
    });
    const monthRows = rows.filter(row => row.in_window || row.confirmed_amount !== null);
    const sum = (list, key) => round2(list.reduce((acc, row) => acc + (Number(row[key]) || 0), 0));
    const unconfirmed = monthRows.filter(row => row.confirmed_amount === null && row.this_month_planned > 0);
    const totals = {
      month_planned: sum(monthRows, "this_month_planned"),
      month_confirmed: round2(monthRows.reduce((acc, row) => acc + (Number(row.confirmed_amount) || 0), 0)),
      month_unconfirmed: sum(unconfirmed, "this_month_planned"),
      month_rows: monthRows.length,
      confirmed_count: monthRows.filter(row => row.confirmed_amount !== null).length,
      unconfirmed_count: unconfirmed.length,
      reserved_total: sum(rows, "reserved_total"),
      remaining_total: sum(rows, "remaining_to_reserve"),
      pending_amount: sum(rows, "amount_incl"),
      overdue_setaside_amount: sum(rows, "overdue_setaside_amount"),
      overdue_setaside_count: rows.reduce((acc, row) => acc + row.overdue_setaside_count, 0)
    };
    return Response.json({
      month,
      current_month: currentMonth,
      can_confirm: canConfirm,
      rows,
      month_rows: monthRows,
      totals
    });
  } catch (error) {
    console.error("lease reserve GET error", error);
    return Response.json({
      error: "فشل حساب الاستقطاع الشهري",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
