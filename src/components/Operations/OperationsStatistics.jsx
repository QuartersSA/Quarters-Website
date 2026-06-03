import {
  ClipboardList,
  PackagePlus,
  CalendarCheck,
  ArrowLeftRight,
  Clock,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function OperationsStatistics({ stats }) {
  const cardClass = `${ws.glass} ${ws.card} p-5`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6" dir="rtl">
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">إجمالي العمليات</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
              {stats.total}
            </p>
          </div>
          <div className={`${ws.iconBox} w-12 h-12 text-slate-700 dark:text-slate-700 dark:text-white/75`}>
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">جرد يومي</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
              {stats.daily}
            </p>
          </div>
          <div className={`${ws.iconBox} w-12 h-12 text-blue-700 dark:text-blue-700 dark:text-blue-200`}>
            <CalendarCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">تحويلات</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
              {stats.transfers}
            </p>
          </div>
          <div className={`${ws.iconBox} w-12 h-12 text-amber-700 dark:text-amber-700 dark:text-amber-200`}>
            <ArrowLeftRight className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">وارد</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
              {stats.receipts}
            </p>
          </div>
          <div className={`${ws.iconBox} w-12 h-12 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200`}>
            <PackagePlus className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">عمليات اليوم</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
              {stats.today}
            </p>
          </div>
          <div className={`${ws.iconBox} w-12 h-12 text-purple-700 dark:text-purple-700 dark:text-purple-200`}>
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
