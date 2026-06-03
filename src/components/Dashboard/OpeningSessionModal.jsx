import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

// Per-item `units` array from the API. Legacy items still without a
// multi-unit setup return [] — we fall back to factor=1 (qty as-typed)
// and hide the dropdown.
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

export function OpeningSessionModal({
  openingModalOpen,
  setOpeningModalOpen,
  openingBranchId,
  setOpeningBranchId,
  openingOpenedAt,
  setOpeningOpenedAt,
  openingNote,
  setOpeningNote,
  openingSearch,
  setOpeningSearch,
  openingQtyByItem,
  setOpeningQtyByItem,
  openingError,
  openingSuccess,
  filteredOpeningItems,
  submitOpening,
  createOpeningMutation,
  branches,
}) {
  // ── Per-item unit selection ────────────────────────────────────────
  //
  // Each item carries an inline `units` array (from `item_units`). The
  // operator types a qty in the picked unit; we convert to base before
  // writing to `openingQtyByItem` so the existing submit pipeline (which
  // ships the map straight to the API as base-unit qty) stays untouched.
  //
  // `displayQtyByItem` is the user-facing number; `unitByItem` is the
  // selected unit-row id. Both are local state and reset whenever the
  // modal is opened (i.e. when `filteredOpeningItems` changes shape).
  const [displayQtyByItem, setDisplayQtyByItem] = useState({});
  const [unitByItem, setUnitByItem] = useState({});

  // Seed defaults whenever the item list changes (modal opens, branch
  // filter changes). We only fill *missing* keys so an operator's
  // mid-entry edits aren't blown away on every re-render.
  useEffect(() => {
    if (!Array.isArray(filteredOpeningItems)) return;
    setUnitByItem((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const it of filteredOpeningItems) {
        if (next[it.id] != null) continue;
        const def = pickDefaultUnit(it, "default_inventory_unit_id");
        if (def) {
          next[it.id] = String(def.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [filteredOpeningItems]);

  const computeBaseQty = (item, displayQty, unitId) => {
    const units = getItemUnits(item);
    const picked = units.find((u) => String(u.id) === String(unitId));
    const factor = picked ? Number(picked.conversion_factor) || 1 : 1;
    const n = Number(displayQty);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * factor * 1000) / 1000;
  };

  const handleDisplayChange = (item, value) => {
    setDisplayQtyByItem((prev) => ({ ...prev, [item.id]: value }));
    const baseQty = computeBaseQty(item, value, unitByItem[item.id]);
    setOpeningQtyByItem((prev) => ({ ...prev, [item.id]: baseQty }));
  };

  const handleUnitChange = (item, unitId) => {
    setUnitByItem((prev) => ({ ...prev, [item.id]: unitId }));
    const baseQty = computeBaseQty(item, displayQtyByItem[item.id], unitId);
    setOpeningQtyByItem((prev) => ({ ...prev, [item.id]: baseQty }));
  };

  if (!openingModalOpen) {
    return null;
  }

  const close = () => setOpeningModalOpen(false);

  const branchOptions = [
    { value: "", label: "اختر الفرع" },
    ...(branches || []).map((b) => ({ value: String(b.id), label: b.name })),
  ];

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
        className={`relative w-full max-w-3xl ${ws.glass} ${ws.card} overflow-hidden`}
      >
        <div
          className={`p-5 border-b ${ws.divider} flex items-center justify-between gap-4`}
        >
          <div className="min-w-0">
            <h3 className="text-slate-900 dark:text-slate-900 dark:text-white font-bold text-lg tracking-tight truncate">
              تسجيل مخزون افتتاحي
            </h3>
            <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm">
              هذه الخطوة تعيد "المفترض" كنقطة بداية للفترة
            </p>
          </div>
          <button
            type="button"
            className={ws.iconButton}
            onClick={close}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <GlassSelect
              value={openingBranchId}
              onChange={setOpeningBranchId}
              options={branchOptions}
              buttonClassName="px-3 py-2.5"
            />

            <div className="w-full">
              <label className="block text-xs text-slate-600 dark:text-slate-600 dark:text-white/55 mb-1">
                تاريخ الافتتاحي
              </label>
              <GlassDatePicker
                value={openingOpenedAt}
                onChange={setOpeningOpenedAt}
                placeholder="اختر التاريخ"
                buttonClassName="px-3 py-2.5"
                showTime
              />
            </div>

            <div className="w-full">
              <label className="block text-xs text-slate-600 dark:text-slate-600 dark:text-white/55 mb-1">
                ملاحظة (اختياري)
              </label>
              <input
                type="text"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="مثال: افتتاح فترة يناير"
              />
            </div>
          </div>

          <div className="mb-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-500 dark:text-white/40" />
              <input
                type="text"
                value={openingSearch}
                onChange={(e) => setOpeningSearch(e.target.value)}
                className={`${ws.input} pr-10 pl-3 py-2.5`}
                placeholder="ابحث عن صنف..."
              />
            </div>
          </div>

          <div
            className={`max-h-[46vh] overflow-auto rounded-3xl border ${ws.divider} bg-slate-50 dark:bg-slate-50 dark:bg-white/[0.02]`}
          >
            <table className="w-full">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04]">
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70">
                    الصنف
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70">
                    الوحدة
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-white/70">
                    الكمية الافتتاحية
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOpeningItems.map((it) => {
                  const units = getItemUnits(it);
                  const unitOptions = units
                    .slice()
                    .sort(
                      (a, b) =>
                        Number(a.sort_order || 0) - Number(b.sort_order || 0),
                    )
                    .map((u) => ({
                      value: String(u.id),
                      label: u.name_ar || u.name_en || "—",
                    }));
                  // Display qty: prefer the typed value, fall back to the
                  // base qty already in the map (covers re-opens / hydration).
                  const displayValue =
                    displayQtyByItem[it.id] ??
                    openingQtyByItem[it.id] ??
                    0;
                  return (
                    <tr
                      key={it.id}
                      className="border-t border-slate-100 dark:border-slate-100 dark:border-white/5"
                    >
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-900 dark:text-white font-medium">
                        {it.name}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-700 dark:text-white/65 text-sm min-w-[140px]">
                        {unitOptions.length > 0 ? (
                          <GlassSelect
                            value={unitByItem[it.id] || ""}
                            onChange={(v) => handleUnitChange(it, v)}
                            options={unitOptions}
                            buttonClassName="px-3 py-2"
                          />
                        ) : (
                          <span>{it.unit || "-"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={displayValue}
                          onChange={(e) => handleDisplayChange(it, e.target.value)}
                          className={`${ws.input} px-3 py-2.5`}
                        />
                      </td>
                    </tr>
                  );
                })}

                {filteredOpeningItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-slate-600 dark:text-slate-600 dark:text-white/55"
                    >
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {openingSuccess && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl text-emerald-700 dark:text-emerald-700 dark:text-emerald-200 font-semibold">
              {openingSuccess}
            </div>
          )}

          {openingError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-400/30 rounded-2xl text-red-700 dark:text-red-700 dark:text-red-200">
              {openingError}
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={close}
              className={`${ws.btnNeutral} px-4 py-3`}
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={submitOpening}
              disabled={createOpeningMutation.isPending}
              className={`${ws.btnPrimary} px-6 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {createOpeningMutation.isPending
                ? "جاري الحفظ..."
                : "حفظ المخزون الافتتاحي"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
