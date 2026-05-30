"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Anchor,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { adminFetch } from "@/utils/apiAuth";
import {
  formatMoney,
  monthLabel,
  buildRecentMonthOptions,
} from "@/utils/payrollFormatters";
import { toast } from "sonner";

/**
 * Active fixed-expense templates, one row each. For the selected month:
 *   - "تم السداد" checkbox toggles the linked accounting_expenses row
 *     via POST /api/accounting/fixed-expenses/:id/toggle-paid
 *   - Amount can be overridden on toggle-on (defaults to template's
 *     default_amount).
 *   - Pencil edits the template (name + type + default amount).
 *   - Trash deletes the template.
 *
 * Inputs:
 *   templates       — [{id, expense_name, expense_type_id, expense_type_name, default_amount}]
 *   monthExpenses   — accounting_expenses rows for the selected month
 *                     (used to know which template is already paid)
 *   types           — accounting_expense_types where scope IN ('fixed','both')
 *   month           — "YYYY-MM"
 *   onMutate        — refetch hook (parent invalidates queries)
 */
export default function FixedPanel({
  templates,
  monthExpenses,
  types,
  month,
  onMutate,
}) {
  const queryClient = useQueryClient();

  // {templateId -> {expenseId, amount}}  lookup of "paid this month".
  const paidMap = useMemo(() => {
    const m = new Map();
    for (const e of monthExpenses || []) {
      if (e.fixed_expense_id) {
        m.set(Number(e.fixed_expense_id), {
          expenseId: e.id,
          amount: Number(e.confirmed_amount ?? e.amount) || 0,
        });
      }
    }
    return m;
  }, [monthExpenses]);

  const togglePaidMut = useMutation({
    mutationFn: async ({ id, amount }) => {
      const r = await adminFetch(
        `/api/accounting/fixed-expenses/${id}/toggle-paid`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, amount }),
        },
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل التحديث");
      return d;
    },
    onSuccess: () => {
      onMutate?.();
      queryClient.invalidateQueries({ queryKey: ["accounting_expenses"] });
    },
    onError: (e) => toast.error(e.message || "فشل التحديث"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const r = await adminFetch(`/api/accounting/fixed-expenses/${id}`, {
        method: "DELETE",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل الحذف");
      return d;
    },
    onSuccess: () => {
      onMutate?.();
      toast.success("تم الحذف");
    },
    onError: (e) => toast.error(e.message || "فشل الحذف"),
  });

  const createMut = useMutation({
    mutationFn: async (body) => {
      const r = await adminFetch("/api/accounting/fixed-expenses", {
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
      toast.success("تم الإضافة");
    },
    onError: (e) => toast.error(e.message || "فشل الإضافة"),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...body }) => {
      const r = await adminFetch(`/api/accounting/fixed-expenses/${id}`, {
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
      toast.success("تم التعديل");
    },
    onError: (e) => toast.error(e.message || "فشل التعديل"),
  });

  // Inline-edit row state (amount override + form modal).
  const [overrideAmount, setOverrideAmount] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const totalConfirmed = useMemo(() => {
    let sum = 0;
    for (const v of paidMap.values()) sum += v.amount;
    return sum;
  }, [paidMap]);

  // Same shape as VariableGrid totals so the header reads identically
  // across both tabs: { total, paid, pending }.
  //   - total   = the sum of every active template's per-month amount
  //               (default_amount split by its frequency cycle), i.e.
  //               what's EXPECTED to land on the month.
  //   - paid    = sum of accounting_expenses rows already confirmed
  //               this month (paidMap).
  //   - pending = expected − paid. Negative would mean an overrun;
  //               clamped at 0 to keep the UI sane.
  const totals = useMemo(() => {
    let expected = 0;
    for (const t of templates || []) {
      expected += perMonthAmount(t.default_amount, t.frequency);
    }
    const paid = totalConfirmed;
    const pending = Math.max(0, expected - paid);
    return { total: expected, paid, pending };
  }, [templates, totalConfirmed]);

  const handleToggle = (t) => {
    const paid = paidMap.has(Number(t.id));
    if (paid) {
      togglePaidMut.mutate({ id: t.id, amount: null });
      return;
    }
    const overrideRaw = overrideAmount[t.id];
    const amount =
      overrideRaw !== undefined && overrideRaw !== ""
        ? Number(overrideRaw)
        : null;
    togglePaidMut.mutate({ id: t.id, amount });
  };

  return (
    <>
      <div className={`${ws.glass} ${ws.card} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={ws.iconBox}>
              <Anchor className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                المصروفات الثابتة
              </div>
              <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
                {monthLabel(month)} — أدخلها مرة، حدّد «تم السداد» كل شهر
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
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className={`${ws.btnPrimary} px-3 py-2 text-sm`}
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قالب</span>
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="text-slate-600 dark:text-white/55 text-sm text-center py-6">
            لا توجد قوالب ثابتة بعد. أضف قالباً لتعرضه هنا كل شهر.
          </div>
        ) : (
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
                    التكرار
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                    الشهري (الإجمالي)
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                    مبلغ الشهر
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                    تم السداد
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 dark:text-white/55">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => {
                  const paidInfo = paidMap.get(Number(t.id));
                  const paid = !!paidInfo;
                  return (
                    <tr
                      key={t.id}
                      className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-3 py-2 text-slate-900 dark:text-white text-sm font-medium">
                        {t.expense_name}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-white/70 text-xs">
                        {t.expense_type_name}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <FrequencyBadge frequency={t.frequency || "monthly"} />
                        {(() => {
                          const m = toMonthString(t.start_month);
                          return m ? (
                            <div className="text-slate-500 dark:text-white/40 text-[10px] mt-0.5" dir="ltr">
                              من {m}
                            </div>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-sm" dir="ltr">
                        <div className="text-slate-900 dark:text-white font-semibold">
                          {formatMoney(
                            perMonthAmount(t.default_amount, t.frequency),
                          )}
                        </div>
                        {(FREQ_CYCLE_MONTHS[t.frequency] || 1) > 1 ? (
                          <div className="text-slate-500 dark:text-white/40 text-[10px] mt-0.5">
                            إجمالي: {formatMoney(t.default_amount)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        {paid ? (
                          <span className="text-emerald-700 dark:text-emerald-200 font-bold" dir="ltr">
                            {formatMoney(paidInfo.amount)}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={overrideAmount[t.id] ?? ""}
                            onChange={(e) =>
                              setOverrideAmount((prev) => ({
                                ...prev,
                                [t.id]: e.target.value,
                              }))
                            }
                            className={`${ws.input} px-2 py-1.5 text-sm w-28`}
                            placeholder={String(
                              perMonthAmount(t.default_amount, t.frequency),
                            )}
                            dir="ltr"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(t)}
                          disabled={togglePaidMut.isPending}
                          className={`${
                            paid
                              ? "text-emerald-700 dark:text-emerald-200 hover:text-emerald-100"
                              : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70"
                          } disabled:opacity-50 inline-flex`}
                          title={paid ? "إلغاء السداد" : "تعليم تم السداد"}
                        >
                          {paid ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                              if (
                                window.confirm(
                                  `حذف القالب «${t.expense_name}»؟`,
                                )
                              ) {
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

      {(showAdd || editTarget) && (
        <FixedFormModal
          target={editTarget}
          types={types}
          onClose={() => {
            setShowAdd(false);
            setEditTarget(null);
          }}
          onSubmit={(payload) => {
            if (editTarget) {
              updateMut.mutate(
                { id: editTarget.id, ...payload },
                {
                  onSuccess: () => {
                    setEditTarget(null);
                  },
                },
              );
            } else {
              createMut.mutate(payload, {
                onSuccess: () => {
                  setShowAdd(false);
                },
              });
            }
          }}
          isPending={createMut.isPending || updateMut.isPending}
        />
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────── */

const FREQUENCY_OPTIONS = [
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "semi_annual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
];

const FREQ_LABEL = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semi_annual: "نصف سنوي",
  annual: "سنوي",
};

const FREQ_BADGE = {
  monthly: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/25",
  quarterly: "bg-pink-500/15 text-pink-700 dark:text-pink-200 border-pink-500/25",
  semi_annual: "bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-500/25",
  annual: "bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/25",
};

const FREQ_CYCLE_MONTHS = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

function perMonthAmount(totalAmount, frequency) {
  const cycle = FREQ_CYCLE_MONTHS[frequency] || 1;
  const total = Number(totalAmount);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.round((total / cycle) * 100) / 100;
}

/**
 * Normalize a DATE/TIMESTAMP value from the API into "YYYY-MM".
 *   - already "YYYY-MM..."     → first 7 chars
 *   - JS Date / ISO timestamp  → format from UTC components
 *   - falsy / unparseable      → ""
 */
function toMonthString(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function FrequencyBadge({ frequency }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border ${
        FREQ_BADGE[frequency] || FREQ_BADGE.monthly
      }`}
    >
      {FREQ_LABEL[frequency] || "شهري"}
    </span>
  );
}

function FixedFormModal({ target, types, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState(() => ({
    expense_name: target?.expense_name || "",
    expense_type_id: target?.expense_type_id
      ? String(target.expense_type_id)
      : "",
    default_amount: target?.default_amount ?? "",
    frequency: target?.frequency || "monthly",
    start_month: toMonthString(target?.start_month),
  }));

  const typeOptions = useMemo(() => {
    const opts = [{ value: "", label: "اختر النوع…" }];
    for (const t of types || []) {
      opts.push({ value: String(t.id), label: t.name });
    }
    return opts;
  }, [types]);

  // Same month dropdown shape used everywhere else on the accounting
  // surface — 30 recent + upcoming months, formatted as "مايو 2026".
  // Leading empty option = "من البداية دائماً" (NULL start_month).
  const startMonthOptions = useMemo(() => {
    const base = buildRecentMonthOptions(30);
    return [{ value: "", label: "من البداية دائماً" }, ...base];
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.expense_name.trim()) return;
    if (!form.expense_type_id) return;
    const amt = Number(form.default_amount);
    if (!Number.isFinite(amt) || amt < 0) return;
    onSubmit({
      expense_name: form.expense_name.trim(),
      expense_type_id: Number(form.expense_type_id),
      default_amount: amt,
      frequency: form.frequency,
      start_month: form.start_month || null,
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
          <h3 className="text-slate-900 dark:text-white font-bold tracking-tight">
            {target ? "تعديل القالب" : "إضافة قالب ثابت"}
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
            value={form.expense_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, expense_name: e.target.value }))
            }
            className={`${ws.input} px-3 py-2.5`}
            required
            placeholder="مثال: إيجار المحل"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
            التصنيف *
          </label>
          <GlassSelect
            value={form.expense_type_id}
            onChange={(v) => setForm((f) => ({ ...f, expense_type_id: v }))}
            options={typeOptions}
            buttonClassName="px-3 py-2.5"
          />
          <p className="text-[10px] text-slate-500 dark:text-white/45 mt-1.5 leading-relaxed">
            البند العام الذي ينتمي إليه هذا القالب — مثل «إيجار»،
            «كهرباء»، «اشتراك». يستخدم في تجميع المصاريف للتقارير.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
            إجمالي المبلغ للدورة *
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.default_amount}
            onChange={(e) =>
              setForm((f) => ({ ...f, default_amount: e.target.value }))
            }
            className={`${ws.input} px-3 py-2.5`}
            required
            dir="ltr"
          />
          {form.default_amount && form.frequency !== "monthly" ? (
            <p className="text-[10px] text-slate-600 dark:text-white/55 mt-1.5">
              ينقسم إلى{" "}
              <span className="text-emerald-700 dark:text-emerald-200 font-bold" dir="ltr">
                {perMonthAmount(form.default_amount, form.frequency)}
              </span>{" "}
              ر.س شهرياً (×{FREQ_CYCLE_MONTHS[form.frequency] || 1})
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
              التكرار *
            </label>
            <GlassSelect
              value={form.frequency}
              onChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
              options={FREQUENCY_OPTIONS}
              buttonClassName="px-3 py-2.5"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2">
              شهر البدء
            </label>
            <GlassSelect
              value={form.start_month}
              onChange={(v) => setForm((f) => ({ ...f, start_month: v }))}
              options={startMonthOptions}
              buttonClassName="px-3 py-2.5"
              placeholder="من البداية دائماً"
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 dark:text-white/45 leading-relaxed">
          المبلغ الإجمالي ينقسم على شهور الدورة ويظهر كل شهر بدءاً من «شهر
          البدء». «شهري» × 1، «ربع سنوي» × 3، «نصف سنوي» × 6، «سنوي» × 12.
          اترك شهر البدء فارغاً لـ«من البداية دائماً».
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
