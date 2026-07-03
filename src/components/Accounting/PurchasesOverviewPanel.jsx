"use client";

import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building,
  CalendarClock,
  CheckCircle2,
  FileText,
  ListTree,
  Plus,
  Users,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import {
  purchaseInvoiceStatusClass,
  purchaseInvoiceStatusLabel,
} from "@/components/Accounting/PurchaseInvoiceModal";
import { useAccountingPurchaseInvoices } from "@/hooks/useAccountingPurchaseInvoices";
import { useAccountingContacts } from "@/hooks/useAccountingContacts";
import { useAccountingAccounts } from "@/hooks/useAccountingAccounts";
import { useAccountingBankAccounts } from "@/hooks/useAccountingBankAccounts";

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

function KpiCard({ label, value, sub, icon: Icon, tone = "slate", onClick }) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700 dark:text-rose-200"
      : tone === "emerald"
        ? "text-emerald-700 dark:text-emerald-200"
        : tone === "amber"
          ? "text-amber-700 dark:text-amber-200"
          : tone === "sky"
            ? "text-sky-700 dark:text-sky-200"
            : "text-slate-700 dark:text-white/80";
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-white/50">
            {label}
          </div>
          <div className={`text-xl font-bold mt-1 ${toneClass}`} dir="ltr">
            {value}
          </div>
          {sub ? (
            <div className="text-xs text-slate-500 dark:text-white/45 mt-1">
              {sub}
            </div>
          ) : null}
        </div>
        <div className={`${ws.iconBox} w-10 h-10 shrink-0 ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Wrapper>
  );
}

function QuickAction({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${ws.glass} ${ws.card} p-4 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors text-right`}
    >
      <div className={`${ws.iconBox} w-10 h-10 shrink-0 text-emerald-700 dark:text-emerald-200`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-semibold text-sm text-slate-900 dark:text-white">
        {label}
      </div>
    </button>
  );
}

