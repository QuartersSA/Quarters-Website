"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X, Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import ItemUnitsPanel from "@/components/Items/ItemUnitsPanel";

function moneyInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return (Math.round(number * 100) / 100).toFixed(2);
}

/**
 * Modal used by the Purchases items panel to create / edit items.
 *
 * Critical UX bit: a checkbox "إضافة لقسم المخزون أيضاً" maps
 * directly to the items API's `show_in_inventory` flag. When OFF
 * the item is purchases-only — it stays out of inventory pages
 * and out of the inventory employee flow, but still shows up in
 * the purchases items list, in invoices, and (eventually) in
 * vendor billing reports.
 */
export default function PurchaseItemModal({
  open,
  item,
  categories,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!item;

  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [basePurchaseCost, setBasePurchaseCost] = useState("");
  const [units, setUnits] = useState([]);
  const [minThreshold, setMinThreshold] = useState("");
  const [showInInventory, setShowInInventory] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name || "");
      setNameEn(item.name_en || "");
      setDescription(item.description || "");
      setCategoryId(item.category_id ? String(item.category_id) : "");
      const baseCost =
        item.base_purchase_cost != null
          ? item.base_purchase_cost
          : item.cost != null
            ? item.cost
            : "";
      setBasePurchaseCost(moneyInput(baseCost));
      const serverUnits = Array.isArray(item.units) ? item.units : [];
      setUnits(
        serverUnits.map((u) => ({
          unit_id: u.unit_id,
          name_ar: u.name_ar,
          name_en: u.name_en || null,
          conversion_factor: Number(u.conversion_factor) || 1,
          is_base: !!u.is_base,
          default_purchase: u.id === item.default_purchase_unit_id,
          default_inventory: u.id === item.default_inventory_unit_id,
        })),
      );
      setMinThreshold(
        item.min_stock_threshold === null ||
          item.min_stock_threshold === undefined
          ? ""
          : String(item.min_stock_threshold),
      );
      setShowInInventory(item.show_in_inventory !== false);
    } else {
      setName("");
      setNameEn("");
      setDescription("");
      setCategoryId("");
      setBasePurchaseCost("");
      setUnits([]);
      setMinThreshold("");
      setShowInInventory(false);
    }
  }, [open, item]);

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "بدون فئة" },
      ...(categories || []).map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    ],
    [categories],
  );

  const canSubmit = !isSubmitting && !!name.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const baseRow = (units || []).find((u) => u.is_base);
    const defaultInvRow = (units || []).find((u) => u.default_inventory);
    // Mirror the OPERATOR-PICKED default inventory unit into the
    // legacy `items.unit` text column so anything else that still
    // reads that flat field (table cards, older exports) sees the
    // unit the operator chose — not whatever happens to be base.
    const baseUnitText =
      defaultInvRow?.name_ar || baseRow?.name_ar || "حبة";
    const baseCostRaw =
      basePurchaseCost === "" ? null : Number(basePurchaseCost);
    const baseCostNum =
      baseCostRaw === null || !Number.isFinite(baseCostRaw)
        ? null
        : Math.round(baseCostRaw * 100) / 100;
    const payload = {
      name: name.trim(),
      name_en: nameEn.trim() || null,
      description: description.trim() || null,
      // Legacy `unit` text mirrors the default inventory unit so
      // older reports/exports that still read items.unit keep
      // showing the unit the operator picked.
      unit: baseUnitText,
      category_id: categoryId ? Number(categoryId) : null,
      cost: baseCostNum,
      base_purchase_cost: baseCostNum,
      units,
      min_stock_threshold:
        minThreshold === "" ? 10 : Number(minThreshold),
      show_in_inventory: !!showInInventory,
      // Always active so the purchases panel surfaces the row even
      // when show_in_inventory is false.
      is_active: true,
    };
    if (isEditing) payload.id = item.id;
    onSubmit(payload);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-lg p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}
            >
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? "تعديل صنف" : "إضافة صنف"}
              </div>
              <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
                صنف يُستخدم في فواتير المشتريات
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              اسم الصنف <span className="text-rose-700 dark:text-rose-300">*</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${ws.input} px-3 py-2`}
              placeholder="مطلوب"
            />
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              الاسم بالإنجليزية{" "}
              <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
            </div>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className={`${ws.input} px-3 py-2`}
              dir="ltr"
            />
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              الفئة
            </div>
            <GlassSelect
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="اختر الفئة"
              buttonClassName="text-sm py-2.5 px-3"
            />
          </div>

          {/* Multi-unit panel — same component the inventory items
              modal uses. Replaces the old single-unit dropdown +
              standalone "التكلفة المرجعية" input. */}
          <ItemUnitsPanel
            units={units}
            setUnits={setUnits}
            basePurchaseCost={basePurchaseCost}
            setBasePurchaseCost={setBasePurchaseCost}
          />

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              الحد الأدنى للمخزون
            </div>
            <input
              type="number"
              value={minThreshold}
              onChange={(e) => setMinThreshold(e.target.value)}
              className={`${ws.input} px-3 py-2 text-right`}
              step="1"
              min="0"
              dir="ltr"
              placeholder="10"
            />
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              الوصف <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${ws.input} px-3 py-2`}
              placeholder="وصف مختصر للصنف"
            />
          </div>

          <label
            className={`${ws.glassSoft} ${ws.card} flex items-start gap-3 p-3 cursor-pointer select-none`}
          >
            <input
              type="checkbox"
              checked={showInInventory}
              onChange={(e) => setShowInInventory(e.target.checked)}
              className="accent-emerald-500 mt-0.5"
            />
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                إضافة لقسم المخزون أيضاً
              </div>
              <div className="text-xs text-slate-600 dark:text-white/60 mt-0.5 leading-relaxed">
                مفعّل: الصنف يظهر في إدارة المخزون ويُحتسب في عمليات الجرد.
                <br />
                غير مفعّل: صنف خاص بالمشتريات فقط (لا يظهر في المخزون).
              </div>
            </div>
          </label>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              {isEditing ? "حفظ التعديلات" : "إضافة"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-4 py-2`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
