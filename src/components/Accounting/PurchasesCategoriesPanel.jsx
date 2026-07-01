"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ws } from "@/components/Workspace/ui";
import useItemCategories from "@/hooks/useItemCategories";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function ScopeBadge({ showInInventory }) {
  if (showInInventory !== false) {
    return (
      <span
        className={`${ws.pill} bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25 inline-flex items-center gap-1`}
      >
        <Eye className="w-3 h-3" />
        مخزون + مشتريات
      </span>
    );
  }

  return (
    <span
      className={`${ws.pill} bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10 inline-flex items-center gap-1`}
    >
      <EyeOff className="w-3 h-3" />
      مشتريات فقط
    </span>
  );
}

export default function PurchasesCategoriesPanel() {
  const {
    categories,
    isLoading,
    error,
    createMutation,
    updateMutation,
  } = useItemCategories(true, { scope: "purchases" });

  const itemsQuery = useQuery({
    queryKey: queryKeys.purchaseItems(),
    queryFn: async () => {
      const response = await adminFetch("/api/items");
      if (!response.ok) throw new Error("Failed to load items");
      return response.json();
    },
  });

  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [addToInventory, setAddToInventory] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editShowInInventory, setEditShowInInventory] = useState(false);

  const itemCounts = useMemo(() => {
    const counts = new Map();
    const items = Array.isArray(itemsQuery.data) ? itemsQuery.data : [];
    for (const item of items) {
      if (item?.is_active === false || !item?.category_id) continue;
      const key = String(item.category_id);
      const current = counts.get(key) || {
        total: 0,
        inventory: 0,
        purchasesOnly: 0,
      };
      current.total += 1;
      if (item.show_in_inventory === false) {
        current.purchasesOnly += 1;
      } else {
        current.inventory += 1;
      }
      counts.set(key, current);
    }
    return counts;
  }, [itemsQuery.data]);

  const filtered = useMemo(() => {
    const term = normalize(q);
    const list = Array.isArray(categories) ? categories : [];
    const sorted = [...list].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "ar"),
    );
    if (!term) return sorted;
    return sorted.filter((category) => {
      const hay = [
        category.name,
        category.name_en,
        category.show_in_inventory === false
          ? "مشتريات purchases"
          : "مخزون inventory",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [categories, q]);

  const resetCreate = () => {
    setName("");
    setNameEn("");
    setAddToInventory(false);
  };

  const startEdit = (category) => {
    setEditingId(category.id);
    setEditName(category.name || "");
    setEditNameEn(category.name_en || "");
    setEditShowInInventory(category.show_in_inventory !== false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditNameEn("");
    setEditShowInInventory(false);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedNameEn = nameEn.trim();
    if (!trimmedName || !trimmedNameEn) {
      toast.error("اسم التصنيف بالعربي والإنجليزي مطلوب");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: trimmedName,
        name_en: trimmedNameEn,
        show_in_inventory: addToInventory,
      });
      toast.success("تمت إضافة التصنيف");
      resetCreate();
    } catch (err) {
      toast.error(err?.message || "فشل إضافة التصنيف");
    }
  };

  const handleSaveEdit = async (categoryId) => {
    const trimmedName = editName.trim();
    const trimmedNameEn = editNameEn.trim();
    if (!trimmedName || !trimmedNameEn) {
      toast.error("اسم التصنيف بالعربي والإنجليزي مطلوب");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: categoryId,
        name: trimmedName,
        name_en: trimmedNameEn,
        show_in_inventory: editShowInInventory,
      });
      toast.success("تم حفظ التصنيف");
      cancelEdit();
    } catch (err) {
      toast.error(err?.message || "فشل تعديل التصنيف");
    }
  };

  const saving = createMutation.isPending;
  const updating = updateMutation.isPending;

  if (isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري تحميل التصنيفات…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-red-700 dark:text-red-300 text-sm`}>
        فشل تحميل التصنيفات. حاول مرة أخرى.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث باسم التصنيف أو نطاقه"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-white/45">
            التصنيفات:{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              {filtered.length}
            </span>{" "}
            / {categories.length}
          </div>
        </div>
      </div>

      <form onSubmit={handleCreate} className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-2 mb-3 text-slate-900 dark:text-white font-bold">
          <Plus className="w-4 h-4 text-emerald-700 dark:text-emerald-200" />
          إضافة تصنيف للمشتريات
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              اسم التصنيف بالعربي
            </div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={`${ws.input} px-3 py-2`}
              placeholder="مثال: مواد تغليف"
              disabled={saving}
            />
          </div>
          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              اسم التصنيف بالإنجليزي
            </div>
            <input
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              className={`${ws.input} px-3 py-2`}
              placeholder="Packaging"
              dir="ltr"
              disabled={saving}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`${ws.btnPrimary} px-4 py-2 justify-center disabled:opacity-50`}
          >
            <Plus className="w-4 h-4" />
            إضافة
          </button>
        </div>

        <label className="mt-3 flex items-start gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75">
          <input
            type="checkbox"
            checked={addToInventory}
            onChange={(event) => setAddToInventory(event.target.checked)}
            className="accent-emerald-500 mt-0.5"
            disabled={saving}
          />
          <span>
            إضافة التصنيف لقسم المخزون أيضاً
            <span className="block text-xs text-slate-500 dark:text-white/45 mt-0.5">
              غير مفعّل: يظهر التصنيف في المشتريات فقط ولا يظهر في صفحة المخزون.
            </span>
          </span>
        </label>
      </form>

      <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
        <div className={`px-4 py-3 border-b ${ws.divider} flex items-center justify-between gap-3`}>
          <div>
            <div className="text-slate-900 dark:text-white font-bold">
              التصنيفات المرتبطة
            </div>
            <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              التصنيفات المشتركة تأتي من المخزون، وتصنيفات المشتريات فقط لا تظهر هناك.
            </div>
          </div>
          <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}>
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
              <Layers className="w-6 h-6 text-slate-500 dark:text-white/50" />
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-white/75">
              لا توجد تصنيفات تطابق البحث
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {filtered.map((category) => {
              const isEditing = editingId === category.id;
              const counts = itemCounts.get(String(category.id)) || {
                total: 0,
                inventory: 0,
                purchasesOnly: 0,
              };
              const hasInventoryItems = counts.inventory > 0;

              return (
                <div
                  key={category.id}
                  className="p-4 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  {!isEditing ? (
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`${ws.iconBox} w-9 h-9 text-emerald-700 dark:text-emerald-200 shrink-0`}>
                          <Layers className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {category.name}
                          </div>
                          <div
                            className="text-xs text-slate-500 dark:text-white/45 truncate mt-0.5"
                            dir="ltr"
                          >
                            {category.name_en || "-"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <ScopeBadge showInInventory={category.show_in_inventory} />
                        <span
                          className={`${ws.pill} bg-sky-100 dark:bg-sky-400/10 text-sky-700 dark:text-sky-200 border-sky-200 dark:border-sky-400/25 inline-flex items-center gap-1`}
                        >
                          <ShoppingCart className="w-3 h-3" />
                          {counts.total} صنف
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEdit(category)}
                        className={`${ws.iconButton} w-9 h-9 shrink-0`}
                        title="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className={`${ws.input} px-3 py-2`}
                          placeholder="اسم التصنيف بالعربي"
                          disabled={updating}
                        />
                        <input
                          value={editNameEn}
                          onChange={(event) => setEditNameEn(event.target.value)}
                          className={`${ws.input} px-3 py-2`}
                          placeholder="Category name"
                          dir="ltr"
                          disabled={updating}
                        />
                      </div>

                      <label className="flex items-start gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75">
                        <input
                          type="checkbox"
                          checked={editShowInInventory}
                          onChange={(event) =>
                            setEditShowInInventory(event.target.checked)
                          }
                          className="accent-emerald-500 mt-0.5"
                          disabled={updating || hasInventoryItems}
                        />
                        <span>
                          يظهر في قسم المخزون أيضاً
                          {hasInventoryItems ? (
                            <span className="block text-xs text-amber-700 dark:text-amber-200 mt-0.5">
                              لا يمكن تحويله إلى مشتريات فقط لأنه مرتبط بأصناف مخزون.
                            </span>
                          ) : (
                            <span className="block text-xs text-slate-500 dark:text-white/45 mt-0.5">
                              عند إلغاء التفعيل سيبقى التصنيف ظاهراً في المشتريات فقط.
                            </span>
                          )}
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(category.id)}
                          disabled={updating}
                          className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50`}
                        >
                          <Check className="w-4 h-4" />
                          حفظ
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={updating}
                          className={`${ws.btnNeutral} px-4 py-2 disabled:opacity-50`}
                        >
                          <X className="w-4 h-4" />
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
