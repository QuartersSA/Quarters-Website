"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  HandCoins,
  Info,
  Loader2,
  Paperclip,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Trash2,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { buildRecentMonthOptions, monthLabel } from "@/utils/payrollFormatters";
import { currentRiyadhMonthKey, riyadhMonthKeyFromOffset } from "@/utils/dateUtils";
import { useAccountingContacts } from "@/hooks/useAccountingContacts";
import { useAccountingBankAccounts } from "@/hooks/useAccountingBankAccounts";
import {
  useLeaseContracts,
  useLeaseContract,
  useLeasePayments,
  useLeaseReserve,
  useCreateLeaseContract,
  useUpdateLeaseContract,
  useDeleteLeaseContract,
  useReactivateLeaseContract,
  useConfirmLeaseReserve,
  useUpdateLeasePayment,
  usePayLeasePayment,
  useUnpayLeasePayment,
} from "@/hooks/useLeaseContracts";
import LeaseContractModal from "@/components/Accounting/LeaseContractModal";
import LeasePayModal from "@/components/Accounting/LeasePayModal";
import {
  CONTRACT_STATUS_LABELS,
  FREQUENCY_LABELS,
  addDays,
  compareDateKeys,
  daysBetween,
  daysInMonth,
  installmentAmounts,
  monthKey,
} from "@/utils/leaseMath";

// ---------- مساعدات ----------

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value, withCurrency = true) {
  const text = moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withCurrency ? `${text} SAR` : text;
}

function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function daysWord(n) {
  const abs = Math.abs(n);
  if (abs === 1) return "يوم";
  if (abs === 2) return "يومين";
  if (abs <= 10) return "أيام";
  return "يوماً";
}

function contractStatusClass(status) {
  if (status === "active")
    return "bg-[#e7f2ee] dark:bg-emerald-400/10 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25";
  if (status === "notice")
    return "bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-400/25";
  if (status === "upcoming")
    return "bg-sky-100 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-400/25";
  if (status === "ended")
    return "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10";
  return "bg-rose-100 dark:bg-rose-400/10 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-400/25";
}

function contractStatusIcon(status) {
  if (status === "active") return CheckCircle2;
  if (status === "notice") return AlertTriangle;
  if (status === "upcoming") return Clock;
  if (status === "ended") return Ban;
  return X;
}

function StatusPill({ status, inactive = false }) {
  const Icon = contractStatusIcon(status);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${contractStatusClass(status)}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {CONTRACT_STATUS_LABELS[status] || status || "—"}
      </span>
      {inactive ? (
        <span className="text-[10px] text-slate-400 dark:text-white/35">موقوف</span>
      ) : null}
    </span>
  );
}

function PaymentPill({ payment, today }) {
  const overdue =
    payment.status === "pending" &&
    (payment.overdue || (payment.due_date && compareDateKeys(payment.due_date, today) < 0));
  const cls =
    payment.status === "paid"
      ? "bg-[#e7f2ee] dark:bg-emerald-400/10 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25"
      : payment.status === "cancelled"
        ? "bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-white/50 border-slate-200 dark:border-white/10"
        : overdue
          ? "bg-rose-100 dark:bg-rose-400/10 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-400/25"
          : "bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-400/25";
  const label =
    payment.status === "paid"
      ? "مسددة"
      : payment.status === "cancelled"
        ? "ملغاة"
        : overdue
          ? "متأخرة"
          : "معلّقة";
  return (
    <span className={`${ws.pill} whitespace-nowrap ${cls}`}>{label}</span>
  );
}

function DueBadge({ dueDate, today }) {
  const n = daysBetween(today, dueDate);
  if (n === null) return null;
  if (n < 0) {
    return (
      <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap">
        متأخرة {-n} {daysWord(n)}
      </span>
    );
  }
  if (n === 0) {
    return (
      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-200 whitespace-nowrap">
        تستحق اليوم
      </span>
    );
  }
  return (
    <span
      className={`text-[11px] whitespace-nowrap ${
        n <= 7
          ? "font-bold text-amber-700 dark:text-amber-200"
          : "text-slate-500 dark:text-white/50"
      }`}
    >
      بعد {n} {daysWord(n)}
    </span>
  );
}

