"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import PurchaseInvoiceModal, {
  PURCHASE_INVOICE_STATUS_OPTIONS,
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

export default function PurchasesInvoicesPanel({ employeeId, isAdmin }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const invoicesQuery = useAccountingPurchaseInvoices({
    employeeId,
    isAdmin,
    q,
    includeInactive,
  });
  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });

  const invoices = invoicesQuery.data || [];
  const contacts = contactsQuery.data || [];

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
    if (!status) return invoices;
    return invoices.filter((invoice) => invoice.computed_status === status);
  }, [invoices, status]);

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
        isSubmitting={createMut.isPending || updateMut.isPending}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}
