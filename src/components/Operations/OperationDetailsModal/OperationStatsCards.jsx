import { Hash, CheckCircle, X, Percent } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function OperationStatsCards({ stats }) {
  const card = `${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-3xl p-4`;
  const label = "flex items-center gap-2 text-slate-600 dark:text-slate-600 dark:text-white/60 mb-2";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" dir="rtl">
      <div className={card}>
        <div className={label}>
          <Hash className="w-4 h-4 text-slate-600 dark:text-slate-600 dark:text-white/60" />
          <span className="text-xs font-semibold">إجمالي الأصناف</span>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.totalItems}
        </p>
      </div>

      <div className={card}>
        <div className={label}>
          <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200" />
          <span className="text-xs font-semibold">متوفر</span>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.availableItems}
        </p>
      </div>

      <div className={card}>
        <div className={label}>
          <X className="w-4 h-4 text-red-700 dark:text-red-700 dark:text-red-200" />
          <span className="text-xs font-semibold">غير متوفر</span>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.unavailableItems}
        </p>
      </div>

      <div className={card}>
        <div className={label}>
          <Percent className="w-4 h-4 text-sky-700 dark:text-sky-700 dark:text-sky-200" />
          <span className="text-xs font-semibold">نسبة التوفر</span>
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.availabilityRate}%
        </p>
      </div>
    </div>
  );
}
