import {
  Building2,
  ClipboardList,
  TrendingUp,
  Clock,
  CheckCircle,
  CalendarDays,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function StatCard({ icon, trend, label, value, accent = "emerald" }) {
  const accentMap = {
    emerald: "text-emerald-700 dark:text-emerald-700 dark:text-emerald-200",
    sky: "text-sky-700 dark:text-sky-700 dark:text-sky-200",
    amber: "text-amber-700 dark:text-amber-700 dark:text-amber-200",
    purple: "text-purple-700 dark:text-purple-700 dark:text-purple-200",
  };

  const iconColor = accentMap[accent] || "text-emerald-700 dark:text-emerald-700 dark:text-emerald-200";

  return (
    <div className={`${ws.glass} ${ws.card} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`${ws.iconBox} ${iconColor}`}>{icon}</div>
        {trend ? <div className={iconColor}>{trend}</div> : null}
      </div>
      <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">{value}</p>
    </div>
  );
}

export function StatisticsCards({ stats }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <StatCard
          accent="emerald"
          icon={<ClipboardList className="w-6 h-6" />}
          trend={<TrendingUp className="w-5 h-5" />}
          label="إجمالي العمليات"
          value={stats.totalOperations}
        />

        <StatCard
          accent="emerald"
          icon={<CheckCircle className="w-6 h-6" />}
          label="العمليات المكتملة"
          value={stats.completedOperations}
        />

        <StatCard
          accent="amber"
          icon={<Clock className="w-6 h-6" />}
          label="قيد الانتظار"
          value={stats.pendingOperations}
        />

        <StatCard
          accent="sky"
          icon={<Building2 className="w-6 h-6" />}
          label="عدد الفروع"
          value={stats.totalBranches}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className={`${ws.glassSoft} ${ws.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">عمليات اليوم</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
                {stats.operationsToday}
              </p>
            </div>
            <div className={`${ws.iconBox} text-sky-700 dark:text-sky-700 dark:text-sky-200`}>
              <CalendarDays className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className={`${ws.glassSoft} ${ws.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">آخر 7 أيام</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
                {stats.operationsLast7}
              </p>
            </div>
            <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-700 dark:text-emerald-200`}>
              <ClipboardList className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className={`${ws.glassSoft} ${ws.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">نسبة اكتمال العمليات</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
                {stats.completionRate}%
              </p>
            </div>
            <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-700 dark:text-emerald-200`}>
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
