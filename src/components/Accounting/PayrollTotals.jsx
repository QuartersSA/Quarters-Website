import { useMemo } from "react";
import { formatMoney } from "@/utils/payrollFormatters";
import { ws } from "@/components/Workspace/ui";
import { CheckCircle2, Clock, Lock } from "lucide-react";

export function PayrollTotals({
  totals,
  monthHint,
  runCreatedAtText,
  run,
  entries,
}) {
  const paymentStats = useMemo(() => {
    if (!entries || entries.length === 0) {
      return {
        paidCount: 0,
        unpaidCount: 0,
        totalCount: 0,
        totalPaid: 0,
        totalUnpaid: 0,
      };
    }
    let paidCount = 0;
    let totalPaid = 0;
    for (const e of entries) {
      if (e.is_paid) {
        paidCount += 1;
        totalPaid += Number(e.paid_amount ?? e.net_salary ?? 0);
      }
    }
    const unpaidCount = entries.length - paidCount;
    const totalUnpaid = totals.net - totalPaid;
    return {
      paidCount,
      unpaidCount,
      totalCount: entries.length,
      totalPaid,
      totalUnpaid,
    };
  }, [entries, totals.net]);

  const isClosed = !!run?.is_closed;

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-5`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold">{monthHint}</span>
            {isClosed && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-300 font-semibold bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" />
                مقفل
              </span>
            )}
          </div>
          <div className="text-white/60 text-sm mt-1">
            آخر تحديث: {runCreatedAtText}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3 w-full md:w-auto">
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/55">إجمالي الرواتب</div>
            <div className="text-white font-extrabold" dir="ltr">
              {formatMoney(totals.totalSalary)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/55">إجمالي البونص</div>
            <div className="text-white font-extrabold" dir="ltr">
              {formatMoney(totals.totalBonuses)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/55">أوفر تايم</div>
            <div className="text-sky-200 font-extrabold" dir="ltr">
              {formatMoney(totals.totalOvertime)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/55">إجمالي الخصميات</div>
            <div className="text-white font-extrabold" dir="ltr">
              {formatMoney(totals.totalDeductions)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/55">قسط السلف</div>
            <div className="text-amber-200 font-extrabold" dir="ltr">
              {formatMoney(totals.totalLoanDeductions)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/55">الصافي</div>
            <div className="text-emerald-200 font-extrabold" dir="ltr">
              {formatMoney(totals.net)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="flex items-center gap-1 text-xs text-white/55">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              تم الدفع
            </div>
            <div className="text-emerald-200 font-extrabold" dir="ltr">
              {formatMoney(paymentStats.totalPaid)}
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              {paymentStats.paidCount} / {paymentStats.totalCount}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="flex items-center gap-1 text-xs text-white/55">
              <Clock className="w-3 h-3 text-amber-400" />
              متبقي
            </div>
            <div className="text-amber-200 font-extrabold" dir="ltr">
              {formatMoney(paymentStats.totalUnpaid)}
            </div>
            <div className="text-xs text-white/40 mt-0.5">
              {paymentStats.unpaidCount} موظف
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
