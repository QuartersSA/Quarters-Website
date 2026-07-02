"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import PurchaseInvoiceModal, {
  PURCHASE_INVOICE_STATUS_OPTIONS,
  buildExpenseAccountOptions,
  purchaseInvoiceStatusClass,
  purchaseInvoiceStatusLabel,
} from "@/components/Accounting/PurchaseInvoiceModal";
import {
  useAccountingPurchaseInvoices,
  useCreateAccountingPurchaseInvoice,
  useDeleteAccountingPurchaseInvoice,
  useUpdateAccountingPurchaseInvoice,
} from "@/hooks/useAccountingPurchaseInvoices";
import { useAccountingContacts } from "@/hooks/useAccountingContacts";
import { useAccountingAccounts } from "@/hooks/useAccountingAccounts";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "كل الحالات" },
  ...PURCHASE_INVOICE_STATUS_OPTIONS,
];

const countBadgeClass =
  "inline-flex min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-white/75";

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value, currency = "SAR") {
  const number = moneyValue(value);
  return `${number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || "SAR"}`;
}

function formatDate(value) {
  if (!value) return "—";
  return String(value);
}

function statusIcon(status) {
  if (status === "paid") return CheckCircle2;
  if (status === "partial_paid") return Banknote;
  if (status === "overdue") return AlertTriangle;
  if (status === "pending_payment") return Clock3;
  return FileText;
}

