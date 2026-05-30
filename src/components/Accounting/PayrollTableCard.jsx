import { useMemo } from "react";
import { Send, Lock, Unlock, CheckCircle2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { PayrollTable } from "./PayrollTable";
import { PayrollExportMenu } from "./PayrollExportMenu";

export function PayrollTableCard({
  entries,
  exportColumns,
  month,
  monthHint,
  run,
  onRebuildPayroll,
  isRebuilding,
  onPaymentSave,
  onCloseMonth,
  isClosingMonth,
}) {
  const isClosed = !!run?.is_closed;

  const paidCount = useMemo(
    () => entries.filter((e) => e.is_paid).length,
    [entries],
  );
  const totalCount = entries.length;
  const allPaid = totalCount > 0 && paidCount === totalCount;

  const closeButtonLabel = isClosingMonth
    ? "جاري المعالجة…"
    : isClosed
      ? "فتح الشهر"
      : "تقفيلة الشهر";

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-5`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="font-bold text-slate-900 dark:text-white tracking-tight">
            جدول مسير الرواتب
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 dark:text-white/50">
                تم الدفع: {paidCount} / {totalCount}
              </span>
              {allPaid && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  مكتمل
                </span>
              )}
              {isClosed && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 font-semibold bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" />
                  مقفل
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <PayrollExportMenu
            entries={entries}
            exportColumns={exportColumns}
            month={month}
            monthHint={monthHint}
            run={run}
          />

          {!isClosed && (
            <button
              type="button"
              onClick={onRebuildPayroll}
              className={`${ws.btnNeutral} px-4 py-2 justify-center w-full sm:w-auto`}
              disabled={isRebuilding}
            >
              <Send className="w-4 h-4" />
              <span className="font-semibold">
                {isRebuilding ? "جاري التحديث…" : "تحديث المسير"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onCloseMonth}
            className={`${isClosed ? ws.btnDanger : ws.btnPrimary} px-4 py-2 justify-center w-full sm:w-auto`}
            disabled={isClosingMonth}
          >
            {isClosed ? (
              <Unlock className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span className="font-semibold">{closeButtonLabel}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <PayrollTable
          entries={entries}
          onPaymentSave={onPaymentSave}
          isClosed={isClosed}
        />
      </div>
    </div>
  );
}
