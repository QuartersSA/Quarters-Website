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
  Info,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import MeasurementUnitModal from "@/components/Items/MeasurementUnitModal";
import { adminFetch } from "@/utils/apiAuth";

/**
 * Flat multi-unit editor — every row is an independent factor
 * against ONE base unit. No hierarchical cascading, no parent/child
 * confusion.
 *
 * The schema/DB contract is preserved: `conversion_factor` =
 * "base units per ONE of this unit". The base row is whichever has
 * is_base=true; it's locked at factor=1.
 *
 * Recommended setup (per the help text below): the operator picks
 * the SMALLEST physical unit as base. Larger containers are added
 * as rows with a factor > 1.
 *
 *   base = حبة (factor=1, sell-by smallest)
 *     ↳ شدة, factor = 20    (1 شدة contains 20 حبة)
 *     ↳ كرتون, factor = 400 (1 كرتون contains 400 حبة)
 *
 * Cost cascade is automatic: each row's cost = base_cost × factor.
 * Quantity conversion (used by every modal that records inventory)
 * is `display_qty × factor = stored_qty_in_base`. Display reads
 * `stored ÷ factor` to reverse it.
 *
 * Storage stays anchored to ONE base regardless of what the
 * operator does in this panel, so there's no semantic drift when
 * adding/removing alternate units.
 */

