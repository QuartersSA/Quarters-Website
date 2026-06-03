import {
  Package,
  Building2,
  BarChart3,
  TrendingDown,
  XCircle,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function ItemsSummaryStats({ stats }) {
  const statCard = `${ws.glass} ${ws.card} p-6`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-8">
      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-slate-800 dark:text-white/80`}>
            <Package className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">إجمالي الأصناف</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.totalItems}
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-sky-700 dark:text-sky-700 dark:text-sky-200`}>
            <Building2 className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">عدد الفروع</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.totalBranches}
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-700 dark:text-emerald-200`}>
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">إجمالي المخزون</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.totalStock.toLocaleString()}
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-amber-700 dark:text-amber-700 dark:text-amber-200`}>
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">أصناف منخفضة</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.lowStockCount}
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-red-700 dark:text-red-700 dark:text-red-200`}>
            <XCircle className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">غير متوفر</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {stats.outOfStockCount}
        </p>
      </div>
    </div>
  );
}
