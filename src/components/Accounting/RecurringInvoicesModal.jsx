"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  Loader2,
  Pencil,
  Plus,
  Repeat,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { buildExpenseAccountOptions } from "@/components/Accounting/PurchaseInvoiceModal";
import { authedFetch } from "@/utils/apiAuth";

/**
 * الفواتير المتكررة — قوالب (إيجار، اشتراكات، عقود شهرية) تتحول
 * تلقائياً إلى فاتورة «بانتظار الاعتماد» في اليوم المحدد من كل شهر.
 * التوليد يتم عند أول فتح للدفتر بعد حلول الموعد (لا يحتاج خادم
 * مجدول) — رقم الفاتورة REC-YYYYMM-القالب.
 */

const RECURRING_KEY = ["recurring-purchase-invoices"];

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const EMPTY_FORM = {
  id: null,
  name: "",
  contact_id: "",
  branch_id: "",
  expense_account_id: "",
  description: "",
  amount: "",
  tax_rate: "15",
  amount_includes_tax: true,
  day_of_month: "1",
  is_active: true,
};

export default function RecurringInvoicesModal({
  open,
  contacts = [],
  accounts = [],
  branches = [],
  onClose,
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null); // null = عرض القائمة
  const [error, setError] = useState("");

  const templatesQuery = useQuery({
    queryKey: RECURRING_KEY,
    enabled: open,
    queryFn: async () => {
      const response = await authedFetch(
        "/api/accounting/recurring-purchase-invoices",
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل التحميل");
      return Array.isArray(data?.templates) ? data.templates : [];
    },
  });
  const templates = templatesQuery.data || [];

  const saveMut = useMutation({
    mutationFn: async (payload) => {
      const response = await authedFetch(
        "/api/accounting/recurring-purchase-invoices",
        {
          method: payload.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل الحفظ");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY });
      setForm(null);
      setError("");
    },
    onError: (err) => setError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id) => {
      const response = await authedFetch(
        `/api/accounting/recurring-purchase-invoices?id=${id}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل الحذف");
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY }),
  });

  const contactOptions = useMemo(
    () => [
      { value: "", label: "اختر المورد…" },
      ...contacts
        .filter((contact) => contact.is_active !== false)
        .map((contact) => ({
          value: String(contact.id),
          label: contact.name,
        })),
    ],
    [contacts],
  );
  const accountOptions = useMemo(
    () => buildExpenseAccountOptions(accounts),
    [accounts],
  );
  const branchOptions = useMemo(
    () => [
      { value: "", label: "بدون تحديد فرع" },
      ...branches.map((branch) => ({
        value: String(branch.id),
        label: branch.name,
      })),
    ],
    [branches],
  );
  const dayOptions = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        value: String(index + 1),
        label: `يوم ${index + 1} من الشهر`,
      })),
    [],
  );

  if (!open || typeof document === "undefined") return null;

  const startEdit = (template) => {
    setError("");
    setForm({
      id: template.id,
      name: template.name || "",
      contact_id: template.contact_id ? String(template.contact_id) : "",
      branch_id: template.branch_id ? String(template.branch_id) : "",
      expense_account_id: template.expense_account_id
        ? String(template.expense_account_id)
        : "",
      description: template.description || "",
      amount: String(moneyValue(template.amount) || ""),
      tax_rate: String(Number(template.tax_rate ?? 15)),
      amount_includes_tax: template.amount_includes_tax !== false,
      day_of_month: String(template.day_of_month || 1),
      is_active: template.is_active !== false,
    });
  };

  const submitForm = (event) => {
    event.preventDefault();
    if (saveMut.isPending) return;
    saveMut.mutate({
      id: form.id || undefined,
      name: form.name,
      contact_id: form.contact_id || null,
      branch_id: form.branch_id || null,
      expense_account_id: form.expense_account_id || null,
      description: form.description || null,
      amount: moneyValue(form.amount),
      tax_rate: Number(form.tax_rate) || 0,
      amount_includes_tax: form.amount_includes_tax,
      day_of_month: Number(form.day_of_month) || 1,
      is_active: form.is_active,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`${ws.glass} ${ws.card} w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}>
        <div className={`sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 py-4 border-b ${ws.divider} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10 text-[#0e7a5f] dark:text-emerald-200`}>
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                الفواتير المتكررة
              </div>
              <div className="text-[11px] text-slate-500 dark:text-white/50 mt-0.5">
                إيجارات واشتراكات تتحول لفاتورة «بانتظار الاعتماد» تلقائياً كل شهر.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {form ? (
            <form onSubmit={submitForm} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    اسم القالب <span className="text-rose-600">*</span>
                  </div>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    placeholder="مثال: إيجار الفرع الرئيسي"
                    className={`${ws.input} px-3 py-2`}
                    autoFocus
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    المورد <span className="text-rose-600">*</span>
                  </div>
                  <GlassSelect
                    value={form.contact_id}
                    onChange={(value) => setForm({ ...form, contact_id: value })}
                    options={contactOptions}
                    placeholder="اختر المورد…"
                    buttonClassName="text-sm py-2 px-3"
                    searchable
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    المبلغ الشهري <span className="text-rose-600">*</span>
                  </div>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                    className={`${ws.input} px-3 py-2 text-left`}
                    step="0.01"
                    min="0"
                    dir="ltr"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    الضريبة
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={form.tax_rate}
                      onChange={(event) =>
                        setForm({ ...form, tax_rate: event.target.value })
                      }
                      className={`${ws.input} px-3 py-2 text-left w-20`}
                      step="0.5"
                      min="0"
                      max="100"
                      dir="ltr"
                    />
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-white/55 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.amount_includes_tax}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            amount_includes_tax: event.target.checked,
                          })
                        }
                        className="accent-[#0e7a5f]"
                      />
                      المبلغ شامل الضريبة
                    </label>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    حساب المصروف (شجرة الحسابات)
                  </div>
                  <GlassSelect
                    value={form.expense_account_id}
                    onChange={(value) =>
                      setForm({ ...form, expense_account_id: value })
                    }
                    options={accountOptions}
                    placeholder="غير مصنّفة"
                    buttonClassName="text-sm py-2 px-3"
                    searchable
                  />
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    يوم التوليد
                  </div>
                  <GlassSelect
                    value={form.day_of_month}
                    onChange={(value) => setForm({ ...form, day_of_month: value })}
                    options={dayOptions}
                    buttonClassName="text-sm py-2 px-3"
                  />
                </div>
                {branches.length > 0 ? (
                  <div>
                    <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                      الفرع
                    </div>
                    <GlassSelect
                      value={form.branch_id}
                      onChange={(value) => setForm({ ...form, branch_id: value })}
                      options={branchOptions}
                      placeholder="بدون تحديد فرع"
                      buttonClassName="text-sm py-2 px-3"
                    />
                  </div>
                ) : null}
                <div className={branches.length > 0 ? "" : "sm:col-span-2"}>
                  <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                    وصف البند
                  </div>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="يظهر كوصف البند في الفاتورة المولدة"
                    className={`${ws.input} px-3 py-2`}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm({ ...form, is_active: event.target.checked })
                  }
                  className="accent-[#0e7a5f]"
                />
                القالب فعّال (يولّد فاتورة كل شهر)
              </label>

              {error ? (
                <div className="text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saveMut.isPending}
                  className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50`}
                >
                  {saveMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {form.id ? "حفظ التعديلات" : "إضافة القالب"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(null);
                    setError("");
                  }}
                  className={`${ws.btnNeutral} px-4 py-2`}
                >
                  إلغاء
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-white/45">
                  {templates.length} قالب
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setForm({ ...EMPTY_FORM });
                  }}
                  className={`${ws.btnPrimary} px-3 py-2 text-xs`}
                >
                  <Plus className="w-4 h-4" />
                  قالب جديد
                </button>
              </div>

              {templatesQuery.isLoading ? (
                <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                  جاري التحميل…
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarClock className="w-8 h-8 mx-auto text-slate-400 dark:text-white/30 mb-2" />
                  <div className="text-sm text-slate-600 dark:text-white/60">
                    لا توجد قوالب بعد — أضف الإيجار أو الاشتراكات الشهرية
                    وسيولّدها النظام تلقائياً.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`${ws.glassSoft} ${ws.card} px-3.5 py-3 flex items-center gap-3 ${template.is_active === false ? "opacity-60" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {template.name}
                          {template.is_active === false ? (
                            <span className="mr-2 text-[10px] font-normal text-slate-500 dark:text-white/45">
                              (موقوف)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            {template.contact_name || template.supplier_name || "بدون مورد"}
                          </span>
                          <span>•</span>
                          <span>يوم {template.day_of_month}</span>
                          {template.account_name ? (
                            <>
                              <span>•</span>
                              <span>{template.account_name}</span>
                            </>
                          ) : null}
                          {template.branch_name ? (
                            <>
                              <span>•</span>
                              <span>{template.branch_name}</span>
                            </>
                          ) : null}
                          {template.last_generated_period ? (
                            <>
                              <span>•</span>
                              <span dir="ltr">آخر توليد {template.last_generated_period}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-sm font-bold tabular-nums shrink-0" dir="ltr">
                        {money(template.amount)} SAR
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(template)}
                          className={`${ws.iconButton} w-8 h-8`}
                          title="تعديل"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(`حذف قالب «${template.name}»؟`)
                            ) {
                              deleteMut.mutate(template.id);
                            }
                          }}
                          className={`${ws.iconButton} w-8 h-8 hover:text-red-700 dark:hover:text-red-200`}
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