const SENTINEL_CREATE = "__create_new_unit__";

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
  // Render order: base first, then by factor ascending (smaller
  // containers near the top, larger ones near the bottom). The
  // underlying array order is preserved for save — sort is purely
  // visual via a `displayIndex` array.
  const displayOrder = useMemo(() => {
    const idxs = safeUnits.map((_, i) => i);
    return idxs.sort((a, b) => {
      const ua = safeUnits[a];
      const ub = safeUnits[b];
      if (ua.is_base && !ub.is_base) return -1;
      if (!ua.is_base && ub.is_base) return 1;
      return (
        (Number(ua.conversion_factor) || 0) -
        (Number(ub.conversion_factor) || 0)
      );
    });
  }, [safeUnits]);

  const baseRow = safeUnits.find((u) => u.is_base) || safeUnits[0] || null;
  const baseCost = Number(basePurchaseCost) || 0;

  const updateRow = (index, patch) => {
    const next = safeUnits.map((u, i) => (i === index ? { ...u, ...patch } : u));
    setUnits(next);
  };

  const updateFactor = (index, value) => {
    const row = safeUnits[index];
    if (!row) return;
    if (row.is_base) return; // base locked at 1
    const safe = value === "" ? "" : Number(value);
    if (safe !== "" && (!Number.isFinite(safe) || safe < 0)) return;
    updateRow(index, { conversion_factor: safe === "" ? "" : safe });
  };

  // Switch the base flag to a new row. All factors rescale by
  // dividing through the new base's old factor so the physical
  // ratios stay identical.
  const setAsBase = (index) => {
    const picked = safeUnits[index];
    if (!picked || picked.is_base) return;
    const denom = Number(picked.conversion_factor) || 1;
    if (denom <= 0) return;
    const next = safeUnits.map((u, i) => ({
      ...u,
      is_base: i === index,
      conversion_factor:
        i === index ? 1 : (Number(u.conversion_factor) || 0) / denom,
    }));
    setUnits(next);
  };

  const setDefault = (index, key) => {
    const next = safeUnits.map((u, i) => ({ ...u, [key]: i === index }));
    setUnits(next);
  };

  const addRow = () => {
    setUnits([
      ...safeUnits,
      {
        unit_id: null,
        name_ar: "",
        name_en: null,
        // Start at 1 — operator types the real "base units per ONE
        // of this new unit" value below.
        conversion_factor: 1,
        is_base: false,
        default_purchase: false,
        default_inventory: false,
      },
    ]);
  };

  const removeRow = (index) => {
    const row = safeUnits[index];
    if (row?.is_base) return; // base stays
    const next = safeUnits.filter((_, i) => i !== index);
    const baseIdx = next.findIndex((u) => u.is_base);
    if (!next.some((u) => u.default_purchase) && baseIdx >= 0) {
      next[baseIdx].default_purchase = true;
    }
    if (!next.some((u) => u.default_inventory) && baseIdx >= 0) {
      next[baseIdx].default_inventory = true;
    }
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
            اختر الوحدة الأصغر (مثلاً حبة) كأساسية. أضف الوحدات الأكبر مع
            معدّل التحويل = <span className="text-slate-700 dark:text-white/70 font-medium">كم وحدة أساسية في 1 من هذه الوحدة</span>.
            <br />
            مثال: حبة (أساسية، factor=1) • شدة factor=20 • كرتون factor=400.
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
          step="0.0001"
          value={basePurchaseCost}
          onChange={(e) => setBasePurchaseCost(e.target.value)}
          className={`${ws.input} px-4 py-3`}
          placeholder="0.00"
          dir="ltr"
        />
      </div>

      {/* Flat units list */}
      <div className="space-y-2">
        {displayOrder.map((i) => {
          const u = safeUnits[i];
          const factor = Number(u.conversion_factor) || 0;
          const cost = baseCost > 0 && factor > 0 ? baseCost * factor : 0;
          const unitSelectValue = u.unit_id ? String(u.unit_id) : "";

          return (
            <div
              key={i}
              className={`grid grid-cols-1 sm:grid-cols-[1fr,160px,1fr,auto] items-start gap-2 p-3 rounded-xl border ${
                u.is_base
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

              {/* Factor (= base units per 1 of this unit) */}
              <div>
                <div className="text-[11px] text-slate-500 dark:text-white/45 mb-1">
                  معدّل التحويل
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={u.is_base ? 1 : u.conversion_factor}
                  onChange={(e) => updateFactor(i, e.target.value)}
                  disabled={u.is_base}
                  className={`${ws.input} px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                  placeholder={u.is_base ? "1" : "مثال: 20"}
                  dir="ltr"
                />
                <div className="text-[10px] text-slate-500 dark:text-white/40 mt-1 leading-tight">
                  {u.is_base ? (
                    <span className="inline-flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      الأساسية ثابتة على 1
                    </span>
                  ) : factor > 0 && baseRow?.name_ar && u.name_ar ? (
                    <>
                      1 {u.name_ar} = {factor}{" "}
                      {baseRow.name_ar}
                    </>
                  ) : (
                    <>كم {baseRow?.name_ar || "وحدة أساسية"} في 1 {u.name_ar || "وحدة"}؟</>
                  )}
                </div>
              </div>

              {/* Derived cost */}
              <div>
                <div className="text-[11px] text-slate-500 dark:text-white/45 mb-1">
                  سعر الشراء (محسوب)
                </div>
                <div
                  className="px-3 py-2 rounded-xl bg-white/60 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 font-mono text-sm text-slate-900 dark:text-white"
                  dir="ltr"
                >
                  {cost > 0 ? `${cost.toFixed(cost < 1 ? 4 : 2)} ر.س` : "—"}
                </div>
                {!u.is_base && baseCost > 0 && factor > 0 ? (
                  <div
                    className="text-[10px] text-slate-500 dark:text-white/40 mt-1 leading-tight font-mono"
                    dir="ltr"
                  >
                    = {baseCost.toFixed(baseCost < 1 ? 4 : 2)} × {factor}
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-1 sm:gap-2 justify-end">
                {u.is_base ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-400/20 border border-emerald-400/40 text-emerald-700 dark:text-emerald-200">
                    <Star className="w-3 h-3 fill-current" />
                    أساسية
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAsBase(i)}
                      disabled={!u.name_ar || !(factor > 0)}
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
          );
        })}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 rounded-xl"
      >
        <Plus className="w-4 h-4" />
        إضافة وحدة جديدة
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
