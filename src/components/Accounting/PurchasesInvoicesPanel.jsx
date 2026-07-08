"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Save,
  ScanEye,
  Search,
  Trash2,
  X,
} from "lucide-react";
import useUpload from "@/utils/useUpload";
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
import { useAccountingBankAccounts } from "@/hooks/useAccountingBankAccounts";
import { useQuery } from "@tanstack/react-query";
import { authedFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import RecurringInvoicesModal from "@/components/Accounting/RecurringInvoicesModal";
import Supplier360Modal from "@/components/Accounting/Supplier360Modal";

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
function RecordPaymentModal({
  invoice,
  bankAccounts = [],
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const balance = Math.max(
    moneyValue(invoice?.total_amount) - moneyValue(invoice?.paid_amount),
    0,
  );
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  // إيصال الدفع — اختياري.
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const receiptInputRef = useRef(null);
  const [upload] = useUpload();

  useEffect(() => {
    if (!invoice) return;
    setAmount(balance.toFixed(2));
    setBankAccountId(
      invoice.paid_bank_account_id ? String(invoice.paid_bank_account_id) : "",
    );
    setReceiptUrl(invoice.payment_receipt_url || "");
    setReceiptName("");
    setReceiptUploading(false);
    // Seed with the outstanding balance each time a new invoice opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

  const handleReceiptPicked = async (fileArg) => {
    if (!fileArg) return;
    setReceiptUploading(true);
    try {
      const result = await upload({ file: fileArg, unoptimized: true });
      if (result?.error) {
        alert(`فشل رفع الإيصال: ${result.error}`);
        return;
      }
      setReceiptUrl(result.url || "");
      setReceiptName(fileArg.name || "");
    } finally {
      setReceiptUploading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };

  const bankOptions = useMemo(
    () => [
      { value: "", label: "بدون تحديد حساب" },
      ...bankAccounts
        .filter((account) => account.is_active !== false)
        .map((account) => ({
          value: String(account.id),
          label: account.bank_name
            ? `${account.name} — ${account.bank_name}`
            : account.name,
        })),
    ],
    [bankAccounts],
  );

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
      paid_bank_account_id: bankAccountId || null,
      payment_receipt_url: receiptUrl || null,
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

          <div className="text-xs text-slate-600 dark:text-white/55 mb-1 mt-3">
            الحساب البنكي المدفوع منه
          </div>
          <GlassSelect
            value={bankAccountId}
            onChange={setBankAccountId}
            options={bankOptions}
            placeholder="بدون تحديد حساب"
            buttonClassName="text-sm py-2.5 px-3"
          />

          <div className="text-xs text-slate-600 dark:text-white/55 mb-1 mt-3">
            إيصال الدفع{" "}
            <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
          </div>
          {receiptUrl ? (
            <div
              className={`${ws.glassSoft} ${ws.card} px-3 py-2 flex items-center justify-between gap-2`}
            >
              <div className="flex items-center gap-2 min-w-0 text-xs text-slate-700 dark:text-white/70">
                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate" dir="ltr">
                  {receiptName || "إيصال مرفق"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${ws.btnNeutral} px-2.5 py-1.5 text-[11px]`}
                >
                  <ExternalLink className="w-3 h-3" />
                  فتح
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl("");
                    setReceiptName("");
                  }}
                  className={`${ws.iconButton} w-7 h-7 hover:text-red-700 dark:hover:text-red-200`}
                  title="إزالة الإيصال"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={receiptUploading}
              onClick={() => receiptInputRef.current?.click()}
              className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50`}
            >
              {receiptUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Paperclip className="w-3.5 h-3.5" />
              )}
              {receiptUploading ? "جاري الرفع…" : "إرفاق إيصال الدفع"}
            </button>
          )}
          <input
            ref={receiptInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) =>
              handleReceiptPicked(event?.target?.files?.[0])
            }
            className="hidden"
          />

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
  initialStatus = "",
  onIntentConsumed,
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [accountFilter, setAccountFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  // المعاينة الجانبية: نقرة على الصف تفتح درجاً دون مغادرة الجدول.
  const [preview, setPreview] = useState(null);
  // تحديد جماعي: تصدير المحدد فقط.
  const [selected, setSelected] = useState(() => new Set());
  // صف نشط للتنقل بالأسهم (↑↓ ثم Enter للمعاينة).
  const [activeIdx, setActiveIdx] = useState(-1);
  // رقائق فلترة محفوظة على هذا الجهاز.
  const [savedFilters, setSavedFilters] = useState([]);
  // قوالب الفواتير المتكررة + بطاقة المورد 360°.
  const [showRecurring, setShowRecurring] = useState(false);
  const [supplier360, setSupplier360] = useState(null);
  const searchRef = React.useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("purchInvSavedFilters");
      if (raw) setSavedFilters(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const persistSavedFilters = (list) => {
    setSavedFilters(list);
    try {
      localStorage.setItem("purchInvSavedFilters", JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const hasActiveFilters =
    !!q || !!status || !!accountFilter || !!branchFilter || !!dateFrom || !!dateTo;

  const saveCurrentFilter = () => {
    const name = window.prompt("اسم الفلتر المحفوظ:");
    if (!name || !name.trim()) return;
    const next = [
      ...savedFilters.filter((f) => f.name !== name.trim()),
      { name: name.trim(), q, status, accountFilter, branchFilter, dateFrom, dateTo },
    ];
    persistSavedFilters(next);
  };

  const applySavedFilter = (filter) => {
    setQ(filter.q || "");
    setStatus(filter.status || "");
    setAccountFilter(filter.accountFilter || "");
    setBranchFilter(filter.branchFilter || "");
    setDateFrom(filter.dateFrom || "");
    setDateTo(filter.dateTo || "");
  };

  const removeSavedFilter = (name) => {
    persistSavedFilters(savedFilters.filter((f) => f.name !== name));
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
  const bankAccountsQuery = useAccountingBankAccounts({ employeeId, isAdmin });
  const branchesQuery = useQuery({
    queryKey: queryKeys.branches(),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const response = await authedFetch("/api/branches");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل تحميل الفروع");
      return Array.isArray(data?.branches) ? data.branches : [];
    },
  });

  const invoices = invoicesQuery.data || [];
  const contacts = contactsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const bankAccounts = bankAccountsQuery.data || [];
  const branches = branchesQuery.data || [];

  // الخط الزمني للفاتورة المعروضة في الدرج — من سجل التدقيق.
  const previewLogQuery = useQuery({
    queryKey: ["purchase-audit-log", "invoice", preview?.id],
    enabled: !!preview?.id,
    queryFn: async () => {
      const response = await authedFetch(
        `/api/accounting/purchase-audit-log?entity_type=invoice&entity_id=${preview.id}&limit=20`,
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "فشل تحميل السجل");
      return Array.isArray(data?.entries) ? data.entries : [];
    },
  });
  const previewLog = previewLogQuery.data || [];

  const accountFilterOptions = useMemo(() => {
    const options = buildExpenseAccountOptions(accounts);
    return [
      { value: "", label: "كل الحسابات" },
      { value: "none", label: "غير مصنّفة" },
      ...options.filter((option) => option.value !== ""),
    ];
  }, [accounts]);

  // Prior-transaction count per contact, shown under the supplier
  // select inside the editor ("N معاملة سابقة").
  const contactStats = useMemo(() => {
    const counts = {};
    for (const invoice of invoices) {
      if (!invoice.contact_id) continue;
      const key = String(invoice.contact_id);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [invoices]);

  const createMut = useCreateAccountingPurchaseInvoice();
  const updateMut = useUpdateAccountingPurchaseInvoice();
  const deleteMut = useDeleteAccountingPurchaseInvoice();

  const counts = useMemo(() => {
    const initial = {
      all: invoices.length,
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
    if (branchFilter === "none") {
      list = list.filter((invoice) => !invoice.branch_id);
    } else if (branchFilter) {
      list = list.filter(
        (invoice) => String(invoice.branch_id || "") === branchFilter,
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
  }, [invoices, status, accountFilter, branchFilter, dateFrom, dateTo]);

  // اختصارات لوحة المفاتيح (حسب المستند): N فاتورة جديدة، / بحث،
  // ↑↓ تنقل بين الصفوف، Enter معاينة، Esc يغلق المعاينة.
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (event.key === "Escape") {
        setPreview(null);
        return;
      }
      if (typing || showAdd || editing || paying || showRecurring || supplier360)
        return;
      if (event.key === "/" ) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        setShowAdd(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIdx((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter") {
        if (activeIdx >= 0 && filtered[activeIdx]) {
          event.preventDefault();
          setPreview(filtered[activeIdx]);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, activeIdx, showAdd, editing, paying, showRecurring, supplier360]);

  const handleExport = (kind, rowsOverride = null) => {
    const rows = rowsOverride || filtered;
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
      { header: "الفرع", accessor: (row) => row.branch_name || "" },
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
    const title = rowsOverride
      ? `فواتير المشتريات — المحدد (${rows.length})`
      : "فواتير المشتريات";
    if (kind === "excel") {
      exportToExcelHTML(rows, "purchase-invoices", columns, title);
    } else {
      exportToPDF(rows, "purchase-invoices", columns, title);
    }
  };

  const exportSelected = (kind) => {
    const rows = filtered.filter((invoice) => selected.has(invoice.id));
    if (rows.length === 0) return;
    handleExport(kind, rows);
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
              ref={searchRef}
              type="text"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث برقم الفاتورة أو المورد — اختصار /"
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
          {branches.length > 0 ? (
            <div className="w-40 shrink-0">
              <GlassSelect
                value={branchFilter}
                onChange={setBranchFilter}
                options={[
                  { value: "", label: "كل الفروع" },
                  { value: "none", label: "بدون فرع" },
                  ...branches.map((branch) => ({
                    value: String(branch.id),
                    label: branch.name,
                  })),
                ]}
                placeholder="كل الفروع"
                buttonClassName="text-sm py-2 px-3"
              />
            </div>
          ) : null}
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
            onClick={() => setShowRecurring(true)}
            className={`${ws.btnNeutral} px-4 py-2`}
            title="قوالب تتحول تلقائياً لفواتير كل شهر"
          >
            <Repeat className="w-4 h-4" />
            متكررة
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

        {/* رقائق الفلاتر المحفوظة — أي تركيبة فلاتر تصبح نقرة واحدة */}
        {savedFilters.length > 0 || hasActiveFilters ? (
          <div className={`flex items-center gap-2 flex-wrap mt-3 pt-3 border-t ${ws.divider}`}>
            <span className="text-[11px] text-slate-500 dark:text-white/45 shrink-0">
              فلاتر محفوظة:
            </span>
            {savedFilters.map((filter) => (
              <span
                key={filter.name}
                className={`${ws.pill} bg-emerald-50 dark:bg-emerald-400/10 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25 inline-flex items-center gap-1.5`}
              >
                <button
                  type="button"
                  onClick={() => applySavedFilter(filter)}
                  className="font-semibold"
                  title="تطبيق الفلتر"
                >
                  {filter.name}
                </button>
                <button
                  type="button"
                  onClick={() => removeSavedFilter(filter.name)}
                  className="opacity-60 hover:opacity-100"
                  title="حذف الفلتر المحفوظ"
                  aria-label={`حذف فلتر ${filter.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={saveCurrentFilter}
                className={`${ws.btnNeutral} px-2.5 py-1 text-[11px]`}
              >
                <Plus className="w-3 h-3" />
                حفظ الفلتر الحالي
              </button>
            ) : null}
          </div>
        ) : null}
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
                    <th className="px-3 py-3 w-9">
                      <input
                        type="checkbox"
                        aria-label="تحديد الكل"
                        className="accent-emerald-500"
                        checked={
                          filtered.length > 0 &&
                          filtered.every((invoice) => selected.has(invoice.id))
                        }
                        onChange={(event) => {
                          setSelected(
                            event.target.checked
                              ? new Set(filtered.map((invoice) => invoice.id))
                              : new Set(),
                          );
                        }}
                      />
                    </th>
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
                  {filtered.map((invoice, index) => (
                    <tr
                      key={invoice.id}
                      onClick={(event) => {
                        // الأزرار والروابط وخانات التحديد لا تفتح المعاينة.
                        if (event.target.closest("button, a, input")) return;
                        setActiveIdx(index);
                        setPreview(invoice);
                      }}
                      className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
                        index === activeIdx
                          ? "bg-emerald-50/60 dark:bg-emerald-400/[0.06]"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label="تحديد الفاتورة"
                          className="accent-emerald-500"
                          checked={selected.has(invoice.id)}
                          onChange={() => toggleSelect(invoice.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5" dir="ltr">
                          <span>{invoice.invoice_number}</span>
                          {invoice.attachment_url ? (
                            <a
                              href={invoice.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-emerald-600 dark:text-white/40 dark:hover:text-emerald-300"
                              title="عرض الفاتورة المرفقة"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                            </a>
                          ) : null}
                        </div>
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
        bankAccounts={bankAccounts}
        branches={branches}
        contactStats={contactStats}
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
          bankAccounts={bankAccounts}
          isSubmitting={updateMut.isPending}
          onClose={() => setPaying(null)}
          onSubmit={(payload) =>
            updateMut.mutate(payload, { onSuccess: () => setPaying(null) })
          }
        />
      ) : null}

      {/* شريط التحديد الجماعي */}
      {selected.size > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl px-4 py-2.5"
              dir="rtl"
            >
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {selected.size} فاتورة محددة
              </span>
              <button
                type="button"
                onClick={() => exportSelected("excel")}
                className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                تصدير Excel
              </button>
              <button
                type="button"
                onClick={() => exportSelected("pdf")}
                className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
              >
                <Download className="w-3.5 h-3.5" />
                تصدير PDF
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-500 hover:text-red-600 dark:text-white/50 dark:hover:text-red-300"
              >
                إلغاء التحديد
              </button>
            </div>,
            document.body,
          )
        : null}

      {/* المعاينة الجانبية — مراجعة سريعة دون مغادرة الجدول */}
      {preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[950]"
              dir="rtl"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setPreview(null);
              }}
            >
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onMouseDown={() => setPreview(null)}
                aria-hidden="true"
              />
              <aside className="absolute inset-y-0 left-0 w-full sm:w-[430px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/10 shadow-2xl overflow-y-auto">
                <div className={`sticky top-0 bg-white dark:bg-slate-950 px-5 py-4 border-b ${ws.divider} flex items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white font-mono" dir="ltr">
                      {preview.invoice_number}
                    </div>
                    {preview.contact_id ? (
                      <button
                        type="button"
                        onClick={() => {
                          const contact = contacts.find(
                            (c) => Number(c.id) === Number(preview.contact_id),
                          );
                          if (contact) setSupplier360(contact);
                        }}
                        className="text-xs text-emerald-700 dark:text-emerald-300 hover:underline truncate mt-0.5 inline-flex items-center gap-1"
                        title="بطاقة المورد 360°"
                      >
                        <ScanEye className="w-3 h-3 shrink-0" />
                        {preview.contact_name || preview.supplier_name}
                      </button>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-white/50 truncate mt-0.5">
                        {preview.supplier_name || "بدون مورد"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill status={preview.computed_status} />
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className={`${ws.iconButton} w-9 h-9`}
                      aria-label="إغلاق المعاينة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">التاريخ</div>
                      <div className="font-semibold" dir="ltr">{preview.invoice_date || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">الاستحقاق</div>
                      <div className="font-semibold" dir="ltr">{preview.due_date || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">الفرع</div>
                      <div className="font-semibold">{preview.branch_name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">بنك السداد</div>
                      <div className="font-semibold">{preview.paid_bank_name || "—"}</div>
                    </div>
                  </div>

                  <div className={`${ws.glassSoft} ${ws.card} p-3 grid grid-cols-3 gap-2 text-center`}>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">المبلغ</div>
                      <div className="text-sm font-bold tabular-nums" dir="ltr">
                        {formatMoney(preview.total_amount, preview.currency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">المدفوع</div>
                      <div className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-200" dir="ltr">
                        {formatMoney(preview.paid_amount, preview.currency)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">المتبقي</div>
                      <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-200" dir="ltr">
                        {formatMoney(preview.balance_due, preview.currency)}
                      </div>
                    </div>
                  </div>

                  {Array.isArray(preview.items) && preview.items.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold text-slate-700 dark:text-white/70 mb-2">
                        البنود ({preview.items.length})
                      </div>
                      <div className="space-y-1.5">
                        {preview.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 text-xs border-b border-dashed border-slate-200 dark:border-white/10 pb-1.5 last:border-0"
                          >
                            <span className="text-slate-700 dark:text-white/75 truncate">
                              {item.description || "بند"}
                            </span>
                            <span className="text-slate-500 dark:text-white/45 shrink-0" dir="ltr">
                              {moneyValue(item.quantity)} × {moneyValue(item.unit_price).toFixed(2)}
                            </span>
                            <span className="font-bold tabular-nums shrink-0" dir="ltr">
                              {moneyValue(item.line_total).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {previewLog.length > 0 ? (
                    <div>
                      <div className="text-xs font-bold text-slate-700 dark:text-white/70 mb-2">
                        سجل الفاتورة
                      </div>
                      <div className="space-y-1.5">
                        {previewLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start gap-2 text-[11px] border-b border-dashed border-slate-200 dark:border-white/10 pb-1.5 last:border-0"
                          >
                            <span
                              className="text-slate-400 dark:text-white/35 font-mono shrink-0"
                              dir="ltr"
                            >
                              {entry.log_date} {entry.log_time}
                            </span>
                            <span className="flex-1 text-slate-700 dark:text-white/70">
                              {entry.summary}
                              {entry.actor_name ? (
                                <span className="text-slate-500 dark:text-white/45">
                                  {" "}
                                  — {entry.actor_name}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 flex-wrap pt-2">
                    {moneyValue(preview.balance_due) > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPaying(preview);
                          setPreview(null);
                        }}
                        className={`${ws.btnPrimary} px-4 py-2 text-sm`}
                      >
                        <HandCoins className="w-4 h-4" />
                        تسجيل دفعة
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(preview);
                        setPreview(null);
                      }}
                      className={`${ws.btnNeutral} px-4 py-2 text-sm`}
                    >
                      <Pencil className="w-4 h-4" />
                      تعديل كامل
                    </button>
                    {preview.attachment_url ? (
                      <a
                        href={preview.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${ws.btnNeutral} px-4 py-2 text-sm`}
                      >
                        <Paperclip className="w-4 h-4" />
                        المرفق
                      </a>
                    ) : null}
                    {preview.payment_receipt_url ? (
                      <a
                        href={preview.payment_receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${ws.btnNeutral} px-4 py-2 text-sm`}
                      >
                        <Banknote className="w-4 h-4" />
                        إيصال الدفع
                      </a>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}

      <RecurringInvoicesModal
        open={showRecurring}
        contacts={contacts}
        accounts={accounts}
        branches={branches}
        onClose={() => setShowRecurring(false)}
      />

      {supplier360 ? (
        <Supplier360Modal
          contact={supplier360}
          invoices={invoices}
          onClose={() => setSupplier360(null)}
        />
      ) : null}
    </>
  );
}
