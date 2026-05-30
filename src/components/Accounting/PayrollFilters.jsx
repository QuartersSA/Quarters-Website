import GlassSelect from "@/components/Workspace/GlassSelect";
import { ws } from "@/components/Workspace/ui";

export function PayrollFilters({ month, monthOptions, onMonthChange }) {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-5`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-slate-900 dark:text-white tracking-tight">
            فلترة مسير الرواتب
          </div>
          <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
            اختر الشهر لرؤية النتائج
          </div>
        </div>

        <div className="w-full sm:w-[280px]">
          <GlassSelect
            value={month}
            onChange={onMonthChange}
            options={monthOptions}
          />
        </div>
      </div>
    </div>
  );
}
