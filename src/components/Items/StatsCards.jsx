import { Package, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function getTotalStock(item) {
  const list = Array.isArray(item?.branch_stock) ? item.branch_stock : [];
  return list.reduce((sum, s) => {
    const qty = Number(s?.quantity || 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

// `items` should be the *visible* list (filteredItems). When a filter
// narrows the rows, totalCount keeps the system-wide count so we can
// surface "ضمن الفلتر" alongside the raw number — otherwise the user
// sees "منخفض: 12" while the table shows 3 rows and assumes drift.
export function StatsCards({ items, totalCount }) {
  const isFiltered =
    typeof totalCount === "number" && totalCount !== items.length;
  const outOfStockItems = items.filter((item) => {
    if (!item.branch_stock || item.show_in_inventory === false) return false;
    const totalStock = getTotalStock(item);
    return totalStock === 0;
  }).length;

  const lowStockItems = items.filter((item) => {
    if (!item.branch_stock || item.show_in_inventory === false) return false;
    const threshold = Number(item.min_stock_threshold || 0);
    const totalStock = getTotalStock(item);
    return totalStock > 0 && totalStock < threshold;
  }).length;

  const availableItems = items.filter((item) => {
    if (item.show_in_inventory === false) return false;
    if (!item.branch_stock || item.branch_stock.length === 0) return true;
    const threshold = Number(item.min_stock_threshold || 0);
    const totalStock = getTotalStock(item);
    return totalStock >= threshold;
  }).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-purple-700 dark:text-purple-200`}>
            <Package className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">
          {isFiltered ? "ضمن الفلتر" : "إجمالي الأصناف"}
        </p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:dark:text-white tracking-tight">
          {items.length}
          {isFiltered ? (
            <span className="text-slate-500 dark:text-slate-500 dark:dark:text-white/40 text-base font-normal">
              {" "}
              / {totalCount}
            </span>
          ) : null}
        </p>
      </div>

      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-200`}>
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">متوفر</p>
        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-200 tracking-tight">
          {availableItems}
        </p>
      </div>

      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-amber-700 dark:text-amber-200`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">منخفض</p>
        <p className="text-3xl font-bold text-amber-700 dark:text-amber-200 tracking-tight">
          {lowStockItems}
        </p>
      </div>

      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-red-700 dark:text-red-200`}>
            <XCircle className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:dark:text-white/55 text-sm mb-1">نفد</p>
        <p className="text-3xl font-bold text-red-700 dark:text-red-200 tracking-tight">
          {outOfStockItems}
        </p>
      </div>
    </div>
  );
}
