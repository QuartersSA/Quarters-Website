"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coffee, Plus, Edit, Trash2, X, EyeOff, Eye } from "lucide-react";
import MarketingSidebar from "@/components/Marketing/Sidebar";
import { ws } from "@/components/Workspace/ui";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";

export default function MarketingMenuPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_marketing",
  });
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState(null);

  function emptyForm() {
    return {
      category: "مشروبات",
      name_ar: "",
      name_en: "",
      description: "",
      price: "",
      sort_order: 0,
      is_active: true,
    };
  }

  const itemsQuery = useQuery({
    queryKey: ["marketing-menu"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await adminFetch("/api/marketing/menu");
      if (!r.ok) throw new Error("فشل تحميل المنيو");
      return r.json();
    },
  });

  const items = itemsQuery.data?.items || [];

  const grouped = useMemo(() => {
    const g = {};
    for (const it of items) {
      if (!g[it.category]) g[it.category] = [];
      g[it.category].push(it);
    }
    return g;
  }, [items]);

  const createMut = useMutation({
    mutationFn: async (payload) => {
      const r = await adminFetch("/api/marketing/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الإضافة");
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-menu"] });
      resetForm();
    },
    onError: (e) => setError(e.message || "خطأ"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...rest }) => {
      const r = await adminFetch("/api/marketing/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...rest }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل التعديل");
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-menu"] });
      resetForm();
    },
    onError: (e) => setError(e.message || "خطأ"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const r = await adminFetch(
        `/api/marketing/menu?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error("فشل الحذف");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marketing-menu"] }),
  });

  const toggleMut = useMutation({
    mutationFn: async (it) => {
      const r = await adminFetch("/api/marketing/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.id, is_active: !it.is_active }),
      });
      if (!r.ok) throw new Error("فشل التحديث");
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marketing-menu"] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
    setError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setShowForm(true);
  };

  const openEdit = (it) => {
    setEditing(it);
    setForm({
      category: it.category,
      name_ar: it.name_ar,
      name_en: it.name_en || "",
      description: it.description || "",
      price: it.price === null || it.price === undefined ? "" : String(it.price),
      sort_order: it.sort_order || 0,
      is_active: !!it.is_active,
    });
    setError(null);
    setShowForm(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name_ar.trim() || !form.category.trim()) {
      setError("الاسم والتصنيف مطلوبان");
      return;
    }
    const payload = {
      category: form.category.trim(),
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || null,
      description: form.description.trim() || null,
      price: form.price === "" ? null : Number(form.price),
      sort_order: Number(form.sort_order) || 0,
      is_active: !!form.is_active,
    };
    if (editing) updateMut.mutate({ id: editing.id, ...payload });
    else createMut.mutate(payload);
  };

  const onDelete = (it) => {
    if (!window.confirm(`حذف "${it.name_ar}"؟`)) return;
    deleteMut.mutate(it.id);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <MarketingSidebar active="menu" onLogout={logout} />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className={`${ws.glass} ${ws.card} p-5 sm:p-6 mb-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`${ws.iconBox} w-12 h-12 text-amber-200`}>
                <Coffee className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">منيو الضيافة</h1>
                <p className="text-slate-600 dark:text-white/55 text-sm mt-1">
                  الأصناف التي ستعرض للبلوقر بعد تفعيل بطاقته.
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className={`${ws.btnPrimary} px-5 py-3 justify-center`}
            >
              <Plus className="w-5 h-5" />
              <span>صنف جديد</span>
            </button>
          </div>
        </div>

        {showForm ? (
          <div className={`${ws.glass} ${ws.card} p-5 sm:p-6 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editing ? "تعديل صنف" : "صنف جديد"}
              </h3>
              <button onClick={resetForm} className={ws.iconButton} aria-label="إغلاق">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error ? (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                {error}
              </div>
            ) : null}

            <form
              onSubmit={submit}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  التصنيف *
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مشروبات / مخبوزات / حلويات…"
                  list="categories"
                  required
                />
                <datalist id="categories">
                  {Object.keys(grouped).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  ترتيب العرض
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  الاسم (عربي) *
                </label>
                <input
                  type="text"
                  value={form.name_ar}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  الاسم (إنجليزي)
                </label>
                <input
                  type="text"
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  وصف (اختياري)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className={`${ws.input} px-4 py-3 resize-none`}
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
                  السعر (ر.س — اختياري)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="w-5 h-5"
                />
                <label htmlFor="active" className="text-slate-900 dark:text-white text-sm">
                  نشط (يظهر للبلوقر)
                </label>
              </div>
              <div className="sm:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className={`${ws.btnPrimary} flex-1 px-4 py-3 justify-center disabled:opacity-50`}
                >
                  {editing ? "حفظ التعديلات" : "إنشاء"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className={`${ws.btnNeutral} px-4 py-3 justify-center`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="space-y-6">
          {itemsQuery.isLoading ? (
            <div className={`${ws.glass} ${ws.card} p-8 text-center text-slate-600 dark:text-white/55`}>
              جاري التحميل…
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className={`${ws.glass} ${ws.card} p-12 text-center text-slate-600 dark:text-white/55`}>
              <Coffee className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>لا توجد أصناف. ابدأ بإضافة منيو الضيافة.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, list]) => (
              <div key={category} className={`${ws.glass} ${ws.card} overflow-hidden`}>
                <div className="px-5 py-3 border-b border-white/[0.06] bg-slate-50 dark:bg-white/[0.03]">
                  <h3 className="text-slate-900 dark:text-white font-bold">{category}</h3>
                </div>
                <table className="w-full">
                  <tbody>
                    {list.map((it) => (
                      <tr
                        key={it.id}
                        className="border-t border-white/[0.04] hover:bg-slate-50/50 dark:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <div className="text-slate-900 dark:text-white font-medium">
                            {it.name_ar}
                            {!it.is_active ? (
                              <span className="mr-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-white/55">
                                مخفي
                              </span>
                            ) : null}
                          </div>
                          {it.name_en ? (
                            <div className="text-slate-500 dark:text-white/45 text-xs mt-0.5">
                              {it.name_en}
                            </div>
                          ) : null}
                          {it.description ? (
                            <div className="text-slate-400 dark:text-white/40 text-xs mt-1 leading-relaxed">
                              {it.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/70 text-sm whitespace-nowrap">
                          {it.price !== null && it.price !== undefined
                            ? `${Number(it.price).toFixed(2)} ر.س`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleMut.mutate(it)}
                              className={`${ws.btnNeutral} px-3 py-1.5 text-sm justify-center`}
                              title={it.is_active ? "إخفاء" : "إظهار"}
                            >
                              {it.is_active ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => openEdit(it)}
                              className={`${ws.btnNeutral} px-3 py-1.5 text-sm justify-center`}
                              title="تعديل"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(it)}
                              className={`${ws.btnDanger} px-3 py-1.5 text-sm justify-center`}
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
