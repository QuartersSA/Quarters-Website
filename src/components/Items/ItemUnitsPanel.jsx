"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Star,
  Ruler,
  ShoppingCart,
  Boxes,
  CornerDownLeft,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import MeasurementUnitModal from "@/components/Items/MeasurementUnitModal";
import { adminFetch } from "@/utils/apiAuth";

/**
 * Hierarchical multi-unit editor.
 *
 * The chain reads top-down "biggest → smallest". Row 0 is the base
 * (factor=1, price = base_purchase_cost). Each row below is a
 * subdivision of the row immediately above it: the input field
 * holds the "parent count" — how many of THIS unit fit inside the
 * row directly above.
 *
 *   كرتون (base, 5.00 ر.س)
 *     ↳ شدة, parent_count = 20    →  derived cost = 5.00 ÷ 20 = 0.25
 *        ↳ حبة, parent_count = 50  →  derived cost = 0.25 ÷ 50 = 0.005
 *
 * The DB still stores `conversion_factor` as "base units per ONE
 * of this unit" (cumulative ratio), so every consumer downstream
 * (purchase receipts, transfers, inventory ops) keeps working
 * unchanged — they do `qty × conversion_factor` and land on a
 * base-unit value. Conversion between the UI's parent_count and
 * the stored cumulative factor is local to this panel:
 *
 *   factor[0]   = 1
 *   factor[i]   = factor[i-1] / parent_count[i]
 *   derived[0]  = base_cost
 *   derived[i]  = derived[i-1] / parent_count[i]    (= base_cost × factor[i])
 *
 * When the operator edits the parent_count of any non-base row,
 * the panel re-derives every downstream factor so the visible
 * chain stays consistent with what the operator typed.
 */

const SENTINEL_CREATE = "__create_new_unit__";

// Compute the per-row "parent count" (how many of THIS unit fit
// in the row above) directly from the stored cumulative factors.
// Row 0 (base) has no parent, so its parent_count = 1.
function parentCountOf(units, i) {
  if (i <= 0) return 1;
  const prev = Number(units[i - 1]?.conversion_factor) || 0;
  const curr = Number(units[i]?.conversion_factor) || 0;
  if (prev <= 0 || curr <= 0) return 0;
  // Tiny rounding so 12.000000001 reads as 12 in the input field.
  return Math.round((prev / curr) * 10000) / 10000;
}

