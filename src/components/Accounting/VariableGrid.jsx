"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  CheckCircle2,
  Trash2,
  Plus,
  X,
  Pencil,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";
import { toast } from "sonner";

/**
 * Variable-expense grid.
 *
 * Each row is a "variable template" — a named line item linked to an
 * existing expense_type (category). Templates live in
 * accounting_variable_templates; per-month amounts live in
 * accounting_expenses with a variable_template_id link back to the
 * template.
 *
 * Props:
 *   types         — full catalog (used to render the category
 *                   dropdown in the add modal); only variable / both
 *                   scopes get listed.
 *   monthExpenses — accounting_expenses rows for the selected month.
 *   month         — "YYYY-MM"
 *   onMutate      — parent refetch hook.
 */
export default function VariableGrid({ types, monthExpenses, month, onMutate }) {
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ["accounting_variable_templates"],
    queryFn: async () => {
      const r = await adminFetch("/api/accounting/variable-templates");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل تحميل القوالب");
      return d.templates || [];
    },
  });
  const templates = templatesQuery.data || [];

  // Categories that the add-template modal lets the admin pick from.
  // Restricted to variable / both — fixed-only categories don't make
  // sense as a variable template parent.
  const variableTypes = useMemo(
    () =>
      (types || []).filter(
        (t) =>
          (t.scope === "variable" || t.scope === "both" || !t.scope) &&
          (t.is_active === undefined || t.is_active === true),
      ),
    [types],
  );

  // (template_id) → accounting_expenses row for the current month.
  const existingByTemplate = useMemo(() => {
    const m = new Map();
    for (const e of monthExpenses || []) {
      const tid = Number(e.variable_template_id);
      if (!Number.isFinite(tid) || tid <= 0) continue;
      if (!m.has(tid)) m.set(tid, e);
    }
    return m;
  }, [monthExpenses]);

  // Draft state per template. Seeded from existing rows; resets when
  // the month or template set changes.
  const [draft, setDraft] = useState({});
  useEffect(() => {
    const next = {};
    for (const t of templates) {
      const row = existingByTemplate.get(Number(t.id));
      next[t.id] = row ? String(row.amount) : "";
    }
    setDraft(next);
  }, [templates, existingByTemplate, month]);

  const saveMut = useMutation({
    mutationFn: async ({ template_id, amount, mark_paid }) => {
      const r = await adminFetch("/api/accounting/expenses/variable", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          variable_template_id: template_id,
          amount: amount === "" || amount === null ? null : Number(amount),
          mark_paid: !!mark_paid,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الحفظ");
      return d;
    },
    onSuccess: () => {
      onMutate?.();
      queryClient.invalidateQueries({ queryKey: ["accounting_expenses"] });
    },
    onError: (e) => toast.error(e.message || "فشل الحفظ"),
  });

  // Template CRUD.
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const createTemplateMut = useMutation({
    mutationFn: async (body) => {
      const r = await adminFetch("/api/accounting/variable-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الإضافة");
      return d;
    },
    onSuccess: () => {
      onMutate?.();
      queryClient.invalidateQueries({
        queryKey: ["accounting_variable_templates"],
      });
      toast.success("تم إضافة القالب");
      setShowAdd(false);
    },
    onError: (e) => toast.error(e.message || "فشل الإضافة"),
  });

  const updateTemplateMut = useMutation({
    mutationFn: async ({ id, ...body }) => {
      const r = await adminFetch(`/api/accounting/variable-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل التعديل");
      return d;
    },
    onSuccess: () => {
      onMutate?.();
      queryClient.invalidateQueries({
        queryKey: ["accounting_variable_templates"],
      });
      toast.success("تم التعديل");
      setEditTarget(null);
    },
    onError: (e) => toast.error(e.message || "فشل التعديل"),
  });

  const deactivateTemplateMut = useMutation({
    mutationFn: async (id) => {
      const r = await adminFetch(`/api/accounting/variable-templates/${id}`, {
        method: "DELETE",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "تعذّر الإيقاف");
      return d;
    },
    onSuccess: () => {
      onMutate?.();
      queryClient.invalidateQueries({
        queryKey: ["accounting_variable_templates"],
      });
      toast.success("تم إيقاف القالب");
    },
    onError: (e) => toast.error(e.message || "تعذّر الإيقاف"),
  });

  const handleBlur = (t) => {
    const row = existingByTemplate.get(Number(t.id));
    const draftVal = draft[t.id] ?? "";
    const draftNum =
      draftVal === "" || draftVal === null ? null : Number(draftVal);
    const existingNum = row ? Number(row.amount) : null;
    if (draftNum === existingNum) return;
    saveMut.mutate({ template_id: t.id, amount: draftVal });
  };

  const handleMarkPaid = (t) => {
    const draftVal = draft[t.id] ?? "";
    if (!draftVal || Number(draftVal) <= 0) {
      toast.error("أدخل المبلغ أولاً");
      return;
    }
    saveMut.mutate({ template_id: t.id, amount: draftVal, mark_paid: true });
  };

  // Three figures shown in the header:
  //
  //   - paid    : sum of confirmed rows for this month
  //               (confirmed_amount → amount fallback).
  //   - pending : sum of every active template's expected_amount that
  //               HASN'T been confirmed yet for the month. This is
  //               the budget waiting to land.
  //   - total   : paid + pending — what the month is shaping up to
  //               cost in total once every template gets confirmed.
  //
  // The previous version read `total` from `row.amount` (the entered
  // draft), so a row that was confirmed via a direct paid path with
  // amount=0 but confirmed_amount=5160 would show total=0 and paid=
  // 5160 — i.e. paid > total, which was confusing. The new shape
  // makes the three figures internally consistent regardless of
  // which path created the row.
  const totals = useMemo(() => {
    let paid = 0;
    let pending = 0;
    for (const t of templates) {
      const row = existingByTemplate.get(Number(t.id));
      const expected = Number(t.expected_amount) || 0;
      if (row?.is_confirmed) {
        paid += Number(row.confirmed_amount ?? row.amount) || 0;
      } else {
        pending += expected;
      }
    }
    return { total: paid + pending, paid, pending };
  }, [templates, existingByTemplate]);

  const addCta = (
    <button
      type="button"
      onClick={() => setShowAdd(true)}
      className={`${ws.btnPrimary} px-3 py-2 text-xs`}
    >
      <Plus className="w-3.5 h-3.5" />
      <span>إضافة قالب</span>
    </button>
  );

  // Modal mounts in a portal so the page's backdrop-filter ancestors
  // can't trap its z-index.
  const modal = useMemo(() => {
    if (typeof document === "undefined") return null;
    if (!showAdd && !editTarget) return null;
    return createPortal(
      <VariableTemplateModal
        target={editTarget}
        types={variableTypes}
        month={month}
        onClose={() => {
          setShowAdd(false);
          setEditTarget(null);
        }}
        onSubmit={(payload) => {
          if (editTarget) {
            updateTemplateMut.mutate({ id: editTarget.id, ...payload });
          } else {
            createTemplateMut.mutate(payload);
          }
        }}
        isPending={
          createTemplateMut.isPending || updateTemplateMut.isPending
        }
      />,
      document.body,
    );
  }, [
    showAdd,
    editTarget,
    variableTypes,
    month,
    createTemplateMut.isPending,
    updateTemplateMut.isPending,
  ]);

  if (templatesQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-5 text-slate-600 dark:text-white/55 text-sm text-center py-6`}>
        جاري التحميل…
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <>
        <div className={`${ws.glass} ${ws.card} p-5`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-slate-600 dark:text-white/55 text-sm">
              لا توجد قوالب متغيرة بعد. أضف أول قالب للبدء.
            </div>
            {addCta}
          </div>
        </div>
        {modal}
      </>
    );
  }

  return (
    <div className={`${ws.glass} ${ws.card} p-5`}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={ws.iconBox}>
            <Receipt className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white tracking-tight">
              المصروفات المتغيرة
            </div>
            <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
              {monthLabel(month)} — القوالب موحّدة كل شهر، يتغيّر المبلغ فقط
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div>
            <span className="text-slate-600 dark:text-white/55">الإجمالي: </span>
            <span className="text-slate-900 dark:text-white font-bold" dir="ltr">
              {formatMoney(totals.total)}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-white/55">مؤكد: </span>
            <span className="text-emerald-700 dark:text-emerald-200 font-bold" dir="ltr">
              {formatMoney(totals.paid)}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-white/55">بانتظار: </span>
            <span className="text-amber-700 dark:text-amber-200 font-bold" dir="ltr">
              {formatMoney(totals.pending)}
            </span>
          </div>
          {addCta}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-white/[0.04]">
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                البند
              </th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                التصنيف
              </th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                المبلغ
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                الحالة
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                إجراء
              </th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const row = existingByTemplate.get(Number(t.id));
              const confirmed = !!row?.is_confirmed;
              return (
                <tr
                  key={t.id}
                  className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2">
                    <div className="text-slate-900 dark:text-white text-sm font-medium">
                      {t.name}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-white/70 text-xs">
                    {t.expense_type_name}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft[t.id] ?? ""}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [t.id]: e.target.value,
                        }))
                      }
                      onBlur={() => handleBlur(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className={`${ws.input} px-2 py-1.5 text-sm w-32`}
                      placeholder={
                        t.expected_amount !== null &&
                        t.expected_amount !== undefined
                          ? String(t.expected_amount)
                          : "0"
                      }
                      dir="ltr"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {confirmed ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        مؤكد
                      </span>
                    ) : row ? (
                      <span className="text-xs text-amber-700 dark:text-amber-200">بانتظار</span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-white/35">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      {!confirmed && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(t)}
                          disabled={saveMut.isPending}
                          className={`${ws.btnPrimary} px-2 py-1 text-xs disabled:opacity-50`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تأكيد</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditTarget(t)}
                        className={`${ws.btnNeutral} px-2 py-1 text-xs`}
                        title="تعديل القالب"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `إيقاف القالب «${t.name}»؟ سيختفي من القائمة والمصاريف السابقة تبقى كما هي.`,
                            )
                          ) {
                            deactivateTemplateMut.mutate(t.id);
                          }
                        }}
                        disabled={deactivateTemplateMut.isPending}
                        className={`${ws.btnDanger} px-2 py-1 text-xs disabled:opacity-50`}
                        title="إيقاف القالب"
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

      {modal}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

