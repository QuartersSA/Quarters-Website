import {
  Package,
  TrendingDown,
  XCircle,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { LowStockExportMenu } from "./LowStockExportMenu";
import { getLowStockStatus } from "@/hooks/useLowStockData";

const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

function StatusIcon({ severity }) {
  if (severity === "out") return <XCircle className="w-4 h-4" />;
  if (severity === "critical") return <AlertTriangle className="w-4 h-4" />;
  return <TrendingDown className="w-4 h-4" />;
}

export function LowStockTable({
  items,
  isLoading,
  onExportExcel,
  onExportPDF,
}) {
  return (
    <div className={sectionCard}>
      <div
        className={`p-5 sm:p-6 border-b ${ws.divider} flex items-center justify-between gap-3`}
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
          <div className={`${ws.iconBox} w-10 h-10 text-amber-700 dark:text-amber-700 dark:text-amber-200`}>
            <Package className="w-5 h-5" />
          </div>
          قائمة الأصناف المنخفضة
        </h2>

        <LowStockExportMenu
          onExportExcel={onExportExcel}
          onExportPDF={onExportPDF}
        />
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-600 dark:text-slate-600 dark:text-white/55">
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-amber-400/60 border-t-transparent rounded-full animate-spin" />
            <span>جاري التحميل…</span>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04]">
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الصنف
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الفرع
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الكمية الحالية
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الحد الأدنى
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  النقص
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const status = getLowStockStatus(item);
                const qty = Number(item.current_quantity) || 0;
                const threshold = Number(item.min_stock_threshold) || 0;
                // Clamp to 0: prevents "-(negative)" rendering when qty > threshold
                // (theoretically shouldn't appear in the low-stock list, but a
                // race between API + filter rerender can sneak a row through).
                const shortage = Math.max(0, threshold - qty);
                const qtyClass =
                  qty === 0
                    ? "text-red-700 dark:text-red-700 dark:text-red-200"
                    : qty < threshold * 0.5
                      ? "text-orange-700 dark:text-orange-700 dark:text-orange-200"
                      : "text-amber-700 dark:text-amber-700 dark:text-amber-200";

                return (
                  <tr
                    key={`${item.id}-${item.branch_id}-${index}`}
                    className="border-t border-slate-100 dark:border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-200 dark:border-white/10">
                          <Package className="w-6 h-6 text-amber-700 dark:text-amber-700 dark:text-amber-200" />
                        </div>
                        <div>
                          <p className="text-slate-900 dark:text-slate-900 dark:text-white font-semibold">
                            {item.name}
                          </p>
                          {item.description ? (
                            <p className="text-slate-500 dark:text-slate-500 dark:text-white/50 text-sm">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-slate-900 dark:text-slate-900 dark:text-white font-medium">
                          {item.branch_name}
                        </p>
                        {item.branch_location ? (
                          <p className="text-slate-500 dark:text-slate-500 dark:text-white/50 text-sm">
                            {item.branch_location}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-lg font-bold ${qtyClass}`}>
                        {qty}
                      </span>
                      <span className="text-slate-500 dark:text-slate-500 dark:text-white/40 text-sm mr-1">
                        {item.unit || "حبة"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-700 dark:text-slate-700 dark:text-white/75 font-medium">
                        {threshold}
                      </span>
                      <span className="text-slate-500 dark:text-slate-500 dark:text-white/40 text-sm mr-1">
                        {item.unit || "حبة"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-red-700 dark:text-red-700 dark:text-red-200 font-bold">
                        -{shortage}
                      </span>
                      <span className="text-slate-500 dark:text-slate-500 dark:text-white/40 text-sm mr-1">
                        {item.unit || "حبة"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`${ws.pill} inline-flex items-center gap-2 text-sm font-semibold border ${status.color}`}
                      >
                        <StatusIcon severity={status.severity} />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center text-slate-500 dark:text-slate-500 dark:text-white/50">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-50 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200" />
          <p className="text-lg mb-2">رائع! لا توجد أصناف منخفضة الكمية</p>
          <p className="text-sm">جميع الأصناف متوفرة بكميات كافية</p>
        </div>
      )}
    </div>
  );
}
