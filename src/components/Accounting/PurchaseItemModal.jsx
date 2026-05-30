"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X, Package } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

const UNIT_OPTIONS = [
  { value: "حبة", label: "حبة" },
  { value: "كيلو", label: "كيلو" },
  { value: "كرتون", label: "كرتون" },
  { value: "كرتون مفرد", label: "كرتون مفرد" },
  { value: "شدة", label: "شدة" },
  { value: "كيس", label: "كيس" },
  { value: "رول", label: "رول" },
];

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
  const [unit, setUnit] = useState("حبة");
  const [categoryId, setCategoryId] = useState("");
  const [cost, setCost] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [showInInventory, setShowInInventory] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setName(item.name || "");
      setNameEn(item.name_en || "");
      setDescription(item.description || "");
      setUnit(item.unit || "حبة");
      setCategoryId(item.category_id ? String(item.category_id) : "");
      setCost(
        item.cost === null || item.cost === undefined
          ? ""
          : String(item.cost),
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
      setUnit("حبة");
      setCategoryId("");
      setCost("");
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
    const payload = {
      name: name.trim(),
      name_en: nameEn.trim() || null,
      description: description.trim() || null,
      unit: unit || "حبة",
      category_id: categoryId ? Number(categoryId) : null,
      cost: cost === "" ? null : Number(cost),
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

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                الوحدة
              </div>
              <GlassSelect
                value={unit}
                onChange={setUnit}
                options={UNIT_OPTIONS}
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                التكلفة المرجعية (ر.س)
              </div>
              <input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={`${ws.input} px-3 py-2 text-right`}
                step="0.01"
                min="0"
                dir="ltr"
                placeholder="0.00"
              />
            </div>
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
