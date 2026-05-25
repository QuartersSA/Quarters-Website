"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, CheckCircle2, Trash2, Plus, X } from "lucide-react";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";
import { toast } from "sonner";

/**
 * One row per "variable" category (scope = 'variable' or 'both').
 * Amount is per (category, month). Saving an amount upserts the
 * canonical variable accounting_expenses row for that pair via
 * PUT /api/accounting/expenses/variable.
 *
 * "بنود موحدة" — every month shows the SAME row list. Only amounts
 * differ. Setting amount to 0/empty deletes the row for that month.
 *
 * Props:
 *   types          — accounting_expense_types where scope IN ('variable','both')
 *   monthExpenses  — accounting_expenses rows for the month (used to
 *                    preload existing amounts)
 *   month          — "YYYY-MM"
 *   onMutate       — refetch hook
 */
export default function VariableGrid({ types, monthExpenses, month, onMutate }) {
  const queryClient = useQueryClient();

  // Map of (type_id) → existing canonical row for this month.
  // "Canonical" = the variable row (no fixed_expense_id) for that type.
  const existingByType = useMemo(() => {
    const m = new Map();
    for (const e of monthExpenses || []) {
      if (e.fixed_expense_id) continue; // skip fixed-linked rows
      const tid = Number(e.expense_type_id);
      if (!m.has(tid)) {
        m.set(tid, e);
      } else {
        // Multiple rows for the same (type, month) — sum amounts so the
        // UI still reflects the total. Mark as legacy (read-only) by
        // setting a `legacy: true` flag downstream consumers can use.
        const cur = m.get(tid);
        m.set(tid, {
          ...cur,
          amount: Number(cur.amount || 0) + Number(e.amount || 0),
          legacy: true,
        });
      }
    }
    return m;
  }, [monthExpenses]);

  // Local "draft" state — what the user is currently typing. Re-seeds
  // when the month or existing data changes so switching months doesn't
  // strand stale input.
  const [draft, setDraft] = useState({});
  useEffect(() => {
    const next = {};
    for (const t of types || []) {
      const row = existingByType.get(Number(t.id));
      next[t.id] = row ? String(row.amount) : "";
    }
    setDraft(next);
  }, [types, existingByType, month]);

  const saveMut = useMutation({
    mutationFn: async ({ type_id, amount, mark_paid }) => {
      const r = await adminFetch("/api/accounting/expenses/variable", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          expense_type_id: type_id,
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

  // Add-template modal state. The template is implemented as a
  // variable-scoped expense_type row with an expected_amount.
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const createTemplateMut = useMutation({
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
      onMutate?.();
      queryClient.invalidateQueries({ queryKey: ["accounting_expense_types"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting_expense_types_full"],
      });
      toast.success("تم إضافة القالب");
      setShowAddTemplate(false);
    },
    onError: (e) => toast.error(e.message || "فشل الإضافة"),
  });

  // Soft-deactivate the category. Hard DELETE refuses when any
  // accounting_expenses row references the type (preserves historical
  // data), so we instead flip is_active=false — the category vanishes
  // from the fixed + variable panels but old expenses keep pointing
  // at it. The admin can hard-delete elsewhere if there's no
  // historical data left.
  const deactivateCategoryMut = useMutation({
    mutationFn: async (id) => {
      const r = await adminFetch(`/api/accounting/expense-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "تعذّر إيقاف البند");
      return d;
    },
    onSuccess: () => {
      onMutate?.();
      queryClient.invalidateQueries({ queryKey: ["accounting_expense_types"] });
      queryClient.invalidateQueries({
        queryKey: ["accounting_expense_types_full"],
      });
      toast.success("تم إيقاف البند");
    },
    onError: (e) => toast.error(e.message || "تعذّر إيقاف البند"),
  });

  const handleBlur = (t) => {
    const row = existingByType.get(Number(t.id));
    const draftVal = draft[t.id] ?? "";
    const draftNum =
      draftVal === "" || draftVal === null ? null : Number(draftVal);
    const existingNum = row ? Number(row.amount) : null;

    // No change → don't fire.
    if (draftNum === existingNum) return;
    saveMut.mutate({ type_id: t.id, amount: draftVal });
  };

  const handleMarkPaid = (t) => {
    const draftVal = draft[t.id] ?? "";
    if (!draftVal || Number(draftVal) <= 0) {
      toast.error("أدخل المبلغ أولاً");
      return;
    }
    saveMut.mutate({ type_id: t.id, amount: draftVal, mark_paid: true });
  };

  const totals = useMemo(() => {
    let total = 0;
    let paid = 0;
    for (const t of types || []) {
      const row = existingByType.get(Number(t.id));
      if (!row) continue;
      total += Number(row.amount) || 0;
      if (row.is_confirmed) {
        paid +=
          Number(row.confirmed_amount ?? row.amount) || 0;
      }
    }
    return { total, paid, pending: total - paid };
  }, [types, existingByType]);

  if (!types || types.length === 0) {
    return (
      <div className={`${ws.glass} ${ws.card} p-5`}>
        <div className="text-white/55 text-sm text-center py-6">
          لا توجد بنود متغيرة بعد. أضف بنداً من تبويب «البنود» وحدد نطاقه
          «متغيّر» أو «الاثنين».
        </div>
      </div>
    );
  }

  return (
    <div className={`${ws.glass} ${ws.card} p-5`}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={ws.iconBox}>
            <Receipt className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <div className="font-bold text-white tracking-tight">
              المصروفات المتغيرة
            </div>
            <div className="text-xs text-white/55 mt-0.5">
              {monthLabel(month)} — البنود موحّدة كل شهر، يتغيّر المبلغ فقط
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div>
            <span className="text-white/55">الإجمالي: </span>
            <span className="text-white font-bold" dir="ltr">
              {formatMoney(totals.total)}
            </span>
          </div>
          <div>
            <span className="text-white/55">مؤكد: </span>
            <span className="text-emerald-200 font-bold" dir="ltr">
              {formatMoney(totals.paid)}
            </span>
          </div>
          <div>
            <span className="text-white/55">بانتظار: </span>
            <span className="text-amber-200 font-bold" dir="ltr">
              {formatMoney(totals.pending)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddTemplate(true)}
            className={`${ws.btnPrimary} px-3 py-2 text-xs`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة قالب</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.04]">
              <th className="text-right px-3 py-2 text-xs font-semibold text-white/55">
                البند
              </th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-white/55">
                المبلغ
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-white/55">
                الحالة
              </th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-white/55">
                إجراء
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const row = existingByType.get(Number(t.id));
              const confirmed = !!row?.is_confirmed;
              const isLegacy = !!row?.legacy;
              return (
                <tr
                  key={t.id}
                  className="border-t border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2">
                    <div className="text-white text-sm font-medium">
                      {t.name}
                    </div>
                    {isLegacy ? (
                      <div className="text-amber-300/70 text-[10px] mt-0.5">
                        ملاحظة: عدة صفوف قديمة لنفس النوع — يُجمع تلقائياً
                      </div>
                    ) : null}
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
                      disabled={isLegacy}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {confirmed ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        مؤكد
                      </span>
                    ) : row ? (
                      <span className="text-xs text-amber-200">بانتظار</span>
                    ) : (
                      <span className="text-xs text-white/35">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      {!confirmed && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(t)}
                          disabled={saveMut.isPending || isLegacy}
                          className={`${ws.btnPrimary} px-2 py-1 text-xs disabled:opacity-50`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>تأكيد</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `إيقاف البند «${t.name}»؟ سيختفي من المصروفات الثابتة والمتغيرة، والمصاريف السابقة المسجلة عليه تبقى كما هي.`,
                            )
                          ) {
                            deactivateCategoryMut.mutate(t.id);
                          }
                        }}
                        disabled={deactivateCategoryMut.isPending}
                        className={`${ws.btnDanger} px-2 py-1 text-xs disabled:opacity-50`}
                        title="إيقاف البند"
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

      {showAddTemplate && (
        <VariableTemplateModal
          types={types}
          month={month}
          onClose={() => setShowAddTemplate(false)}
          onSubmit={(payload) => createTemplateMut.mutate(payload)}
          isPending={createTemplateMut.isPending}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

const SCOPE_OPTIONS = [
  { value: "variable", label: "متغيّر فقط" },
  { value: "both", label: "الاثنين (ثابت + متغيّر)" },
];

/**
 * Add-template modal scoped to the variable grid.
 *
 * Fields:
 *   - اسم البند     (free text → becomes accounting_expense_types.name)
 *   - التصنيف       (scope: 'variable' | 'both')
 *   - إجمالي المبلغ المتوقع
 *       Auto-prefills from /api/accounting/expenses/last-amount if a
 *       category with the same name already exists; otherwise the
 *       admin types in the expected amount manually.
 */
function VariableTemplateModal({
  types,
  month,
  onClose,
  onSubmit,
  isPending,
}) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("variable");
  const [expectedAmount, setExpectedAmount] = useState("");
  const [historyHint, setHistoryHint] = useState(null);

  // History prefill: when the typed name matches an existing type
  // (case-insensitive trim), look up its last accounting_expenses
  // amount before the current month and seed the input.
  React.useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setHistoryHint(null);
      return;
    }
    const match = (types || []).find(
      (t) =>
        String(t.name || "").trim().toLowerCase() ===
        trimmed.toLowerCase(),
    );
    if (!match) {
      setHistoryHint(null);
      return;
    }
    // Seed expected_amount from the stored type-level expected first.
    if (
      match.expected_amount !== null &&
      match.expected_amount !== undefined &&
      !expectedAmount
    ) {
      setExpectedAmount(String(match.expected_amount));
    }
    if (!month) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          expense_type_id: String(match.id),
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
          if (!expectedAmount) setExpectedAmount(String(d.amount));
        }
      } catch {
        // ignore — prefill is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, month]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const exp = expectedAmount === "" ? null : Number(expectedAmount);
    if (exp !== null && (!Number.isFinite(exp) || exp < 0)) return;
    onSubmit({
      name: trimmed,
      scope,
      expected_amount: exp,
    });
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
        className={`w-full max-w-md ${ws.glass} ${ws.card} p-5 space-y-4`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold tracking-tight">
            إضافة قالب متغيّر
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
          <label className="block text-xs font-semibold text-white/55 mb-2">
            التصنيف *
          </label>
          <GlassSelect
            value={scope}
            onChange={setScope}
            options={SCOPE_OPTIONS}
            buttonClassName="px-3 py-2.5"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-white/55 mb-2">
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
            <p className="text-[10px] text-emerald-200/80 mt-1.5">
              تمت تعبئته من شهر{" "}
              <span dir="ltr">{historyHint.month}</span> (
              <span dir="ltr">{formatMoney(historyHint.amount)}</span>)
            </p>
          ) : (
            <p className="text-[10px] text-white/45 mt-1.5">
              يستخدم كقيمة افتراضية كل شهر — يمكن تغييرها لاحقاً.
            </p>
          )}
        </div>

        <p className="text-[10px] text-white/45 leading-relaxed">
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
