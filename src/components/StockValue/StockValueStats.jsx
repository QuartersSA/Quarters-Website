import { Banknote, Package, AlertTriangle, TrendingUp } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

const statCard = `${ws.glass} ${ws.card} p-6`;

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString("en-US");
}

// Stat cards: total value (grand sum), item count, items missing cost,
// top-value item. Surface "missing cost" so the user knows what to fix
// to make the grand total accurate.
export function StockValueStats({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200`}>
            <Banknote className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">إجمالي قيمة المخزون</p>
        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200 tracking-tight">
          {fmtMoney(stats.totalValue)}{" "}
          <span className="text-base text-slate-500 dark:text-slate-500 dark:dark:text-white/45 font-medium">ر.س</span>
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-sky-700 dark:text-sky-700 dark:dark:text-sky-200`}>
            <Package className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">عدد الأصناف</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:dark:text-white tracking-tight">
          {fmtCount(stats.itemCount)}
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-amber-700 dark:text-amber-700 dark:dark:text-amber-200`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">أصناف بدون سعر</p>
        <p className="text-3xl font-bold text-amber-700 dark:text-amber-700 dark:dark:text-amber-200 tracking-tight">
          {fmtCount(stats.missingCostCount)}
        </p>
        {stats.missingCostCount > 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-500 dark:dark:text-white/40 mt-1">
            لا تُحسب في الإجمالي
          </p>
        ) : null}
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-purple-700 dark:text-purple-700 dark:dark:text-purple-200`}>
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">الأعلى قيمة</p>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:dark:text-white truncate">
          {stats.topItemName || "—"}
        </p>
        {stats.topItemValue > 0 ? (
          <p className="text-xs text-purple-700 dark:text-purple-700 dark:dark:text-purple-200 font-semibold mt-0.5">
            {fmtMoney(stats.topItemValue)} ر.س
          </p>
        ) : null}
      </div>
    </div>
  );
}
