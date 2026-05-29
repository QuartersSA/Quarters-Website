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

export function ItemCard({ item, onEdit, onDelete, onViewStock }) {
  const totalStock =
    item.branch_stock?.reduce(
      (sum, stock) => sum + parseInt(stock.quantity || 0),
      0,
    ) || 0;

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

  const cardClass = `${ws.glass} ${ws.card} overflow-hidden hover:bg-white/[0.03] transition-colors`;

  const statusBadge =
    item.show_in_inventory === false ? (
      <span className="px-3 py-1 bg-red-500/80 text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <EyeOff className="w-3 h-3" />
        معطّل
      </span>
    ) : stockStatus === "out_of_stock" ? (
      <span className="px-3 py-1 bg-red-500/80 text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        نفد
      </span>
    ) : stockStatus === "low_stock" ? (
      <span className="px-3 py-1 bg-amber-500/80 text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        منخفض
      </span>
    ) : (
      <span className="px-3 py-1 bg-emerald-500/80 text-white text-xs font-semibold rounded-full inline-flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        متوفر
      </span>
    );

  return (
    <div className={cardClass} dir="rtl">
      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-xl font-bold text-white tracking-tight">
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
              className={`${ws.pill} bg-white/[0.04] text-white/70 border-white/10`}
            >
              <Layers className="w-4 h-4" />
              <span className="mr-1">{item.category_name}</span>
            </span>
          ) : null}

          {item.unit ? (
            <span
              className={`${ws.pill} bg-white/[0.04] text-white/70 border-white/10`}
            >
              <span className="text-base">{getUnitIcon(item.unit)}</span>
              <span className="mr-1">الوحدة: {item.unit}</span>
            </span>
          ) : null}
        </div>

        {item.description ? (
          <p className="text-white/45 text-sm mb-4 line-clamp-2">
            {item.description}
          </p>
        ) : null}

        {/* Stock Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/55">إجمالي المخزون:</span>
            <span className="text-white font-bold">
              {totalStock} {item.unit || "وحدة"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/55">الحد الأدنى:</span>
            <span className="text-amber-200 font-bold">
              {item.min_stock_threshold} {item.unit || "وحدة"}
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
