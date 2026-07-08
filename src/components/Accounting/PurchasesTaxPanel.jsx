"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  Info,
  Percent,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import { useAccountingPurchaseInvoices } from "@/hooks/useAccountingPurchaseInvoices";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";

// VAT report over purchase invoices: input VAT (الضريبة القابلة
// للخصم) aggregated per Hijri-agnostic Gregorian month, Riyadh time.
// Backed by شجرة الحسابات nodes 1104 (receivable) / 2102 (payable).

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function todayRiyadh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return `${moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SAR`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return `${MONTHS_AR[(month || 1) - 1]} ${year}`;
}

function quarterOf(monthKey) {
  const month = Number(monthKey.slice(5, 7));
  return Math.floor((month - 1) / 3) + 1;
}

function KpiCard({ label, value, sub, tone = "slate" }) {
  const toneClass =
    tone === "emerald"
      ? "text-[#0e7a5f] dark:text-emerald-200"
      : tone === "sky"
        ? "text-sky-700 dark:text-sky-200"
        : tone === "amber"
          ? "text-amber-700 dark:text-amber-200"
          : "text-slate-700 dark:text-white/80";
  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="text-xs text-slate-500 dark:text-white/50">{label}</div>
      <div className={`text-xl font-bold mt-1 ${toneClass}`} dir="ltr">
        {value}
      </div>
      {sub ? (
        <div className="text-xs text-slate-500 dark:text-white/45 mt-1">{sub}</div>
      ) : null}
    </div>
  );
}

