import { Package, ChevronDown, ChevronUp } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { getUnitIcon } from "@/utils/itemsSummaryCalculations";
import { ItemBranchDetails } from "./ItemBranchDetails";

export function ItemCard({ item, isExpanded, onToggle }) {
  const totalQuantity = item.branches.reduce(
    (sum, b) => sum + (Number(b.current_quantity) || 0),
    0,
  );

  return (
    <div className="hover:bg-slate-100 dark:hover:bg-slate-100 dark:dark:hover:bg-white/[0.04] transition-colors">
      {/* Item Header */}
      <div className="p-6 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Item Icon */}
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/[0.04] rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-200 dark:dark:border-white/10 flex-shrink-0">
              <Package className="w-8 h-8 text-slate-600 dark:text-slate-600 dark:dark:text-white/60" />
            </div>

            {/* Item Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-900 dark:dark:text-white tracking-tight">
                  {item.name}
                </h3>
                {item.unit ? (
                  <span
                    className={`${ws.pill} bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/[0.04] text-slate-700 dark:text-slate-700 dark:dark:text-white/70 border-slate-200 dark:border-slate-200 dark:dark:border-white/10`}
                  >
                    <span className="text-sm">{getUnitIcon(item.unit)}</span>
                    <span className="mr-1">{item.unit}</span>
                  </span>
                ) : null}
              </div>
              {item.description ? (
                <p className="text-slate-500 dark:text-slate-500 dark:dark:text-white/50 text-sm mb-2">{item.description}</p>
              ) : null}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500 dark:text-slate-500 dark:dark:text-white/45">
                  الحد الأدنى: {item.min_stock_threshold} {item.unit || "وحدة"}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-400 dark:dark:text-white/30">•</span>
                <span className="text-xs text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200 font-semibold">
                  إجمالي المخزون: {totalQuantity} {item.unit || "وحدة"}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-400 dark:dark:text-white/30">•</span>
                <span className="text-xs text-sky-700 dark:text-sky-700 dark:dark:text-sky-200">
                  {item.branches.length} فرع
                </span>
              </div>
            </div>

            {/* Expand Icon */}
            <div className="flex items-center gap-3">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-500 dark:dark:text-white/45" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-500 dark:dark:text-white/45" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded ? (
        <div className="px-6 pb-6">
          <div
            className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:dark:border-white/10 rounded-3xl p-6`}
          >
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-700 dark:dark:text-white/70 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-sky-700 dark:text-sky-700 dark:dark:text-sky-200" />
              تفاصيل الفروع وآخر عمليات الجرد
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {item.branches.map((branch, idx) => (
                <ItemBranchDetails
                  key={idx}
                  branch={branch}
                  minThreshold={item.min_stock_threshold}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
