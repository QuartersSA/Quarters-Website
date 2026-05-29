import { ws } from "@/components/Workspace/ui";

export function AvailabilityProgressBar({ stats }) {
  return (
    <div
      className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:dark:border-white/10 rounded-3xl p-4`}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-700 dark:dark:text-white/70">
          نسبة توفر الأصناف
        </span>
        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200">
          {stats.availabilityRate}%
        </span>
      </div>

      <div className="w-full bg-slate-200 dark:bg-slate-200 dark:dark:bg-white/10 rounded-full h-3 overflow-hidden border border-slate-200 dark:border-slate-200 dark:dark:border-white/10">
        <div
          className="bg-emerald-400/60 h-full rounded-full transition-all duration-500"
          style={{ width: `${stats.availabilityRate}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-500 dark:dark:text-white/45">
        <span>{stats.availableItems} متوفر</span>
        <span>{stats.unavailableItems} غير متوفر</span>
      </div>
    </div>
  );
}
