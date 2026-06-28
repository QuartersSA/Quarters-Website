import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  ClipboardCheck,
  Search,
  X,
  RotateCcw,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { adminFetch } from "@/utils/apiAuth";
import { formatRiyadhDateTimeForInput } from "@/utils/dateUtils";
import { invalidateInventoryQueries } from "@/utils/queryKeys";

function getItemUnits(item) {
  return Array.isArray(item?.units) ? item.units : [];
}

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

function isExcludedInventoryCategory(categoryName) {
  const normalized = String(categoryName || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!normalized) return false;
  return (
    (normalized.includes("سكر") && normalized.includes("محلي")) ||
    (normalized.includes("sugar") && normalized.includes("sweet"))
  );
}

function roundQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

export default function AdminInventoryCountModal({
  open,
  onClose,
  branches,
  items,
}) {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [operationDate, setOperationDate] = useState("");
  const [search, setSearch] = useState("");
  const [qtyByItem, setQtyByItem] = useState({});
  const [countMode, setCountMode] = useState("partial");
  const [showEnteredOnly, setShowEnteredOnly] = useState(false);
  const [fullConfirmOpen, setFullConfirmOpen] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setOperationDate(formatRiyadhDateTimeForInput());
    setSearch("");
    setQtyByItem({});
    setCountMode("partial");
    setShowEnteredOnly(false);
    setFullConfirmOpen(false);
    setSuccess("");
    setError("");
  }, [open]);

  const branchOptions = useMemo(
    () => [
      { value: "", label: "اختر الفرع" },
      ...(branches || []).map((branch) => ({
        value: String(branch.id),
        label: branch.name,
      })),
    ],
    [branches],
  );

  const selectedBranchNumber = Number(branchId);

  const countItems = useMemo(() => {
    if (!Number.isFinite(selectedBranchNumber) || selectedBranchNumber <= 0) {
      return [];
    }

    return (items || []).filter((item) => {
      if (item.is_active === false || item.show_in_inventory === false) {
        return false;
      }
      if (isExcludedInventoryCategory(item.category_name)) {
        return false;
      }
      if (
        Array.isArray(item.disabled_branches) &&
        item.disabled_branches.map(Number).includes(selectedBranchNumber)
      ) {
        return false;
      }
      return true;
    });
  }, [items, selectedBranchNumber]);

  const enteredItems = useMemo(() => {
    return Object.entries(qtyByItem).filter(([, value]) => {
      if (value === "" || value == null) return false;
      const qty = roundQty(value);
      return qty != null && qty >= 0;
    });
  }, [qtyByItem]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = countItems;

    if (q) {
      list = list.filter((item) => {
        const name = String(item.name || "").toLowerCase();
        const nameEn = String(item.name_en || "").toLowerCase();
        const category = String(item.category_name || "").toLowerCase();
        return name.includes(q) || nameEn.includes(q) || category.includes(q);
      });
    }

    if (showEnteredOnly) {
      const enteredIds = new Set(enteredItems.map(([id]) => String(id)));
      list = list.filter((item) => enteredIds.has(String(item.id)));
    }

    return list;
  }, [countItems, enteredItems, search, showEnteredOnly]);

  const progressPercentage =
    countItems.length > 0
      ? Math.min(100, (enteredItems.length / countItems.length) * 100)
      : 0;

  const createInventoryMutation = useMutation({
    mutationFn: async () => {
      const availableItems = {};
      for (const [itemId, value] of enteredItems) {
        const qty = roundQty(value);
        if (qty == null || qty < 0) continue;
        availableItems[itemId] = qty;
      }
      const enteredIds = new Set(Object.keys(availableItems).map(String));
      const unavailableItems =
        countMode === "full"
          ? countItems
              .filter((item) => !enteredIds.has(String(item.id)))
              .map((item) => Number(item.id))
              .filter((id) => Number.isFinite(id) && id > 0)
          : [];

      const response = await adminFetch("/api/inventory-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          inventoryType: "Daily",
          availableItems,
          unavailableItems,
          operationDate,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "فشل حفظ الجرد");
      }
      return data;
    },
    onSuccess: async () => {
      await invalidateInventoryQueries(queryClient);
      setError("");
      setSuccess("تم حفظ الجرد الجديد بنجاح");
      setQtyByItem({});
      setSearch("");
    },
    onError: (err) => {
      setSuccess("");
      setError(err?.message || "فشل حفظ الجرد");
    },
  });

  if (!open) return null;

  const close = () => {
    if (createInventoryMutation.isPending) return;
    onClose?.();
  };

  const handleQtyChange = (itemId, value) => {
    setQtyByItem((prev) => {
      const next = { ...prev };
      if (value === "") {
        delete next[itemId];
      } else {
        next[itemId] = value;
      }
      return next;
    });
  };

  const resetDraft = () => {
    setQtyByItem({});
    setSearch("");
    setShowEnteredOnly(false);
    setFullConfirmOpen(false);
    setError("");
    setSuccess("");
  };

  const canSubmit =
    Number.isFinite(selectedBranchNumber) &&
    selectedBranchNumber > 0 &&
    (countMode === "full" ? countItems.length > 0 : enteredItems.length > 0) &&
    !createInventoryMutation.isPending;
  const missingCount = Math.max(0, countItems.length - enteredItems.length);

  const submitCount = () => {
    if (!canSubmit) return;
    if (countMode === "full" && missingCount > 0) {
      setFullConfirmOpen(true);
      return;
    }
    createInventoryMutation.mutate();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      <div
        className={`relative w-full max-w-5xl ${ws.glass} ${ws.card} overflow-hidden`}
      >
        <div
          className={`p-5 border-b ${ws.divider} flex items-center justify-between gap-4`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
              <h3 className="text-slate-900 dark:text-white font-bold text-xl tracking-tight">
                جرد جديد
              </h3>
            </div>
            <p className="text-slate-600 dark:text-white/55 text-sm mt-1">
              أدخل كميات الجرد مباشرة من لوحة الإدارة بنفس وحدة الجرد الافتراضية للصنف
            </p>
          </div>

          <button
            type="button"
            className={ws.iconButton}
            onClick={close}
            aria-label="إغلاق"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(180px,240px)_minmax(180px,240px)_1fr] gap-3 mb-4">
            <div>
              <label className="block text-xs text-slate-600 dark:text-white/55 mb-1">
                الفرع
              </label>
              <GlassSelect
                value={branchId}
                onChange={(value) => {
                  setBranchId(value);
                  setQtyByItem({});
                  setSuccess("");
                  setError("");
                }}
                options={branchOptions}
                buttonClassName="px-3 py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-white/55 mb-1">
                تاريخ ووقت الجرد
              </label>
              <GlassDatePicker
                value={operationDate}
                onChange={setOperationDate}
                placeholder="اختر التاريخ"
                showTime
                buttonClassName="px-3 py-2.5"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-white/55 mb-1">
                بحث
              </label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`${ws.input} pr-10 pl-3 py-2.5`}
                  placeholder="ابحث عن صنف..."
                  disabled={!branchId}
                />
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
            <div
              className={`rounded-2xl border ${ws.divider} bg-slate-50 dark:bg-white/[0.03] p-3`}
            >
              <div className="flex items-center justify-between gap-3 mb-2 text-sm">
                <span className="font-semibold text-slate-800 dark:text-white">
                  التقدم
                </span>
                <span className="text-slate-600 dark:text-white/60">
                  {enteredItems.length} من {countItems.length} صنف
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEnteredOnly((value) => !value)}
              className={`${showEnteredOnly ? ws.btnPrimary : ws.btnNeutral} px-4 py-3 justify-center`}
              disabled={!branchId}
            >
              <span>{showEnteredOnly ? "عرض الكل" : "المدخل فقط"}</span>
              <span className="text-xs opacity-80">({enteredItems.length})</span>
            </button>

            <button
              type="button"
              onClick={resetDraft}
              className={`${ws.btnNeutral} px-4 py-3 justify-center`}
              disabled={enteredItems.length === 0}
            >
              <RotateCcw className="w-4 h-4" />
              <span>مسح المسودة</span>
            </button>
          </div>

          <div
            className={`mb-4 rounded-2xl border ${ws.divider} bg-slate-50 dark:bg-white/[0.03] p-3`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCountMode("partial")}
                className={`${countMode === "partial" ? ws.btnPrimary : ws.btnNeutral} px-4 py-3 justify-center`}
              >
                <span>جرد جزئي</span>
                <span className="text-xs opacity-80">يحفظ المدخل فقط</span>
              </button>

              <button
                type="button"
                onClick={() => setCountMode("full")}
                className={`${countMode === "full" ? ws.btnPrimary : ws.btnNeutral} px-4 py-3 justify-center`}
              >
                <span>جرد كامل</span>
                <span className="text-xs opacity-80">غير المدخل = صفر</span>
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-600 dark:text-white/55">
              {countMode === "full"
                ? `الجرد الكامل سيحفظ ${missingCount} صنف غير مدخل بكمية صفر بعد التأكيد.`
                : "الجرد الجزئي لا يغير الأصناف التي لم تدخل لها كمية."}
            </p>
          </div>

          {!branchId ? (
            <div
              className={`rounded-3xl border ${ws.divider} bg-slate-50 dark:bg-white/[0.02] px-4 py-12 text-center`}
            >
              <p className="text-slate-700 dark:text-white/70 font-semibold">
                اختر الفرع أولاً لعرض أصناف الجرد الخاصة به
              </p>
            </div>
          ) : (
            <div
              className={`max-h-[48vh] overflow-auto rounded-3xl border ${ws.divider} bg-slate-50 dark:bg-white/[0.02]`}
            >
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-white/[0.04]">
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">
                      الصنف
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">
                      التصنيف
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">
                      وحدة الجرد
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-white/70">
                      الكمية
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const lockedUnit = pickDefaultUnit(
                      item,
                      "default_inventory_unit_id",
                    );
                    const lockedUnitLabel =
                      lockedUnit?.name_ar ||
                      lockedUnit?.name_en ||
                      item.unit ||
                      "-";
                    const entered = qtyByItem[item.id] !== undefined;

                    return (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 dark:border-white/5"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </div>
                          {item.name_en ? (
                            <div className="text-xs text-slate-500 dark:text-white/45">
                              {item.name_en}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-white/65">
                          {item.category_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-white/65">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75">
                            {lockedUnitLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={qtyByItem[item.id] ?? ""}
                              onChange={(event) =>
                                handleQtyChange(item.id, event.target.value)
                              }
                              className={`${ws.input} px-3 py-2.5 pl-24 font-semibold`}
                              placeholder="0"
                            />
                            <div className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-white/60">
                              {lockedUnitLabel}
                            </div>
                          </div>
                          {entered ? (
                            <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>مدخل</span>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-slate-600 dark:text-white/55"
                      >
                        لا توجد أصناف مطابقة
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          {success ? (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl text-emerald-700 dark:text-emerald-200 font-semibold">
              {success}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-400/30 rounded-2xl text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {fullConfirmOpen ? (
            <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-300/30 dark:bg-amber-500/10">
              <div className="font-bold text-amber-900 dark:text-amber-100">
                تأكيد الجرد الكامل
              </div>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-100/80">
                سيتم حفظ {missingCount} صنف غير مدخل بكمية صفر. هذا يؤثر على
                رصيد الفرع مباشرة.
              </p>
              <div className="mt-3 flex flex-col sm:flex-row gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setFullConfirmOpen(false)}
                  className={`${ws.btnNeutral} px-4 py-2.5 justify-center`}
                >
                  رجوع
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFullConfirmOpen(false);
                    createInventoryMutation.mutate();
                  }}
                  className={`${ws.btnPrimary} px-4 py-2.5 justify-center`}
                >
                  تأكيد الحفظ بالصفر
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={close}
              className={`${ws.btnNeutral} px-4 py-3 justify-center`}
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={submitCount}
              disabled={!canSubmit}
              className={`${ws.btnPrimary} px-6 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {createInventoryMutation.isPending
                ? "جاري حفظ الجرد..."
                : countMode === "full"
                  ? "حفظ الجرد الكامل"
                  : "حفظ الجرد الجزئي"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
