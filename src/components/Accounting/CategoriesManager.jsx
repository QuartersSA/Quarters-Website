"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Pencil, Trash2, Plus, X, Power } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

const SCOPE_OPTIONS = [
  { value: "both", label: "الاثنين (ثابت + متغيّر)" },
  { value: "fixed", label: "ثابت فقط" },
  { value: "variable", label: "متغيّر فقط" },
];

const SCOPE_LABEL = {
  fixed: "ثابت",
  variable: "متغيّر",
  both: "الاثنين",
};

const SCOPE_BADGE = {
  fixed: "bg-sky-500/15 text-sky-200 border-sky-500/25",
  variable: "bg-emerald-500/15 text-emerald-200 border-emerald-500/25",
  both: "bg-amber-500/15 text-amber-200 border-amber-500/25",
};

/**
 * CRUD for `accounting_expense_types`. Each category has a `scope` flag
 * controlling whether it shows up under the fixed panel, the variable
 * panel, or both.
 */
export default function CategoriesManager() {
  const queryClient = useQueryClient();
  // includeInactive=1 so the manager surface lists every category
  // (active + inactive). Other endpoints continue to filter inactive
  // ones out by default.
  const typesQuery = useQuery({
    queryKey: ["accounting_expense_types_full"],
    queryFn: async () => {
      const r = await adminFetch(
        "/api/accounting/expense-types?includeInactive=1",
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل التحميل");
      return d.types || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["accounting_expense_types"] });
    queryClient.invalidateQueries({
      queryKey: ["accounting_expense_types_full"],
    });
  };

  const createMut = useMutation({
    mutationFn: async (body) => {
      const r = await adminFetch("/api/accounting/expense-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الإضافة");
      return d;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم الإضافة");
    },
    onError: (e) => toast.error(e.message || "فشل الإضافة"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...body }) => {
      const r = await adminFetch(`/api/accounting/expense-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل التعديل");
      return d;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم التعديل");
    },
    onError: (e) => toast.error(e.message || "فشل التعديل"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const r = await adminFetch(`/api/accounting/expense-types/${id}`, {
        method: "DELETE",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الحذف");
      return d;
    },
    onSuccess: () => {
      invalidate();
      toast.success("تم الحذف");
    },
    onError: (e) => toast.error(e.message || "فشل الحذف"),
  });

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const types = useMemo(() => typesQuery.data || [], [typesQuery.data]);

  return (
    <>
      <div className={`${ws.glass} ${ws.card} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={ws.iconBox}>
              <ListChecks className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="font-bold text-white tracking-tight">
                البنود
              </div>
              <div className="text-xs text-white/55 mt-0.5">
                أضف، حرّر، أو احذف بنود المصروفات وحدّد نطاق كل واحد
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className={`${ws.btnPrimary} px-3 py-2 text-sm`}
          >
            <Plus className="w-4 h-4" />
            <span>بند جديد</span>
          </button>
        </div>

        {typesQuery.isLoading ? (
          <div className="text-white/55 text-sm text-center py-6">
            جاري التحميل…
          </div>
        ) : types.length === 0 ? (
          <div className="text-white/55 text-sm text-center py-6">
            لا توجد بنود بعد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.04]">
                  <th className="text-right px-3 py-2 text-xs font-semibold text-white/55">
                    الاسم
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-white/55">
                    النطاق
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-white/55">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {types.map((t) => {
                  const isInactive = t.is_active === false;
                  return (
                    <tr
                      key={t.id}
                      className={`border-t border-white/5 hover:bg-white/[0.02] ${
                        isInactive ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-white text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span>{t.name}</span>
                          {isInactive ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 text-white/60">
                              غير مفعّل
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center text-xs px-2 py-1 rounded-full border ${
                            SCOPE_BADGE[t.scope || "both"] || SCOPE_BADGE.both
                          }`}
                        >
                          {SCOPE_LABEL[t.scope || "both"] || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateMut.mutate({
                                id: t.id,
                                // legacy `undefined` treated as active,
                                // so toggle resolves to false there too.
                                is_active: isInactive ? true : false,
                              })
                            }
                            disabled={updateMut.isPending}
                            className={`${
                              isInactive ? ws.btnPrimary : ws.btnNeutral
                            } px-2 py-1 text-xs disabled:opacity-50`}
                            title={isInactive ? "تفعيل" : "إلغاء التفعيل"}
                          >
                            <Power className="w-3 h-3" />
                            <span>{isInactive ? "تفعيل" : "إيقاف"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTarget(t)}
                            className={`${ws.btnNeutral} px-2 py-1 text-xs`}
                            title="تعديل"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`حذف البند «${t.name}»؟`)) {
                                deleteMut.mutate(t.id);
                              }
                            }}
                            className={`${ws.btnDanger} px-2 py-1 text-xs`}
                            title="حذف"
                          >
                            <Trash2 className="w-3 h-3" />
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

      {(showForm || editTarget) && (
        <CategoryFormModal
          target={editTarget}
          onClose={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
          onSubmit={(payload) => {
            if (editTarget) {
              updateMut.mutate(
                { id: editTarget.id, ...payload },
                {
                  onSuccess: () => setEditTarget(null),
                },
              );
            } else {
              createMut.mutate(payload, {
                onSuccess: () => setShowForm(false),
              });
            }
          }}
          isPending={createMut.isPending || updateMut.isPending}
        />
      )}
    </>
  );
}

function CategoryFormModal({ target, onClose, onSubmit, isPending }) {
  const [name, setName] = useState(target?.name || "");
  const [scope, setScope] = useState(target?.scope || "both");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, scope });
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      dir="rtl"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm ${ws.glass} ${ws.card} p-5 space-y-4`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold tracking-tight">
            {target ? "تعديل البند" : "بند جديد"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/55 mb-2">
            الاسم *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${ws.input} px-3 py-2.5`}
            required
            placeholder="مثال: كهرباء"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/55 mb-2">
            النطاق *
          </label>
          <GlassSelect
            value={scope}
            onChange={setScope}
            options={SCOPE_OPTIONS}
            buttonClassName="px-3 py-2.5"
          />
          <p className="text-[10px] text-white/45 mt-1.5">
            «ثابت» يظهر في قوالب المصروف الثابت فقط. «متغيّر» يظهر في
            قائمة المتغيّر فقط. «الاثنين» يظهر في الاثنين.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className={`${ws.btnPrimary} flex-1 px-4 py-2.5 justify-center disabled:opacity-50`}
          >
            {isPending ? "جاري الحفظ…" : "حفظ"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} px-4 py-2.5`}
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