function SummaryCard({ label, value, icon: Icon, tone = "slate", suffix }) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700 dark:text-rose-200"
      : tone === "emerald"
        ? "text-emerald-700 dark:text-emerald-200"
        : tone === "amber"
          ? "text-amber-700 dark:text-amber-200"
          : "text-slate-700 dark:text-white/80";
  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-white/50">
            {label}
          </div>
          <div className={`text-xl font-bold mt-1 ${toneClass}`} dir="ltr">
            {value}
          </div>
          {suffix ? (
            <div className="text-xs text-slate-500 dark:text-white/45 mt-1">
              {suffix}
            </div>
          ) : null}
        </div>
        <div className={`${ws.iconBox} w-10 h-10 shrink-0 ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const Icon = statusIcon(status);
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${purchaseInvoiceStatusClass(status)}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {purchaseInvoiceStatusLabel(status)}
    </span>
  );
}

// Quick payment: bump paid_amount without opening the full edit form.
// PUT requires the complete invoice payload, so the modal replays the
// row's fields and only changes the paid amount.
function RecordPaymentModal({ invoice, isSubmitting, onClose, onSubmit }) {
  const balance = Math.max(
    moneyValue(invoice?.total_amount) - moneyValue(invoice?.paid_amount),
    0,
  );
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!invoice) return;
    setAmount(balance.toFixed(2));
    // Seed with the outstanding balance each time a new invoice opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  if (!invoice || typeof document === "undefined") return null;

  const paymentValue = moneyValue(amount);
  const valid = paymentValue > 0 && paymentValue <= balance + 0.005;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!valid || isSubmitting) return;
    const newPaid =
      Math.round((moneyValue(invoice.paid_amount) + paymentValue) * 100) / 100;
    onSubmit({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      contact_id: invoice.contact_id || null,
      expense_account_id: invoice.expense_account_id || null,
      supplier_name: invoice.supplier_name || null,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || null,
      currency: invoice.currency || "SAR",
      subtotal_amount: invoice.subtotal_amount,
      tax_amount: invoice.tax_amount,
      total_amount: moneyValue(invoice.total_amount),
      paid_amount: Math.min(newPaid, moneyValue(invoice.total_amount)),
      workflow_status: invoice.workflow_status || "pending_payment",
      notes: invoice.notes || null,
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
      <div className={`${ws.glass} ${ws.card} w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}>
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                تسجيل دفعة
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5" dir="ltr">
                {invoice.invoice_number}
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

        <div className={`${ws.glassSoft} ${ws.card} p-3 mb-4 grid grid-cols-3 gap-2 text-center`}>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">المبلغ</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5" dir="ltr">
              {formatMoney(invoice.total_amount, invoice.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">المدفوع</div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-200 mt-0.5" dir="ltr">
              {formatMoney(invoice.paid_amount, invoice.currency)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">المتبقي</div>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-200 mt-0.5" dir="ltr">
              {formatMoney(balance, invoice.currency)}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
            مبلغ الدفعة <span className="text-rose-700 dark:text-rose-300">*</span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={`${ws.input} px-3 py-2.5 text-right`}
            step="0.01"
            min="0"
            max={balance}
            dir="ltr"
            autoFocus
          />
          {paymentValue > balance + 0.005 ? (
            <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
              الدفعة أكبر من الرصيد المتبقي.
            </div>
          ) : null}

          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={!valid || isSubmitting}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              تسجيل الدفعة
            </button>
            <button
              type="button"
              onClick={() => setAmount(balance.toFixed(2))}
              className={`${ws.btnNeutral} px-3 py-2 text-xs`}
            >
              سداد كامل المتبقي
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function PurchasesInvoicesPanel({
  employeeId,
  isAdmin,
  autoOpenAdd = false,
  onIntentConsumed,
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);

  // Quick-action deep link (?intent=add) opens the create modal once.
  useEffect(() => {
    if (!autoOpenAdd) return;
    setShowAdd(true);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd]);

  const invoicesQuery = useAccountingPurchaseInvoices({
    employeeId,
    isAdmin,
    q,
    includeInactive,
  });
  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const accountsQuery = useAccountingAccounts({ employeeId, isAdmin });

  const invoices = invoicesQuery.data || [];
  const contacts = contactsQuery.data || [];
  const accounts = accountsQuery.data || [];

  const accountFilterOptions = useMemo(() => {
    const options = buildExpenseAccountOptions(accounts);
    return [
      { value: "", label: "كل الحسابات" },
      { value: "none", label: "غير مصنّفة" },
      ...options.filter((option) => option.value !== ""),
    ];
  }, [accounts]);

  const createMut = useCreateAccountingPurchaseInvoice();
  const updateMut = useUpdateAccountingPurchaseInvoice();
  const deleteMut = useDeleteAccountingPurchaseInvoice();

  const counts = useMemo(() => {
    const initial = {
      all: invoices.length,
      new: 0,
      pending_payment: 0,
      partial_paid: 0,
      paid: 0,
      overdue: 0,
    };
    return invoices.reduce((acc, invoice) => {
      if (acc[invoice.computed_status] !== undefined) {
        acc[invoice.computed_status] += 1;
      }
      return acc;
    }, initial);
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = invoices;
    if (status) {
      list = list.filter((invoice) => invoice.computed_status === status);
    }
    if (accountFilter === "none") {
      list = list.filter((invoice) => !invoice.expense_account_id);
    } else if (accountFilter) {
      list = list.filter(
        (invoice) => String(invoice.expense_account_id || "") === accountFilter,
      );
    }
    if (dateFrom) {
      list = list.filter(
        (invoice) => (invoice.invoice_date || "") >= dateFrom,
      );
    }
    if (dateTo) {
      list = list.filter((invoice) => (invoice.invoice_date || "") <= dateTo);
    }
    return list;
  }, [invoices, status, accountFilter, dateFrom, dateTo]);

  const handleExport = (kind) => {
    const columns = [
      { header: "رقم الفاتورة", accessor: (row) => row.invoice_number },
      { header: "المورد", accessor: (row) => row.supplier_name || "" },
      {
        header: "الحساب",
        accessor: (row) =>
          row.expense_account_name
            ? `${row.expense_account_code || ""} ${row.expense_account_name}`.trim()
            : "غير مصنّفة",
      },
      { header: "التاريخ", accessor: (row) => row.invoice_date || "" },
      { header: "الاستحقاق", accessor: (row) => row.due_date || "" },
      {
        header: "الحالة",
        accessor: (row) => purchaseInvoiceStatusLabel(row.computed_status),
      },
      { header: "العملة", accessor: (row) => row.currency || "SAR" },
      {
        header: "المبلغ",
        accessor: (row) => moneyValue(row.total_amount).toFixed(2),
      },
      {
        header: "المدفوع",
        accessor: (row) => moneyValue(row.paid_amount).toFixed(2),
      },
      {
        header: "الرصيد",
        accessor: (row) => moneyValue(row.balance_due).toFixed(2),
      },
    ];
    const title = "فواتير المشتريات";
    if (kind === "excel") {
      exportToExcelHTML(filtered, "purchase-invoices", columns, title);
    } else {
      exportToPDF(filtered, "purchase-invoices", columns, title);
    }
  };

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, invoice) => {
        acc.total += moneyValue(invoice.total_amount);
        acc.paid += moneyValue(invoice.paid_amount);
        acc.balance += moneyValue(invoice.balance_due);
        if (invoice.computed_status === "overdue") {
          acc.overdue += moneyValue(invoice.balance_due);
        }
        return acc;
      },
      { total: 0, paid: 0, balance: 0, overdue: 0 },
    );
  }, [filtered]);

  const handleSubmit = (payload) => {
    if (editing) {
      updateMut.mutate(payload, {
        onSuccess: () => setEditing(null),
      });
    } else {
      createMut.mutate(payload, {
        onSuccess: () => setShowAdd(false),
      });
    }
  };

  const handleDelete = (invoice) => {
    const ok = window.confirm(
      `إيقاف فاتورة "${invoice.invoice_number}"؟ يمكنك عرضها لاحقاً من خيار عرض الموقوفة.`,
    );
    if (!ok) return;
    deleteMut.mutate({ id: invoice.id, force: false });
  };

  return (
    <>
      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث برقم الفاتورة أو المورد"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <div className="min-w-[190px]">
            <GlassSelect
              value={status}
              onChange={setStatus}
              options={STATUS_FILTER_OPTIONS}
              placeholder="كل الحالات"
              buttonClassName="text-sm py-2 px-3"
            />
          </div>
          <div className="min-w-[210px]">
            <GlassSelect
              value={accountFilter}
              onChange={setAccountFilter}
              options={accountFilterOptions}
              placeholder="كل الحسابات"
              buttonClassName="text-sm py-2 px-3"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75 shrink-0">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="accent-emerald-500"
            />
            عرض الموقوفة
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => invoicesQuery.refetch()}
            className={`${ws.btnNeutral} px-4 py-2`}
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${ws.btnPrimary} px-4 py-2`}
          >
            <Plus className="w-4 h-4" />
            إنشاء فاتورة مشتريات
          </button>
        </div>

        {/* Second toolbar row: date range + export */}
        <div className={`flex items-center gap-3 flex-wrap mt-3 pt-3 border-t ${ws.divider}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-white/55">من</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className={`${ws.input} px-3 py-1.5 text-sm w-auto`}
            />
            <span className="text-xs text-slate-600 dark:text-white/55">إلى</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className={`${ws.input} px-3 py-1.5 text-sm w-auto`}
            />
            {dateFrom || dateTo ? (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-xs text-slate-500 hover:text-red-600 dark:text-white/45 dark:hover:text-red-300"
              >
                مسح
              </button>
            ) : null}
          </div>
          <div className="flex-1" />
          <div className="text-xs text-slate-500 dark:text-white/45">
            {filtered.length} فاتورة معروضة
          </div>
          <button
            type="button"
            onClick={() => handleExport("excel")}
            className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
            disabled={filtered.length === 0}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
            disabled={filtered.length === 0}
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className={`${ws.glassSoft} ${ws.card} p-2 overflow-x-auto`}>
        <div className="flex items-center gap-1 min-w-max">
          <button
            type="button"
            onClick={() => setStatus("")}
            className={`${ws.segBtn} ${!status ? ws.segActive : ws.segInactive} text-sm`}
          >
            الكل
            <span className={countBadgeClass}>{counts.all}</span>
          </button>
          {PURCHASE_INVOICE_STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatus(option.value)}
              className={`${ws.segBtn} ${
                status === option.value ? ws.segActive : ws.segInactive
              } text-sm`}
            >
              {option.label}
              <span className={countBadgeClass}>{counts[option.value] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard
          label="إجمالي الفواتير"
          value={formatMoney(totals.total, "SAR")}
          icon={FileText}
        />
        <SummaryCard
          label="المدفوع"
          value={formatMoney(totals.paid, "SAR")}
          icon={CheckCircle2}
          tone="emerald"
        />
        <SummaryCard
          label="الرصيد المتبقي"
          value={formatMoney(totals.balance, "SAR")}
          icon={Banknote}
          tone="amber"
        />
        <SummaryCard
          label="متأخر"
          value={formatMoney(totals.overdue, "SAR")}
          icon={AlertTriangle}
          tone="rose"
          suffix={`${counts.overdue || 0} فاتورة`}
        />
      </div>

      {invoicesQuery.isLoading ? (
        <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
          جاري تحميل فواتير المشتريات…
        </div>
      ) : invoicesQuery.error ? (
        <div className={`${ws.glass} ${ws.card} p-6 text-red-700 dark:text-red-300 text-sm`}>
          فشل تحميل فواتير المشتريات. حاول مرة أخرى.
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
          <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
            <FileText className="w-6 h-6 text-slate-500 dark:text-white/50" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white">
            لا توجد فواتير مشتريات
          </div>
          <div className="text-sm text-slate-600 dark:text-white/60 mt-1 mb-4">
            أنشئ فاتورة مشتريات جديدة، ثم حدّث المدفوع وتاريخ الاستحقاق لتظهر الحالة تلقائياً.
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${ws.btnPrimary} px-4 py-2`}
          >
            <Plus className="w-4 h-4" />
            إنشاء فاتورة مشتريات
          </button>
        </div>
      ) : (
        <>
          <div className={`${ws.glass} ${ws.card} overflow-hidden hidden lg:block`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100/80 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10">
                  <tr className="text-slate-500 dark:text-white/50">
                    <th className="text-right font-semibold px-4 py-3">رقم</th>
                    <th className="text-right font-semibold px-4 py-3">المورد</th>
                    <th className="text-right font-semibold px-4 py-3">الحساب</th>
                    <th className="text-right font-semibold px-4 py-3">التاريخ</th>
                    <th className="text-right font-semibold px-4 py-3">الاستحقاق</th>
                    <th className="text-right font-semibold px-4 py-3">الحالة</th>
                    <th className="text-left font-semibold px-4 py-3">المبلغ</th>
                    <th className="text-left font-semibold px-4 py-3">المدفوع</th>
                    <th className="text-left font-semibold px-4 py-3">الرصيد</th>
                    <th className="text-center font-semibold px-4 py-3">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {filtered.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white" dir="ltr">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-white/70">
                        {invoice.supplier_name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {invoice.expense_account_id ? (
                          <span
                            className={`${ws.pill} bg-amber-100 dark:bg-amber-400/10 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-400/25 whitespace-nowrap`}
                            title={invoice.expense_account_code}
                          >
                            {invoice.expense_account_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-white/35 text-xs">
                            غير مصنّفة
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-white/65" dir="ltr">
                        {formatDate(invoice.invoice_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-white/65" dir="ltr">
                        {formatDate(invoice.due_date)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={invoice.computed_status} />
                      </td>
                      <td className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white" dir="ltr">
                        {formatMoney(invoice.total_amount, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-left text-slate-700 dark:text-white/70" dir="ltr">
                        {formatMoney(invoice.paid_amount, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white" dir="ltr">
                        {formatMoney(invoice.balance_due, invoice.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {moneyValue(invoice.balance_due) > 0 &&
                          invoice.is_active !== false ? (
                            <button
                              type="button"
                              onClick={() => setPaying(invoice)}
                              className={`${ws.iconButton} w-9 h-9 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:border-emerald-200 dark:hover:border-emerald-500/30 hover:text-emerald-700 dark:hover:text-emerald-200`}
                              title="تسجيل دفعة"
                            >
                              <HandCoins className="w-4 h-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setEditing(invoice)}
                            className={`${ws.iconButton} w-9 h-9`}
                            title="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(invoice)}
                            className={`${ws.iconButton} w-9 h-9 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 hover:text-red-700 dark:hover:text-red-200`}
                            title="إيقاف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:hidden space-y-3">
            {filtered.map((invoice) => (
              <div key={invoice.id} className={`${ws.glass} ${ws.card} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate" dir="ltr">
                      {invoice.invoice_number}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-white/60 mt-1 truncate">
                      {invoice.supplier_name || "—"}
                    </div>
                    {invoice.expense_account_id ? (
                      <span
                        className={`${ws.pill} bg-amber-100 dark:bg-amber-400/10 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-400/25 mt-2 inline-flex`}
                      >
                        {invoice.expense_account_name}
                      </span>
                    ) : null}
                  </div>
                  <StatusPill status={invoice.computed_status} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-white/45">التاريخ</div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-1" dir="ltr">
                      {formatDate(invoice.invoice_date)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-white/45">الاستحقاق</div>
                    <div className="font-semibold text-slate-900 dark:text-white mt-1" dir="ltr">
                      {formatDate(invoice.due_date)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-white/45">المبلغ</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1" dir="ltr">
                      {formatMoney(invoice.total_amount, invoice.currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-white/45">الرصيد</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-1" dir="ltr">
                      {formatMoney(invoice.balance_due, invoice.currency)}
                    </div>
                  </div>
                </div>

                <div className={`flex items-center gap-2 mt-4 pt-3 border-t ${ws.divider}`}>
                  {moneyValue(invoice.balance_due) > 0 &&
                  invoice.is_active !== false ? (
                    <button
                      type="button"
                      onClick={() => setPaying(invoice)}
                      className={`${ws.btnPrimary} px-3 py-2 text-xs`}
                    >
                      <HandCoins className="w-4 h-4" />
                      تسجيل دفعة
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setEditing(invoice)}
                    className={`${ws.btnNeutral} px-3 py-2 text-xs`}
                  >
                    <Pencil className="w-4 h-4" />
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(invoice)}
                    className={`${ws.btnNeutral} px-3 py-2 text-xs hover:text-red-700 dark:hover:text-red-200`}
                  >
                    <Trash2 className="w-4 h-4" />
                    إيقاف
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PurchaseInvoiceModal
        open={showAdd || !!editing}
        invoice={editing}
        contacts={contacts}
        accounts={accounts}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      {paying ? (
        <RecordPaymentModal
          invoice={paying}
          isSubmitting={updateMut.isPending}
          onClose={() => setPaying(null)}
          onSubmit={(payload) =>
            updateMut.mutate(payload, { onSuccess: () => setPaying(null) })
          }
        />
      ) : null}
    </>
  );
}