export default function PurchasesOverviewPanel({
  employeeId,
  isAdmin,
  onNavigate,
}) {
  const invoicesQuery = useAccountingPurchaseInvoices({ employeeId, isAdmin });
  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const accountsQuery = useAccountingAccounts({ employeeId, isAdmin });
  const banksQuery = useAccountingBankAccounts({ employeeId, isAdmin });

  const invoices = invoicesQuery.data || [];
  const contacts = contactsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const banks = banksQuery.data || [];

  const today = todayRiyadh();
  const monthPrefix = today.slice(0, 7);
  const weekAhead = addDays(today, 7);

  const stats = useMemo(() => {
    const acc = {
      openBalance: 0,
      openCount: 0,
      overdueBalance: 0,
      overdueCount: 0,
      dueSoonBalance: 0,
      dueSoonCount: 0,
      paidThisMonth: 0,
      monthTotal: 0,
      monthCount: 0,
    };
    for (const invoice of invoices) {
      const balance = moneyValue(invoice.balance_due);
      const status = invoice.computed_status;
      if (balance > 0) {
        acc.openBalance += balance;
        acc.openCount += 1;
      }
      if (status === "overdue") {
        acc.overdueBalance += balance;
        acc.overdueCount += 1;
      }
      if (
        balance > 0 &&
        invoice.due_date &&
        invoice.due_date >= today &&
        invoice.due_date <= weekAhead
      ) {
        acc.dueSoonBalance += balance;
        acc.dueSoonCount += 1;
      }
      if (String(invoice.invoice_date || "").startsWith(monthPrefix)) {
        acc.paidThisMonth += moneyValue(invoice.paid_amount);
        acc.monthTotal += moneyValue(invoice.total_amount);
        acc.monthCount += 1;
      }
    }
    return acc;
  }, [invoices, today, weekAhead, monthPrefix]);

  const topAccounts = useMemo(() => {
    const byAccount = new Map();
    for (const invoice of invoices) {
      const key = invoice.expense_account_id
        ? String(invoice.expense_account_id)
        : "none";
      const entry = byAccount.get(key) || {
        name: invoice.expense_account_name || "غير مصنّفة",
        code: invoice.expense_account_code || "",
        total: 0,
        count: 0,
      };
      entry.total += moneyValue(invoice.total_amount);
      entry.count += 1;
      byAccount.set(key, entry);
    }
    const list = [...byAccount.values()].sort((a, b) => b.total - a.total);
    const max = list.length ? list[0].total : 0;
    return { list: list.slice(0, 5), max };
  }, [invoices]);

  const recentInvoices = useMemo(() => invoices.slice(0, 5), [invoices]);

  const overdueInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.computed_status === "overdue")
        .sort((a, b) => moneyValue(b.balance_due) - moneyValue(a.balance_due))
        .slice(0, 3),
    [invoices],
  );

  const activeContactsCount = useMemo(
    () => contacts.filter((c) => c.is_active !== false).length,
    [contacts],
  );
  const activeAccountsCount = useMemo(
    () => accounts.filter((a) => a.is_active !== false).length,
    [accounts],
  );
  const banksBookTotal = useMemo(
    () =>
      banks
        .filter((b) => b.is_active !== false)
        .reduce((sum, b) => sum + moneyValue(b.book_balance), 0),
    [banks],
  );

  if (invoicesQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري تحميل نظرة عامة على المشتريات…
      </div>
    );
  }

  return (
    <>
      {/* Alerts strip — only when something needs attention */}
      {overdueInvoices.length > 0 ? (
        <div
          className={`${ws.card} p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-rose-800 dark:text-rose-200 text-sm">
                {stats.overdueCount} فاتورة متأخرة برصيد{" "}
                <span dir="ltr">{formatMoney(stats.overdueBalance)}</span>
              </div>
              <div className="mt-2 space-y-1">
                {overdueInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2 flex-wrap"
                  >
                    <span dir="ltr">{invoice.invoice_number}</span>
                    <span>—</span>
                    <span className="truncate">{invoice.supplier_name || "مورد"}</span>
                    <span dir="ltr" className="font-bold">
                      {formatMoney(invoice.balance_due, invoice.currency)}
                    </span>
                    {invoice.due_date ? (
                      <span dir="ltr">استحقاق {invoice.due_date}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("invoices")}
              className={`${ws.btnNeutral} px-3 py-1.5 text-xs shrink-0`}
            >
              عرض الفواتير
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="رصيد غير مدفوع"
          value={formatMoney(stats.openBalance)}
          sub={`${stats.openCount} فاتورة مفتوحة`}
          icon={Banknote}
          tone="amber"
          onClick={() => onNavigate?.("invoices")}
        />
        <KpiCard
          label="متأخرة"
          value={formatMoney(stats.overdueBalance)}
          sub={`${stats.overdueCount} فاتورة`}
          icon={AlertTriangle}
          tone="rose"
          onClick={() => onNavigate?.("invoices")}
        />
        <KpiCard
          label="تستحق خلال 7 أيام"
          value={formatMoney(stats.dueSoonBalance)}
          sub={`${stats.dueSoonCount} فاتورة`}
          icon={CalendarClock}
          tone="sky"
          onClick={() => onNavigate?.("invoices")}
        />
        <KpiCard
          label="مشتريات هذا الشهر"
          value={formatMoney(stats.monthTotal)}
          sub={`${stats.monthCount} فاتورة — مدفوع ${formatMoney(stats.paidThisMonth)}`}
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickAction
          label="إنشاء فاتورة مشتريات"
          icon={Plus}
          onClick={() => onNavigate?.("invoices", { intent: "add" })}
        />
        <QuickAction
          label={`الموردون (${activeContactsCount})`}
          icon={Users}
          onClick={() => onNavigate?.("vendors")}
        />
        <QuickAction
          label={`شجرة الحسابات (${activeAccountsCount})`}
          icon={ListTree}
          onClick={() => onNavigate?.("accounts")}
        />
        <QuickAction
          label={`البنوك — ${formatMoney(banksBookTotal)}`}
          icon={Building}
          onClick={() => onNavigate?.("banks")}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent invoices */}
        <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
          <div
            className={`px-4 py-3 border-b ${ws.divider} flex items-center justify-between gap-3`}
          >
            <div className="font-bold text-slate-900 dark:text-white">
              أحدث الفواتير
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("invoices")}
              className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
            >
              عرض الكل
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <div className={`${ws.iconBox} w-12 h-12 mx-auto mb-3`}>
                <FileText className="w-5 h-5 text-slate-500 dark:text-white/50" />
              </div>
              <div className="text-sm text-slate-600 dark:text-white/60 mb-3">
                لا توجد فواتير بعد
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("invoices", { intent: "add" })}
                className={`${ws.btnPrimary} px-4 py-2`}
              >
                <Plus className="w-4 h-4" />
                إنشاء فاتورة
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="font-semibold text-sm text-slate-900 dark:text-white truncate"
                        dir="ltr"
                      >
                        {invoice.invoice_number}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${purchaseInvoiceStatusClass(invoice.computed_status)}`}
                      >
                        {purchaseInvoiceStatusLabel(invoice.computed_status)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5 truncate">
                      {invoice.supplier_name || "—"}
                      {invoice.expense_account_name
                        ? ` · ${invoice.expense_account_name}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div
                      className="font-bold text-sm text-slate-900 dark:text-white"
                      dir="ltr"
                    >
                      {formatMoney(invoice.total_amount, invoice.currency)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-white/45" dir="ltr">
                      {invoice.invoice_date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top expense accounts */}
        <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
          <div
            className={`px-4 py-3 border-b ${ws.divider} flex items-center justify-between gap-3`}
          >
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                أعلى حسابات المصروفات
              </div>
              <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                إجمالي الفواتير حسب حساب المصروف من شجرة الحسابات.
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.("accounts")}
              className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
            >
              الشجرة
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          {topAccounts.list.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-600 dark:text-white/60">
              لا توجد بيانات بعد — صنّف الفواتير على حسابات المصروفات لتظهر هنا.
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {topAccounts.list.map((entry) => {
                const pct = topAccounts.max
                  ? Math.max(4, Math.round((entry.total / topAccounts.max) * 100))
                  : 0;
                return (
                  <div key={`${entry.code}-${entry.name}`}>
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <div className="min-w-0 flex items-center gap-2">
                        {entry.code ? (
                          <span
                            className="font-mono text-[11px] text-slate-500 dark:text-white/45"
                            dir="ltr"
                          >
                            {entry.code}
                          </span>
                        ) : null}
                        <span className="font-semibold text-slate-800 dark:text-white/85 truncate">
                          {entry.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-white/40">
                          ({entry.count})
                        </span>
                      </div>
                      <span
                        className="font-bold text-slate-900 dark:text-white shrink-0"
                        dir="ltr"
                      >
                        {formatMoney(entry.total)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/80 dark:bg-emerald-400/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
