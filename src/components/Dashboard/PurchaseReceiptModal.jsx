import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Package,
  AlertCircle,
  Send,
  Warehouse,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { todayRiyadhDateKey } from "@/utils/dateUtils";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

/**
 * Look up the multi-unit array on an item. Falls back to an empty list
 * for legacy rows still on the old schema (no `units`).
 */
function getItemUnits(item) {
  return Array.isArray(item?.units) ? item.units : [];
}

/**
 * Default unit row for the operator to pre-select. Tries the explicit
 * `default_purchase_unit_id`/`default_inventory_unit_id` pointer first,
 * then falls back to the base row, then the first row.
 */
function pickDefaultUnit(item, defaultKey) {
  const units = getItemUnits(item);
  if (units.length === 0) return null;
  const defaultId = item?.[defaultKey];
  if (defaultId != null) {
    const hit = units.find((u) => String(u.id) === String(defaultId));
    if (hit) return hit;
  }
  return units.find((u) => u.is_base) || units[0] || null;
}

function getStock(stockMap, branchId, itemId) {
  if (!stockMap || !branchId || !itemId) return null;
  const key = `${branchId}-${itemId}`;
  if (stockMap instanceof Map) return stockMap.get(key) ?? null;
  return stockMap[key] ?? null;
}

