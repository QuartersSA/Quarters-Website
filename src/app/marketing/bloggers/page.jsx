"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  X,
  QrCode,
  CheckCircle2,
  Clock,
} from "lucide-react";
import MarketingSidebar from "@/components/Marketing/Sidebar";
import BloggersExportMenu from "@/components/Marketing/BloggersExportMenu";
import { ws } from "@/components/Workspace/ui";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminFetch } from "@/utils/apiAuth";
import { formatDateTime } from "@/utils/dateUtils";

export default function BloggersPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_marketing",
  });
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", handle: "", phone: "", note: "" });
  const [error, setError] = useState(null);

  const bloggersQuery = useQuery({
    queryKey: ["marketing-bloggers"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await adminFetch("/api/marketing/bloggers");
      if (!r.ok) throw new Error("فشل تحميل البلوقرز");
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (payload) => {
      const r = await adminFetch("/api/marketing/bloggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الإنشاء");
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-bloggers"] });
      resetForm();
    },
    onError: (e) => setError(e.message || "خطأ"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...rest }) => {
      const r = await adminFetch("/api/marketing/bloggers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...rest }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل التعديل");
      return d;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-bloggers"] });
      resetForm();
    },
    onError: (e) => setError(e.message || "خطأ"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const r = await adminFetch(
        `/api/marketing/bloggers?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الحذف");
      return d;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marketing-bloggers"] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", handle: "", phone: "", note: "" });
    setError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", handle: "", phone: "", note: "" });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (b) => {
    setEditing(b);
    setForm({
      name: b.name || "",
      handle: b.handle || "",
      phone: b.phone || "",
      note: b.note || "",
    });
    setError(null);
    setShowForm(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("الاسم مطلوب");
      return;
    }
    if (editing) {
      updateMut.mutate({ id: editing.id, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  const onDelete = (b) => {
    if (!window.confirm(`حذف "${b.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
    deleteMut.mutate(b.id);
  };

  if (!isAuthenticated) return null;

  const bloggers = bloggersQuery.data?.bloggers || [];

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <MarketingSidebar active="bloggers" onLogout={logout} />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className={`${ws.glass} ${ws.card} p-5 sm:p-6 mb-6`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`${ws.iconBox} w-12 h-12 text-pink-200`}>
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">بطاقات البلوقرز</h1>
                <p className="text-white/55 text-sm mt-1">
                  أنشئ بطاقات دعوة لكل بلوقر مع كود QR للتفعيل عبر الكاشير.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <BloggersExportMenu bloggers={bloggers} />
              <button
                onClick={openCreate}
                className={`${ws.btnPrimary} px-5 py-3 justify-center`}
              >
                <Plus className="w-5 h-5" />
                <span>بلوقر جديد</span>
              </button>
            </div>
          </div>
        </div>

        {showForm ? (
          <div className={`${ws.glass} ${ws.card} p-5 sm:p-6 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {editing ? "تعديل بلوقر" : "بلوقر جديد"}
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

            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/55 mb-2">
                  الاسم *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="مثال: أحمد العتيبي"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/55 mb-2">
                  معرّف الحساب (اختياري)
                </label>
                <input
                  type="text"
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="@instagram"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/55 mb-2">
                  الجوال (اختياري)
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`${ws.input} px-4 py-3`}
                  placeholder="05xxxxxxxx"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-white/55 mb-2">
                  ملاحظة (اختياري)
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className={`${ws.input} px-4 py-3 resize-none`}
                  rows={2}
                  placeholder="ملاحظات داخلية"
                />
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

        <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
          {bloggersQuery.isLoading ? (
            <div className="p-8 text-center text-white/55">جاري التحميل…</div>
          ) : bloggers.length === 0 ? (
            <div className="p-12 text-center text-white/55">
              <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>لا يوجد بلوقرز بعد. ابدأ بإضافة واحد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/[0.04]">
                    <th className="text-right px-4 py-3 text-sm font-semibold text-white/55">
                      الاسم
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-white/55">
                      الكود
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-white/55">
                      الحالة
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-white/55">
                      التفعيل
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-white/55">
                      أُنشئ
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-white/55">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bloggers.map((b) => {
                    const isActive = b.state === "active";
                    return (
                      <tr
                        key={b.id}
                        className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3">
                          <div className="text-white font-medium">{b.name}</div>
                          {b.handle ? (
                            <div className="text-white/45 text-xs mt-0.5">
                              @{b.handle}
                            </div>
                          ) : null}
                          {b.phone ? (
                            <div className="text-white/45 text-xs">{b.phone}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-emerald-200 text-sm bg-white/[0.04] px-2 py-1 rounded">
                            {b.slug}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-500/25">
                              <CheckCircle2 className="w-3 h-3" />
                              مُفعَّل
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/25">
                              <Clock className="w-3 h-3" />
                              بانتظار التفعيل
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/55 text-xs">
                          {b.activated_at ? (
                            <>
                              <div>{formatDateTime(b.activated_at)}</div>
                              {b.activated_by_employee_name ? (
                                <div className="text-white/35 mt-0.5">
                                  {b.activated_by_employee_name}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-white/35">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/55 text-xs">
                          {formatDateTime(b.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={`/marketing/bloggers/${b.id}/card`}
                              className={`${ws.btnPrimary} px-3 py-1.5 text-sm justify-center`}
                              title="عرض بطاقة الدعوة"
                            >
                              <QrCode className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => openEdit(b)}
                              className={`${ws.btnNeutral} px-3 py-1.5 text-sm justify-center`}
                              title="تعديل"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(b)}
                              className={`${ws.btnDanger} px-3 py-1.5 text-sm justify-center`}
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
