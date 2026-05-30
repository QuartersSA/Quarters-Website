import { useState, useMemo } from "react";
import {
  Package,
  Layers,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  EyeOff,
  ClipboardList,
  ClipboardCheck,
  ClipboardX,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  XCircle,
  Link,
  Building2,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function getUnitIcon(unit) {
  const icons = {
    حبة: "📦",
    كيلو: "⚖️",
    كرتون: "📦",
    شدة: "🎁",
    كيس: "🛍️",
    رول: "🧻",
    "كرتون مفرد": "📦",
  };
  return icons[unit] || "📦";
}

function computeTotalStock(item) {
  const list = Array.isArray(item?.branch_stock) ? item.branch_stock : [];
  return list.reduce((sum, stock) => {
    const qty = Number(stock?.quantity || 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

function computeStockStatus(item) {
  const list = Array.isArray(item?.branch_stock) ? item.branch_stock : [];
  const threshold = Number(item?.min_stock_threshold || 0);
  if (list.length === 0) return "available";

  const totalStock = list.reduce((sum, s) => {
    const qty = Number(s?.quantity || 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);

  if (totalStock === 0) return "out_of_stock";
  if (totalStock < threshold) return "low_stock";

  return "available";
}

function formatCost(cost) {
  if (cost == null || cost === "") return "-";
  const num = Number(cost);
  if (!Number.isFinite(num)) return "-";
  return `${num.toFixed(2)} ر.س`;
}

export function ItemsTable({
  items,
  isLoading,
  searchTerm,
  onEdit,
  onDelete,
  onViewStock,
  onManageBranches,
  onBatchInventory,
  isBatchPending,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const itemIds = useMemo(() => {
    return Array.isArray(items) ? items.map((i) => i.id) : [];
  }, [items]);

  const allSelected = itemIds.length > 0 && selectedIds.size === itemIds.length;
  const someSelected =
    selectedIds.size > 0 && selectedIds.size < itemIds.length;

  const toggleSelectAll = () => {
    if (allSelected || someSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(itemIds));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBatch = (showInInventory) => {
    if (selectedIds.size === 0 || !onBatchInventory) return;
    onBatchInventory(Array.from(selectedIds), showInInventory, clearSelection);
  };

  const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;
  const headerCell =
    "text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:dark:text-slate-600 dark:dark:dark:text-white/55 whitespace-nowrap";
  const colCount = 10;

  // checkbox styles
  const checkboxBase =
    "w-5 h-5 flex items-center justify-center cursor-pointer rounded-md transition-colors";
  const checkboxActive =
    "bg-emerald-400/20 border border-emerald-400/40 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-300";
  const checkboxInactive =
    "bg-slate-100 dark:bg-slate-100 dark:dark:bg-slate-100 dark:dark:dark:bg-white/[0.04] border border-slate-200 dark:border-slate-200 dark:dark:border-slate-200 dark:dark:dark:border-white/15 text-slate-400 dark:text-slate-400 dark:dark:text-slate-400 dark:dark:dark:text-white/30 hover:bg-slate-200 dark:hover:bg-slate-200 dark:dark:hover:bg-slate-200 dark:dark:dark:hover:bg-white/[0.07]";
  const checkboxPartial =
    "bg-emerald-400/10 border border-emerald-400/30 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-300";

  const selectAllIcon = allSelected ? (
    <CheckSquare className="w-4 h-4" />
  ) : someSelected ? (
    <MinusSquare className="w-4 h-4" />
  ) : (
    <Square className="w-4 h-4" />
  );

  const selectAllClass = allSelected
    ? checkboxActive
    : someSelected
      ? checkboxPartial
      : checkboxInactive;

  const headers = (
    <tr className="bg-slate-100 dark:bg-slate-100 dark:dark:bg-slate-100 dark:dark:dark:bg-white/[0.04]">
      <th className="px-4 py-4 w-12">
        <button
          type="button"
          onClick={toggleSelectAll}
          className={`${checkboxBase} ${selectAllClass}`}
          title="تحديد الكل"
        >
          {selectAllIcon}
        </button>
      </th>
      <th className={headerCell}>الصنف</th>
      <th className={headerCell}>الوصف</th>
      <th className={headerCell}>الفئة</th>
      <th className={headerCell}>الوحدة</th>
      <th className={headerCell}>التكلفة</th>
      <th className={headerCell}>الحد الأدنى</th>
      <th className={headerCell}>إجمالي المخزون</th>
      <th className={headerCell}>الحالة</th>
      <th className={headerCell}>الإجراءات</th>
    </tr>
  );

  const renderEmpty = (message) => (
    <div className={sectionCard}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>{headers}</thead>
          <tbody>
            <tr>
              <td
                colSpan={colCount}
                className="px-6 py-12 text-center text-slate-500 dark:text-slate-500 dark:dark:text-slate-500 dark:dark:dark:text-white/45"
              >
                <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>{message}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>{headers}</thead>
            <tbody>
              <tr>
                <td
                  colSpan={colCount}
                  className="px-6 py-12 text-center text-slate-600 dark:text-slate-600 dark:dark:text-slate-600 dark:dark:dark:text-white/55"
                >
                  جاري التحميل…
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    const msg = searchTerm ? "لا توجد نتائج للبحث" : "لا توجد أصناف حتى الآن";
    return renderEmpty(msg);
  }

  const selectedCount = selectedIds.size;

  return (
    <>
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>{headers}</thead>
            <tbody>
              {items.map((item) => {
                const isChecked = selectedIds.has(item.id);
                const categoryName = item?.category_name || "-";
                const unit = item?.unit || "حبة";
                const totalStock = computeTotalStock(item);
                const stockStatus = computeStockStatus(item);
                const hasBranchStock = Array.isArray(item?.branch_stock);
                const showInInventory = item?.show_in_inventory !== false;

                const minThresholdValue = Number(
                  item?.min_stock_threshold || 0,
                );
                const minThresholdText = `${minThresholdValue.toLocaleString()} ${unit}`;

                const statusPillClass = !showInInventory
                  ? `${ws.pill} bg-red-500/15 text-red-700 dark:text-red-700 dark:dark:text-red-200 border-red-500/25`
                  : stockStatus === "out_of_stock"
                    ? `${ws.pill} bg-red-500/15 text-red-700 dark:text-red-700 dark:dark:text-red-200 border-red-500/25`
                    : stockStatus === "low_stock"
                      ? `${ws.pill} bg-amber-500/15 text-amber-700 dark:text-amber-700 dark:dark:text-amber-200 border-amber-500/25`
                      : `${ws.pill} bg-emerald-500/15 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200 border-emerald-500/25`;

                const statusIcon = !showInInventory ? (
                  <EyeOff className="w-4 h-4" />
                ) : stockStatus === "out_of_stock" ? (
                  <XCircle className="w-4 h-4" />
                ) : stockStatus === "low_stock" ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                );

                const statusText = !showInInventory
                  ? "معطّل"
                  : stockStatus === "out_of_stock"
                    ? "نفد"
                    : stockStatus === "low_stock"
                      ? "منخفض"
                      : "متوفر";

                const stockText = hasBranchStock
                  ? `${totalStock.toLocaleString()} ${unit}`
                  : "-";

                const viewStockTitle = hasBranchStock
                  ? "عرض المخزون في الفروع"
                  : "لا يوجد مخزون مسجل";

                const rowCheckClass = isChecked
                  ? checkboxActive
                  : checkboxInactive;
                const rowCheckIcon = isChecked ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                );

                const rowBg = isChecked
                  ? "bg-emerald-400/[0.04]"
                  : "hover:bg-slate-100 dark:hover:bg-slate-100 dark:dark:hover:bg-slate-100 dark:dark:dark:hover:bg-white/[0.05]";

                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 dark:border-slate-100 dark:dark:border-slate-100 dark:dark:dark:border-white/5 transition-colors ${rowBg}`}
                  >
                    {/* Checkbox */}
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => toggleOne(item.id)}
                        className={`${checkboxBase} ${rowCheckClass}`}
                      >
                        {rowCheckIcon}
                      </button>
                    </td>

                    {/* Item */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <div
                          className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/80`}
                        >
                          <Package className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-slate-900 dark:text-slate-900 dark:dark:text-slate-900 dark:dark:dark:text-white font-medium truncate">
                            {item?.name || "-"}
                          </div>
                          {item?.name_en ? (
                            <div
                              className="text-slate-500 dark:text-slate-500 dark:dark:text-slate-500 dark:dark:dark:text-white/45 text-xs truncate"
                              dir="ltr"
                            >
                              {item.name_en}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-700 dark:dark:text-slate-700 dark:dark:dark:text-white/70 text-sm">
                      <div
                        className="line-clamp-2"
                        style={{ maxWidth: 260 }}
                        title={item?.description || ""}
                      >
                        {item?.description || "—"}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      <span
                        className={`${ws.pill} bg-slate-50 dark:bg-slate-50 dark:dark:bg-slate-50 dark:dark:dark:bg-white/[0.03] text-slate-700 dark:text-slate-700 dark:dark:text-slate-700 dark:dark:dark:text-white/70 border-slate-200 dark:border-slate-200 dark:dark:border-slate-200 dark:dark:dark:border-white/10 inline-flex items-center gap-2`}
                      >
                        <Layers className="w-4 h-4" />
                        <span className="truncate max-w-[180px]">
                          {categoryName}
                        </span>
                      </span>
                    </td>

                    {/* Unit */}
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-700 dark:dark:text-slate-700 dark:dark:dark:text-white/75 whitespace-nowrap">
                      <span
                        className={`${ws.pill} bg-slate-50 dark:bg-slate-50 dark:dark:bg-slate-50 dark:dark:dark:bg-white/[0.03] text-slate-700 dark:text-slate-700 dark:dark:text-slate-700 dark:dark:dark:text-white/70 border-slate-200 dark:border-slate-200 dark:dark:border-slate-200 dark:dark:dark:border-white/10`}
                      >
                        <span className="text-base">{getUnitIcon(unit)}</span>
                        <span className="mr-1">{unit}</span>
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-slate-700 dark:text-slate-700 dark:dark:text-slate-700 dark:dark:dark:text-white/75 font-medium">
                        {formatCost(item?.cost)}
                      </div>
                      {item?.linked_green_bean_name ? (
                        <div className="flex items-center gap-1 mt-1">
                          <Link className="w-3 h-3 text-amber-700 dark:text-amber-700 dark:dark:text-amber-300/50" />
                          <span className="text-amber-700 dark:text-amber-700 dark:dark:text-amber-200/50 text-[10px]">
                            {item.linked_green_bean_name}
                            {item.last_order_date ? (
                              <span className="text-slate-400 dark:text-slate-400 dark:dark:text-slate-400 dark:dark:dark:text-white/30 mr-1">
                                (
                                {new Date(
                                  item.last_order_date,
                                ).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn")}
                                )
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ) : null}
                    </td>

                    {/* Min */}
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-700 dark:dark:text-slate-700 dark:dark:dark:text-white/75 whitespace-nowrap">
                      {minThresholdText}
                    </td>

                    {/* Stock */}
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-800 dark:dark:text-slate-800 dark:dark:dark:text-white/85 whitespace-nowrap">
                      {stockText}
                    </td>

                    {/* Status (single column combining activation + stock level) */}
                    <td className="px-6 py-4">
                      <span
                        className={`${statusPillClass} inline-flex items-center gap-2`}
                      >
                        {statusIcon}
                        <span>{statusText}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onViewStock(item)}
                          disabled={!hasBranchStock}
                          className={`${ws.iconButton} text-slate-800 dark:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed`}
                          aria-label="عرض المخزون"
                          title={viewStockTitle}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Per-branch enable/disable. Optional handler:
                            page passes it in but the table degrades
                            gracefully if a future caller omits it. */}
                        {typeof onManageBranches === "function" ? (
                          <button
                            type="button"
                            onClick={() => onManageBranches(item)}
                            className={`${ws.iconButton} text-purple-700 dark:text-purple-700 dark:dark:text-purple-200`}
                            aria-label="إدارة الفروع"
                            title={
                              Array.isArray(item?.disabled_branches) &&
                              item.disabled_branches.length > 0
                                ? `معطّل في ${item.disabled_branches.length} فرع — اضغط للإدارة`
                                : "إدارة الفروع (تفعيل/إلغاء حسب الفرع)"
                            }
                          >
                            <Building2 className="w-4 h-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className={`${ws.iconButton} text-sky-700 dark:text-sky-700 dark:dark:text-sky-200`}
                          aria-label="تعديل"
                          title="تعديل"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          className={`${ws.iconButton} text-red-700 dark:text-red-700 dark:dark:text-red-200`}
                          aria-label="حذف"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          className={`px-6 py-3 border-t ${ws.divider} text-xs text-slate-500 dark:text-slate-500 dark:dark:text-slate-500 dark:dark:dark:text-white/45`}
        >
          تلميح: على الجوال تقدر تسحب يمين/يسار لعرض كل الأعمدة.
        </div>
      </div>

      {/* ── Floating bulk-action bar ── */}
      {selectedCount > 0 ? (
        <div
          className="fixed bottom-6 left-1/2 z-50"
          style={{ transform: "translateX(-50%)" }}
        >
          <div
            className={`${ws.popover} border border-slate-200 dark:border-slate-200 dark:dark:border-slate-200 dark:dark:dark:border-white/15 rounded-2xl px-5 py-3.5 flex items-center gap-4 shadow-2xl`}
          >
            {/* Counter */}
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-900 dark:dark:text-slate-900 dark:dark:dark:text-white font-semibold whitespace-nowrap">
              <CheckSquare className="w-5 h-5 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-300" />
              <span>{selectedCount}</span>
              <span className="text-slate-500 dark:text-slate-500 dark:dark:text-slate-500 dark:dark:dark:text-white/50 text-sm font-normal">محدد</span>
            </div>

            <div className="w-px h-7 bg-slate-200 dark:bg-slate-200 dark:dark:bg-slate-200 dark:dark:dark:bg-white/10" />

            {/* Enable in inventory */}
            <button
              type="button"
              disabled={isBatchPending}
              onClick={() => handleBatch(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-400/15 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200 border border-emerald-400/25 font-semibold hover:bg-emerald-400/25 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>فعّل في الجرد</span>
            </button>

            {/* Disable from inventory */}
            <button
              type="button"
              disabled={isBatchPending}
              onClick={() => handleBatch(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 text-red-700 dark:text-red-700 dark:dark:text-red-200 border border-red-500/25 font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <ClipboardX className="w-4 h-4" />
              <span>أخفِ من الجرد</span>
            </button>

            <div className="w-px h-7 bg-slate-200 dark:bg-slate-200 dark:dark:bg-slate-200 dark:dark:dark:bg-white/10" />

            {/* Cancel */}
            <button
              type="button"
              onClick={clearSelection}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-100 dark:dark:bg-slate-100 dark:dark:dark:bg-white/[0.05] border border-slate-200 dark:border-slate-200 dark:dark:border-slate-200 dark:dark:dark:border-white/10 text-slate-500 dark:text-slate-500 dark:dark:text-slate-500 dark:dark:dark:text-white/50 hover:bg-slate-200 dark:hover:bg-slate-200 dark:dark:hover:bg-slate-200 dark:dark:dark:hover:bg-white/[0.08] hover:text-slate-700 dark:hover:text-slate-700 dark:dark:hover:text-slate-700 dark:dark:dark:hover:text-white/70 transition-colors"
              title="إلغاء التحديد"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