export function PurchaseReceiptModal({
  receiptModalOpen,
  setReceiptModalOpen,
  receiptBranchId,
  setReceiptBranchId,
  receiptDate,
  setReceiptDate,
  receiptItemId,
  setReceiptItemId,
  receiptQty,
  setReceiptQty,
  receiptNote,
  setReceiptNote,
  receiptError,
  receiptItems,
  addReceiptItem,
  removeReceiptItem,
  submitReceipt,
  createReceiptMutation,
  stockByBranchItem,
  branches,
  activeItems,
  // Edit mode props
  editingOperation,
  submitEditReceipt,
  updateReceiptMutation,
}) {
  const branchOptions = useMemo(
    () => [
      { value: "", label: "اختر الفرع" },
      ...(branches || []).map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  const itemOptions = useMemo(() => {
    // Drop items the admin has disabled at the chosen receipt branch.
    // Receipt API now rejects them server-side; hiding them in the
    // dropdown keeps the form from offering invalid choices.
    const branchIdNum = Number(receiptBranchId);
    const byBranch = (it) => {
      if (!Number.isFinite(branchIdNum) || branchIdNum <= 0) return true;
      const disabled = Array.isArray(it?.disabled_branches)
        ? it.disabled_branches.map(Number)
        : [];
      return !disabled.includes(branchIdNum);
    };

    const base = [{ value: "", label: "اختر الصنف" }];
    const sorted = (activeItems || [])
      .filter(byBranch)
      .slice()
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "ar"),
      );
    const mapped = sorted.map((it) => ({
      value: String(it.id),
      label: it.name,
    }));
    return [...base, ...mapped];
  }, [activeItems, receiptBranchId]);

  // ── Unit selector state ──────────────────────────────────────────────
  //
  // The "selected item" carries an inline `units` array (per-item rows
  // from `item_units`). Each row has its own `conversion_factor` against
  // the item's base unit. The qty input below is in the *picked unit*;
  // we convert to base before pushing into `receiptItems` so the existing
  // submit pipeline (which ships base-unit qty to the API) stays untouched.
  //
  // `displayByItem` lets the preview list show "5 كرتون" instead of just
  // the converted base number ("120"). Keyed by itemId so removal stays
  // O(1) and survives re-renders.
  const selectedItem = useMemo(() => {
    const idNum = Number(receiptItemId);
    if (!Number.isFinite(idNum) || idNum <= 0) return null;
    return (activeItems || []).find((i) => Number(i.id) === idNum) || null;
  }, [activeItems, receiptItemId]);

  const [displayByItem, setDisplayByItem] = useState({});
  const pendingAddRef = useRef(null);

  // Unit is LOCKED to the item's default inventory unit. The operator
  // can't pick a unit; we only show its name as a read-only label next
  // to the qty input and on the added rows. The typed qty is stored
  // as-is — no factor conversion.
  const lockedUnit = useMemo(
    () => pickDefaultUnit(selectedItem, "default_inventory_unit_id"),
    [selectedItem],
  );
  const lockedUnitLabel = lockedUnit?.name_ar || lockedUnit?.name_en || "";

  // When the stored qty differs from what's currently in `receiptQty`
  // (rounding to 3 decimals), we bump `receiptQty` first and defer the
  // add to the next render so the hook's `useCallback` sees the rounded
  // value. Same deferred-add plumbing as before — just no factor.
  useEffect(() => {
    const pending = pendingAddRef.current;
    if (!pending) return;
    if (String(receiptQty) !== String(pending.baseQty)) return;
    pendingAddRef.current = null;
    setDisplayByItem((prev) => ({
      ...prev,
      [pending.itemId]: {
        qty: pending.displayQty,
        unitLabel: pending.unitLabel,
      },
    }));
    addReceiptItem();
  }, [receiptQty, addReceiptItem]);

  const handleAddWithUnit = () => {
    const rawQty = Number(receiptQty);
    if (!Number.isFinite(rawQty) || rawQty <= 0) {
      // Let the hook surface its own validation error.
      addReceiptItem();
      return;
    }
    const itemIdNum = Number(receiptItemId);
    if (!Number.isFinite(itemIdNum) || itemIdNum <= 0) {
      addReceiptItem();
      return;
    }
    // Store the typed count as-is — NO conversion-factor multiplication.
    // The unit is locked to the item's default inventory unit (label
    // only); downstream stock-value math applies the factor. Matches the
    // employee-inventory fix (commit 160292b).
    const storedQty = Math.round(rawQty * 1000) / 1000;
    const unitLabel = lockedUnitLabel;
    if (String(receiptQty) === String(storedQty)) {
      // No rounding change — bookkeep the label and add inline.
      setDisplayByItem((prev) => ({
        ...prev,
        [itemIdNum]: { qty: storedQty, unitLabel },
      }));
      addReceiptItem();
      return;
    }
    pendingAddRef.current = {
      itemId: itemIdNum,
      displayQty: storedQty,
      unitLabel,
      baseQty: String(storedQty),
    };
    setReceiptQty(String(storedQty));
  };

  const handleRemoveWithUnit = (itemId) => {
    setDisplayByItem((prev) => {
      if (!(itemId in prev)) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    removeReceiptItem(itemId);
  };

  if (!receiptModalOpen) {
    return null;
  }

  const close = () => setReceiptModalOpen(false);

  const isEditMode = !!editingOperation;
  const itemsList = Array.isArray(receiptItems) ? receiptItems : [];
  const activeMutation = isEditMode
    ? updateReceiptMutation
    : createReceiptMutation;
  const isPending = activeMutation?.isPending;
  // Future-date guard: receipt dates in future = wrong (typo or paste). Same
  // pattern as OpeningSession/Inventory — keeps audit trail honest.
  const isFutureDate = (() => {
    if (!receiptDate) return false;
    return String(receiptDate).slice(0, 10) > todayRiyadhDateKey();
  })();
  const canSubmit =
    itemsList.length > 0 && receiptBranchId && receiptDate && !isFutureDate;

  const handleSubmit = isEditMode ? submitEditReceipt : submitReceipt;

  const submitLabel = isPending
    ? "جاري الحفظ…"
    : isEditMode
      ? "حفظ التعديلات"
      : "حفظ الوارد";

  // Stock for the currently selected item + branch
  const selectedStock = getStock(
    stockByBranchItem,
    receiptBranchId,
    receiptItemId,
  );
  const showSelectedStock =
    receiptBranchId && receiptItemId && selectedStock !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      dir="rtl"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      <div
        className={`relative w-full sm:max-w-2xl max-h-[95dvh] sm:max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden ${ws.glass} ${ws.card}`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-6 flex items-center justify-between flex-shrink-0 ${ws.topBar}`}
        >
          <div className="min-w-0">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/80`}>
                <Package className="w-5 h-5" />
              </span>
              <span className="truncate">
                {isEditMode ? "تعديل الوارد" : "إضافة وارد مشتريات"}
              </span>
            </h3>
            <p className="text-slate-500 dark:text-slate-500 dark:text-white/50 text-sm mt-1">
              {isEditMode
                ? "عدّل بيانات الوارد والأصناف والكميات"
                : "سجّل كميات واردة لعدة أصناف في نفس الوقت"}
            </p>
          </div>
          <button
            type="button"
            className={ws.iconButton}
            onClick={close}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 min-h-0">
          {/* Error */}
          {receiptError ? (
            <div className="p-4 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-100 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">{receiptError}</div>
            </div>
          ) : null}

          {/* Branch + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                الفرع
              </label>
              <GlassSelect
                value={receiptBranchId}
                onChange={setReceiptBranchId}
                options={branchOptions}
                buttonClassName="px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                تاريخ الوارد
              </label>
              <GlassDatePicker
                value={receiptDate}
                onChange={setReceiptDate}
                placeholder="اختر التاريخ"
                buttonClassName="px-4 py-3"
                showTime
              />
              {isFutureDate ? (
                <p className="mt-1.5 text-xs text-red-700 dark:text-red-700 dark:text-red-200">
                  ⚠ التاريخ في المستقبل — لا يمكن الحفظ
                </p>
              ) : null}
            </div>
          </div>

          {/* Add item row */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 items-end md:grid-cols-[1fr_140px_120px]">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                  الصنف
                </label>
                <GlassSelect
                  value={receiptItemId}
                  onChange={setReceiptItemId}
                  options={itemOptions}
                  buttonClassName="px-4 py-3"
                  searchable
                  searchPlaceholder="ابحث عن صنف..."
                  noResultsLabel="لا يوجد صنف مطابق"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
                  الكمية
                  {lockedUnitLabel ? (
                    <span className="font-normal text-slate-500 dark:text-slate-500 dark:text-white/40">
                      {" "}
                      ({lockedUnitLabel})
                    </span>
                  ) : null}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={receiptQty}
                  onChange={(e) => setReceiptQty(e.target.value)}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="0"
                />
              </div>

              <button
                type="button"
                onClick={handleAddWithUnit}
                className={`${ws.btnPrimary} px-4 py-3 justify-center`}
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>
            </div>

            {/* Current stock hint */}
            {showSelectedStock ? (
              <div className="flex items-center gap-2 px-1">
                <Warehouse className="w-3.5 h-3.5 text-amber-700 dark:text-amber-700 dark:text-amber-300/70" />
                <span className="text-xs text-amber-700 dark:text-amber-700 dark:text-amber-200/80">
                  الكمية الحالية في الفرع:{" "}
                  <span className="font-bold text-amber-700 dark:text-amber-700 dark:text-amber-200">
                    {selectedStock}
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55 mb-2">
              ملاحظة (اختياري)
            </label>
            <input
              type="text"
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
              className={`${ws.input} px-4 py-3`}
              placeholder="مثال: فاتورة رقم 123"
            />
          </div>

          {/* Items list */}
          <div className={`${ws.glassSoft} ${ws.card} p-4`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-slate-900 dark:text-slate-900 dark:text-white font-bold">الأصناف المضافة</h4>
              <span className={`${ws.chip}`}>{itemsList.length} صنف</span>
            </div>

            {itemsList.length === 0 ? (
              <div className="text-slate-500 dark:text-slate-500 dark:text-white/50 text-sm">
                ما تم اختيار أصناف بعد
              </div>
            ) : (
              <div className="space-y-2">
                {itemsList.map((it) => {
                  const itemStock = getStock(
                    stockByBranchItem,
                    receiptBranchId,
                    it.itemId,
                  );
                  // Prefer the operator's typed qty+unit when available;
                  // fall back to the raw base-unit number for edit-mode
                  // rows we hydrated from the server (no display label
                  // tracked for those).
                  const display = displayByItem[it.itemId];
                  const qtyLabel = display
                    ? `${display.qty}${display.unitLabel ? ` ${display.unitLabel}` : ""}`
                    : String(it.quantity);

                  return (
                    <div
                      key={it.itemId}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-slate-200 dark:border-white/10"
                    >
                      <div className="min-w-0">
                        <div className="text-slate-900 dark:text-slate-900 dark:text-white font-semibold truncate">
                          {it.itemName}
                        </div>
                        {receiptBranchId && itemStock !== null ? (
                          <div className="text-slate-500 dark:text-slate-500 dark:text-white/40 text-xs mt-0.5 flex items-center gap-1">
                            <Warehouse className="w-3 h-3" />
                            المتوفر: {itemStock}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`${ws.pill} bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-900 dark:text-white border-slate-200 dark:border-slate-200 dark:border-white/10`}
                        >
                          {qtyLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveWithUnit(it.itemId)}
                          className={`${ws.btnDanger} px-3 py-2 text-sm justify-center`}
                          aria-label="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`p-4 sm:p-6 border-t ${ws.divider} flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0`}
        >
          <button
            type="button"
            onClick={close}
            className={`${ws.btnNeutral} flex-1 px-4 py-3 justify-center`}
            disabled={isPending}
          >
            <X className="w-5 h-5" />
            <span>إلغاء</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className={`${ws.btnPrimary} flex-1 px-4 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Send className="w-5 h-5" />
            <span>{submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
