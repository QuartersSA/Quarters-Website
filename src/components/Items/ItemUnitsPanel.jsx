"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Star, Ruler, ShoppingCart, Boxes } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import MeasurementUnitModal from "@/components/Items/MeasurementUnitModal";
import { adminFetch } from "@/utils/apiAuth";

/**
 * Editor for the multi-unit panel on an item.
 *
 * Value shape (state owned by parent — keeps a single source of
 * truth alongside the rest of formData):
 *
 *   units = [
 *     {
 *       unit_id: number | null,    // measurement_units.id (catalog ref)
 *       name_ar: string,
 *       name_en: string | null,
 *       conversion_factor: number, // 1 for the base row
 *       is_base: boolean,          // exactly one row per item
 *       default_purchase: boolean,
 *       default_inventory: boolean,
 *     },
 *     ...
 *   ]
 *
 * Mounting with an empty array seeds a single row that auto-flags
 * is_base + both defaults, so the operator starts from a valid
 * state and only has to fill in the unit name + cost.
 *
 * Derived-cost column: each non-base row shows
 *   basePurchaseCost × conversion_factor
 * read-only, so the operator never enters per-unit prices.
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
  const baseRow = safeUnits.find((u) => u.is_base) || null;
  const baseCost = Number(basePurchaseCost) || 0;

  const updateRow = (index, patch) => {
    const next = safeUnits.map((u, i) => (i === index ? { ...u, ...patch } : u));
    setUnits(next);
  };

  // Switch the base flag to a new row. All conversion factors
  // re-scale relative to the new base so the underlying physical
  // ratios stay the same: divide every factor by the new base's
  // current factor; force the new base to exactly 1.
  const setAsBase = (index) => {
    const newBase = safeUnits[index];
    if (!newBase) return;
    const denom = Number(newBase.conversion_factor) || 1;
    if (denom <= 0) return;
    const next = safeUnits.map((u, i) => {
      const f = Number(u.conversion_factor) || 0;
      const rescaled = i === index ? 1 : Math.round((f / denom) * 10000) / 10000;
      return { ...u, conversion_factor: rescaled, is_base: i === index };
    });
    setUnits(next);
  };

  const setDefault = (index, key) => {
    // key = "default_purchase" | "default_inventory"
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
        conversion_factor: 1,
        is_base: false,
        default_purchase: false,
        default_inventory: false,
      },
    ]);
  };

  const removeRow = (index) => {
    const row = safeUnits[index];
    if (row?.is_base) return; // base row stays
    const next = safeUnits.filter((_, i) => i !== index);
    // If we dropped the row that held a default, fall back to base.
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

  // After the modal saves a new catalog row, splice it into the
  // pending row (the one whose dropdown triggered the create) and
  // refresh the catalog query so other rows see it too.
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

  const defaultPurchaseOptions = useMemo(() => {
    return safeUnits
      .filter((u) => u.name_ar)
      .map((u, i) => ({
        value: String(i),
        label: u.name_ar,
      }));
  }, [safeUnits]);

  const purchaseSelectedIndex = safeUnits.findIndex(
    (u) => u.default_purchase,
  );
  const inventorySelectedIndex = safeUnits.findIndex(
    (u) => u.default_inventory,
  );

  const headerClass =
    "text-xs font-semibold text-slate-600 dark:text-white/55 pb-2";

  return (
    <div
      className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-4`}
      dir="rtl"
    >
      <div className="flex items-center gap-2">
        <div className={`${ws.iconBox} w-9 h-9 text-slate-700 dark:text-white/80`}>
          <Ruler className="w-4 h-4" />
        </div>
        <div>
          <p className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">
            وحدات القياس
          </p>
          <p className="text-slate-500 dark:text-white/50 text-xs mt-0.5">
            اختر الوحدة الأساسية (factor=1). الأسعار على باقي الوحدات تُحسب
            تلقائياً من سعر الأساسية × معدّل التحويل.
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

      {/* Units table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right">
              <th className={`${headerClass} pr-1`}>اسم الوحدة</th>
              <th className={headerClass}>معدّل التحويل</th>
              <th className={headerClass}>سعر الشراء (محسوب)</th>
              <th className={headerClass}>أساسية</th>
              <th className={`${headerClass} text-left`}></th>
            </tr>
          </thead>
          <tbody>
            {safeUnits.map((u, i) => {
              const factor = Number(u.conversion_factor) || 0;
              const derivedCost = baseCost * factor;
              const unitSelectValue = u.unit_id ? String(u.unit_id) : "";
              return (
                <tr
                  key={i}
                  className="align-top border-t border-slate-100 dark:border-white/5"
                >
                  <td className="py-2 pr-1 min-w-[160px]">
                    <GlassSelect
                      value={unitSelectValue}
                      onChange={(v) => handleUnitPick(i, v)}
                      options={unitOptions}
                      placeholder="اختر الوحدة"
                    />
                  </td>
                  <td className="py-2 px-2 w-[140px]">
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={u.conversion_factor}
                      onChange={(e) =>
                        updateRow(i, {
                          conversion_factor:
                            e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      disabled={u.is_base}
                      className={`${ws.input} px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                      placeholder={u.is_base ? "1" : "مثال: 12"}
                      dir="ltr"
                    />
                  </td>
                  <td
                    className="py-2 px-2 text-slate-700 dark:text-white/70 font-mono text-xs"
                    dir="ltr"
                  >
                    {baseCost > 0 && factor > 0
                      ? `${derivedCost.toFixed(2)} ر.س`
                      : "—"}
                  </td>
                  <td className="py-2 px-2 w-[110px]">
                    {u.is_base ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-400/15 border border-emerald-400/30 text-emerald-700 dark:text-emerald-200">
                        <Star className="w-3 h-3 fill-current" />
                        أساسية
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAsBase(i)}
                        disabled={!u.name_ar || factor <= 0}
                        className={`${ws.btnNeutral} px-2 py-1 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed`}
                        title="جعل هذه الوحدة هي الأساسية"
                      >
                        <Star className="w-3 h-3" />
                        تعيين
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-2 w-[40px] text-left">
                    {u.is_base ? null : (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-700 dark:text-red-300 hover:bg-red-500/10"
                        aria-label="حذف الوحدة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 rounded-xl"
      >
        <Plus className="w-4 h-4" />
        إضافة وحدة أخرى
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
            options={defaultPurchaseOptions}
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
              inventorySelectedIndex >= 0
                ? String(inventorySelectedIndex)
                : ""
            }
            onChange={(v) => setDefault(Number(v), "default_inventory")}
            options={defaultPurchaseOptions}
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
