"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, ShoppingCart, Hash } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { adminFetch } from "@/utils/apiAuth";

function unitLabel(unit) {
  return unit || "حبة";
}
function formatCost(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} ر.س`;
}

/**
 * Read-only items table for the Purchases section.
 *
 * Source of truth is the same `/api/items` endpoint the admin
 * items page uses — categories, units, costs, descriptions, etc.
 * here we just pivot the data into the purchases UX language
 * (search, category filter, compact rows) and leave the actual
 * item-editing flow on /admin/items so we don't ship two parallel
 * "edit an item" forms.
 */
export default function PurchasesItemsPanel() {
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const itemsQuery = useQuery({
    queryKey: ["purchases_items"],
    queryFn: async () => {
      const r = await adminFetch("/api/items");
      if (!r.ok) throw new Error("Failed to load items");
      return r.json();
    },
  });

  const items = useMemo(() => {
    const list = Array.isArray(itemsQuery.data) ? itemsQuery.data : [];
    return list.filter((i) => i.is_active !== false);
  }, [itemsQuery.data]);

  const categoryOptions = useMemo(() => {
    const seen = new Map();
    for (const i of items) {
      if (!i.category_id) continue;
      const key = String(i.category_id);
      if (seen.has(key)) continue;
      seen.set(key, i.category_name || "بدون فئة");
    }
    const arr = Array.from(seen.entries()).map(([value, label]) => ({
      value,
      label,
    }));
    arr.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    return [{ value: "", label: "كل الفئات" }, ...arr];
  }, [items]);

  const filtered = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryId && String(i.category_id || "") !== categoryId)
        return false;
      if (!lower) return true;
      const hay = [i.name, i.name_en, i.description, i.category_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(lower);
    });
  }, [items, q, categoryId]);

  if (itemsQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري تحميل الأصناف…
      </div>
    );
  }
  if (itemsQuery.error) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-red-700 dark:text-red-300 text-sm`}>
        فشل تحميل الأصناف. حاول مرة أخرى.
      </div>
    );
  }

  return (
    <>
      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم، الوصف، الفئة"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <div className="min-w-[200px]">
            <GlassSelect
              value={categoryId}
              onChange={setCategoryId}
              options={categoryOptions}
              placeholder="كل الفئات"
              buttonClassName="text-sm py-2 px-3"
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-white/45">
            عدد الأصناف:{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              {filtered.length}
            </span>{" "}
            / {items.length}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
          <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
            <Package className="w-6 h-6 text-slate-500 dark:text-white/50" />
          </div>
          <div className="text-sm font-semibold text-slate-700 dark:text-white/75">
            لا توجد أصناف تطابق البحث
          </div>
          <div className="text-xs text-slate-500 dark:text-white/45 mt-1">
            عدّل البحث أو فلتر الفئة لعرض الأصناف.
          </div>
        </div>
      ) : (
        <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-700 dark:text-white/70 text-xs">
                  <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                    الصنف
                  </th>
                  <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                    الفئة
                  </th>
                  <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                    الوحدة
                  </th>
                  <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                    التكلفة المرجعية
                  </th>
                  <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                    الحد الأدنى
                  </th>
                  <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                    الوصف
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    className="border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                  >
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`${ws.iconBox} w-8 h-8 text-emerald-700 dark:text-emerald-200`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {it.name || "—"}
                          </div>
                          {it.name_en ? (
                            <div
                              className="text-[11px] text-slate-500 dark:text-white/45 truncate"
                              dir="ltr"
                            >
                              {it.name_en}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap">
                      {it.category_name ? (
                        <span
                          className={`${ws.pill} bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10`}
                        >
                          {it.category_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-white/40">
                          بدون فئة
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap">
                      {unitLabel(it.unit)}
                    </td>
                    <td
                      className="py-3 px-3 text-slate-800 dark:text-white/85 whitespace-nowrap text-right font-mono"
                      dir="ltr"
                    >
                      {formatCost(it.cost)}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {Number(it.min_stock_threshold || 0).toLocaleString()}
                      </span>
                    </td>
                    <td
                      className="py-3 px-3 text-slate-600 dark:text-white/60 text-xs"
                      style={{ maxWidth: 280 }}
                    >
                      <div className="truncate" title={it.description || ""}>
                        {it.description || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className={`px-4 py-2 border-t ${ws.divider} text-[11px] text-slate-500 dark:text-white/45`}
          >
            البيانات مسحوبة مباشرة من قسم إدارة الأصناف. للتعديل، انتقل
            إلى /admin/items.
          </div>
        </div>
      )}
    </>
  );
}