export default function PurchasesTaxPanel({ employeeId, isAdmin }) {
  const [year, setYear] = useState(() => todayRiyadh().slice(0, 4));

  const invoicesQuery = useAccountingPurchaseInvoices({ employeeId, isAdmin });
  const invoices = invoicesQuery.data || [];

  const today = todayRiyadh();
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);
  const currentQuarter = quarterOf(currentMonth);

  const yearOptions = useMemo(() => {
    const years = new Set([currentYear]);
    for (const invoice of invoices) {
      const y = String(invoice.invoice_date || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
    }
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [invoices, currentYear]);

  const report = useMemo(() => {
    const byMonth = new Map();
    let monthTax = 0;
    let quarterTax = 0;
    let yearTax = 0;
    let yearSubtotal = 0;
    let yearTotal = 0;

    for (const invoice of invoices) {
      const date = String(invoice.invoice_date || "");
      if (date.length < 7) continue;
      const monthKey = date.slice(0, 7);
      const invoiceYear = date.slice(0, 4);
      const tax = moneyValue(invoice.tax_amount);
      const total = moneyValue(invoice.total_amount);
      // subtotal column may be 0 for invoices entered total-only —
      // fall back to total − tax so the net column stays truthful.
      const subtotalRaw = moneyValue(invoice.subtotal_amount);
      const subtotal = subtotalRaw > 0 ? subtotalRaw : Math.max(total - tax, 0);

      if (monthKey === currentMonth) monthTax += tax;
      if (
        invoiceYear === currentYear &&
        quarterOf(monthKey) === currentQuarter
      ) {
        quarterTax += tax;
      }

      if (invoiceYear !== year) continue;
      yearTax += tax;
      yearSubtotal += subtotal;
      yearTotal += total;

      const entry = byMonth.get(monthKey) || {
        month: monthKey,
        count: 0,
        subtotal: 0,
        tax: 0,
        total: 0,
      };
      entry.count += 1;
      entry.subtotal += subtotal;
      entry.tax += tax;
      entry.total += total;
      byMonth.set(monthKey, entry);
    }

    const months = [...byMonth.values()].sort((a, b) =>
      b.month.localeCompare(a.month),
    );
    return { months, monthTax, quarterTax, yearTax, yearSubtotal, yearTotal };
  }, [invoices, year, currentMonth, currentYear, currentQuarter]);

  const exportColumns = [
    { header: "الشهر", accessor: (row) => monthLabel(row.month) },
    { header: "عدد الفواتير", accessor: (row) => row.count },
    { header: "الصافي قبل الضريبة", accessor: (row) => row.subtotal.toFixed(2) },
    { header: "ضريبة القيمة المضافة", accessor: (row) => row.tax.toFixed(2) },
    { header: "الإجمالي", accessor: (row) => row.total.toFixed(2) },
  ];

  const handleExport = (kind) => {
    const title = `تقرير ضريبة مشتريات ${year}`;
    if (kind === "excel") {
      exportToExcelHTML(report.months, `vat-purchases-${year}`, exportColumns, title);
    } else {
      exportToPDF(report.months, `vat-purchases-${year}`, exportColumns, title);
    }
  };

  if (invoicesQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري تحميل تقرير الضريبة…
      </div>
    );
  }

  return (
    <>
      <div
        className={`${ws.card} p-4 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/25 flex items-start gap-3`}
      >
        <Info className="w-5 h-5 text-sky-700 dark:text-sky-300 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800 dark:text-sky-200 leading-relaxed">
          التقرير يجمع «الضريبة» المسجّلة على فواتير المشتريات (ضريبة
          مدخلات قابلة للخصم — حساب 1104 في شجرة الحسابات). ضريبة
          المخرجات على المبيعات (حساب 2102) تُدار من نظام نقاط البيع.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="ضريبة هذا الشهر"
          value={formatMoney(report.monthTax)}
          sub={monthLabel(currentMonth)}
          tone="emerald"
        />
        <KpiCard
          label={`ضريبة الربع ${currentQuarter}`}
          value={formatMoney(report.quarterTax)}
          sub={`${currentYear} — للربع الحالي`}
          tone="sky"
        />
        <KpiCard
          label={`ضريبة سنة ${year}`}
          value={formatMoney(report.yearTax)}
          sub={`صافي ${formatMoney(report.yearSubtotal)} · إجمالي ${formatMoney(report.yearTotal)}`}
          tone="amber"
        />
      </div>

      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white/85">
            <CalendarRange className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-200" />
            السنة:
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {yearOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setYear(option)}
                className={`${ws.segBtn} ${
                  year === option ? ws.segActive : ws.segInactive
                } text-sm`}
                dir="ltr"
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => handleExport("excel")}
            className={`${ws.btnNeutral} px-3 py-2 text-xs`}
            disabled={report.months.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className={`${ws.btnNeutral} px-3 py-2 text-xs`}
            disabled={report.months.length === 0}
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {report.months.length === 0 ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
          <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
            <Percent className="w-6 h-6 text-slate-500 dark:text-white/50" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white">
            لا توجد بيانات ضريبة لسنة {year}
          </div>
          <div className="text-sm text-slate-600 dark:text-white/60 mt-1">
            سجّل مبلغ الضريبة عند إدخال فواتير المشتريات ليظهر هنا تلقائياً.
          </div>
        </div>
      ) : (
        <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/80 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10">
                <tr className="text-slate-500 dark:text-white/50">
                  <th className="text-right font-semibold px-4 py-3">الشهر</th>
                  <th className="text-center font-semibold px-4 py-3">الفواتير</th>
                  <th className="text-left font-semibold px-4 py-3">
                    الصافي قبل الضريبة
                  </th>
                  <th className="text-left font-semibold px-4 py-3">الضريبة</th>
                  <th className="text-left font-semibold px-4 py-3">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {report.months.map((row) => (
                  <tr
                    key={row.month}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {monthLabel(row.month)}
                      {row.month === currentMonth ? (
                        <span
                          className={`${ws.pill} bg-[#e7f2ee] dark:bg-emerald-400/10 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25 mr-2`}
                        >
                          الحالي
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700 dark:text-white/70">
                      {row.count}
                    </td>
                    <td className="px-4 py-3 text-left text-slate-700 dark:text-white/70" dir="ltr">
                      {formatMoney(row.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-left font-bold text-[#0e7a5f] dark:text-emerald-200" dir="ltr">
                      {formatMoney(row.tax)}
                    </td>
                    <td className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white" dir="ltr">
                      {formatMoney(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/80 dark:bg-white/[0.04] border-t border-slate-200 dark:border-white/10">
                <tr className="font-bold text-slate-900 dark:text-white">
                  <td className="px-4 py-3">الإجمالي — {year}</td>
                  <td className="px-4 py-3 text-center">
                    {report.months.reduce((sum, row) => sum + row.count, 0)}
                  </td>
                  <td className="px-4 py-3 text-left" dir="ltr">
                    {formatMoney(report.yearSubtotal)}
                  </td>
                  <td className="px-4 py-3 text-left text-[#0e7a5f] dark:text-emerald-200" dir="ltr">
                    {formatMoney(report.yearTax)}
                  </td>
                  <td className="px-4 py-3 text-left" dir="ltr">
                    {formatMoney(report.yearTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
