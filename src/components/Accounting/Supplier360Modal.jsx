"use client";

import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Banknote,
  FileText,
  Hash,
  Percent,
  User,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import {
  purchaseInvoiceStatusClass,
  purchaseInvoiceStatusLabel,
} from "@/components/Accounting/PurchaseInvoiceModal";

/**
 * بطاقة مورد 360° — صورة كاملة للمورد في نافذة واحدة:
 * إجمالي التعامل والمدفوع والرصيد ونسبة المتأخر، اتجاه آخر 6 أشهر،
 * وأحدث الفواتير. تُحسب من نفس صفوف الدفتر الموجودة في الكاش.
 */

const MONTH_SHORT = [
  "ينا",
  "فبر",
  "مار",
  "أبر",
  "ماي",
  "يون",
  "يول",
  "أغس",
  "سبت",
  "أكت",
  "نوف",
  "ديس",
];

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

function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function Kpi({ label, value, tone = "" }) {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-3`}>
      <div className="text-[11px] text-slate-500 dark:text-white/45">
        {label}
      </div>
      <div className={`text-base font-bold mt-0.5 ${tone || "text-slate-900 dark:text-white"}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}

export default function Supplier360Modal({ contact, invoices = [], onClose }) {
  // فواتير هذا المورد: بالربط أو بمطابقة الاسم للفواتير غير المربوطة.
  const supplierInvoices = useMemo(() => {
    if (!contact) return [];
    return invoices
      .filter((invoice) => {
        if (invoice.is_active === false) return false;
        if (invoice.contact_id) {
          return Number(invoice.contact_id) === Number(contact.id);
        }
        return (
          (invoice.supplier_name || "").trim() === (contact.name || "").trim()
        );
      })
      .sort((a, b) =>
        String(b.invoice_date || "").localeCompare(String(a.invoice_date || "")),
      );
  }, [contact, invoices]);

  const stats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let balance = 0;
    let overdueBalance = 0;
    let overdueCount = 0;
    for (const invoice of supplierInvoices) {
      total += moneyValue(invoice.total_amount);
      paid += moneyValue(invoice.paid_amount);
      balance += moneyValue(invoice.balance_due);
      if (invoice.computed_status === "overdue") {
        overdueCount += 1;
        overdueBalance += moneyValue(invoice.balance_due);
      }
    }
    const count = supplierInvoices.length;
    return {
      total,
      paid,
      balance,
      overdueBalance,
      overdueCount,
      count,
      average: count > 0 ? total / count : 0,
      lastDate: supplierInvoices[0]?.invoice_date || null,
      overduePct: total > 0 ? Math.round((overdueBalance / total) * 100) : 0,
    };
  }, [supplierInvoices]);

  // اتجاه آخر 6 أشهر.
  const trend = useMemo(() => {
    const today = todayRiyadh();
    let [y, m] = today.split("-").map(Number);
    const months = [];
    for (let i = 0; i < 6; i += 1) {
      months.unshift({ key: `${y}-${String(m).padStart(2, "0")}`, month: m, total: 0 });
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    const byKey = new Map(months.map((entry) => [entry.key, entry]));
    for (const invoice of supplierInvoices) {
      const key = String(invoice.invoice_date || "").slice(0, 7);
      const bucket = byKey.get(key);
      if (bucket) bucket.total += moneyValue(invoice.total_amount);
    }
    const peak = Math.max(...months.map((entry) => entry.total), 1);
    return { months, peak };
  }, [supplierInvoices]);

  if (!contact || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`${ws.glass} ${ws.card} w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}>
        {/* الرأس */}
        <div className={`sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 py-4 border-b ${ws.divider} flex items-start justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`${ws.iconBox} w-11 h-11 text-[#0e7a5f] dark:text-emerald-200 shrink-0`}>
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {contact.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-white/50 mt-0.5 flex items-center gap-3 flex-wrap">
                {contact.vat_number ? (
                  <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                    <Hash className="w-3 h-3" />
                    {contact.vat_number}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  ضريبة افتراضية {Number(contact.default_tax_rate || 0).toFixed(0)}%
                </span>
                {stats.lastDate ? (
                  <span dir="ltr">آخر فاتورة {stats.lastDate}</span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9 shrink-0`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* مؤشرات */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="إجمالي التعامل" value={`${money(stats.total)} SAR`} />
            <Kpi
              label="المدفوع"
              value={`${money(stats.paid)} SAR`}
              tone="text-[#0e7a5f] dark:text-emerald-200"
            />
            <Kpi
              label="الرصيد المستحق"
              value={`${money(stats.balance)} SAR`}
              tone="text-amber-700 dark:text-amber-200"
            />
            <Kpi
              label={`متأخر (${stats.overdueCount})`}
              value={`${money(stats.overdueBalance)} SAR`}
              tone="text-rose-700 dark:text-rose-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500 dark:text-white/45">
            <div className={`${ws.glassSoft} ${ws.card} p-2.5 flex items-center gap-2`}>
              <FileText className="w-3.5 h-3.5 shrink-0" />
              {stats.count} فاتورة — متوسط {money(stats.average)} SAR
            </div>
            <div className={`${ws.glassSoft} ${ws.card} p-2.5 flex items-center gap-2`}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              نسبة المتأخر من إجمالي التعامل: {stats.overduePct}%
            </div>
          </div>

          {/* اتجاه آخر 6 أشهر */}
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-white/70 mb-2">
              مشتريات آخر 6 أشهر
            </div>
            <div className="flex items-end gap-2 h-24">
              {trend.months.map((entry) => {
                const pct = Math.max(
                  Math.round((entry.total / trend.peak) * 100),
                  entry.total > 0 ? 6 : 2,
                );
                return (
                  <div
                    key={entry.key}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${entry.key}: ${money(entry.total)} SAR`}
                  >
                    <div className="w-full h-20 flex items-end">
                      <div
                        className="w-full rounded-t bg-[#0e7a5f]/75 dark:bg-emerald-400/60"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-white/40">
                      {MONTH_SHORT[entry.month - 1]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* أحدث الفواتير */}
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-white/70 mb-2">
              أحدث الفواتير ({Math.min(supplierInvoices.length, 8)} من {supplierInvoices.length})
            </div>
            {supplierInvoices.length === 0 ? (
              <div className="text-center text-sm text-slate-500 dark:text-white/50 py-6">
                لا توجد فواتير لهذا المورد بعد.
              </div>
            ) : (
              <div className="space-y-1.5">
                {supplierInvoices.slice(0, 8).map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`${ws.glassSoft} ${ws.card} px-3 py-2 flex items-center gap-3`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white font-mono" dir="ltr">
                        {invoice.invoice_number}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5" dir="ltr">
                        {invoice.invoice_date}
                        {invoice.due_date ? ` ← ${invoice.due_date}` : ""}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${purchaseInvoiceStatusClass(invoice.computed_status)}`}
                    >
                      {purchaseInvoiceStatusLabel(invoice.computed_status)}
                    </span>
                    <div className="text-xs font-bold tabular-nums shrink-0" dir="ltr">
                      {money(invoice.total_amount)}
                    </div>
                    {moneyValue(invoice.balance_due) > 0 ? (
                      <div className="text-[10px] text-amber-700 dark:text-amber-300 tabular-nums shrink-0 inline-flex items-center gap-1" dir="ltr">
                        <Banknote className="w-3 h-3" />
                        {money(invoice.balance_due)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