function SummaryCard({ label, value, icon: Icon, tone = "slate", suffix }) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700 dark:text-rose-200"
      : tone === "emerald"
        ? "text-[#0e7a5f] dark:text-emerald-200"
        : tone === "amber"
          ? "text-amber-700 dark:text-amber-200"
          : tone === "sky"
            ? "text-sky-700 dark:text-sky-200"
            : "text-slate-700 dark:text-white/80";
  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-white/50">{label}</div>
          <div className={`text-xl font-bold mt-1 tabular-nums ${toneClass}`} dir="ltr">
            {value}
          </div>
          {suffix ? (
            <div className="text-xs text-slate-500 dark:text-white/45 mt-1">{suffix}</div>
          ) : null}
        </div>
        <div className={`${ws.iconBox} w-10 h-10 shrink-0 ${toneClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
      <div className={`${ws.iconBox} mx-auto text-[#0e7a5f] dark:text-emerald-200`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-bold text-slate-900 dark:text-white mt-3">{title}</div>
      {hint ? (
        <div className="text-sm text-slate-500 dark:text-white/50 mt-1">{hint}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function ExportButtons({ onExport, disabled }) {
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onExport("excel")}
        className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50`}
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Excel
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onExport("pdf")}
        className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50`}
      >
        <Download className="w-3.5 h-3.5" />
        PDF
      </button>
    </>
  );
}

function monthEndDate(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return "";
  return `${m[1]}-${m[2]}-${String(daysInMonth(Number(m[1]), Number(m[2]))).padStart(2, "0")}`;
}

// حجم الدفعة الظاهر في القائمة: من قيمة الدفعة + الضريبة، أو الاستحقاق
// القادم للعقود ذات الدفعات المخصصة.
function contractInstallmentIncl(contract) {
  if (contract.payment_frequency === "custom") return null;
  return installmentAmounts({
    amount: contract.installment_amount,
    vatRate: contract.vat_rate,
    amountIncludesVat: false,
  }).amount_incl;
}

const DUE_CHIPS = [
  { key: "overdue", label: "المتأخرة" },
  { key: "30", label: "خلال 30 يوماً" },
  { key: "month", label: "هذا الشهر" },
  { key: "all", label: "الكل" },
];

// ---------- اللوحة ----------

export default function LeaseContractsPanel({
  employeeId,
  isAdmin,
  sub = "contracts",
  onSubChange,
  autoOpenAdd = false,
  onIntentConsumed,
}) {
  const today = useMemo(() => todayRiyadh(), []);
  const currentMonth = useMemo(() => currentRiyadhMonthKey(), []);

  // العقود
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  // سداد المستحق
  const [dueChip, setDueChip] = useState("30");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [showPaid, setShowPaid] = useState(false);
  const [paying, setPaying] = useState(null);
  // الاستقطاع الشهري
  const [reserveMonth, setReserveMonth] = useState(currentMonth);
  const [reserveBranch, setReserveBranch] = useState("");
  // مبالغ الاستقطاع المُدخلة قبل التأكيد: { [payment_id]: "1234.00" }
  const [reserveDrafts, setReserveDrafts] = useState({});
  const [confirmingAll, setConfirmingAll] = useState(false);

  // رابط سريع (?intent=add) يفتح نافذة الإضافة مرة واحدة.
  useEffect(() => {
    if (!autoOpenAdd) return;
    setShowAdd(true);
    onIntentConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdd]);

  // إغلاق الدرج أو تبديل العقد يلغي أي تحرير دفعة جارٍ.
  useEffect(() => {
    setEditingPayment(null);
  }, [previewId]);

  // ---------- البيانات ----------

  const contractsQuery = useLeaseContracts({ employeeId, isAdmin, includeInactive });
  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const bankAccountsQuery = useAccountingBankAccounts({ employeeId, isAdmin });
  const branchesQuery = useQuery({
    queryKey: queryKeys.branches(),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      // المسار يعيد مصفوفة مباشرة (والمفتاح مشترك مع الشريط الجانبي).
      const response = await adminFetch("/api/branches");
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "فشل تحميل الفروع");
      return Array.isArray(data) ? data : Array.isArray(data?.branches) ? data.branches : [];
    },
  });
  // الدفعات المعلّقة كلها — لمؤشرات العقود («مستحق خلال 30 يوماً»).
  const pendingPaymentsQuery = useLeasePayments({ employeeId, isAdmin, status: "pending" });
  // دفعات قسم «سداد المستحق» بنطاق الأشهر المختار.
  const duePaymentsQuery = useLeasePayments({
    employeeId,
    isAdmin,
    status: showPaid ? "all" : "pending",
    from: dueFrom ? `${dueFrom}-01` : "",
    to: dueTo ? monthEndDate(dueTo) : "",
  });
  const detailQuery = useLeaseContract(previewId);
  const editDetailQuery = useLeaseContract(editingId);
  const reserveQuery = useLeaseReserve({
    employeeId,
    isAdmin,
    month: reserveMonth,
    branchId: reserveBranch,
  });

  const contracts = contractsQuery.data || [];
  const contacts = contactsQuery.data || [];
  const bankAccounts = bankAccountsQuery.data || [];
  const branches = branchesQuery.data || [];
  const pendingPayments = pendingPaymentsQuery.data || [];
  const duePayments = duePaymentsQuery.data || [];
  const reserve = reserveQuery.data || null;

  const createMut = useCreateLeaseContract();
  const updateMut = useUpdateLeaseContract();
  const deleteMut = useDeleteLeaseContract();
  const reactivateMut = useReactivateLeaseContract();
  const confirmReserveMut = useConfirmLeaseReserve();
  const updatePaymentMut = useUpdateLeasePayment();
  const payMut = usePayLeasePayment();
  const unpayMut = useUnpayLeasePayment();

  // صف الدرج: التفاصيل مع الدفعات إن وصلت، وإلا صف القائمة.
  const drawerContract = previewId
    ? detailQuery.data || contracts.find((c) => c.id === previewId) || null
    : null;
  const drawerPayments = Array.isArray(detailQuery.data?.payments)
    ? detailQuery.data.payments
    : [];

  // ---------- العقود: فلترة ومؤشرات ----------

  const filteredContracts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return contracts;
    return contracts.filter((c) =>
      [c.contract_number, c.lessor_name, c.location, c.branch_name, c.lessor_vat_number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [contracts, q]);

  const contractsKpi = useMemo(() => {
    const live = contracts.filter((c) => c.is_active !== false);
    const activeCount = live.filter((c) =>
      ["active", "notice"].includes(c.computed_status),
    ).length;
    const noticeCount = live.filter((c) => c.computed_status === "notice").length;
    const horizon = addDays(today, 30);
    const due30 = pendingPayments
      .filter((p) => p.due_date && compareDateKeys(p.due_date, horizon) <= 0)
      .reduce((acc, p) => acc + moneyValue(p.amount_incl), 0);
    const due30Count = pendingPayments.filter(
      (p) => p.due_date && compareDateKeys(p.due_date, horizon) <= 0,
    ).length;
    const remaining = live
      .filter((c) => c.computed_status !== "terminated")
      .reduce((acc, c) => acc + moneyValue(c.pending_total), 0);
    return { activeCount, noticeCount, due30, due30Count, remaining };
  }, [contracts, pendingPayments, today]);

  const exportContracts = (kind) => {
    const columns = [
      { header: "رقم العقد", accessor: (row) => row.contract_number || "" },
      { header: "المؤجر", accessor: (row) => row.lessor_name || "" },
      { header: "الموقع", accessor: (row) => row.location || "" },
      { header: "الفرع", accessor: (row) => row.branch_name || "" },
      { header: "البداية", accessor: (row) => row.start_date || "" },
      { header: "الانتهاء", accessor: (row) => row.end_date || "" },
      {
        header: "فترة الإشعار",
        accessor: (row) =>
          row.notice_period_days ? `${row.notice_period_days} يوم` : row.notice_period_text || "",
      },
      {
        header: "التكرار",
        accessor: (row) => FREQUENCY_LABELS[row.payment_frequency] || row.payment_frequency,
      },
      {
        header: "الدفعة شامل الضريبة",
        accessor: (row) => {
          const incl = contractInstallmentIncl(row);
          return incl === null ? "" : incl.toFixed(2);
        },
      },
      { header: "المدفوع", accessor: (row) => moneyValue(row.paid_total).toFixed(2) },
      { header: "المتبقي", accessor: (row) => moneyValue(row.pending_total).toFixed(2) },
      { header: "الإجمالي", accessor: (row) => moneyValue(row.total_value).toFixed(2) },
      { header: "الاستحقاق القادم", accessor: (row) => row.next_due_date || "" },
      {
        header: "الحالة",
        accessor: (row) => CONTRACT_STATUS_LABELS[row.computed_status] || row.computed_status,
      },
    ];
    const title = "العقود التأجيرية";
    if (kind === "excel") exportToExcelHTML(filteredContracts, "lease-contracts", columns, title);
    else exportToPDF(filteredContracts, "lease-contracts", columns, title);
  };

  // ---------- العقود: إجراءات ----------

  const handleSubmitContract = (payload) => {
    if (payload.id) {
      updateMut.mutate(payload, { onSuccess: () => setEditingId(null) });
    } else {
      createMut.mutate(payload, {
        onSuccess: (data) => {
          setShowAdd(false);
          if (data?.contract?.id) setPreviewId(data.contract.id);
        },
      });
    }
  };

  const handleDeleteContract = (contract) => {
    if (!contract) return;
    if (contract.is_active === false) {
      const ok = window.confirm(
        `حذف العقد "${contract.contract_number || contract.lessor_name}" نهائياً؟ لا يمكن التراجع. يُرفض الحذف إن كانت له دفعات مسددة.`,
      );
      if (!ok) return;
      deleteMut.mutate(
        { id: contract.id, force: true },
        { onSuccess: () => setPreviewId(null) },
      );
      return;
    }
    const ok = window.confirm(
      `إيقاف العقد "${contract.contract_number || contract.lessor_name}"؟ تختفي دفعاته من سداد المستحق والاستقطاع، ويمكنك عرضه لاحقاً من «عرض الموقوفة».`,
    );
    if (!ok) return;
    deleteMut.mutate({ id: contract.id, force: false }, { onSuccess: () => setPreviewId(null) });
  };

  const openPayFromDrawer = (payment) => {
    if (!drawerContract) return;
    setPaying({
      ...payment,
      contract_id: drawerContract.id,
      contract_number: drawerContract.contract_number,
      lessor_name: drawerContract.lessor_name,
      location: drawerContract.location,
      payment_frequency: drawerContract.payment_frequency,
    });
  };

  const handleUnpay = (payment) => {
    const ok = window.confirm(
      `التراجع عن سداد الدفعة #${payment.seq} (${formatMoney(payment.paid_amount ?? payment.amount_incl)})؟ تعود معلّقة وتُوقف الفاتورة ${payment.invoice_number || "المرتبطة"}.`,
    );
    if (!ok) return;
    unpayMut.mutate({ id: payment.id });
  };

  const handleCancelPayment = (payment) => {
    const ok = window.confirm(
      `إلغاء الدفعة #${payment.seq} المستحقة في ${payment.due_date}؟ تُستبعد من المستحقات والاستقطاع ويمكن استرجاعها لاحقاً.`,
    );
    if (!ok) return;
    updatePaymentMut.mutate({ id: payment.id, status: "cancelled" });
  };

  const handleRestorePayment = (payment) => {
    updatePaymentMut.mutate({ id: payment.id, status: "pending" });
  };

  const startEditPayment = (payment) => {
    setEditingPayment({
      id: payment.id,
      seq: payment.seq,
      due_date: payment.due_date || "",
      amount_excl: moneyValue(payment.amount_excl).toFixed(2),
      vat_rate: String(moneyValue(payment.vat_rate)),
      notes: payment.notes || "",
    });
  };

  const saveEditPayment = () => {
    if (!editingPayment) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editingPayment.due_date)) {
      window.alert("تاريخ الاستحقاق غير صالح.");
      return;
    }
    if (!(moneyValue(editingPayment.amount_excl) > 0)) {
      window.alert("المبلغ يجب أن يكون أكبر من صفر.");
      return;
    }
    updatePaymentMut.mutate(
      {
        id: editingPayment.id,
        due_date: editingPayment.due_date,
        amount_excl: moneyValue(editingPayment.amount_excl),
        vat_rate: Math.min(Math.max(moneyValue(editingPayment.vat_rate), 0), 100),
        notes: editingPayment.notes.trim() || null,
      },
      { onSuccess: () => setEditingPayment(null) },
    );
  };

  // ---------- سداد المستحق ----------

  const dueRows = useMemo(() => {
    const horizon = addDays(today, 30);
    return duePayments.filter((p) => {
      if (p.status === "cancelled") return false;
      if (!showPaid && p.status === "paid") return false;
      const isPending = p.status === "pending";
      // نطاق أشهر محدد يلغي عمل الشريحة (وإلا تفرغ القائمة بلا سبب ظاهر).
      if (dueFrom || dueTo) return true;
      if (dueChip === "overdue") return isPending && compareDateKeys(p.due_date, today) < 0;
      if (dueChip === "30") return compareDateKeys(p.due_date, horizon) <= 0;
      if (dueChip === "month") return monthKey(p.due_date) === currentMonth;
      return true;
    });
  }, [duePayments, dueChip, dueFrom, dueTo, showPaid, today, currentMonth]);

  const dueGroups = useMemo(() => {
    const map = new Map();
    for (const row of dueRows) {
      const key = monthKey(row.due_date) || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => ({
        key,
        rows,
        total: rows
          .filter((r) => r.status === "pending")
          .reduce((acc, r) => acc + moneyValue(r.amount_incl), 0),
        paid: rows
          .filter((r) => r.status === "paid")
          .reduce((acc, r) => acc + moneyValue(r.paid_amount ?? r.amount_incl), 0),
      }));
  }, [dueRows]);

  const dueSummary = useMemo(() => {
    const pending = dueRows.filter((r) => r.status === "pending");
    const overdue = pending.filter((r) => compareDateKeys(r.due_date, today) < 0);
    return {
      count: pending.length,
      total: pending.reduce((acc, r) => acc + moneyValue(r.amount_incl), 0),
      overdueCount: overdue.length,
      overdueTotal: overdue.reduce((acc, r) => acc + moneyValue(r.amount_incl), 0),
    };
  }, [dueRows, today]);

  const exportDue = (kind) => {
    const columns = [
      { header: "الاستحقاق", accessor: (row) => row.due_date || "" },
      { header: "رقم العقد", accessor: (row) => row.contract_number || "" },
      { header: "المؤجر", accessor: (row) => row.lessor_name || "" },
      { header: "الموقع", accessor: (row) => row.location || "" },
      { header: "الدفعة", accessor: (row) => `#${row.seq}` },
      {
        header: "الفترة",
        accessor: (row) =>
          row.period_start && row.period_end ? `${row.period_start} → ${row.period_end}` : "",
      },
      { header: "قبل الضريبة", accessor: (row) => moneyValue(row.amount_excl).toFixed(2) },
      { header: "الضريبة", accessor: (row) => moneyValue(row.vat_amount).toFixed(2) },
      { header: "شامل الضريبة", accessor: (row) => moneyValue(row.amount_incl).toFixed(2) },
      {
        header: "الحالة",
        accessor: (row) =>
          row.status === "paid"
            ? `مسددة ${row.paid_date || ""}`
            : compareDateKeys(row.due_date, today) < 0
              ? "متأخرة"
              : "معلّقة",
      },
      { header: "الفاتورة", accessor: (row) => row.invoice_number || "" },
    ];
    const title = "دفعات الإيجار المستحقة";
    if (kind === "excel") exportToExcelHTML(dueRows, "lease-due-payments", columns, title);
    else exportToPDF(dueRows, "lease-due-payments", columns, title);
  };

  // ---------- الاستقطاع الشهري ----------

  const reserveMonthOptions = useMemo(() => {
    const future = [];
    for (let i = 12; i >= 1; i -= 1) {
      const value = riyadhMonthKeyFromOffset(i);
      future.push({ value, label: monthLabel(value) });
    }
    const recent = buildRecentMonthOptions(12).filter((option) => option.value);
    return [...future, ...recent];
  }, []);

  const branchFilterOptions = useMemo(
    () => [
      { value: "", label: "كل الفروع" },
      ...branches.map((branch) => ({ value: String(branch.id), label: branch.name })),
    ],
    [branches],
  );

  const reserveRows = Array.isArray(reserve?.rows) ? reserve.rows : [];
  const reserveTotals = reserve?.totals || {};
  const reserveRevenue = reserve?.revenue || {};
  // التأكيد متاح للشهر الحالي وما قبله فقط (إيرادات الشهر المستقبلي لم تتحقق).
  const canConfirmReserve = reserve ? reserve.can_confirm !== false : reserveMonth <= currentMonth;

  // تبديل الشهر يمسح المسودات.
  useEffect(() => {
    setReserveDrafts({});
  }, [reserveMonth, reserveBranch]);

  const reserveDraftValue = (row) => {
    const draft = reserveDrafts[row.id];
    if (draft !== undefined) return draft;
    return moneyValue(row.confirmed_amount ?? row.suggested_amount).toFixed(2);
  };

  const confirmReserveRow = (row, amountOverride) => {
    const raw = amountOverride !== undefined ? amountOverride : reserveDraftValue(row);
    const amount = Math.round(moneyValue(raw) * 100) / 100;
    if (amount < 0) return;
    confirmReserveMut.mutate(
      {
        payment_id: row.id,
        month: reserveMonth,
        amount,
        suggested_amount: moneyValue(row.suggested_amount),
        revenue_basis: moneyValue(reserveRevenue.total),
      },
      {
        onSuccess: () =>
          setReserveDrafts((drafts) => {
            const next = { ...drafts };
            delete next[row.id];
            return next;
          }),
      },
    );
  };

  const clearReserveRow = (row) => {
    if (row.confirmed_amount === null || row.confirmed_amount === undefined) return;
    const ok = window.confirm(
      `إلغاء استقطاع ${monthLabel(reserveMonth)} عن الدفعة #${row.seq} (${formatMoney(row.confirmed_amount)})؟`,
    );
    if (!ok) return;
    confirmReserveRow(row, 0);
  };

  // تأكيد كل الصفوف غير المؤكدة بالمقترح (تتابعًا لتفادي التضارب).
  const confirmAllSuggested = async () => {
    const targets = reserveRows.filter(
      (row) =>
        (row.confirmed_amount === null || row.confirmed_amount === undefined) &&
        moneyValue(row.suggested_amount) > 0,
    );
    if (!targets.length) return;
    const ok = window.confirm(
      `تأكيد استقطاع ${monthLabel(reserveMonth)} لـ ${targets.length} دفعة بالمبالغ المقترحة (إجمالي ${formatMoney(
        targets.reduce((acc, row) => acc + moneyValue(row.suggested_amount), 0),
      )})؟`,
    );
    if (!ok) return;
    setConfirmingAll(true);
    let done = 0;
    try {
      for (const row of targets) {
        try {
          await confirmReserveMut.mutateAsync({
            payment_id: row.id,
            month: reserveMonth,
            amount: Math.round(moneyValue(row.suggested_amount) * 100) / 100,
            suggested_amount: moneyValue(row.suggested_amount),
            revenue_basis: moneyValue(reserveRevenue.total),
            silent: true,
          });
          done += 1;
        } catch {
          // الخطأ عُرض في toast من الطفرة.
        }
      }
    } finally {
      setConfirmingAll(false);
      setReserveDrafts({});
    }
    if (done > 0) toast.success(`تم تأكيد الاستقطاع لـ ${done} دفعة`);
  };

  const exportReserve = (kind) => {
    const columns = [
      { header: "رقم العقد", accessor: (row) => row.contract_number || "" },
      { header: "المؤجر", accessor: (row) => row.lessor_name || "" },
      { header: "الدفعة", accessor: (row) => `#${row.seq}` },
      { header: "الاستحقاق", accessor: (row) => row.due_date || "" },
      { header: "المبلغ شامل", accessor: (row) => moneyValue(row.amount_incl).toFixed(2) },
      {
        header: "نافذة الادخار",
        accessor: (row) => `${row.reserve_start || ""} → ${row.due_date || ""} (${row.months_total} أشهر)`,
      },
      { header: "الاستقطاع الشهري", accessor: (row) => moneyValue(row.monthly_reserve).toFixed(2) },
      { header: "حصة هذا الشهر", accessor: (row) => moneyValue(row.this_month_share).toFixed(2) },
      { header: "المُدَّخر بالخطة", accessor: (row) => moneyValue(row.reserved_to_date).toFixed(2) },
      { header: "المؤكد فعلياً", accessor: (row) => moneyValue(row.reserved_actual).toFixed(2) },
      { header: "المقترح لهذا الشهر", accessor: (row) => moneyValue(row.suggested_amount).toFixed(2) },
      {
        header: "المؤكد هذا الشهر",
        accessor: (row) =>
          row.confirmed_amount === null || row.confirmed_amount === undefined
            ? ""
            : moneyValue(row.confirmed_amount).toFixed(2),
      },
      { header: "المتبقي", accessor: (row) => moneyValue(row.remaining_actual ?? row.remaining).toFixed(2) },
      {
        header: "الحالة",
        accessor: (row) =>
          row.overdue ? "متأخرة" : row.due_this_month ? "تستحق هذا الشهر" : "جارية",
      },
    ];
    const title = `الاستقطاع الشهري للإيجارات — ${monthLabel(reserveMonth)}`;
    if (kind === "excel") exportToExcelHTML(reserveRows, "lease-reserve", columns, title);
    else exportToPDF(reserveRows, "lease-reserve", columns, title);
  };

  // ---------- العرض ----------

  const addButton = (
    <button
      type="button"
      onClick={() => setShowAdd(true)}
      className={`${ws.btnPrimary} px-4 py-2`}
    >
      <Plus className="w-4 h-4" />
      عقد جديد
    </button>
  );

  const renderContracts = () => (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard
          label="عقود سارية"
          value={contractsKpi.activeCount}
          icon={ScrollText}
          tone="emerald"
          suffix={`من ${contracts.filter((c) => c.is_active !== false).length} عقد`}
        />
        <SummaryCard
          label="داخل فترة الإشعار"
          value={contractsKpi.noticeCount}
          icon={AlertTriangle}
          tone={contractsKpi.noticeCount > 0 ? "amber" : "slate"}
          suffix="راجع التجديد أو الإنهاء"
        />
        <SummaryCard
          label="مستحق خلال 30 يوماً"
          value={formatMoney(contractsKpi.due30)}
          icon={CalendarClock}
          tone={contractsKpi.due30 > 0 ? "rose" : "slate"}
          suffix={`${contractsKpi.due30Count} دفعة (شامل المتأخرة)`}
        />
        <SummaryCard
          label="إجمالي المتبقي"
          value={formatMoney(contractsKpi.remaining)}
          icon={Wallet}
          tone="sky"
          suffix="الدفعات المعلّقة للعقود السارية"
        />
      </div>

      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث برقم العقد أو المؤجر أو الموقع"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75 shrink-0">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="accent-[#0e7a5f]"
            />
            عرض الموقوفة
          </label>
          <div className="flex-1" />
          <ExportButtons onExport={exportContracts} disabled={filteredContracts.length === 0} />
          <button
            type="button"
            onClick={() => contractsQuery.refetch()}
            className={`${ws.btnNeutral} px-3 py-2`}
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${contractsQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
          {addButton}
        </div>
      </div>

      {contractsQuery.isLoading ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center text-slate-500 dark:text-white/50`}>
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          <div className="mt-2 text-sm">جاري تحميل العقود…</div>
        </div>
      ) : contractsQuery.isError ? (
        <div className={`${ws.glass} ${ws.card} p-6 text-center text-rose-700 dark:text-rose-300 text-sm`}>
          {contractsQuery.error?.message || "فشل تحميل العقود"}
        </div>
      ) : filteredContracts.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={q ? "لا نتائج مطابقة" : "لا عقود تأجيرية بعد"}
          hint={
            q
              ? "جرّب كلمة أخرى أو امسح البحث."
              : "أضف أول عقد وارفع نسخته ليُحلَّل ذكياً ويُولَّد جدول دفعاته."
          }
          action={q ? null : addButton}
        />
      ) : (
        <>
          <div className={`hidden lg:block ${ws.glass} ${ws.card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#fafbfa] dark:bg-white/[0.03] text-slate-600 dark:text-white/60">
                  <tr>
                    <th className="text-right font-semibold px-4 py-3">رقم العقد</th>
                    <th className="text-right font-semibold px-4 py-3">المؤجر</th>
                    <th className="text-right font-semibold px-4 py-3">الموقع / الفرع</th>
                    <th className="text-right font-semibold px-4 py-3">البداية</th>
                    <th className="text-right font-semibold px-4 py-3">الانتهاء</th>
                    <th className="text-right font-semibold px-4 py-3">الإشعار</th>
                    <th className="text-right font-semibold px-4 py-3">التكرار</th>
                    <th className="text-left font-semibold px-4 py-3">الدفعة (شامل)</th>
                    <th className="text-left font-semibold px-4 py-3">المدفوع / الإجمالي</th>
                    <th className="text-right font-semibold px-4 py-3">الاستحقاق القادم</th>
                    <th className="text-right font-semibold px-4 py-3">الحالة</th>
                    <th className="text-center font-semibold px-4 py-3">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {filteredContracts.map((contract) => {
                    const incl = contractInstallmentIncl(contract);
                    return (
                      <tr
                        key={contract.id}
                        onClick={(event) => {
                          if (event.target.closest("button, a, input")) return;
                          setPreviewId(contract.id);
                        }}
                        className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
                          contract.is_active === false ? "opacity-60" : ""
                        } ${previewId === contract.id ? "bg-[#e7f2ee]/70 dark:bg-emerald-400/[0.06]" : ""}`}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5" dir="ltr">
                            <span className="font-mono">{contract.contract_number || `#${contract.id}`}</span>
                            {contract.attachment_url ? (
                              <a
                                href={contract.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-[#0e7a5f] dark:text-white/40 dark:hover:text-emerald-300"
                                title="عرض العقد المرفق"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/70">
                          {contract.lessor_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/70">
                          <div className="truncate max-w-[220px]">{contract.location || "—"}</div>
                          {contract.branch_name ? (
                            <div className="text-[11px] text-slate-500 dark:text-white/45">
                              {contract.branch_name}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/65 font-mono" dir="ltr">
                          {formatDate(contract.start_date)}
                        </td>
                        <td className="px-4 py-3 font-mono" dir="ltr">
                          <div className="text-slate-700 dark:text-white/65">{formatDate(contract.end_date)}</div>
                          {Number.isFinite(Number(contract.days_to_end)) && contract.days_to_end >= 0 ? (
                            <div className="text-[10px] text-slate-400 dark:text-white/35" dir="rtl">
                              بعد {contract.days_to_end} {daysWord(contract.days_to_end)}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/65">
                          {contract.notice_period_days ? (
                            <div>
                              <span dir="ltr">{contract.notice_period_days}</span> يوم
                              {contract.notice_starts_on ? (
                                <div className="text-[10px] text-slate-400 dark:text-white/35 font-mono" dir="ltr">
                                  {contract.notice_starts_on}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            contract.notice_period_text || "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/65 whitespace-nowrap">
                          {FREQUENCY_LABELS[contract.payment_frequency] || contract.payment_frequency}
                        </td>
                        <td className="px-4 py-3 text-left font-bold text-slate-900 dark:text-white tabular-nums" dir="ltr">
                          {incl === null ? (
                            <span className="text-xs font-normal text-slate-500 dark:text-white/45">مخصص</span>
                          ) : (
                            formatMoney(incl, false)
                          )}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums" dir="ltr">
                          <span className="font-bold text-[#0e7a5f] dark:text-emerald-200">
                            {formatMoney(contract.paid_total, false)}
                          </span>
                          <span className="text-slate-400 dark:text-white/35"> / </span>
                          <span className="text-slate-700 dark:text-white/70">
                            {formatMoney(contract.total_value, false)}
                          </span>
                          <div className="text-[10px] text-slate-400 dark:text-white/35" dir="rtl">
                            {contract.payments_paid || 0} من {contract.payments_total || 0} دفعة
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {contract.next_due_date ? (
                            <div>
                              <div className="font-mono text-slate-800 dark:text-white/85" dir="ltr">
                                {contract.next_due_date}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-white/45 tabular-nums" dir="ltr">
                                {formatMoney(contract.next_due_amount, false)}
                              </div>
                              {contract.overdue_count > 0 ? (
                                <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
                                  {contract.overdue_count} متأخرة
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-white/35">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            status={contract.computed_status}
                            inactive={contract.is_active === false}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(contract.id)}
                              className={`${ws.iconButton} w-9 h-9`}
                              title="تعديل العقد"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContract(contract)}
                              className={`${ws.iconButton} w-9 h-9 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 hover:text-red-700 dark:hover:text-red-200`}
                              title={contract.is_active === false ? "حذف نهائي" : "إيقاف"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* الجوال: بطاقات */}
          <div className="lg:hidden space-y-3">
            {filteredContracts.map((contract) => {
              const incl = contractInstallmentIncl(contract);
              return (
                <div
                  key={contract.id}
                  className={`${ws.glass} ${ws.card} p-4 ${contract.is_active === false ? "opacity-60" : ""}`}
                  onClick={(event) => {
                    if (event.target.closest("button, a")) return;
                    setPreviewId(contract.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white font-mono truncate" dir="ltr">
                        {contract.contract_number || `#${contract.id}`}
                      </div>
                      <div className="text-sm text-slate-700 dark:text-white/70 mt-1 truncate">
                        {contract.lessor_name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/45 truncate">
                        {[contract.location, contract.branch_name].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <StatusPill status={contract.computed_status} inactive={contract.is_active === false} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-white/45">المدة</div>
                      <div className="font-mono text-slate-900 dark:text-white mt-0.5 text-xs" dir="ltr">
                        {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-white/45">
                        {FREQUENCY_LABELS[contract.payment_frequency] || "الدفعة"}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums" dir="ltr">
                        {incl === null ? "مخصص" : formatMoney(incl)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-white/45">المدفوع / الإجمالي</div>
                      <div className="mt-0.5 tabular-nums text-xs" dir="ltr">
                        <span className="font-bold text-[#0e7a5f] dark:text-emerald-200">
                          {formatMoney(contract.paid_total, false)}
                        </span>{" "}
                        / {formatMoney(contract.total_value, false)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-white/45">الاستحقاق القادم</div>
                      <div className="font-mono text-slate-900 dark:text-white mt-0.5 text-xs" dir="ltr">
                        {contract.next_due_date || "—"}
                      </div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 mt-3 pt-3 border-t ${ws.divider}`}>
                    <button
                      type="button"
                      onClick={() => setPreviewId(contract.id)}
                      className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
                    >
                      التفاصيل والدفعات
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(contract.id)}
                      className={`${ws.iconButton} w-8 h-8 mr-auto`}
                      title="تعديل"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );

  const renderDue = () => (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard
          label="دفعات معلّقة (في العرض)"
          value={dueSummary.count}
          icon={CalendarClock}
          tone="slate"
        />
        <SummaryCard
          label="إجمالي المعلّق"
          value={formatMoney(dueSummary.total)}
          icon={Wallet}
          tone="amber"
        />
        <SummaryCard
          label="المتأخرة"
          value={dueSummary.overdueCount}
          icon={AlertTriangle}
          tone={dueSummary.overdueCount > 0 ? "rose" : "slate"}
          suffix={dueSummary.overdueCount > 0 ? formatMoney(dueSummary.overdueTotal) : "لا متأخرات"}
        />
        <SummaryCard
          label="الدفعة القادمة"
          value={
            dueRows.find((r) => r.status === "pending")?.due_date ||
            pendingPayments[0]?.due_date ||
            "—"
          }
          icon={Clock}
          tone="sky"
          suffix={
            dueRows.find((r) => r.status === "pending")
              ? formatMoney(dueRows.find((r) => r.status === "pending").amount_incl)
              : null
          }
        />
      </div>

      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`${ws.segWrap} flex-wrap`}>
            {DUE_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setDueChip(chip.key)}
                className={`${ws.segBtn} text-xs px-3 py-1.5 ${
                  dueChip === chip.key ? ws.segActive : ws.segInactive
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-white/55">من</span>
            <input
              type="month"
              value={dueFrom}
              onChange={(event) => setDueFrom(event.target.value)}
              className={`${ws.input} px-3 py-1.5 text-sm w-auto`}
              dir="ltr"
            />
            <span className="text-xs text-slate-600 dark:text-white/55">إلى</span>
            <input
              type="month"
              value={dueTo}
              onChange={(event) => setDueTo(event.target.value)}
              className={`${ws.input} px-3 py-1.5 text-sm w-auto`}
              dir="ltr"
            />
            {dueFrom || dueTo ? (
              <button
                type="button"
                onClick={() => {
                  setDueFrom("");
                  setDueTo("");
                }}
                className="text-xs text-slate-500 hover:text-red-600 dark:text-white/50 dark:hover:text-red-300"
              >
                مسح
              </button>
            ) : null}
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75 shrink-0">
            <input
              type="checkbox"
              checked={showPaid}
              onChange={(event) => setShowPaid(event.target.checked)}
              className="accent-[#0e7a5f]"
            />
            عرض المسددة
          </label>
          <div className="flex-1" />
          <ExportButtons onExport={exportDue} disabled={dueRows.length === 0} />
          <button
            type="button"
            onClick={() => duePaymentsQuery.refetch()}
            className={`${ws.btnNeutral} px-3 py-2`}
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${duePaymentsQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {duePaymentsQuery.isLoading ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center text-slate-500 dark:text-white/50`}>
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          <div className="mt-2 text-sm">جاري تحميل الدفعات…</div>
        </div>
      ) : dueGroups.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="لا دفعات في هذا النطاق"
          hint="غيّر الفلتر أو نطاق الأشهر، أو أضف عقداً جديداً من قسم العقود."
        />
      ) : (
        <div className="space-y-4">
          {dueGroups.map((group) => (
            <div key={group.key} className={`${ws.glass} ${ws.card} overflow-hidden`}>
              <div className={`${ws.sectionHeader} flex items-center justify-between gap-3 flex-wrap`}>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {group.key === currentMonth ? "هذا الشهر — " : ""}
                  {monthLabel(group.key)}
                  <span className="text-xs font-normal text-slate-500 dark:text-white/45 mr-2">
                    {group.rows.length} دفعة
                  </span>
                </div>
                <div className="text-xs tabular-nums flex items-center gap-3" dir="ltr">
                  {group.total > 0 ? (
                    <span className="font-bold text-amber-700 dark:text-amber-200">
                      {formatMoney(group.total)}
                    </span>
                  ) : null}
                  {group.paid > 0 ? (
                    <span className="text-[#0e7a5f] dark:text-emerald-200">
                      {formatMoney(group.paid)} <span dir="rtl">مسدد</span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-500 dark:text-white/50 text-xs">
                    <tr>
                      <th className="text-right font-semibold px-4 py-2">الاستحقاق</th>
                      <th className="text-right font-semibold px-4 py-2">العقد / المؤجر</th>
                      <th className="text-right font-semibold px-4 py-2">الدفعة / الفترة</th>
                      <th className="text-left font-semibold px-4 py-2">المبلغ شامل</th>
                      <th className="text-right font-semibold px-4 py-2">الحالة</th>
                      <th className="text-center font-semibold px-4 py-2">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {group.rows.map((row) => (
                      <tr key={row.id} className={row.status === "paid" ? "opacity-75" : ""}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono text-slate-900 dark:text-white" dir="ltr">
                            {row.due_date}
                          </div>
                          {row.status === "pending" ? (
                            <DueBadge dueDate={row.due_date} today={today} />
                          ) : row.paid_date ? (
                            <div className="text-[11px] text-slate-500 dark:text-white/45 font-mono" dir="ltr">
                              سُدد {row.paid_date}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setPreviewId(row.contract_id)}
                            className="font-semibold text-slate-900 dark:text-white hover:text-[#0e7a5f] dark:hover:text-emerald-300 text-right"
                          >
                            {row.lessor_name || "—"}
                          </button>
                          <div className="text-[11px] text-slate-500 dark:text-white/45 truncate max-w-[260px]">
                            <span className="font-mono" dir="ltr">
                              {row.contract_number || `#${row.contract_id}`}
                            </span>
                            {row.location ? ` · ${row.location}` : ""}
                            {row.branch_name ? ` · ${row.branch_name}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800 dark:text-white/85">الدفعة #{row.seq}</div>
                          {row.period_start && row.period_end ? (
                            <div className="text-[11px] text-slate-500 dark:text-white/45 font-mono whitespace-nowrap" dir="ltr">
                              {row.period_start} → {row.period_end}
                            </div>
                          ) : row.notes ? (
                            <div className="text-[11px] text-slate-500 dark:text-white/45 truncate max-w-[200px]">
                              {row.notes}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums" dir="ltr">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {formatMoney(row.amount_incl)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-white/45">
                            {formatMoney(row.amount_excl, false)} + {formatMoney(row.vat_amount, false)}{" "}
                            <span dir="rtl">ضريبة {moneyValue(row.vat_rate)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <PaymentPill payment={row} today={today} />
                          {row.status === "paid" && row.invoice_number ? (
                            <div className="text-[11px] text-slate-500 dark:text-white/45 font-mono mt-1" dir="ltr">
                              {row.invoice_number}
                            </div>
                          ) : null}
                          {row.status === "paid" && row.bank_name ? (
                            <div className="text-[11px] text-slate-500 dark:text-white/45">
                              {row.bank_name}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {row.status === "pending" ? (
                              <button
                                type="button"
                                onClick={() => setPaying(row)}
                                className={`${ws.btnPrimary} px-3 py-1.5 text-xs`}
                              >
                                <HandCoins className="w-3.5 h-3.5" />
                                سداد
                              </button>
                            ) : row.status === "paid" ? (
                              <button
                                type="button"
                                onClick={() => handleUnpay(row)}
                                disabled={unpayMut.isPending}
                                className={`${ws.btnNeutral} px-3 py-1.5 text-xs disabled:opacity-50`}
                                title="التراجع عن السداد وإيقاف الفاتورة"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                تراجع
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderReserve = () => (
    <>
      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-xs text-slate-600 dark:text-white/55">الشهر</div>
          <div className="w-44">
            <GlassSelect
              value={reserveMonth}
              onChange={setReserveMonth}
              options={reserveMonthOptions}
              placeholder="اختر الشهر"
              buttonClassName="text-sm py-2 px-3"
            />
          </div>
          {branches.length > 0 ? (
            <div className="w-44">
              <GlassSelect
                value={reserveBranch}
                onChange={setReserveBranch}
                options={branchFilterOptions}
                placeholder="كل الفروع"
                buttonClassName="text-sm py-2 px-3"
              />
            </div>
          ) : null}
          {reserveMonth !== currentMonth ? (
            <button
              type="button"
              onClick={() => setReserveMonth(currentMonth)}
              className="text-xs text-[#0e7a5f] dark:text-emerald-300 hover:underline"
            >
              الشهر الحالي
            </button>
          ) : null}
          <div className="flex-1" />
          {reserveRows.length > 0 ? (
            <button
              type="button"
              onClick={confirmAllSuggested}
              disabled={
                !canConfirmReserve ||
                confirmingAll ||
                confirmReserveMut.isPending ||
                moneyValue(reserveTotals.unconfirmed_count) === 0
              }
              className={`${ws.btnPrimary} px-3 py-2 text-xs disabled:opacity-50`}
              title={
                canConfirmReserve
                  ? "تأكيد استقطاع كل الدفعات غير المؤكدة بالمبالغ المقترحة"
                  : "لا يمكن تأكيد استقطاع لشهر مستقبلي"
              }
            >
              {confirmingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              تأكيد الكل بالمقترح
              {moneyValue(reserveTotals.unconfirmed_count) > 0
                ? ` (${reserveTotals.unconfirmed_count})`
                : ""}
            </button>
          ) : null}
          <ExportButtons onExport={exportReserve} disabled={reserveRows.length === 0} />
          <button
            type="button"
            onClick={() => reserveQuery.refetch()}
            className={`${ws.btnNeutral} px-3 py-2`}
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${reserveQuery.isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <SummaryCard
          label="إيرادات الشهر من التقفيلات"
          value={formatMoney(reserveRevenue.total)}
          icon={Wallet}
          tone="sky"
          suffix={
            reserveRevenue.shifts
              ? `${reserveRevenue.shifts} تقفيلة · نقد ${formatMoney(reserveRevenue.cash, false)} · شبكة ${formatMoney(reserveRevenue.card, false)}`
              : "لا تقفيلات مسجلة لهذا الشهر"
          }
        />
        <SummaryCard
          label="الاستقطاع المقترح هذا الشهر"
          value={formatMoney(reserveTotals.suggested_this_month)}
          icon={PiggyBank}
          tone="emerald"
          suffix={`بالخطة الأصلية ${formatMoney(reserveTotals.this_month_share, false)} · الشهري الكلي ${formatMoney(reserveTotals.monthly_reserve, false)}`}
        />
        <SummaryCard
          label="نسبته من الإيرادات"
          value={
            reserveTotals.suggested_share_of_revenue_pct === null ||
            reserveTotals.suggested_share_of_revenue_pct === undefined
              ? "—"
              : `${moneyValue(reserveTotals.suggested_share_of_revenue_pct).toFixed(1)}%`
          }
          icon={Info}
          tone={
            moneyValue(reserveTotals.suggested_share_of_revenue_pct) > 30
              ? "rose"
              : moneyValue(reserveTotals.suggested_share_of_revenue_pct) > 15
                ? "amber"
                : "slate"
          }
          suffix={
            reserveTotals.suggested_share_of_revenue_pct === null ||
            reserveTotals.suggested_share_of_revenue_pct === undefined
              ? "لا إيرادات مسجلة للمقارنة"
              : "من إيرادات التقفيلات"
          }
        />
        <SummaryCard
          label="المؤكد هذا الشهر"
          value={formatMoney(reserveTotals.confirmed_this_month)}
          icon={CheckCircle2}
          tone={
            moneyValue(reserveTotals.unconfirmed_count) > 0 && canConfirmReserve
              ? "amber"
              : "emerald"
          }
          suffix={
            moneyValue(reserveTotals.unconfirmed_count) > 0
              ? `${reserveTotals.unconfirmed_count} دفعة بانتظار التأكيد`
              : moneyValue(reserveTotals.confirmed_count) > 0
                ? `${reserveTotals.confirmed_count} دفعة مؤكدة`
                : "لم يُؤكد شيء بعد"
          }
        />
        <SummaryCard
          label="المُدَّخر فعلياً حتى الآن"
          value={formatMoney(reserveTotals.reserved_actual)}
          icon={Wallet}
          tone={moneyValue(reserveTotals.behind_plan) > 0 ? "amber" : "emerald"}
          suffix={
            moneyValue(reserveTotals.behind_plan) > 0
              ? `متأخر عن الخطة بـ ${formatMoney(reserveTotals.behind_plan, false)} (الخطة ${formatMoney(reserveTotals.reserved_to_date, false)})`
              : `بالخطة ${formatMoney(reserveTotals.reserved_to_date, false)}`
          }
        />
        <SummaryCard
          label="المتبقي حتى الاستحقاق"
          value={formatMoney(reserveTotals.remaining_actual ?? reserveTotals.remaining)}
          icon={CalendarClock}
          tone="amber"
          suffix={`من ${formatMoney(reserveTotals.pending_amount, false)} دفعات معلّقة`}
        />
      </div>

      {!canConfirmReserve ? (
        <div className={`${ws.glassSoft} ${ws.card} px-4 py-3 text-xs text-slate-600 dark:text-white/60 flex items-center gap-2`}>
          <Info className="w-4 h-4 shrink-0 text-sky-700 dark:text-sky-200" />
          هذا شهر مستقبلي: الأرقام تقديرية للتخطيط، والتأكيد يُتاح عند حلول الشهر بعد تسجيل إيراداته.
        </div>
      ) : null}

      {reserveQuery.isLoading ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center text-slate-500 dark:text-white/50`}>
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          <div className="mt-2 text-sm">جاري حساب الاستقطاع…</div>
        </div>
      ) : reserveQuery.isError ? (
        <div className={`${ws.glass} ${ws.card} p-6 text-center text-rose-700 dark:text-rose-300 text-sm`}>
          {reserveQuery.error?.message || "فشل تحميل الاستقطاع"}
        </div>
      ) : reserveRows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="لا دفعات معلّقة تحتاج استقطاعاً"
          hint="كل دفعات العقود السارية مسددة، أو لا عقود سارية في هذا الفرع."
        />
      ) : (
        <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#fafbfa] dark:bg-white/[0.03] text-slate-600 dark:text-white/60 text-xs">
                <tr>
                  <th className="text-right font-semibold px-4 py-3">العقد / المؤجر</th>
                  <th className="text-right font-semibold px-4 py-3">الدفعة والاستحقاق</th>
                  <th className="text-left font-semibold px-4 py-3">المبلغ شامل</th>
                  <th className="text-right font-semibold px-4 py-3">نافذة الادخار</th>
                  <th className="text-left font-semibold px-4 py-3">الاستقطاع الشهري</th>
                  <th className="text-left font-semibold px-4 py-3">المُدَّخر فعلياً</th>
                  <th className="text-left font-semibold px-4 py-3">المقترح لهذا الشهر</th>
                  <th className="text-right font-semibold px-4 py-3">تأكيد الاستقطاع</th>
                  <th className="text-left font-semibold px-4 py-3">المتبقي</th>
                  <th className="text-right font-semibold px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {reserveRows.map((row) => {
                  const pct =
                    row.months_total > 0
                      ? Math.min(100, Math.round((row.months_elapsed / row.months_total) * 100))
                      : 0;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setPreviewId(row.contract_id)}
                          className="font-semibold text-slate-900 dark:text-white hover:text-[#0e7a5f] dark:hover:text-emerald-300 text-right"
                        >
                          {row.lessor_name || "—"}
                        </button>
                        <div className="text-[11px] text-slate-500 dark:text-white/45 truncate max-w-[220px]">
                          <span className="font-mono" dir="ltr">
                            {row.contract_number || `#${row.contract_id}`}
                          </span>
                          {row.location ? ` · ${row.location}` : ""}
                          {row.branch_name ? ` · ${row.branch_name}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800 dark:text-white/85">الدفعة #{row.seq}</div>
                        <div className="font-mono text-slate-600 dark:text-white/55 text-xs" dir="ltr">
                          {row.due_date}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
                        {formatMoney(row.amount_incl, false)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-700 dark:text-white/70 whitespace-nowrap" dir="ltr">
                          {row.reserve_start || "—"} → {row.due_date}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-white/45">
                          {row.months_total} {row.months_total === 1 ? "شهر" : row.months_total === 2 ? "شهران" : row.months_total <= 10 ? "أشهر" : "شهراً"}
                          {" · "}
                          انقضى {row.months_elapsed} / {row.months_total}
                        </div>
                        <div className="h-1 rounded-full bg-slate-200 dark:bg-white/10 mt-1 overflow-hidden w-32">
                          <div
                            className={`h-full ${row.overdue ? "bg-rose-500" : "bg-[#0e7a5f] dark:bg-emerald-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left tabular-nums text-slate-800 dark:text-white/85" dir="ltr">
                        {formatMoney(row.monthly_reserve, false)}
                      </td>
                      <td className="px-4 py-3 text-left tabular-nums" dir="ltr">
                        <div className="text-slate-800 dark:text-white/85">
                          {formatMoney(row.reserved_actual, false)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-white/40 whitespace-nowrap">
                          بالخطة {formatMoney(row.reserved_to_date, false)}
                        </div>
                        {moneyValue(row.behind_plan) > 0 ? (
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-200 whitespace-nowrap">
                            متأخر عن الخطة −{formatMoney(row.behind_plan, false)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-left tabular-nums font-bold" dir="ltr">
                        <span
                          className={
                            moneyValue(row.suggested_amount) > 0
                              ? "text-[#0e7a5f] dark:text-emerald-200"
                              : "text-slate-400 dark:text-white/35"
                          }
                        >
                          {formatMoney(row.suggested_amount, false)}
                        </span>
                        {row.months_left > 0 && moneyValue(row.suggested_amount) > 0 ? (
                          <div className="text-[10px] text-slate-500 dark:text-white/40 whitespace-nowrap">
                            على {row.months_left} {row.months_left === 1 ? "شهر" : row.months_left === 2 ? "شهرين" : row.months_left <= 10 ? "أشهر" : "شهراً"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const confirmed =
                            row.confirmed_amount !== null && row.confirmed_amount !== undefined;
                          const draft = reserveDraftValue(row);
                          const draftValue = moneyValue(draft);
                          const dirty =
                            confirmed && Math.abs(draftValue - moneyValue(row.confirmed_amount)) > 0.005;
                          const busy =
                            confirmingAll ||
                            (confirmReserveMut.isPending &&
                              confirmReserveMut.variables?.payment_id === row.id);
                          if (!canConfirmReserve) {
                            return (
                              <span className="text-[11px] text-slate-400 dark:text-white/35 whitespace-nowrap">
                                شهر مستقبلي
                              </span>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              <input
                                type="number"
                                value={draft}
                                min="0"
                                step="0.01"
                                dir="ltr"
                                onChange={(event) =>
                                  setReserveDrafts((drafts) => ({
                                    ...drafts,
                                    [row.id]: event.target.value,
                                  }))
                                }
                                className={`${ws.input} w-28 px-2 py-1.5 text-xs text-right tabular-nums ${
                                  confirmed && !dirty
                                    ? "border-[#c9e2d8] dark:border-emerald-400/30"
                                    : ""
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => confirmReserveRow(row)}
                                disabled={busy || (confirmed && !dirty) || draftValue < 0}
                                className={`${confirmed && !dirty ? ws.btnNeutral : ws.btnPrimary} px-2.5 py-1.5 text-[11px] whitespace-nowrap disabled:opacity-50`}
                                title={confirmed ? "حفظ المبلغ المعدّل" : "تأكيد استقطاع هذا الشهر"}
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                {confirmed ? (dirty ? "حفظ" : "مؤكد") : "تأكيد"}
                              </button>
                              {confirmed ? (
                                <button
                                  type="button"
                                  onClick={() => clearReserveRow(row)}
                                  disabled={busy}
                                  className={`${ws.iconButton} disabled:opacity-50`}
                                  title="إلغاء استقطاع هذا الشهر"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          );
                        })()}
                        {row.confirmed_by ? (
                          <div className="text-[10px] text-slate-400 dark:text-white/35 mt-1 whitespace-nowrap">
                            أكده {row.confirmed_by}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-left tabular-nums font-bold text-amber-700 dark:text-amber-200" dir="ltr">
                        {formatMoney(row.remaining_actual ?? row.remaining, false)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`${ws.pill} whitespace-nowrap ${
                            row.overdue
                              ? "bg-rose-100 dark:bg-rose-400/10 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-400/25"
                              : row.due_this_month
                                ? "bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-400/25"
                                : "bg-[#e7f2ee] dark:bg-emerald-400/10 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25"
                          }`}
                        >
                          {row.overdue ? "متأخرة" : row.due_this_month ? "تستحق هذا الشهر" : "جارية"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Array.isArray(reserveRevenue.by_branch) && reserveRevenue.by_branch.length > 1 && !reserveBranch ? (
        <div className={`${ws.glassSoft} ${ws.card} p-4`}>
          <div className="text-xs font-bold text-slate-700 dark:text-white/70 mb-2">
            إيرادات الشهر حسب الفرع
          </div>
          <div className="flex flex-wrap gap-2">
            {reserveRevenue.by_branch.map((b) => (
              <span key={b.branch_id ?? "none"} className={ws.chip}>
                {b.branch_name || "بدون فرع"}
                <span className="tabular-nums font-bold" dir="ltr">
                  {formatMoney(b.total, false)}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`${ws.glassSoft} ${ws.card} p-4`}>
        <div className="flex items-start gap-3">
          <div className={`${ws.iconBox} w-10 h-10 shrink-0`}>
            <Info className="w-5 h-5 text-sky-700 dark:text-sky-200" />
          </div>
          <div className="min-w-0 text-sm text-slate-600 dark:text-white/60 leading-7">
            <div className="font-bold text-slate-900 dark:text-white tracking-tight">
              كيف يُحسب الاستقطاع؟
            </div>
            <div>
              لكل دفعة معلّقة: <b>الاستقطاع الشهري</b> = المبلغ شامل الضريبة ÷ عدد أشهر
              نافذة الادخار، والنافذة تبدأ من استحقاق الدفعة السابقة (أو بداية العقد /
              تاريخ إضافته إن كان بعدها) وتنتهي بالشهر السابق لشهر الاستحقاق — فالدفعة
              النصف سنوية تُدَّخر على 6 أشهر ثم تُسدَّد عند استحقاقها.
            </div>
            <div>
              <b>المقترح لهذا الشهر</b> يصحّح نفسه: (المبلغ − المؤكد فعلياً في الأشهر السابقة) ÷
              الأشهر المتبقية حتى الشهر السابق للاستحقاق — إذا فات شهر بلا استقطاع ارتفع
              المقترح تلقائياً، وإذا استُقطع أكثر انخفض. عدّل المبلغ إن لزم ثم اضغط «تأكيد»
              ليُسجَّل ما حُجز فعلياً من إيرادات الشهر.
            </div>
            <div>
              <b>حصة هذا الشهر بالخطة</b> هي ما يُستقطع من إيرادات تقفيلات الشهر المختار (آخر شهر
              في النافذة يحمل الباقي حتى يكتمل المبلغ)، و<b>المُدَّخر المفترض</b> = الاستقطاع
              الشهري × الأشهر المنقضية، و<b>المتبقي</b> = المبلغ − المُدَّخر. الدفعات المتأخرة
              انتهت نافذتها: حصتها هذا الشهر صفر ويُعدّ ادخارها مكتملاً بالخطة، وتبقى ضمن
              الدفعات المعلّقة حتى تُسدَّد من «سداد المستحق».
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="space-y-4">
        {sub === "due" ? renderDue() : sub === "reserve" ? renderReserve() : renderContracts()}
      </div>

      {/* نافذة الإضافة */}
      <LeaseContractModal
        open={showAdd}
        contract={null}
        contacts={contacts}
        branches={branches}
        isSubmitting={createMut.isPending}
        onClose={() => setShowAdd(false)}
        onSubmit={handleSubmitContract}
      />

      {/* نافذة التعديل — تُفتح بعد وصول العقد بدفعاته */}
      <LeaseContractModal
        open={!!editingId && !!editDetailQuery.data}
        contract={editDetailQuery.data || null}
        contacts={contacts}
        branches={branches}
        isSubmitting={updateMut.isPending}
        onClose={() => setEditingId(null)}
        onSubmit={handleSubmitContract}
      />
      {editingId && !editDetailQuery.data && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40" dir="rtl">
              <div className={`${ws.glass} ${ws.card} px-5 py-4 flex items-center gap-3 text-sm`}>
                {editDetailQuery.isError ? (
                  <>
                    <span className="text-rose-700 dark:text-rose-300">
                      {editDetailQuery.error?.message || "فشل تحميل العقد"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
                    >
                      إغلاق
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري تحميل العقد…
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {paying ? (
        <LeasePayModal
          payment={paying}
          bankAccounts={bankAccounts}
          isSubmitting={payMut.isPending}
          onClose={() => setPaying(null)}
          onSubmit={(payload) => payMut.mutate(payload, { onSuccess: () => setPaying(null) })}
        />
      ) : null}

      {/* درج تفاصيل العقد */}
      {drawerContract && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[950]"
              dir="rtl"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setPreviewId(null);
              }}
            >
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                onMouseDown={() => setPreviewId(null)}
                aria-hidden="true"
              />
              <aside className="absolute inset-y-0 left-0 w-full sm:w-[520px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/10 shadow-2xl overflow-y-auto">
                <div
                  className={`sticky top-0 z-10 bg-white dark:bg-slate-950 px-5 py-4 border-b ${ws.divider} flex items-center justify-between gap-3`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white font-mono" dir="ltr">
                      {drawerContract.contract_number || `#${drawerContract.id}`}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-white/50 truncate mt-0.5">
                      {drawerContract.lessor_name}
                      {drawerContract.lessor_vat_number ? (
                        <span className="font-mono" dir="ltr">
                          {" "}
                          · {drawerContract.lessor_vat_number}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill
                      status={drawerContract.computed_status}
                      inactive={drawerContract.is_active === false}
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewId(null)}
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
                      <div className="text-[11px] text-slate-500 dark:text-white/45">الموقع</div>
                      <div className="font-semibold">{drawerContract.location || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">الفرع</div>
                      <div className="font-semibold">{drawerContract.branch_name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">البداية</div>
                      <div className="font-semibold font-mono" dir="ltr">
                        {formatDate(drawerContract.start_date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">الانتهاء</div>
                      <div className="font-semibold font-mono" dir="ltr">
                        {formatDate(drawerContract.end_date)}
                      </div>
                      {Number.isFinite(Number(drawerContract.days_to_end)) ? (
                        <div className="text-[11px] text-slate-500 dark:text-white/45">
                          {drawerContract.days_to_end >= 0
                            ? `بعد ${drawerContract.days_to_end} ${daysWord(drawerContract.days_to_end)}`
                            : `انتهى قبل ${-drawerContract.days_to_end} ${daysWord(drawerContract.days_to_end)}`}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">فترة الإشعار</div>
                      <div className="font-semibold">
                        {drawerContract.notice_period_days
                          ? `${drawerContract.notice_period_days} يوم`
                          : "—"}
                      </div>
                      {drawerContract.notice_starts_on ? (
                        <div className="text-[11px] text-slate-500 dark:text-white/45">
                          تبدأ{" "}
                          <span className="font-mono" dir="ltr">
                            {drawerContract.notice_starts_on}
                          </span>
                        </div>
                      ) : null}
                      {drawerContract.notice_period_text ? (
                        <div className="text-[11px] text-slate-500 dark:text-white/45">
                          {drawerContract.notice_period_text}
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">التكرار</div>
                      <div className="font-semibold">
                        {FREQUENCY_LABELS[drawerContract.payment_frequency] ||
                          drawerContract.payment_frequency}
                      </div>
                      {drawerContract.payment_frequency !== "custom" ? (
                        <div className="text-[11px] text-slate-500 dark:text-white/45 tabular-nums" dir="ltr">
                          {formatMoney(drawerContract.installment_amount, false)} + VAT{" "}
                          {moneyValue(drawerContract.vat_rate)}% ={" "}
                          {formatMoney(contractInstallmentIncl(drawerContract), false)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className={`${ws.glassSoft} ${ws.card} p-3 grid grid-cols-3 gap-2 text-center`}>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">إجمالي العقد</div>
                      <div className="text-sm font-bold tabular-nums" dir="ltr">
                        {formatMoney(drawerContract.total_value, false)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">المدفوع</div>
                      <div className="text-sm font-bold tabular-nums text-[#0e7a5f] dark:text-emerald-200" dir="ltr">
                        {formatMoney(drawerContract.paid_total, false)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-white/45">المتبقي</div>
                      <div className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-200" dir="ltr">
                        {formatMoney(drawerContract.pending_total, false)}
                      </div>
                    </div>
                  </div>

                  {drawerContract.attachment_url ? (
                    <a
                      href={drawerContract.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className={`${ws.glassSoft} ${ws.card} px-3 py-2 flex items-center gap-2 text-xs text-slate-700 dark:text-white/70 hover:text-[#0e7a5f] dark:hover:text-emerald-300`}
                    >
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1" dir="ltr">
                        {drawerContract.attachment_name || "نسخة العقد"}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  ) : null}

                  {drawerContract.notes ? (
                    <div className="text-xs text-slate-600 dark:text-white/60 leading-relaxed whitespace-pre-wrap">
                      {drawerContract.notes}
                    </div>
                  ) : null}

                  {/* جدول الدفعات */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-xs font-bold text-slate-700 dark:text-white/70">
                        جدول الدفعات ({drawerPayments.length})
                      </div>
                      {detailQuery.isFetching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      ) : null}
                    </div>
                    {detailQuery.isLoading ? (
                      <div className="text-xs text-slate-500 dark:text-white/45 py-3 text-center">
                        جاري تحميل الدفعات…
                      </div>
                    ) : drawerPayments.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-white/45 py-3 text-center">
                        لا دفعات مسجلة لهذا العقد.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {drawerPayments.map((payment) => {
                          const isEditingRow = editingPayment?.id === payment.id;
                          return (
                            <div
                              key={payment.id}
                              className={`rounded-[10px] border p-2.5 text-[11px] ${
                                payment.status === "cancelled"
                                  ? "border-dashed border-slate-200 dark:border-white/10 opacity-60"
                                  : "border-[#e2e7e4] dark:border-white/10"
                              }`}
                            >
                              {isEditingRow ? (
                                <div className="space-y-2">
                                  <div className="font-bold text-slate-800 dark:text-white/85">
                                    تعديل الدفعة #{payment.seq}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <div className="text-slate-500 dark:text-white/45 mb-0.5">الاستحقاق</div>
                                      <input
                                        type="date"
                                        value={editingPayment.due_date}
                                        onChange={(event) =>
                                          setEditingPayment((s) => ({ ...s, due_date: event.target.value }))
                                        }
                                        className={`${ws.input} px-2 py-1.5 text-xs`}
                                        dir="ltr"
                                      />
                                    </div>
                                    <div>
                                      <div className="text-slate-500 dark:text-white/45 mb-0.5">قبل الضريبة</div>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingPayment.amount_excl}
                                        onChange={(event) =>
                                          setEditingPayment((s) => ({ ...s, amount_excl: event.target.value }))
                                        }
                                        className={`${ws.input} px-2 py-1.5 text-xs text-right`}
                                        dir="ltr"
                                      />
                                    </div>
                                    <div>
                                      <div className="text-slate-500 dark:text-white/45 mb-0.5">الضريبة %</div>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={editingPayment.vat_rate}
                                        onChange={(event) =>
                                          setEditingPayment((s) => ({ ...s, vat_rate: event.target.value }))
                                        }
                                        className={`${ws.input} px-2 py-1.5 text-xs text-right`}
                                        dir="ltr"
                                      />
                                    </div>
                                  </div>
                                  <input
                                    type="text"
                                    value={editingPayment.notes}
                                    onChange={(event) =>
                                      setEditingPayment((s) => ({ ...s, notes: event.target.value }))
                                    }
                                    placeholder="ملاحظة (اختياري)"
                                    className={`${ws.input} px-2 py-1.5 text-xs`}
                                  />
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-500 dark:text-white/45 tabular-nums" dir="ltr">
                                      = {formatMoney(
                                        installmentAmounts({
                                          amount: editingPayment.amount_excl,
                                          vatRate: editingPayment.vat_rate,
                                          amountIncludesVat: false,
                                        }).amount_incl,
                                      )}
                                    </span>
                                    <div className="flex-1" />
                                    <button
                                      type="button"
                                      onClick={() => setEditingPayment(null)}
                                      className={`${ws.btnNeutral} px-2.5 py-1 text-[11px]`}
                                    >
                                      إلغاء
                                    </button>
                                    <button
                                      type="button"
                                      disabled={updatePaymentMut.isPending}
                                      onClick={saveEditPayment}
                                      className={`${ws.btnPrimary} px-2.5 py-1 text-[11px] disabled:opacity-50`}
                                    >
                                      {updatePaymentMut.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Save className="w-3 h-3" />
                                      )}
                                      حفظ
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400 dark:text-white/35 w-6 shrink-0 font-mono">
                                    #{payment.seq}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono text-slate-800 dark:text-white/85" dir="ltr">
                                        {payment.due_date}
                                      </span>
                                      <PaymentPill payment={payment} today={today} />
                                      {payment.status === "pending" ? (
                                        <DueBadge dueDate={payment.due_date} today={today} />
                                      ) : null}
                                    </div>
                                    <div className="text-slate-500 dark:text-white/45 truncate">
                                      {payment.period_start && payment.period_end ? (
                                        <span className="font-mono" dir="ltr">
                                          {payment.period_start} → {payment.period_end}
                                        </span>
                                      ) : null}
                                      {payment.status === "paid" ? (
                                        <>
                                          {payment.period_start ? " · " : ""}
                                          سُدد {payment.paid_date || "—"}
                                          {payment.invoice_number ? (
                                            <span className="font-mono" dir="ltr">
                                              {" "}
                                              · {payment.invoice_number}
                                            </span>
                                          ) : null}
                                          {payment.bank_name ? ` · ${payment.bank_name}` : ""}
                                        </>
                                      ) : null}
                                      {payment.notes ? ` · ${payment.notes}` : ""}
                                    </div>
                                  </div>
                                  <div className="text-left shrink-0 tabular-nums" dir="ltr">
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {formatMoney(payment.amount_incl, false)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-white/35">
                                      {formatMoney(payment.amount_excl, false)} + {moneyValue(payment.vat_rate)}%
                                    </div>
                                  </div>
                                  {payment.receipt_url ? (
                                    <a
                                      href={payment.receipt_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-slate-400 hover:text-[#0e7a5f] dark:text-white/40 dark:hover:text-emerald-300 shrink-0"
                                      title="إيصال السداد"
                                    >
                                      <Paperclip className="w-3 h-3" />
                                    </a>
                                  ) : null}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {payment.status === "pending" && drawerContract.is_active !== false ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => openPayFromDrawer(payment)}
                                          className={`${ws.iconButton} w-7 h-7 hover:bg-[#e7f2ee] dark:hover:bg-emerald-500/15 hover:text-[#0e7a5f] dark:hover:text-emerald-200`}
                                          title="سداد"
                                        >
                                          <HandCoins className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => startEditPayment(payment)}
                                          className={`${ws.iconButton} w-7 h-7`}
                                          title="تعديل"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCancelPayment(payment)}
                                          className={`${ws.iconButton} w-7 h-7 hover:text-red-700 dark:hover:text-red-200`}
                                          title="إلغاء الدفعة"
                                        >
                                          <Ban className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : payment.status === "paid" ? (
                                      <button
                                        type="button"
                                        onClick={() => handleUnpay(payment)}
                                        disabled={unpayMut.isPending}
                                        className={`${ws.iconButton} w-7 h-7 disabled:opacity-50`}
                                        title="التراجع عن السداد"
                                      >
                                        <Undo2 className="w-3.5 h-3.5" />
                                      </button>
                                    ) : payment.status === "cancelled" ? (
                                      <button
                                        type="button"
                                        onClick={() => handleRestorePayment(payment)}
                                        disabled={updatePaymentMut.isPending}
                                        className={`${ws.btnNeutral} px-2 py-1 text-[10px] disabled:opacity-50`}
                                        title="إعادة الدفعة إلى المعلّقة"
                                      >
                                        استرجاع
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 dark:text-white/35">
                    أُضيف بواسطة {drawerContract.created_by_employee_name || "—"}
                    {drawerContract.created_at ? (
                      <span className="font-mono" dir="ltr">
                        {" "}
                        · {String(drawerContract.created_at).slice(0, 10)}
                      </span>
                    ) : null}
                  </div>

                  <div className={`flex items-center gap-2 pt-3 border-t ${ws.divider} flex-wrap`}>
                    <button
                      type="button"
                      onClick={() => setEditingId(drawerContract.id)}
                      className={`${ws.btnPrimary} px-3 py-2 text-xs`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      تعديل العقد
                    </button>
                    {drawerContract.computed_status !== "terminated" &&
                    drawerContract.is_active !== false ? (
                      <button
                        type="button"
                        onClick={() => onSubChange?.("due")}
                        className={`${ws.btnNeutral} px-3 py-2 text-xs`}
                        title="الانتقال إلى سداد المستحق"
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        سداد المستحق
                      </button>
                    ) : null}
                    <div className="flex-1" />
                    {drawerContract.is_active === false ? (
                      <button
                        type="button"
                        onClick={() => reactivateMut.mutate({ id: drawerContract.id })}
                        disabled={reactivateMut.isPending}
                        className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50`}
                        title="إعادة العقد الموقوف إلى العقود النشطة"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        إعادة تفعيل
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteContract(drawerContract)}
                      disabled={deleteMut.isPending}
                      className={`${ws.btnDanger} px-3 py-2 text-xs disabled:opacity-50`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {drawerContract.is_active === false ? "حذف نهائي" : "إيقاف"}
                    </button>
                  </div>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
