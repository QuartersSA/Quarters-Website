import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { f as reserveForPayment, r as round2, s as suggestedReserve, h as addMonths } from './leaseMath-E5QDwIUO.js';
import { e as ensureLeaseSchema, t as todayRiyadh, h as listPayments, i as loadReservesByPayment, R as REQUIRE_LEASE } from './leaseContracts-D_U8xvPU.js';
import '@neondatabase/serverless';
import 'crypto';

// الاستقطاع الشهري: لكل دفعة معلّقة (عقود سارية غير مُنهاة) نافذة ادخار
// من reserve_start إلى الاستحقاق؛ حصة الشهر المطلوب مقابل إيرادات
// التقفيلات في نفس الشهر.
// GET /api/accounting/lease-contracts/reserve?month=YYYY-MM&branch_id=

function parseMonth(value) {
  const text = String(value || "").trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(text) ? text : null;
}

// إيرادات الشهر من تقفيلات الشفتات (كاش + شبكة) — إجمالي وبالفرع.
// الجدول قد لا يكون موجودًا بعد → أصفار.
async function loadMonthRevenue(month, branchId) {
  const from = `${month}-01`;
  const to = addMonths(from, 1);
  const zero = {
    total: 0,
    cash: 0,
    card: 0,
    shifts: 0,
    by_branch: []
  };
  try {
    const params = [from, to];
    let where = "WHERE sc.shift_date >= $1::date AND sc.shift_date < $2::date";
    if (branchId) {
      params.push(branchId);
      where += ` AND sc.branch_id = $${params.length}`;
    }
    const [totals] = await sql(`
      SELECT COALESCE(SUM(sc.actual_cash), 0) AS cash,
             COALESCE(SUM(sc.actual_card), 0) AS card,
             COALESCE(SUM(sc.actual_cash + sc.actual_card), 0) AS total,
             COUNT(*)::int AS shifts
      FROM accounting_shift_closings sc
      ${where}
      `, params);
    const byBranch = await sql(`
      SELECT sc.branch_id, b.name AS branch_name,
             COALESCE(SUM(sc.actual_cash + sc.actual_card), 0) AS total
      FROM accounting_shift_closings sc
      LEFT JOIN branches b ON b.id = sc.branch_id
      ${where}
      GROUP BY sc.branch_id, b.name
      ORDER BY total DESC
      `, params);
    return {
      total: round2(totals?.total),
      cash: round2(totals?.cash),
      card: round2(totals?.card),
      shifts: Number(totals?.shifts) || 0,
      by_branch: byBranch.map(row => ({
        branch_id: row.branch_id ?? null,
        branch_name: row.branch_name ?? null,
        total: round2(row.total)
      }))
    };
  } catch (error) {
    console.error("lease reserve revenue query failed", error?.message);
    return zero;
  }
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
    const month = parseMonth(url.searchParams.get("month")) || todayRiyadh().slice(0, 7);
    const branchRaw = Number(url.searchParams.get("branch_id"));
    const branchId = Number.isInteger(branchRaw) && branchRaw > 0 ? branchRaw : null;
    const pending = await listPayments({
      status: "pending",
      excludeTerminated: true
    });
    const filtered = branchId ? pending.filter(payment => Number(payment.branch_id) === branchId) : pending;

    // سجل الاستقطاعات المؤكدة (ما حُجز فعليًا) لكل دفعة معلّقة.
    const ledger = await loadReservesByPayment(filtered.map(payment => payment.id));
    const currentMonth = todayRiyadh().slice(0, 7);
    const canConfirm = month <= currentMonth;
    const rows = filtered.map(payment => {
      const reserve = reserveForPayment({
        amountIncl: payment.amount_incl,
        dueDate: payment.due_date,
        reserveStart: payment.reserve_start,
        asOfMonth: month
      });
      // المتأخرة: لا حصة لهذا الشهر؛ المتبقي يُظهر ما لم يُدَّخر.
      const overdue = reserve.overdue;
      const entries = ledger[Number(payment.id)] || [];
      const reservedActual = round2(entries.reduce((acc, e) => acc + e.amount, 0));
      const reservedBefore = round2(entries.filter(e => e.month < month).reduce((acc, e) => acc + e.amount, 0));
      const confirmed = entries.find(e => e.month === month) || null;
      const suggestion = suggestedReserve({
        amountIncl: payment.amount_incl,
        dueDate: payment.due_date,
        reserveStart: payment.reserve_start,
        asOfMonth: month,
        reservedBefore
      });
      const remainingActual = round2(Math.max(payment.amount_incl - reservedActual, 0));
      return {
        ...payment,
        ...reserve,
        this_month_share: overdue ? 0 : reserve.this_month_share ?? 0,
        overdue,
        // الفعلي من السجل
        reserved_actual: reservedActual,
        reserved_before_month: reservedBefore,
        remaining_actual: remainingActual,
        confirmed_amount: confirmed ? confirmed.amount : null,
        confirmed_note: confirmed ? confirmed.note : null,
        confirmed_by: confirmed ? confirmed.created_by_employee_name : null,
        suggested_amount: suggestion.suggested,
        months_left: suggestion.months_left,
        // التأخر عن الخطة: المفترض حتى الآن − الفعلي (موجب = متأخر)
        behind_plan: round2(Math.max(reserve.reserved_to_date - reservedActual, 0)),
        ledger: entries
      };
    });
    const revenue = await loadMonthRevenue(month, branchId);
    const sum = key => round2(rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0));
    const thisMonthShare = sum("this_month_share");
    const confirmedThisMonth = round2(rows.reduce((acc, row) => acc + (Number(row.confirmed_amount) || 0), 0));
    const suggestedThisMonth = sum("suggested_amount");
    const totals = {
      monthly_reserve: sum("monthly_reserve"),
      this_month_share: thisMonthShare,
      reserved_to_date: sum("reserved_to_date"),
      remaining: sum("remaining"),
      pending_amount: sum("amount_incl"),
      share_of_revenue_pct: revenue.total > 0 ? round2(thisMonthShare / revenue.total * 100) : null,
      reserved_actual: sum("reserved_actual"),
      remaining_actual: sum("remaining_actual"),
      suggested_this_month: suggestedThisMonth,
      confirmed_this_month: confirmedThisMonth,
      confirmed_count: rows.filter(row => row.confirmed_amount !== null).length,
      unconfirmed_count: rows.filter(row => row.confirmed_amount === null && row.suggested_amount > 0).length,
      suggested_share_of_revenue_pct: revenue.total > 0 ? round2(suggestedThisMonth / revenue.total * 100) : null,
      behind_plan: sum("behind_plan")
    };
    return Response.json({
      month,
      current_month: currentMonth,
      can_confirm: canConfirm,
      revenue,
      rows,
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
