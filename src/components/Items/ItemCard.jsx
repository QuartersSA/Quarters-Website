import {
  Edit,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Layers,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { sumStockQuantities } from "@/utils/inventoryMath";

export function ItemCard({ item, onEdit, onDelete, onViewStock }) {
  // Resolve the display unit from the multi-unit "default inventory"
  // pointer, falling back to the legacy text column for un-migrated
  // items. Same logic the table view uses.
  const itemUnits = Array.isArray(item?.units) ? item.units : [];
  const defaultInvUnit =
    itemUnits.find((u) => u.id === item?.default_inventory_unit_id) ||
    itemUnits.find((u) => u.is_base) ||
    null;
  const displayUnit = defaultInvUnit?.name_ar || item?.unit || "";
  const totalStock = sumStockQuantities(item.branch_stock);

  const threshold = Number(item.min_stock_threshold || 0);

  const hasOutOfStock = item.branch_stock?.some(
    (stock) => Number(stock.quantity || 0) === 0,
  );
  const hasLowStock = item.branch_stock?.some((stock) => {
    const qty = Number(stock.quantity || 0);
    return qty > 0 && qty < threshold;
  });

  const stockStatus = hasOutOfStock
    ? "out_of_stock"
    : hasLowStock
      ? "low_stock"
      : "available";

  const getUnitIcon = (unit) => {
    const icons = {
      حبة: "📦",
      كيلو: "⚖️",
      كرتون: "📦",
      شدة: "🎁",
    };
    return icons[unit] || "📦";
  };

  const cardClass = `${ws.glass} ${ws.card} overflow-hidden hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors`;

  const statusBadge =
    item.show_in_inventory === false ? (
      <span className="px-3 py-1 bg-red-500/80 text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <EyeOff className="w-3 h-3" />
        معطّل
      </span>
    ) : stockStatus === "out_of_stock" ? (
      <span className="px-3 py-1 bg-red-500/80 text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        نفد
      </span>
    ) : stockStatus === "low_stock" ? (
      <span className="px-3 py-1 bg-amber-500/80 text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        منخفض
      </span>
    ) : (
      <span className="px-3 py-1 bg-emerald-500/80 text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        متوفر
      </span>
    );

  return (
    <div className={cardClass} dir="rtl">
      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
            {item.name}
          </h3>

          <div className="flex items-center gap-2 flex-shrink-0">
            {statusBadge}
          </div>
        </div>

        {/* Category + Unit */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {item.category_name ? (
            <span
              className={`${ws.pill} bg-slate-100 dark:bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10`}
            >
              <Layers className="w-4 h-4" />
              <span className="mr-1">{item.category_name}</span>
            </span>
          ) : null}

          {displayUnit ? (
            <span
              className={`${ws.pill} bg-slate-100 dark:bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10`}
            >
              <span className="text-base">{getUnitIcon(displayUnit)}</span>
              <span className="mr-1">الوحدة: {displayUnit}</span>
            </span>
          ) : null}
        </div>

        {item.description ? (
          <p className="text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 text-sm mb-4 line-clamp-2">
            {item.description}
          </p>
        ) : null}

        {/* Stock Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">إجمالي المخزون:</span>
            <span className="text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white font-bold">
              {totalStock} {displayUnit || "وحدة"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">الحد الأدنى:</span>
            <span className="text-amber-700 dark:text-amber-700 dark:text-amber-200 font-bold">
              {item.min_stock_threshold} {displayUnit || "وحدة"}
            </span>
          </div>
        </div>

        {/* Branch Stock Preview */}
        {item.branch_stock && item.branch_stock.length > 0 ? (
          <button
            type="button"
            onClick={() => onViewStock(item)}
            className={`${ws.btnNeutral} w-full mb-3 px-3 py-2 justify-center text-sm`}
          >
            <Eye className="w-4 h-4" />
            عرض المخزون في الفروع ({item.branch_stock.length})
          </button>
        ) : null}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className={`${ws.btnPrimary} flex-1 px-4 py-2 justify-center`}
          >
            <Edit className="w-4 h-4" />
            تعديل
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className={`${ws.btnDanger} px-4 py-2 justify-center`}
            aria-label="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
