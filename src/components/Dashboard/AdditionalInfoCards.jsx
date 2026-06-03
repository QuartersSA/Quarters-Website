import { Package, Building2, CheckCircle } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function AdditionalInfoCards({ items, branches }) {
  const cardClass = `${ws.glass} ${ws.card} p-6`;

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-8"
      dir="rtl"
    >
      <div className={cardClass}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-4 flex items-center gap-3 tracking-tight">
          <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/80`}>
            <Package className="w-5 h-5" />
          </div>
          إحصائيات الأصناف
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-600 dark:text-white/55">إجمالي الأصناف</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white">
              {items?.length || 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-600 dark:text-white/55">الأصناف النشطة</span>
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-700 dark:text-emerald-200">
              {items?.filter((item) => item.show_in_inventory !== false)
                .length || 0}
            </span>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:text-white mb-4 flex items-center gap-3 tracking-tight">
          <div className={`${ws.iconBox} w-10 h-10 text-sky-700 dark:text-sky-700 dark:text-sky-200`}>
            <Building2 className="w-5 h-5" />
          </div>
          الفروع النشطة
        </h3>
        <div className="space-y-2">
          {branches?.slice(0, 3).map((branch) => (
            <div
              key={branch.id}
              className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-100 dark:border-white/5 last:border-0"
            >
              <div>
                <p className="text-slate-900 dark:text-slate-900 dark:text-white font-medium">{branch.name}</p>
                <p className="text-slate-500 dark:text-slate-500 dark:text-white/45 text-sm">{branch.location}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
