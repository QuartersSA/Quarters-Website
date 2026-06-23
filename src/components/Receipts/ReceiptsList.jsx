import { useState } from "react";
import { Truck, ChevronDown, ChevronUp, Package, Calendar } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatDateTime as formatRiyadhDateTime } from "@/utils/dateUtils";

const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

function formatDate(value) {
  return formatRiyadhDateTime(value);
}

function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function ReceiptCard({ group }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-5`}>
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="w-full flex items-center justify-between gap-3 text-right"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`${ws.iconBox} w-12 h-12 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200`}>
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-900 dark:text-slate-900 dark:text-white font-semibold tracking-tight">
                {group.branchName || "—"}
              </span>
              {group.isLegacy ? (
                <span className="text-[10px] text-slate-500 dark:text-slate-500 dark:text-white/40 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-200 dark:border-white/10">
                  قديم
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-400/10 border border-emerald-400/30 font-mono">
                  RB-{String(group.batchId).slice(-8)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-500 dark:text-white/50 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(group.receivedAt)}
              </span>
              <span>•</span>
              <span>{group.totalItems} صنف</span>
              {group.employeeName ? (
                <>
                  <span>•</span>
                  <span>{group.employeeName}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-left">
            <div className="text-xs text-slate-500 dark:text-slate-500 dark:text-white/40">إجمالي الكمية</div>
            <div className="text-slate-900 dark:text-slate-900 dark:text-white font-bold" dir="ltr">
              {formatNumber(group.totalQty)}
            </div>
          </div>
          <div className={`${ws.iconBox} w-9 h-9 text-slate-500 dark:text-slate-500 dark:text-white/40`}>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="mt-4 space-y-2 pt-4 border-t border-slate-200 dark:border-slate-200 dark:border-white/10">
          {group.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-200 dark:border-white/10"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Package className="w-4 h-4 text-slate-500 dark:text-slate-500 dark:text-white/40 flex-shrink-0" />
                <span className="text-slate-900 dark:text-slate-900 dark:text-white text-sm truncate">
                  {item.item_name}
                </span>
                {item.note ? (
                  <span className="text-slate-500 dark:text-slate-500 dark:text-white/40 text-xs">— {item.note}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-1 text-sm flex-shrink-0">
                <span className="text-emerald-700 dark:text-emerald-700 dark:text-emerald-200 font-bold" dir="ltr">
                  +{formatNumber(item.quantity)}
                </span>
                <span className="text-slate-500 dark:text-slate-500 dark:text-white/40 text-xs">
                  {item.item_unit || ""}
                </span>
              </div>
            </div>
          ))}

          {group.note ? (
            <div className="px-3 py-2 rounded-xl bg-amber-400/5 border border-amber-400/20 text-amber-100 text-sm">
              ملاحظة: {group.note}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ReceiptsList({ groups, isLoading, error }) {
  if (isLoading) {
    return (
      <div className={`${sectionCard} p-12 text-center text-slate-600 dark:text-slate-600 dark:text-white/55`}>
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
          <span>جاري التحميل…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${sectionCard} p-12 text-center text-red-700 dark:text-red-700 dark:text-red-300`}>
        {String(error?.message || error)}
      </div>
    );
  }

  if (!Array.isArray(groups) || groups.length === 0) {
    return (
      <div className={`${sectionCard} p-12 text-center text-slate-500 dark:text-slate-500 dark:text-white/50`}>
        <Truck className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg mb-2">لا توجد واردات في هذه الفترة</p>
        <p className="text-sm">جرّب تعديل الفلاتر أو توسيع الفترة الزمنية</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <ReceiptCard key={g.key} group={g} />
      ))}
    </div>
  );
}
