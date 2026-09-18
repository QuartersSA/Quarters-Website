import { useMemo } from "react";
import {
  Package,
  X,
  Languages,
  Layers,
  ClipboardList,
  Flame,
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
  // الفئة المختارة «بن قهوة محمّصة»؟ — العلم الصريح على الفئة هو
  // المصدر الوحيد (لا تخمين بالاسم). أصناف هذه الفئة تظهر لها خانة
  // «إضافة قيمة تحميص» داخل فاتورة المشتريات.
  const selectedCategory = useMemo(() => {
    if (!formData.category_id) return null;
    return (
      (Array.isArray(categories) ? categories : []).find(
        (c) => String(c.id) === String(formData.category_id),
      ) || null
    );
  }, [formData.category_id, categories]);
  const isRoastedCoffeeCategory = selectedCategory?.is_roasted_coffee === true;

  // تغيير الفئة بعيدًا عن البن يمسح افتراضات البن على الصنف.
  const handleCategoryChange = (v) => {
    const newCatId = v ? parseInt(v) : null;
    const newCat = (Array.isArray(categories) ? categories : []).find(
      (c) => String(c.id) === String(newCatId),
    );
    const isRoasted = newCat?.is_roasted_coffee === true;

    setFormData({
      ...formData,
      category_id: newCatId,
      bag_size_kg: isRoasted ? formData.bag_size_kg : "",
      roast_cost_per_kg: isRoasted ? formData.roast_cost_per_kg : "",
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

  // آخر تكلفة صافية محسوبة من فاتورة بن مكتملة الوصول (شاملة الضريبة
  // وتكلفة التحميص وبعد الهدر) — تُكتب على الصنف تلقائيًا من الفاتورة.
  const invoiceCostInfo =
    editingItem && editingItem.cost_source === "invoice"
      ? {
          cost:
            editingItem.base_purchase_cost != null
              ? Number(editingItem.base_purchase_cost).toFixed(2)
              : editingItem.cost != null
                ? Number(editingItem.cost).toFixed(2)
                : null,
          date: editingItem.cost_source_date
            ? formatRiyadhDateForInput(editingItem.cost_source_date)
            : null,
        }
      : null;
  const categoryRoastDefault =
    selectedCategory?.roast_cost_per_kg != null &&
    selectedCategory.roast_cost_per_kg !== ""
      ? Number(selectedCategory.roast_cost_per_kg)
      : 9;
  const roasterName = selectedCategory?.default_roaster_name || null;

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

          {/* افتراضات البن — تظهر فقط لفئة «بن قهوة محمّصة» */}
          {isRoastedCoffeeCategory ? (
            <div
              className={`${ws.glassSoft} border border-amber-500/20 rounded-2xl p-5 space-y-4`}
            >
              <label
                className={`${labelClass} flex items-center gap-2 text-amber-700 dark:text-amber-200/80 mb-0`}
              >
                <Flame className="w-4 h-4" />
                افتراضات البن المحمّص
              </label>
              <p className="text-amber-700 dark:text-amber-200/50 text-xs">
                تُستخدم كقيم افتراضية عند إضافة الصنف في فاتورة مشتريات مع
                «إضافة قيمة تحميص». الفارغ يرث افتراض الفئة.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>وزن الخيشة (كغ)</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={formData.bag_size_kg ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, bag_size_kg: e.target.value })
                    }
                    className={`${ws.input} px-4 py-3`}
                    placeholder="مثال: 60"
                    dir="ltr"
                  />
                  <p className={helpClass}>
                    يحوّل عدد الخِيَش في الفاتورة إلى كيلو خام
                  </p>
                </div>
                <div>
                  <label className={labelClass}>تكلفة التحميص للكيلو (ر.س)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.roast_cost_per_kg ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        roast_cost_per_kg: e.target.value,
                      })
                    }
                    className={`${ws.input} px-4 py-3`}
                    placeholder={`افتراض الفئة: ${categoryRoastDefault}`}
                    dir="ltr"
                  />
                  <p className={helpClass}>
                    {roasterName
                      ? `تُفوتر على «${roasterName}» بفاتورة تحميص مستقلة`
                      : "تُفوتر بفاتورة تحميص مستقلة خارج فاتورة المورد"}
                  </p>
                </div>
              </div>

              {invoiceCostInfo?.cost ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/15 rounded-xl">
                  <p className="text-amber-800 dark:text-amber-200/80 text-xs">
                    تكلفة الصنف الحالية محسوبة من آخر فاتورة بن مكتملة الوصول
                    (صافي الكيلو شامل الضريبة والتحميص وبعد الهدر):{" "}
                    <span className="font-bold">{invoiceCostInfo.cost} ر.س</span>
                    {invoiceCostInfo.date ? (
                      <span className="text-amber-700 dark:text-amber-200/50 mr-2">
                        — وصول {invoiceCostInfo.date}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-amber-700 dark:text-amber-200/50 text-[11px] mt-1">
                    تعديل التكلفة يدويًا هنا يوقف التحديث التلقائي حتى أول
                    وصول مكتمل جديد.
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

          {/* حالة الصنف: نشط/موقوف — الموقوف يختفي من الوارد والجرد
              والتحويل كلها؛ هذا المفتاح هو طريق إعادة التفعيل الوحيد. */}
          <div
            className={`${ws.glassSoft} border rounded-2xl p-5 ${
              formData.is_active === false
                ? "border-red-300 dark:border-red-400/30"
                : "border-slate-200 dark:border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`${ws.iconBox} w-9 h-9 ${
                    formData.is_active === false
                      ? "text-red-600 dark:text-red-300"
                      : "text-emerald-700 dark:text-emerald-200"
                  }`}
                >
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white/90 text-sm font-semibold">
                    الصنف نشط
                  </p>
                  <p className="text-slate-500 dark:text-white/40 text-xs mt-0.5">
                    {formData.is_active === false
                      ? "موقوف — لا يظهر في الوارد ولا الجرد ولا التحويل حتى يُعاد تفعيله"
                      : "إيقافه يخفيه من كل شاشات المخزون مع بقاء سجلاته"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={formData.is_active !== false}
                aria-label="الصنف نشط"
                onClick={() =>
                  setFormData({
                    ...formData,
                    is_active: formData.is_active === false,
                  })
                }
                className="relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30"
                style={{
                  backgroundColor:
                    formData.is_active !== false
                      ? "rgba(52, 211, 153, 0.35)"
                      : "rgba(255, 255, 255, 0.08)",
                  border:
                    formData.is_active !== false
                      ? "1px solid rgba(52, 211, 153, 0.4)"
                      : "1px solid rgba(255, 255, 255, 0.12)",
                }}
              >
                <span
                  className="block w-5 h-5 rounded-full shadow-md transition-transform duration-200"
                  style={{
                    backgroundColor:
                      formData.is_active !== false
                        ? "#34d399"
                        : "rgba(255, 255, 255, 0.4)",
                    transform:
                      formData.is_active !== false
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
