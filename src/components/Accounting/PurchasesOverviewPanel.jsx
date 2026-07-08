"use client";

import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  Contact,
  FileText,
  HandCoins,
  ListTree,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import {
  purchaseInvoiceStatusClass,
  purchaseInvoiceStatusLabel,
} from "@/components/Accounting/PurchaseInvoiceModal";
import { useAccountingPurchaseInvoices } from "@/hooks/useAccountingPurchaseInvoices";
import { useAccountingAccounts } from "@/hooks/useAccountingAccounts";

/**
 * لوحة القيادة — حسب مستند التصميم.
 *
 * تجيب أربعة أسئلة بالترتيب: كم اشترينا هذا الشهر (مع مقارنة الشهر
 * السابق)؟ كم علينا؟ وش المتأخر؟ ووش يحتاج تصرفاً الآن؟ ثم رسم شهري
 * وتوزيع الإنفاق وأحدث الفواتير.
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

const DONUT_COLORS = ["#0e7a5f", "#0e7490", "#b7791f", "#2569a8", "#8b5cf6"];

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

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(yyyyMm, delta) {
  const [y, m] = yyyyMm.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value, currency = "SAR") {
  return `${moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function KpiCard({ label, value, sub, delta, tone = "slate", onClick }) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700 dark:text-rose-200"
      : tone === "emerald"
        ? "text-emerald-700 dark:text-emerald-200"
        : tone === "amber"
          ? "text-amber-700 dark:text-amber-200"
          : "text-slate-900 dark:text-white";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`${ws.glass} ${ws.card} p-4 text-right w-full ${
        onClick
          ? "hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
          : ""
      }`}
    >
      <div className="text-xs text-slate-500 dark:text-white/50">{label}</div>
      <div
        className={`text-xl font-bold mt-1 tabular-nums ${toneClass}`}
        dir="ltr"
      >
        {value}
      </div>
      {delta ? (
        <div
          className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${
            delta.direction === "up"
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }`}
        >
          {delta.direction === "up" ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {delta.text}
        </div>
      ) : sub ? (
        <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
          {sub}
        </div>
      ) : null}
    </Wrapper>
  );
}

export default function PurchasesOverviewPanel({
  employeeId,
  isAdmin,
  onNavigate,
}) {
  const invoicesQuery = useAccountingPurchaseInvoices({ employeeId, isAdmin });
  const accountsQuery = useAccountingAccounts({ employeeId, isAdmin });

  const invoices = useMemo(
    () =>
      (invoicesQuery.data || []).filter(
        (invoice) => invoice.is_active !== false,
      ),
    [invoicesQuery.data],
  );
  const accounts = accountsQuery.data || [];

  const today = todayRiyadh();
  const thisMonth = today.slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const weekAhead = addDays(today, 7);

  // ── KPI row ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let monthTotal = 0;
    let monthCount = 0;
    let lastMonthTotal = 0;
    let openBalance = 0;
    let openCount = 0;
    let overdueBalance = 0;
    let overdueCount = 0;
    let oldestOverdueDays = 0;
    let pendingCount = 0;
    for (const invoice of invoices) {
      const month = (invoice.invoice_date || "").slice(0, 7);
      const total = moneyValue(invoice.total_amount);
      const balance = moneyValue(invoice.balance_due);
      if (month === thisMonth) {
        monthTotal += total;
        monthCount += 1;
      }
      if (month === lastMonth) lastMonthTotal += total;
      if (balance > 0) {
        openBalance += balance;
        openCount += 1;
      }
      if (invoice.computed_status === "overdue") {
        overdueBalance += balance;
        overdueCount += 1;
        const due = invoice.due_date || invoice.invoice_date;
        const days = Math.floor(
          (new Date(today).getTime() - new Date(due).getTime()) / 86400000,
        );
        if (days > oldestOverdueDays) oldestOverdueDays = days;
      }
      if (
        invoice.computed_status === "pending_payment" ||
        invoice.computed_status === "new"
      ) {
        pendingCount += 1;
      }
    }
    const deltaPct =
      lastMonthTotal > 0
        ? Math.round(((monthTotal - lastMonthTotal) / lastMonthTotal) * 100)
        : null;
    return {
      monthTotal,
      monthCount,
      deltaPct,
      openBalance,
      openCount,
      overdueBalance,
      overdueCount,
      oldestOverdueDays,
      pendingCount,
    };
  }, [invoices, thisMonth, lastMonth, today]);

  // ── الرسم الشهري — آخر ٨ أشهر ────────────────────────────────────
  const monthlyBars = useMemo(() => {
    const months = [];
    for (let i = 7; i >= 0; i -= 1) months.push(shiftMonth(thisMonth, -i));
    const totals = new Map(months.map((month) => [month, 0]));
    for (const invoice of invoices) {
      const month = (invoice.invoice_date || "").slice(0, 7);
      if (totals.has(month)) {
        totals.set(month, totals.get(month) + moneyValue(invoice.total_amount));
      }
    }
    const max = Math.max(...totals.values(), 1);
    return months.map((month) => {
      const [, m] = month.split("-").map(Number);
      return {
        month,
        label: MONTH_SHORT[m - 1],
        value: totals.get(month),
        pct: Math.round((totals.get(month) / max) * 100),
        isCurrent: month === thisMonth,
      };
    });
  }, [invoices, thisMonth]);

  // ── توزيع الإنفاق على الحسابات (donut) ───────────────────────────
  const donut = useMemo(() => {
    const byAccount = new Map();
    let total = 0;
    for (const invoice of invoices) {
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      if (items.length === 0) {
        const key = invoice.expense_account_id || "none";
        byAccount.set(
          key,
          (byAccount.get(key) || 0) + moneyValue(invoice.total_amount),
        );
        total += moneyValue(invoice.total_amount);
        continue;
      }
      for (const item of items) {
        const key = item.account_id || "none";
        byAccount.set(
          key,
          (byAccount.get(key) || 0) + moneyValue(item.line_total),
        );
        total += moneyValue(item.line_total);
      }
    }
    if (total <= 0) return null;
    const accountById = new Map(accounts.map((a) => [Number(a.id), a]));
    const sorted = [...byAccount.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4);
    const restTotal = sorted.slice(4).reduce((acc, [, v]) => acc + v, 0);
    const slices = top.map(([id, value], index) => ({
      name:
        id === "none"
          ? "غير مصنّفة"
          : accountById.get(Number(id))?.name || "حساب محذوف",
      value,
      pct: Math.round((value / total) * 100),
      color: DONUT_COLORS[index],
    }));
    if (restTotal > 0.005) {
      slices.push({
        name: "أخرى",
        value: restTotal,
        pct: Math.max(100 - slices.reduce((a, s) => a + s.pct, 0), 0),
        color: "#94a3b8",
      });
    }
    let acc = 0;
    const stops = slices
      .map((slice) => {
        const from = acc;
        acc += (slice.value / total) * 100;
        return `${slice.color} ${from}% ${acc}%`;
      })
      .join(", ");
    return { slices, stops };
  }, [invoices, accounts]);

  // ── يحتاج تصرفك ──────────────────────────────────────────────────
  const actionItems = useMemo(() => {
    const items = [];
    if (stats.overdueCount > 0) {
      items.push({
        tone: "rose",
        text: `${stats.overdueCount} فاتورة متأخرة بمجموع ${formatMoney(stats.overdueBalance)} — أقدمها منذ ${stats.oldestOverdueDays} يوماً. سدّد أو جدوِل.`,
      });
    }
    const dueSoon = invoices.filter(
      (invoice) =>
        moneyValue(invoice.balance_due) > 0 &&
        invoice.due_date &&
        invoice.due_date >= today &&
        invoice.due_date <= weekAhead,
    );
    if (dueSoon.length > 0) {
      const sum = dueSoon.reduce(
        (acc, invoice) => acc + moneyValue(invoice.balance_due),
        0,
      );
      items.push({
        tone: "amber",
        text: `${dueSoon.length} فاتورة تستحق خلال ٧ أيام بمجموع ${formatMoney(sum)}.`,
      });
    }
    if (stats.pendingCount > 0) {
      items.push({
        tone: "amber",
        text: `${stats.pendingCount} فاتورة بانتظار الاعتماد (لم يُسجَّل عليها أي سداد).`,
      });
    }
    // شبهة تكرار: نفس الرقم لنفس المورد أكثر من مرة.
    const seen = new Map();
    let dupCount = 0;
    for (const invoice of invoices) {
      if (!invoice.contact_id || !invoice.invoice_number) continue;
      const key = `${invoice.contact_id}::${String(invoice.invoice_number).toLowerCase()}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    for (const count of seen.values()) if (count > 1) dupCount += 1;
    if (dupCount > 0) {
      items.push({
        tone: "slate",
        text: `${dupCount} رقم فاتورة مكرر لنفس المورد — راجع تبويب الفواتير.`,
      });
    }
    return items;
  }, [invoices, stats, today, weekAhead]);

  const recentInvoices = useMemo(() => invoices.slice(0, 5), [invoices]);

  if (invoicesQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري تحميل لوحة القيادة…
      </div>
    );
  }

  const goInvoices = (statusKey) =>
    onNavigate?.("invoices", statusKey ? { status: statusKey } : {});

  return (
    <>
      {/* KPI row — ثابتة الأربع حسب المستند */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label={`مشتريات الشهر (${stats.monthCount} فاتورة)`}
          value={formatMoney(stats.monthTotal)}
          delta={
            stats.deltaPct === null
              ? null
              : {
                  direction: stats.deltaPct >= 0 ? "up" : "down",
                  text: `${Math.abs(stats.deltaPct)}% عن الشهر الماضي`,
                }
          }
          onClick={() => goInvoices()}
        />
        <KpiCard
          label="مستحق غير مدفوع"
          value={formatMoney(stats.openBalance)}
          sub={`على ${stats.openCount} فاتورة`}
          tone="amber"
          onClick={() => goInvoices()}
        />
        <KpiCard
          label="متأخر عن الاستحقاق"
          value={formatMoney(stats.overdueBalance)}
          sub={
            stats.overdueCount
              ? `${stats.overdueCount} فاتورة — أقدمها ${stats.oldestOverdueDays} يوماً`
              : "لا متأخرات 👌"
          }
          tone={stats.overdueCount ? "rose" : "emerald"}
          onClick={() => goInvoices("overdue")}
        />
        <KpiCard
          label="بانتظار الاعتماد"
          value={String(stats.pendingCount)}
          sub="فواتير بلا أي سداد"
          tone={stats.pendingCount ? "amber" : "emerald"}
          onClick={() => goInvoices("pending_payment")}
        />
      </div>

      {/* الرسم الشهري + التوزيع */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className={`${ws.glass} ${ws.card} p-4 lg:col-span-3`}>
          <div className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            المشتريات الشهرية — آخر ٨ أشهر
          </div>
          <div className="flex items-end gap-2 h-36 border-b border-slate-200 dark:border-white/10">
            {monthlyBars.map((bar) => (
              <div
                key={bar.month}
                className="flex-1 flex flex-col justify-end h-full"
                title={`${bar.label}: ${formatMoney(bar.value)}`}
              >
                <div
                  className={`rounded-t ${
                    bar.isCurrent
                      ? "bg-emerald-600 dark:bg-emerald-400"
                      : "bg-emerald-100 dark:bg-emerald-400/20"
                  }`}
                  style={{ height: `${Math.max(bar.pct, bar.value > 0 ? 4 : 0)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            {monthlyBars.map((bar) => (
              <span
                key={bar.month}
                className={`flex-1 text-center text-[10.5px] ${
                  bar.isCurrent
                    ? "font-bold text-emerald-700 dark:text-emerald-300"
                    : "text-slate-400 dark:text-white/35"
                }`}
              >
                {bar.label}
              </span>
            ))}
          </div>
        </div>

        <div className={`${ws.glass} ${ws.card} p-4 lg:col-span-2`}>
          <div className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            توزيع الإنفاق على الحسابات
          </div>
          {donut ? (
            <div className="flex items-center gap-4">
              <div
                className="w-28 h-28 rounded-full shrink-0"
                style={{
                  background: `conic-gradient(${donut.stops})`,
                  WebkitMask:
                    "radial-gradient(circle 36px, transparent 98%, #000 100%)",
                  mask: "radial-gradient(circle 36px, transparent 98%, #000 100%)",
                }}
                role="img"
                aria-label="رسم دائري لتوزيع الإنفاق على الحسابات"
              />
              <div className="grid gap-1.5 text-xs min-w-0">
                {donut.slices.map((slice) => (
                  <div key={slice.name} className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: slice.color }}
                    />
                    <span className="truncate text-slate-700 dark:text-white/75">
                      {slice.name}
                    </span>
                    <span className="text-slate-400 dark:text-white/40 shrink-0" dir="ltr">
                      {slice.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-white/45 py-8 text-center">
              لا مشتريات بعد.
            </div>
          )}
        </div>
      </div>

      {/* أحدث الفواتير + يحتاج تصرفك */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <div className={`${ws.glass} ${ws.card} p-4 lg:col-span-3`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              أحدث الفواتير
            </div>
            <button
              type="button"
              onClick={() => goInvoices()}
              className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center gap-1"
            >
              كل الفواتير
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-white/45 py-6 text-center">
              لا فواتير بعد — أنشئ أول فاتورة.
            </div>
          ) : (
            recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-slate-200 dark:border-white/10 last:border-0 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs text-slate-500 dark:text-white/45" dir="ltr">
                    {invoice.invoice_number}
                  </span>
                  <span className="text-slate-800 dark:text-white/80 mx-2">
                    {invoice.contact_name || invoice.supplier_name || "بدون مورد"}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold shrink-0 ${purchaseInvoiceStatusClass(invoice.computed_status)}`}
                >
                  {purchaseInvoiceStatusLabel(invoice.computed_status)}
                </span>
                <span className="font-bold tabular-nums shrink-0" dir="ltr">
                  {formatMoney(invoice.total_amount, invoice.currency)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className={`${ws.glass} ${ws.card} p-4 lg:col-span-2`}>
          <div className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-300" />
            يحتاج تصرفك
          </div>
          {actionItems.length === 0 ? (
            <div className="text-xs text-emerald-700 dark:text-emerald-300 py-6 text-center">
              كل شيء تحت السيطرة — لا متأخرات ولا معلقات. ✅
            </div>
          ) : (
            actionItems.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-2 py-2 border-b border-dashed border-slate-200 dark:border-white/10 last:border-0 text-xs text-slate-700 dark:text-white/75"
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    item.tone === "rose"
                      ? "bg-rose-500"
                      : item.tone === "amber"
                        ? "bg-amber-500"
                        : "bg-slate-400"
                  }`}
                />
                <span>{item.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* إجراءات سريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "فاتورة مشتريات جديدة",
            icon: Plus,
            onClick: () => onNavigate?.("invoices", { intent: "add" }),
          },
          {
            label: "تسجيل دفعة",
            icon: HandCoins,
            onClick: () => goInvoices(),
          },
          {
            label: "الموردون",
            icon: Contact,
            onClick: () => onNavigate?.("vendors"),
          },
          {
            label: "التقارير",
            icon: FileText,
            onClick: () => onNavigate?.("reports"),
          },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`${ws.glass} ${ws.card} p-4 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors text-right`}
          >
            <div className={`${ws.iconBox} w-10 h-10 shrink-0 text-emerald-700 dark:text-emerald-200`}>
              <action.icon className="w-5 h-5" />
            </div>
            <div className="font-semibold text-sm text-slate-900 dark:text-white">
              {action.label}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