/**
 * Add/edit modal for a variable template.
 *
 * Fields:
 *   - اسم البند (template name)
 *   - التصنيف (existing expense_type from variableTypes)
 *   - إجمالي المبلغ المتوقع (auto-prefilled from the most recent
 *     amount logged against the chosen category)
 */
function VariableTemplateModal({
  target,
  types,
  month,
  onClose,
  onSubmit,
  isPending,
}) {
  const [name, setName] = useState(target?.name || "");
  const [typeId, setTypeId] = useState(
    target?.expense_type_id ? String(target.expense_type_id) : "",
  );
  const [expectedAmount, setExpectedAmount] = useState(
    target?.expected_amount !== null && target?.expected_amount !== undefined
      ? String(target.expected_amount)
      : "",
  );
  const [historyHint, setHistoryHint] = useState(null);

  const typeOptions = useMemo(() => {
    const opts = [{ value: "", label: "اختر التصنيف…" }];
    for (const t of types || []) {
      opts.push({ value: String(t.id), label: t.name });
    }
    return opts;
  }, [types]);

  // Auto-prefill expected_amount from the last logged amount for the
  // chosen category (any month before current).
  useEffect(() => {
    if (!typeId || !month) {
      setHistoryHint(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          expense_type_id: String(typeId),
          beforeMonth: month,
        });
        const r = await adminFetch(
          `/api/accounting/expenses/last-amount?${params}`,
        );
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        if (d?.amount !== null && d?.amount !== undefined) {
          setHistoryHint({
            amount: d.amount,
            month: String(d.expense_month || "").slice(0, 7),
          });
          if (!target && !expectedAmount) {
            setExpectedAmount(String(d.amount));
          }
        } else {
          setHistoryHint(null);
        }
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeId, month]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const tid = Number(typeId);
    if (!Number.isFinite(tid) || tid <= 0) return;
    const exp = expectedAmount === "" ? null : Number(expectedAmount);
    if (exp !== null && (!Number.isFinite(exp) || exp < 0)) return;
    onSubmit({
      name: trimmed,
      expense_type_id: tid,
      expected_amount: exp,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      dir="rtl"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md ${ws.glass} ${ws.card} p-5 space-y-4`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-slate-900 dark:text-white font-bold tracking-tight">
            {target ? "تعديل قالب متغيّر" : "إضافة قالب متغيّر"}
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
          <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
            اسم البند *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${ws.input} px-3 py-2.5`}
            required
            autoFocus
            placeholder="مثال: قهوة"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
            التصنيف *
          </label>
          <GlassSelect
            value={typeId}
            onChange={setTypeId}
            options={typeOptions}
            buttonClassName="px-3 py-2.5"
          />
          <p className="text-[10px] text-slate-500 dark:text-white/45 mt-1.5">
            البنود المعروضة هنا فقط من التصنيفات المرتبطة بـ«مصروف متغيّر».
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
            إجمالي المبلغ المتوقع
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={expectedAmount}
            onChange={(e) => setExpectedAmount(e.target.value)}
            className={`${ws.input} px-3 py-2.5`}
            dir="ltr"
            placeholder="0"
          />
          {historyHint ? (
            <p className="text-[10px] text-emerald-700 dark:text-emerald-200/80 mt-1.5">
              تمت تعبئته من شهر{" "}
              <span dir="ltr">{historyHint.month}</span> (
              <span dir="ltr">{formatMoney(historyHint.amount)}</span>)
            </p>
          ) : (
            <p className="text-[10px] text-slate-500 dark:text-white/45 mt-1.5">
              يستخدم كقيمة افتراضية كل شهر — يمكن تغييرها لاحقاً.
            </p>
          )}
        </div>

        <p className="text-[10px] text-slate-500 dark:text-white/45 leading-relaxed">
          القالب يتكرر كل شهر في قائمة المصروفات المتغيرة. تعديل المبلغ
          الشهري لا يؤثر على الأشهر الماضية.
        </p>

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
