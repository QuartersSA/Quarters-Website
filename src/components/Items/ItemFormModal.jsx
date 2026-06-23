import { useMemo } from "react";
import {
  Package,
  X,
  Languages,
  Layers,
  ClipboardList,
  Link,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import ItemUnitsPanel from "@/components/Items/ItemUnitsPanel";
import { formatRiyadhDateForInput } from "@/utils/dateUtils";

export function ItemFormModal({
  isOpen,
  editingItem,
  formData,
  setFormData,
  categories,
  greenBeans = [],
  onSubmit,
  onClose,
  createMutation,
  updateMutation,
}) {
  // Determine if the selected category is a roasted coffee category
  const isRoastedCoffeeCategory = useMemo(() => {
    if (!formData.category_id) return false;
    const cat = (Array.isArray(categories) ? categories : []).find(
      (c) => String(c.id) === String(formData.category_id),
    );
    if (!cat) return false;
    const catName = (cat.name || "").toLowerCase();
    const catNameEn = (cat.name_en || "").toLowerCase();
    return (
      catName.includes("بن") ||
      catName.includes("محمص") ||
      catName.includes("قهوة محمصة") ||
      catNameEn.includes("roast") ||
      catNameEn.includes("coffee bean")
    );
  }, [formData.category_id, categories]);

  // When category changes away from roasted coffee, clear linked bean
  const handleCategoryChange = (v) => {
    const newCatId = v ? parseInt(v) : null;
    const newCat = (Array.isArray(categories) ? categories : []).find(
      (c) => String(c.id) === String(newCatId),
    );
    const newCatName = (newCat?.name || "").toLowerCase();
    const newCatNameEn = (newCat?.name_en || "").toLowerCase();
    const isRoasted =
      newCatName.includes("بن") ||
      newCatName.includes("محمص") ||
      newCatName.includes("قهوة محمصة") ||
      newCatNameEn.includes("roast") ||
      newCatNameEn.includes("coffee bean");

    setFormData({
      ...formData,
      category_id: newCatId,
      linked_green_bean_id: isRoasted ? formData.linked_green_bean_id : null,
    });
  };

  if (!isOpen) return null;

  const labelClass = "block text-slate-700 dark:text-white/70 text-sm font-semibold mb-2";
  const helpClass = "text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/40 text-xs mt-1";

  const categoryOptions = [
    { value: "", label: "بدون فئة" },
    ...(Array.isArray(categories)
      ? categories.map((c) => ({ value: String(c.id), label: c.name }))
      : []),
  ];

  const greenBeanOptions = [
    { value: "", label: "بدون ربط" },
    ...(Array.isArray(greenBeans)
      ? greenBeans.map((b) => ({ value: String(b.id), label: b.name }))
      : []),
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  const submitLabel = saving
    ? "جاري الحفظ…"
    : editingItem
      ? "حفظ التعديلات"
      : "إضافة الصنف";

  const errorMessage =
    createMutation.error?.message || updateMutation.error?.message;

  const categoryValue = formData.category_id
    ? String(formData.category_id)
    : "";

  const linkedBeanValue = formData.linked_green_bean_id
    ? String(formData.linked_green_bean_id)
    : "";

  // Show last order info if editing and item is linked
  const lastOrderInfo =
    editingItem?.linked_green_bean_id && editingItem?.last_order_price_per_kg
      ? {
          price: Number(editingItem.last_order_price_per_kg).toFixed(2),
          date: editingItem.last_order_date
            ? formatRiyadhDateForInput(editingItem.last_order_date)
            : null,
          beanName: editingItem.linked_green_bean_name || "",
        }
      : null;

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
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/80`}>
              <Package className="w-5 h-5" />
            </div>
            {editingItem ? "تعديل الصنف" : "إضافة صنف جديد"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/60" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {/* Category */}
          <div>
            <label className={`${labelClass} flex items-center gap-2`}>
              <Layers className="w-4 h-4" />
              الفئة
            </label>

            <GlassSelect
              value={categoryValue}
              onChange={handleCategoryChange}
              options={categoryOptions}
              placeholder="اختر الفئة…"
            />

            <p className={helpClass}>
              تقدر تضيف فئات من زر "الفئات" في صفحة الأصناف
            </p>
          </div>

          {/* Green Bean Link — only shown for roasted coffee categories */}
          {isRoastedCoffeeCategory ? (
            <div
              className={`${ws.glassSoft} border border-amber-500/20 rounded-2xl p-5`}
            >
              <label
                className={`${labelClass} flex items-center gap-2 text-amber-700 dark:text-amber-700 dark:text-amber-200/80`}
              >
                <Link className="w-4 h-4" />
                ربط ببن أخضر
              </label>

              <GlassSelect
                value={linkedBeanValue}
                onChange={(v) =>
                  setFormData({
                    ...formData,
                    linked_green_bean_id: v ? parseInt(v) : null,
                  })
                }
                options={greenBeanOptions}
                placeholder="اختر البن الأخضر…"
              />

              <p className="text-amber-700 dark:text-amber-700 dark:text-amber-200/40 text-xs mt-2">
                عند ربط الصنف ببن أخضر، التكلفة تتحدث تلقائياً مع كل طلب توريد
                جديد
              </p>

              {lastOrderInfo ? (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/15 rounded-xl">
                  <p className="text-amber-700 dark:text-amber-700 dark:text-amber-200/80 text-xs">
                    آخر تكلفة توريد ({lastOrderInfo.beanName}):{" "}
                    <span className="font-bold text-amber-100">
                      {lastOrderInfo.price} ر.س/كغ
                    </span>
                    {lastOrderInfo.date ? (
                      <span className="text-amber-700 dark:text-amber-700 dark:text-amber-200/50 mr-2">
                        — {lastOrderInfo.date}
                      </span>
                    ) : null}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Arabic Name */}
          <div>
            <label className={labelClass}>
              اسم الصنف (عربي) <span className="text-red-700 dark:text-red-700 dark:text-red-300">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={`${ws.input} px-4 py-3`}
              placeholder="مثال: حليب نادك"
              dir="rtl"
            />
          </div>

          {/* English Name */}
          <div>
            <label className={`${labelClass} flex items-center gap-2`}>
              <Languages className="w-4 h-4" />
              اسم الصنف (إنجليزي) <span className="text-red-700 dark:text-red-700 dark:text-red-300">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name_en}
              onChange={(e) =>
                setFormData({ ...formData, name_en: e.target.value })
              }
              className={`${ws.input} px-4 py-3`}
              placeholder="Example: Nadec Milk"
              dir="ltr"
            />
            <p className={helpClass}>أدخل الاسم بالأحرف الإنجليزية فقط</p>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>الوصف</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className={`${ws.input} px-4 py-3 resize-none`}
              placeholder="وصف مختصر للصنف…"
            />
          </div>

          {/* Multi-unit panel — replaces the old single-unit radio
              grid and the standalone "تكلفة المنتج" input. The panel
              owns base_purchase_cost + the per-item units array. The
              legacy `formData.cost` stays in sync with the base cost
              so older code paths (reports / API consumers) keep
              working without change. */}
          <ItemUnitsPanel
            units={formData.units || []}
            setUnits={(next) => setFormData({ ...formData, units: next })}
            basePurchaseCost={formData.base_purchase_cost}
            setBasePurchaseCost={(v) =>
              setFormData({
                ...formData,
                base_purchase_cost: v,
                cost: v, // legacy mirror
              })
            }
          />

          {/* Min Stock Threshold */}
          <div>
            <label className={labelClass}>
              الحد الأدنى للتنبيه <span className="text-red-700 dark:text-red-700 dark:text-red-300">*</span>
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.001"
              value={formData.min_stock_threshold}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  min_stock_threshold: Number(e.target.value) || 0,
                })
              }
              className={`${ws.input} px-4 py-3`}
              placeholder="10"
            />
            <p className={helpClass}>
              سيتم التنبيه عند وصول الكمية لهذا العدد أو أقل
            </p>
          </div>

          {/* Max Stock Threshold */}
          <div>
            <label className={labelClass}>
              الحد الأقصى للتنبيه{" "}
              <span className="text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/40 text-xs">(اختياري)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={
                formData.max_stock_threshold === null ||
                formData.max_stock_threshold === undefined
                  ? ""
                  : formData.max_stock_threshold
              }
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  max_stock_threshold:
                    val === "" ? null : Number(val),
                });
              }}
              className={`${ws.input} px-4 py-3`}
              placeholder="بدون حد"
            />
            <p className={helpClass}>
              سيتم التنبيه عند تجاوز الكمية هذا العدد (لكشف المخزون الفائض)
            </p>
          </div>

          {/* Show in Inventory Toggle */}
          <div
            className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-2xl p-5`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`${ws.iconBox} w-9 h-9 text-blue-700 dark:text-blue-700 dark:text-blue-200`}>
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white/90 text-sm font-semibold">
                    تفعيل الصنف في الجرد
                  </p>
                  <p className="text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/40 text-xs mt-0.5">
                    الصنف يظهر للموظفين عند تسجيل الجرد ويُحسب في التقارير
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={formData.show_in_inventory}
                aria-label="تفعيل الصنف في الجرد"
                onClick={() =>
                  setFormData({
                    ...formData,
                    show_in_inventory: !formData.show_in_inventory,
                  })
                }
                className="relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30"
                style={{
                  backgroundColor: formData.show_in_inventory
                    ? "rgba(52, 211, 153, 0.35)"
                    : "rgba(255, 255, 255, 0.08)",
                  border: formData.show_in_inventory
                    ? "1px solid rgba(52, 211, 153, 0.4)"
                    : "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <span
                  className="block w-5 h-5 rounded-full shadow-md transition-transform duration-200"
                  style={{
                    backgroundColor: formData.show_in_inventory
                      ? "#34d399"
                      : "rgba(255, 255, 255, 0.4)",
                    transform: formData.show_in_inventory
                      ? "translateX(-6px) translateY(1px)"
                      : "translateX(-30px) translateY(1px)",
                  }}
                />
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
              <p className="text-red-700 dark:text-red-700 dark:text-red-200 text-sm">{errorMessage}</p>
            </div>
          ) : null}

          <div className={`flex gap-3 pt-4 border-t ${ws.divider}`}>
            <button
              type="submit"
              disabled={saving}
              className={`${ws.btnPrimary} flex-1 px-6 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-6 py-3 justify-center`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