export default function ItemUnitsPanel({
  units,
  setUnits,
  basePurchaseCost,
  setBasePurchaseCost,
}) {
  const queryClient = useQueryClient();
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [pendingRowIndex, setPendingRowIndex] = useState(null);

  const catalogQuery = useQuery({
    queryKey: ["measurement-units"],
    queryFn: async () => {
      const res = await adminFetch("/api/measurement-units");
      if (!res.ok) throw new Error("failed to load units");
      return res.json();
    },
    staleTime: 60_000,
  });

  const catalog = useMemo(
    () => (Array.isArray(catalogQuery.data) ? catalogQuery.data : []),
    [catalogQuery.data],
  );

  // Seed a base row on first mount when the parent passed nothing.
  useEffect(() => {
    if (!Array.isArray(units) || units.length === 0) {
      setUnits([
        {
          unit_id: null,
          name_ar: "",
          name_en: null,
          conversion_factor: 1,
          is_base: true,
          default_purchase: true,
          default_inventory: true,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeUnits = Array.isArray(units) ? units : [];
  const baseRow = safeUnits[0] || null; // always row 0 in the chain
  const baseCost = Number(basePurchaseCost) || 0;

  const updateRow = (index, patch) => {
    const next = safeUnits.map((u, i) => (i === index ? { ...u, ...patch } : u));
    setUnits(next);
  };

  // Operator edited a parent_count input. Recompute the cumulative
  // `conversion_factor` for that row AND for every row below it so
  // the chain stays internally consistent with what they typed.
  const updateParentCount = (index, value) => {
    if (index <= 0) return; // base row's parent_count is always 1
    const next = [...safeUnits];
    // Snapshot the old parent_count for every row so the downstream
    // rows preserve their relative subdivision after the change.
    const oldParentCounts = next.map((_, k) => parentCountOf(next, k));
    const safe = value === "" ? 0 : Number(value);
    if (!Number.isFinite(safe) || safe < 0) return;
    oldParentCounts[index] = safe;
    // Rebuild every factor from the freshly-edited parent_count chain.
    let cumulative = 1;
    for (let k = 0; k < next.length; k++) {
      if (k === 0) {
        cumulative = 1;
      } else {
        const pc = oldParentCounts[k];
        cumulative = pc > 0 ? cumulative / pc : 0;
      }
      next[k] = { ...next[k], conversion_factor: cumulative };
    }
    setUnits(next);
  };

  // Re-anchor: a different row becomes the base. The picked row is
  // pulled to index 0 (the chain reads top-down) and every factor
  // re-scales relative to the new base so the underlying physical
  // ratios stay the same.
  const setAsBase = (index) => {
    if (index === 0) return;
    const picked = safeUnits[index];
    if (!picked) return;
    const denom = Number(picked.conversion_factor) || 1;
    if (denom <= 0) return;
    const rescaled = safeUnits.map((u) => ({
      ...u,
      conversion_factor: (Number(u.conversion_factor) || 0) / denom,
      is_base: false,
    }));
    // Pull picked to the top + force exact 1.
    const pulled = { ...rescaled[index], is_base: true, conversion_factor: 1 };
    rescaled.splice(index, 1);
    rescaled.unshift(pulled);
    setUnits(rescaled);
  };

  const setDefault = (index, key) => {
    const next = safeUnits.map((u, i) => ({ ...u, [key]: i === index }));
    setUnits(next);
  };

  const addRow = () => {
    // Default new row parent_count = 1 (factor inherits the previous
    // row's factor) so the operator types the real number in the
    // input field next; cost cell stays at "—" until they do.
    const prevFactor =
      Number(safeUnits[safeUnits.length - 1]?.conversion_factor) || 1;
    setUnits([
      ...safeUnits,
      {
        unit_id: null,
        name_ar: "",
        name_en: null,
        conversion_factor: prevFactor, // parent_count defaults to 1
        is_base: false,
        default_purchase: false,
        default_inventory: false,
      },
    ]);
  };

  const removeRow = (index) => {
    if (index === 0) return; // base row stays put
    const next = safeUnits.filter((_, i) => i !== index);
    if (!next.some((u) => u.default_purchase)) next[0].default_purchase = true;
    if (!next.some((u) => u.default_inventory)) next[0].default_inventory = true;
    setUnits(next);
  };

  const handleUnitPick = (index, value) => {
    if (value === SENTINEL_CREATE) {
      setPendingRowIndex(index);
      setShowCreateUnit(true);
      return;
    }
    if (!value) {
      updateRow(index, { unit_id: null, name_ar: "", name_en: null });
      return;
    }
    const picked = catalog.find((c) => String(c.id) === String(value));
    if (!picked) return;
    updateRow(index, {
      unit_id: Number(picked.id),
      name_ar: picked.name_ar,
      name_en: picked.name_en || null,
    });
  };

  const handleUnitCreated = (row) => {
    queryClient.invalidateQueries({ queryKey: ["measurement-units"] });
    const idx = pendingRowIndex;
    setPendingRowIndex(null);
    if (idx == null) return;
    updateRow(idx, {
      unit_id: Number(row.id),
      name_ar: row.name_ar,
      name_en: row.name_en || null,
    });
  };

  const unitOptions = useMemo(() => {
    const opts = catalog.map((c) => ({
      value: String(c.id),
      label: c.name_en ? `${c.name_ar} (${c.name_en})` : c.name_ar,
    }));
    opts.unshift({ value: "", label: "اختر الوحدة" });
    opts.push({ value: SENTINEL_CREATE, label: "+ إنشاء وحدة قياس" });
    return opts;
  }, [catalog]);

  const defaultOptions = useMemo(() => {
    return safeUnits
      .filter((u) => u.name_ar)
      .map((u, i) => ({
        value: String(i),
        label: u.name_ar,
      }));
  }, [safeUnits]);

  const purchaseSelectedIndex = safeUnits.findIndex((u) => u.default_purchase);
  const inventorySelectedIndex = safeUnits.findIndex(
    (u) => u.default_inventory,
  );

  // Pre-compute derived display costs once per render so the cells
  // and the inline "X ÷ Y" rationale share the same number.
  const derivedCosts = useMemo(() => {
    const arr = new Array(safeUnits.length);
    for (let i = 0; i < safeUnits.length; i++) {
      if (i === 0) {
        arr[i] = baseCost;
      } else {
        const pc = parentCountOf(safeUnits, i);
        const prev = arr[i - 1];
        arr[i] = pc > 0 && prev > 0 ? prev / pc : 0;
      }
    }
    return arr;
  }, [safeUnits, baseCost]);

  return (
    <div
      className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-4`}
      dir="rtl"
    >
      <div className="flex items-start gap-2">
        <div className={`${ws.iconBox} w-9 h-9 text-slate-700 dark:text-white/80 shrink-0`}>
          <Ruler className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">
            وحدات القياس
          </p>
          <p className="text-slate-500 dark:text-white/50 text-xs mt-1 leading-relaxed">
            الترتيب من الأكبر إلى الأصغر. كل وحدة جزء من الوحدة فوقها — اكتب
            "كم من هذه الوحدة في الوحدة الأعلى". السعر يتقسّم تلقائياً:
            <br />
            <span className="text-slate-700 dark:text-white/70 font-medium">
              سعر الوحدة = سعر الوحدة الأعلى ÷ معدّل التحويل
            </span>
          </p>
        </div>
      </div>

      {/* Cost row — single canonical base_purchase_cost */}
      <div>
        <label className="block text-slate-700 dark:text-white/70 text-sm font-semibold mb-2">
          سعر شراء الوحدة الأساسية (ر.س){" "}
          {baseRow?.name_ar ? (
            <span className="text-slate-500 dark:text-white/45 text-xs">
              — {baseRow.name_ar}
            </span>
          ) : null}
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={basePurchaseCost}
          onChange={(e) => setBasePurchaseCost(e.target.value)}
          className={`${ws.input} px-4 py-3`}
          placeholder="0.00"
          dir="ltr"
        />
      </div>

      {/* Hierarchical chain — one card per row, indented by depth so
          the "below = part of above" relationship is visually obvious */}
      <div className="space-y-2">
        {safeUnits.map((u, i) => {
          const parentRow = i > 0 ? safeUnits[i - 1] : null;
          const parentName = parentRow?.name_ar || "";
          const parentCost = i > 0 ? derivedCosts[i - 1] : 0;
          const myCost = derivedCosts[i];
          const parentCount = parentCountOf(safeUnits, i);
          const unitSelectValue = u.unit_id ? String(u.unit_id) : "";
          const indentClass = i === 0 ? "" : "mr-6 sm:mr-10";

          return (
            <div key={i} className={indentClass}>
              {/* Inline relationship hint */}
              {i > 0 ? (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/45 mb-1 pr-1">
                  <CornerDownLeft className="w-3 h-3" />
                  جزء من:{" "}
                  <span className="text-slate-700 dark:text-white/70 font-semibold">
                    {parentName || "الوحدة الأعلى"}
                  </span>
                </div>
              ) : null}

              <div
                className={`grid grid-cols-1 sm:grid-cols-[1fr,140px,1fr,auto] items-start gap-2 p-3 rounded-xl border ${
                  i === 0
                    ? "bg-emerald-50/40 dark:bg-emerald-500/[0.04] border-emerald-300/50 dark:border-emerald-400/20"
                    : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10"
                }`}
              >
                {/* Unit name */}
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500 dark:text-white/45 mb-1">
                    اسم الوحدة
                  </div>
                  <GlassSelect
                    value={unitSelectValue}
                    onChange={(v) => handleUnitPick(i, v)}
                    options={unitOptions}
                    placeholder="اختر الوحدة"
                  />
                </div>

                {/* Parent count input (factor in chain) */}
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-white/45 mb-1">
                    معدّل التحويل
                  </div>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={i === 0 ? 1 : parentCount || ""}
                    onChange={(e) => updateParentCount(i, e.target.value)}
                    disabled={i === 0}
                    className={`${ws.input} px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                    placeholder={i === 0 ? "1" : "مثال: 20"}
                    dir="ltr"
                  />
                  {i > 0 ? (
                    <div className="text-[10px] text-slate-500 dark:text-white/40 mt-1 leading-tight">
                      {parentCount > 0 && parentName
                        ? `${parentCount} ${u.name_ar || "وحدة"} في كل ${parentName}`
                        : `كم ${u.name_ar || "وحدة"} في كل ${parentName || "وحدة أعلى"}؟`}
                    </div>
                  ) : null}
                </div>

                {/* Derived cost cell — show the actual division for
                    every non-base row so the operator can verify */}
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-white/45 mb-1">
                    سعر الشراء (محسوب)
                  </div>
                  <div
                    className="px-3 py-2 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 font-mono text-sm text-slate-900 dark:text-white"
                    dir="ltr"
                  >
                    {myCost > 0 ? `${myCost.toFixed(myCost < 1 ? 4 : 2)} ر.س` : "—"}
                  </div>
                  {i > 0 && parentCost > 0 && parentCount > 0 ? (
                    <div
                      className="text-[10px] text-slate-500 dark:text-white/40 mt-1 leading-tight font-mono"
                      dir="ltr"
                    >
                      = {parentCost.toFixed(parentCost < 1 ? 4 : 2)} ÷{" "}
                      {parentCount}
                    </div>
                  ) : null}
                </div>

                {/* Actions: base badge / set-as-base / delete */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-1 sm:gap-2 justify-end">
                  {i === 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-400/20 border border-emerald-400/40 text-emerald-700 dark:text-emerald-200">
                      <Star className="w-3 h-3 fill-current" />
                      أساسية
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setAsBase(i)}
                        disabled={!u.name_ar || !(parentCount > 0)}
                        className={`${ws.btnNeutral} px-2 py-1 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed`}
                        title="جعل هذه الوحدة هي الأساسية"
                      >
                        <Star className="w-3 h-3" />
                        تعيين أساسية
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-700 dark:text-red-300 hover:bg-red-500/10"
                        aria-label="حذف الوحدة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 rounded-xl"
      >
        <Plus className="w-4 h-4" />
        إضافة وحدة أصغر
      </button>

      {/* Two defaults — purchases + inventory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
        <div>
          <label className="flex items-center gap-2 text-slate-700 dark:text-white/70 text-sm font-semibold mb-2">
            <ShoppingCart className="w-4 h-4" />
            وحدة المشتريات الافتراضية{" "}
            <span className="text-red-700 dark:text-red-300">*</span>
          </label>
          <GlassSelect
            value={
              purchaseSelectedIndex >= 0 ? String(purchaseSelectedIndex) : ""
            }
            onChange={(v) => setDefault(Number(v), "default_purchase")}
            options={defaultOptions}
            placeholder="اختر الوحدة"
          />
          <p className="text-slate-500 dark:text-white/45 text-xs mt-1">
            تظهر تلقائياً عند إنشاء فاتورة مشتريات أو أمر شراء.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-slate-700 dark:text-white/70 text-sm font-semibold mb-2">
            <Boxes className="w-4 h-4" />
            وحدة المخزون الافتراضية{" "}
            <span className="text-red-700 dark:text-red-300">*</span>
          </label>
          <GlassSelect
            value={
              inventorySelectedIndex >= 0 ? String(inventorySelectedIndex) : ""
            }
            onChange={(v) => setDefault(Number(v), "default_inventory")}
            options={defaultOptions}
            placeholder="اختر الوحدة"
          />
          <p className="text-slate-500 dark:text-white/45 text-xs mt-1">
            تظهر تلقائياً عند تسجيل الجرد والتحويل والمخزون الافتتاحي.
          </p>
        </div>
      </div>

      <MeasurementUnitModal
        isOpen={showCreateUnit}
        onClose={() => {
          setShowCreateUnit(false);
          setPendingRowIndex(null);
        }}
        onSaved={handleUnitCreated}
      />
    </div>
  );
}
