import {
  Building2,
  Package,
  AlertTriangle,
  X,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function ViewStockModal({ item, onClose }) {
  if (!item) return null;

  const getUnitIcon = (unit) => {
    const icons = {
      حبة: "📦",
      كيلو: "⚖️",
      كرتون: "📦",
      شدة: "🎁",
    };
    return icons[unit] || "📦";
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      dir="rtl"
    >
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-2xl shadow-2xl my-8 flex flex-col`}
        style={{ maxHeight: "calc(100vh - 64px)" }}
      >
        <div
          className={`p-6 flex items-center justify-between shrink-0 ${ws.topBar}`}
        >
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:dark:text-white flex items-center gap-3 tracking-tight">
              <div className={`${ws.iconBox} w-10 h-10 text-sky-700 dark:text-sky-200`}>
                <Building2 className="w-5 h-5" />
              </div>
              <span className="truncate">مخزون "{item.name}" في الفروع</span>
            </h3>
            {item.unit ? (
              <div className="mt-2">
                <span
                  className={`${ws.pill} bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/[0.04] text-slate-700 dark:text-slate-700 dark:dark:text-white/70 border-slate-200 dark:border-slate-200 dark:dark:border-white/10`}
                >
                  <span className="text-base">{getUnitIcon(item.unit)}</span>
                  <span className="mr-1">الوحدة: {item.unit}</span>
                </span>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-600 dark:dark:text-white/60" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-3">
            {item.branch_stock?.map((stock) => {
              const qty = Number(stock.quantity) || 0;
              const threshold = Number(item.min_stock_threshold || 0);
              const isOutOfStock = qty === 0;
              const isLow = !isOutOfStock && qty < threshold;

              const rowClass = isOutOfStock
                ? "bg-red-500/10 border-red-500/20"
                : isLow
                  ? "bg-amber-500/10 border-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-100 dark:dark:bg-white/[0.04] border-slate-200 dark:border-slate-200 dark:dark:border-white/10";

              const iconClass = isOutOfStock
                ? "text-red-700 dark:text-red-200"
                : isLow
                  ? "text-amber-700 dark:text-amber-200"
                  : "text-sky-700 dark:text-sky-200";

              const qtyClass = isOutOfStock
                ? "text-red-700 dark:text-red-200"
                : isLow
                  ? "text-amber-700 dark:text-amber-200"
                  : "text-slate-900 dark:text-slate-900 dark:dark:text-white";

              const statusLabel = isOutOfStock ? (
                <p className="text-red-700 dark:text-red-200 text-xs flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  نفد المخزون
                </p>
              ) : isLow ? (
                <p className="text-amber-700 dark:text-amber-200 text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  أقل من الحد الأدنى
                </p>
              ) : (
                <p className="text-emerald-700 dark:text-emerald-200 text-xs flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  متوفر
                </p>
              );

              return (
                <div
                  key={stock.branch_id}
                  className={`flex items-center justify-between p-4 rounded-3xl border ${rowClass}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${ws.iconBox} w-10 h-10 ${iconClass}`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-slate-900 dark:dark:text-white font-medium">
                        {stock.branch_name}
                      </p>
                      {statusLabel}
                    </div>
                  </div>

                  <div className="text-left">
                    <p className={`text-2xl font-bold ${qtyClass}`}>{qty}</p>
                    <p className="text-slate-500 dark:text-slate-500 dark:dark:text-white/45 text-xs">
                      {item.unit || "وحدة"}
                    </p>
                  </div>
                </div>
              );
            })}

            {!item.branch_stock || item.branch_stock.length === 0 ? (
              <div className="text-center py-8 text-slate-600 dark:text-slate-600 dark:dark:text-white/55">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>لا توجد بيانات مخزون لهذا الصنف</p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} w-full mt-6 px-6 py-3 justify-center`}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
