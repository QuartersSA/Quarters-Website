"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Pencil,
  PieChart as PieIcon,
  Plus,
  Receipt,
  ScrollText,
  Search,
  Table2,
  Trash2,
  Wallet,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import PurchaseInvoiceModal from "@/components/Accounting/PurchaseInvoiceModal";
import useAdminTheme from "@/hooks/useAdminTheme";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { useAccountingContacts } from "@/hooks/useAccountingContacts";
import { useAccountingAccounts } from "@/hooks/useAccountingAccounts";
import { useAccountingBankAccounts } from "@/hooks/useAccountingBankAccounts";
import {
  useAccountingPurchaseInvoices,
  useCreateAccountingPurchaseInvoice,
} from "@/hooks/useAccountingPurchaseInvoices";
import {
  invalidateBranchProjectQueries,
  useBranchProjects,
  useDeleteBranchProjectInvoice,
  useSaveBranchProjectInvoice,
} from "@/hooks/useBranchProjects";
import { authedFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import {
  DEFAULT_PHASE_TEMPLATE,
  ESTABLISHMENT_ACCOUNTS,
  INVOICE_STATUS_LABELS,
  invoiceStatus,
  phaseBudget,
  projectBudget,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import { EmptyState, ModalShell, ProgressBar, SectionCard, SummaryCard, formatDate, formatMoney, moneyValue } from "./shared";
import ExpenseModal from "./ExpenseModal";

// تبويب المصروفات: ملخص الميزانية، جدول قسم/فعلي، رسم دائري، فواتير.
// الفواتير فواتير مشتريات حقيقية مرتبطة بالمشروع (project_id/project_phase_id):
// «+ فاتورة» يفتح نافذة فاتورة المشتريات بتعبئة مسبقة، «ربط فاتورة موجودة»
// يربط فاتورة غير مرتبطة، التعديل هنا = القسم والحساب فقط، والحذف نهائي.

const DEFAULT_ACCOUNT = "5399";

const PIE_COLORS = [
  "#0e7a5f",
  "#0284c7",
  "#7c3aed",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#9333ea",
  "#ea580c",
  "#64748b",
];

const STATUS_CLASS = {
  paid: "bg-[#e7f2ee] dark:bg-emerald-400/15 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25",
  partial_paid: "bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-400/25",
  overdue: "bg-rose-100 dark:bg-rose-400/15 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-400/25",
  pending_payment: "bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/15",
};

const STATUS_ORDER = ["pending_payment", "partial_paid", "paid", "overdue"];

function InvoiceStatusPill({ status }) {
  const cls = STATUS_CLASS[status] || STATUS_CLASS.pending_payment;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${cls}`}>
      {INVOICE_STATUS_LABELS?.[status] || status}
    </span>
  );
}

// شارة فاتورة استقطاع إيجار (مصدرها العقد — لا تُحذف من هنا).
function LeaseChip({ invoice }) {
  if (invoice?.source !== "lease") return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-sky-200 dark:border-sky-400/25 bg-sky-50 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
      title={`استقطاع إيجار${invoice.lease_month ? ` لشهر ${invoice.lease_month}` : ""} — يُدار من العقد`}
    >
      <ScrollText className="w-3 h-3" />
      إيجار
    </span>
  );
}

function accountName(code, fallback) {
  const found = (ESTABLISHMENT_ACCOUNTS || []).find((a) => String(a.code) === String(code));
  return found?.name || fallback || code || "—";
}

// الحساب الافتراضي للقسم: من القسم نفسه، وإلا من القالب إن طابق الاسم/اللون.
function inferAccountForPhase(project, phaseId) {
  if (!phaseId) return DEFAULT_ACCOUNT;
  const phase = (project?.phases || []).find((p) => String(p?.id) === String(phaseId));
  if (!phase) return DEFAULT_ACCOUNT;
  if (phase.default_account_code) return String(phase.default_account_code);
  const template = Array.isArray(DEFAULT_PHASE_TEMPLATE) ? DEFAULT_PHASE_TEMPLATE : [];
  const match = template.find((t) => t?.name && phase.name && String(t.name).trim() === String(phase.name).trim());
  if (match?.default_account_code) return String(match.default_account_code);
  const byColor = template.find((t) => t?.color && phase.color && t.color === phase.color);
  if (byColor?.default_account_code) return String(byColor.default_account_code);
  return DEFAULT_ACCOUNT;
}

function PieTooltip({ active, payload, isDark, total }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = total > 0 ? Math.round((moneyValue(item.value) / total) * 100) : 0;
  return (
    <div
      className="text-xs px-3 py-2 rounded-xl shadow-lg"
      style={{
        background: isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.98)",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(15, 23, 42, 0.12)"}`,
        color: isDark ? "#fff" : "rgb(15, 23, 42)",
        minWidth: 140,
      }}
      dir="rtl"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: item.payload?.fill || item.color }} />
        <span style={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgb(51, 65, 85)" }}>{item.name}</span>
      </div>
      <div className="font-bold mt-1" dir="ltr">
        {formatMoney(item.value)} · {pct}%
      </div>
    </div>
  );
}

// نافذة «ربط فاتورة موجودة»: فواتير المشتريات غير المرتبطة بأي مشروع،
// بحث بالرقم/المورد، اختيار قسم، ثم POST {invoice_id, phase_id}.
function LinkInvoiceModal({ open, project, phases, defaultPhaseId, employeeId, isAdmin, onClose }) {
  const queryClient = useQueryClient();
  const saveMut = useSaveBranchProjectInvoice();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [phaseId, setPhaseId] = useState("");

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedId(null);
    setPhaseId(defaultPhaseId != null ? String(defaultPhaseId) : "");
  }, [open, defaultPhaseId]);

  // تُحمَّل فقط عند فتح النافذة (القائمة ثقيلة: بنود ودفعات ومرفقات).
  const invoicesQuery = useAccountingPurchaseInvoices({
    employeeId: open ? employeeId : null,
    isAdmin: !!isAdmin,
  });

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (invoicesQuery.data || [])
      .filter((inv) => !inv.project_id && inv.is_active !== false)
      .filter((inv) => {
        if (!q) return true;
        const hay = `${inv.invoice_number || ""} ${inv.supplier_name || ""} ${inv.contact_name || ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 60);
  }, [invoicesQuery.data, search]);

  const phaseOptions = useMemo(
    () => [{ value: "", label: "بلا قسم" }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))],
    [phases],
  );

  const selected = candidates.find((inv) => inv.id === selectedId) || null;

  function handleConfirm() {
    if (!project?.id || !selected || saveMut.isPending) return;
    saveMut.mutate(
      { project_id: project.id, invoice_id: selected.id, phase_id: phaseId ? Number(phaseId) : null },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.accountingPurchaseInvoices() });
          onClose?.();
        },
      },
    );
  }

  return (
    <ModalShell
      open={open}
      title="ربط فاتورة موجودة"
      description="فواتير المشتريات غير المرتبطة بأي مشروع تأسيس"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${ws.btnNeutral} px-4 py-2 text-sm`}>
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selected || saveMut.isPending}
            className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            ربط بالمشروع
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/35" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${ws.input} pr-9 pl-3 py-2 text-sm`}
              placeholder="بحث برقم الفاتورة أو المورد…"
              autoFocus
            />
          </div>
          <div>
            <GlassSelect value={phaseId} onChange={setPhaseId} options={phaseOptions} placeholder="القسم" buttonClassName="text-sm py-2 px-3" />
          </div>
        </div>

        {invoicesQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500 dark:text-white/50">
            <Loader2 className="w-4 h-4 animate-spin" />
            جاري تحميل الفواتير…
          </div>
        ) : invoicesQuery.isError ? (
          <div className="text-sm text-rose-700 dark:text-rose-200 py-6 text-center">
            {invoicesQuery.error?.message || "فشل تحميل فواتير المشتريات"}
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-white/45 py-8 text-center">
            {search ? "لا فواتير مطابقة." : "لا فواتير غير مرتبطة."}
          </div>
        ) : (
          <ul className={`divide-y ${ws.divider} max-h-[50svh] overflow-y-auto -mx-1 px-1`}>
            {candidates.map((inv) => {
              const active = inv.id === selectedId;
              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(inv.id)}
                    className={`w-full text-right px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                      active ? "bg-[#e7f2ee] dark:bg-emerald-400/15" : "hover:bg-slate-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        active
                          ? "bg-[#0e7a5f] border-[#0e7a5f] text-white"
                          : "border-slate-300 dark:border-white/25 text-transparent"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm text-slate-900 dark:text-white" dir="ltr">
                        {inv.invoice_number}
                      </span>
                      <span className="block text-xs text-slate-600 dark:text-white/60 truncate">
                        {inv.supplier_name || inv.contact_name || "—"} · {formatDate(inv.invoice_date)}
                        {inv.lease_contract_id ? " · استقطاع إيجار" : ""}
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold text-sm text-slate-900 dark:text-white shrink-0" dir="ltr">
                      {formatMoney(inv.total_amount, false)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selected ? (
          <div className="text-[11px] text-slate-500 dark:text-white/45">
            ستُحسب الفاتورة «{selected.invoice_number}» ضمن تكاليف تأسيس {project?.name || "المشروع"}
            {phaseId ? ` — قسم ${phases.find((p) => String(p.id) === phaseId)?.name || ""}` : " بلا قسم"}.
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

export default function ExpensesTab({ project }) {
  const { isDark } = useAdminTheme();
  const queryClient = useQueryClient();
  const { employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";
  const today = useMemo(() => todayRiyadh(), []);
  const deleteMut = useDeleteBranchProjectInvoice();
  const createMut = useCreateAccountingPurchaseInvoice();

  // بيانات نافذة فاتورة المشتريات (نفس هوكس قائمة الفواتير).
  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const accountsQuery = useAccountingAccounts({ employeeId, isAdmin });
  const bankAccountsQuery = useAccountingBankAccounts({ employeeId, isAdmin });
  const projectsQuery = useBranchProjects({ employeeId, isAdmin });
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
  const contacts = contactsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const bankAccounts = bankAccountsQuery.data || [];
  const branches = branchesQuery.data || [];
  // المشروع الحالي دائماً ضمن القائمة حتى لو لم تُحمَّل بعد.
  const projects = useMemo(() => {
    const list = Array.isArray(projectsQuery.data) ? projectsQuery.data : [];
    if (project?.id && !list.some((p) => Number(p?.id) === Number(project.id))) return [project, ...list];
    return list;
  }, [projectsQuery.data, project]);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const phases = useMemo(() => {
    const list = Array.isArray(project?.phases) ? [...project.phases] : [];
    list.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return list;
  }, [project?.phases]);

  const invoices = useMemo(
    () =>
      (Array.isArray(project?.invoices) ? project.invoices : []).map((inv) => ({
        ...inv,
        _status: invoiceStatus(inv, today) || inv.status || "pending_payment",
      })),
    [project?.invoices, today],
  );

  const budget = useMemo(() => projectBudget(project), [project]);

  const phaseRows = useMemo(() => {
    const rows = phases.map((phase) => ({ key: String(phase.id), name: phase.name, color: phase.color, ...phaseBudget(phase, invoices) }));
    const orphan = invoices.filter((inv) => inv.phase_id == null);
    if (orphan.length > 0) {
      const committed = orphan.reduce((s, i) => s + moneyValue(i.total_amount), 0);
      const paid = orphan.reduce((s, i) => s + moneyValue(i.paid_amount), 0);
      rows.push({ key: "none", name: "بلا قسم", color: "#94a3b8", budget: 0, committed, paid, remaining: -committed, over: committed, pct: committed > 0 ? 100 : 0 });
    }
    return rows;
  }, [phases, invoices]);

  const pieData = useMemo(() => {
    const map = new Map();
    const names = new Map();
    for (const inv of invoices) {
      const code = String(inv.expense_account_code || DEFAULT_ACCOUNT);
      map.set(code, (map.get(code) || 0) + moneyValue(inv.total_amount));
      if (inv.expense_account_name && !names.has(code)) names.set(code, inv.expense_account_name);
    }
    return [...map.entries()]
      .map(([code, value]) => ({ code, name: accountName(code, names.get(code)), value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((d, i) => ({ ...d, fill: PIE_COLORS[i % PIE_COLORS.length] }));
  }, [invoices]);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const phaseOptions = useMemo(
    () => [{ value: "all", label: "كل الأقسام" }, { value: "none", label: "بلا قسم" }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))],
    [phases],
  );
  const accountOptions = useMemo(
    () => [{ value: "all", label: "كل الحسابات" }, ...(ESTABLISHMENT_ACCOUNTS || []).map((a) => ({ value: String(a.code), label: `${a.code} — ${a.name}` }))],
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        if (phaseFilter === "none" && inv.phase_id != null) return false;
        if (phaseFilter !== "all" && phaseFilter !== "none" && String(inv.phase_id) !== phaseFilter) return false;
        if (accountFilter !== "all" && String(inv.expense_account_code) !== accountFilter) return false;
        if (statusFilter !== "all" && inv._status !== statusFilter) return false;
        if (q) {
          const hay = `${inv.invoice_number || ""} ${inv.supplier_name || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.invoice_date || "").localeCompare(String(a.invoice_date || "")));
  }, [invoices, phaseFilter, accountFilter, statusFilter, search]);

  const phaseName = (id) => (id == null ? "بلا قسم" : phases.find((p) => String(p.id) === String(id))?.name || "—");

  const exportColumns = useMemo(
    () => [
      { header: "رقم الفاتورة", accessor: (r) => r.invoice_number || "" },
      { header: "التاريخ", accessor: (r) => formatDate(r.invoice_date) },
      { header: "الاستحقاق", accessor: (r) => formatDate(r.due_date) },
      { header: "المورد", accessor: (r) => r.supplier_name || "" },
      { header: "القسم", accessor: (r) => phaseName(r.phase_id) },
      { header: "الحساب", accessor: (r) => `${r.expense_account_code || ""} ${accountName(r.expense_account_code, r.expense_account_name)}` },
      { header: "المصدر", accessor: (r) => (r.source === "lease" ? "إيجار" : "مشتريات") },
      { header: "الإجمالي", accessor: (r) => formatMoney(r.total_amount, false) },
      { header: "المسدد", accessor: (r) => formatMoney(r.paid_amount, false) },
      { header: "المتبقي", accessor: (r) => formatMoney(moneyValue(r.total_amount) - moneyValue(r.paid_amount), false) },
      { header: "الحالة", accessor: (r) => INVOICE_STATUS_LABELS?.[r._status] || r._status },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phases],
  );

  const exportTitle = `مصروفات تأسيس — ${project?.name || ""}`;
  const exportFile = `branch-project-${project?.code || project?.id || "expenses"}`;

  // القسم المختار في الفلتر يصير القسم الافتراضي للفاتورة الجديدة/المربوطة.
  const defaultPhaseId = phaseFilter !== "all" && phaseFilter !== "none" ? Number(phaseFilter) : null;
  const prefill = useMemo(
    () => ({
      project_id: project?.id ?? null,
      project_phase_id: defaultPhaseId,
      expense_account_code: defaultPhaseId ? inferAccountForPhase(project, defaultPhaseId) : null,
    }),
    [project, defaultPhaseId],
  );

  function handleCreate(payload) {
    if (!project?.id || createMut.isPending) return;
    createMut.mutate(
      {
        ...payload,
        project_id: payload.project_id ?? project.id,
        project_phase_id: payload.project_id ? (payload.project_phase_id ?? null) : null,
      },
      {
        onSuccess: async () => {
          setInvoiceModalOpen(false);
          await invalidateBranchProjectQueries(queryClient, project.id);
        },
      },
    );
  }

  function handleDelete(inv) {
    if (!project?.id || inv.source === "lease") return;
    if (!window.confirm(`حذف الفاتورة «${inv.invoice_number}» نهائياً من فواتير المشتريات؟`)) return;
    deleteMut.mutate(
      { project_id: project.id, id: inv.id },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accountingPurchaseInvoices() }) },
    );
  }

  const statCards = [
    { label: "الميزانية الإجمالية", value: formatMoney(budget.budget_total, false), icon: Wallet, tone: "slate" },
    {
      label: "مجموع ميزانيات الأقسام",
      value: formatMoney(budget.phases_budget, false),
      icon: Table2,
      tone: budget.unallocated < 0 ? "rose" : "sky",
      suffix: `غير موزَّع: ${formatMoney(budget.unallocated, false)}`,
    },
    { label: "الملتزم به", value: formatMoney(budget.committed, false), icon: Receipt, tone: budget.over ? "rose" : "amber", suffix: `${Math.round(budget.pct || 0)}% من الميزانية` },
    { label: "المسدد", value: formatMoney(budget.paid, false), icon: Download, tone: "emerald", suffix: `متبقٍ: ${formatMoney(budget.remaining, false)}` },
  ];

  return (
    <div className="space-y-4">
      {/* الملخص */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <SummaryCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} suffix={c.suffix} />
        ))}
      </div>
      {budget.over ? (
        <div className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-400/10 border border-rose-200 dark:border-rose-400/25 rounded-[10px] px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          الملتزم به تجاوز الميزانية الإجمالية بمقدار {formatMoney(Math.abs(budget.remaining))}.
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
        {/* الميزانية مقابل الفعلي */}
        <SectionCard title="الميزانية مقابل الفعلي" icon={Table2} description="لكل قسم">
          {phaseRows.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-white/45 py-4 text-center">لا أقسام بعد.</div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="text-slate-500 dark:text-white/45">
                    <th className="text-right font-semibold py-2">القسم</th>
                    <th className="text-left font-semibold py-2">ميزانية</th>
                    <th className="text-left font-semibold py-2">ملتزم</th>
                    <th className="text-left font-semibold py-2">مسدد</th>
                    <th className="text-left font-semibold py-2">متبقٍ</th>
                    <th className="text-left font-semibold py-2 w-[120px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseRows.map((row) => (
                    <tr key={row.key} className={`border-t ${ws.divider}`}>
                      <td className="py-2 text-slate-900 dark:text-white">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color || "#94a3b8" }} />
                          {row.name}
                        </span>
                      </td>
                      <td className="py-2 text-left tabular-nums text-slate-700 dark:text-white/80" dir="ltr">{formatMoney(row.budget, false)}</td>
                      <td className={`py-2 text-left tabular-nums ${row.over ? "text-rose-600 dark:text-rose-300 font-semibold" : "text-slate-700 dark:text-white/80"}`} dir="ltr">{formatMoney(row.committed, false)}</td>
                      <td className="py-2 text-left tabular-nums text-[#0e7a5f] dark:text-emerald-200" dir="ltr">{formatMoney(row.paid, false)}</td>
                      <td className={`py-2 text-left tabular-nums ${row.remaining < 0 ? "text-rose-600 dark:text-rose-300" : "text-slate-700 dark:text-white/80"}`} dir="ltr">{formatMoney(row.remaining, false)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <ProgressBar pct={row.pct} tone={row.over ? "rose" : "sky"} className="flex-1" />
                          <span className="tabular-nums text-slate-500 dark:text-white/45 w-9 text-left" dir="ltr">{Math.round(row.pct || 0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* الرسم الدائري */}
        <SectionCard title="التوزيع حسب الحساب" icon={PieIcon}>
          {pieData.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-white/45 py-8 text-center">لا فواتير بعد.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] gap-3 items-center">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke={isDark ? "rgba(19,32,68,0.9)" : "#ffffff"} strokeWidth={2}>
                      {pieData.map((d) => (
                        <Cell key={d.code} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip isDark={isDark} total={pieTotal} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {pieData.map((d) => (
                  <li key={d.code} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                    <span className="text-slate-700 dark:text-white/80 flex-1 truncate">{d.name}</span>
                    <span className="tabular-nums text-slate-900 dark:text-white font-semibold" dir="ltr">{formatMoney(d.value, false)}</span>
                    <span className="tabular-nums text-slate-400 dark:text-white/35 w-9 text-left" dir="ltr">
                      {pieTotal > 0 ? Math.round((d.value / pieTotal) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      </div>

      {/* الفواتير */}
      <SectionCard
        title="الفواتير"
        icon={Receipt}
        description={`${filtered.length} من ${invoices.length}`}
        action={
          <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" onClick={() => exportToExcelHTML(filtered, exportFile, exportColumns, exportTitle)} disabled={filtered.length === 0} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs disabled:opacity-50`} title="تصدير Excel">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </button>
            <button type="button" onClick={() => exportToPDF(filtered, exportFile, exportColumns, exportTitle)} disabled={filtered.length === 0} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs disabled:opacity-50`} title="تصدير PDF">
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
            <button type="button" onClick={() => setLinkOpen(true)} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs`} title="ربط فاتورة مشتريات موجودة بهذا المشروع">
              <Link2 className="w-3.5 h-3.5" />
              ربط فاتورة موجودة
            </button>
            <button type="button" onClick={() => setInvoiceModalOpen(true)} className={`${ws.btnPrimary} px-3 py-1.5 text-xs`}>
              <Plus className="w-3.5 h-3.5" />
              فاتورة
            </button>
          </div>
        }
      >
        {/* الفلاتر */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/35" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className={`${ws.input} pr-9 pl-3 py-2 text-sm`} placeholder="بحث برقم الفاتورة أو المورد…" />
          </div>
          <GlassSelect value={phaseFilter} onChange={setPhaseFilter} options={phaseOptions} placeholder="القسم" buttonClassName="text-sm py-2 px-3" />
          <GlassSelect value={accountFilter} onChange={setAccountFilter} options={accountOptions} placeholder="الحساب" buttonClassName="text-sm py-2 px-3" menuWidth={300} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {[{ value: "all", label: "الكل" }, ...STATUS_ORDER.map((s) => ({ value: s, label: INVOICE_STATUS_LABELS?.[s] || s }))].map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`${ws.chip} px-2.5 py-1 ${active ? "!bg-[#0b3d31] !text-white !border-[#0b3d31] dark:!bg-white/10 dark:!border-white/20" : ""}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={invoices.length === 0 ? "لا فواتير بعد" : "لا نتائج مطابقة"}
            hint={invoices.length === 0 ? "أنشئ فاتورة مشتريات لهذا المشروع أو اربط فاتورة موجودة." : "عدّل الفلاتر أو البحث."}
          />
        ) : (
          <>
            {/* سطح المكتب */}
            <div className="hidden md:block overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="text-slate-500 dark:text-white/45">
                    <th className="text-right font-semibold py-2">رقم</th>
                    <th className="text-right font-semibold py-2">تاريخ</th>
                    <th className="text-right font-semibold py-2">مورد</th>
                    <th className="text-right font-semibold py-2">قسم</th>
                    <th className="text-right font-semibold py-2">حساب</th>
                    <th className="text-left font-semibold py-2">إجمالي</th>
                    <th className="text-left font-semibold py-2">مسدد</th>
                    <th className="text-right font-semibold py-2">حالة</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className={`border-t ${ws.divider}`}>
                      <td className="py-2 text-slate-900 dark:text-white">
                        <span className="inline-flex items-center gap-1.5" dir="ltr">
                          <span className="font-mono">{inv.invoice_number}</span>
                          <LeaseChip invoice={inv} />
                        </span>
                      </td>
                      <td className="py-2 tabular-nums text-slate-700 dark:text-white/80" dir="ltr">{formatDate(inv.invoice_date)}</td>
                      <td className="py-2 text-slate-900 dark:text-white">{inv.supplier_name}</td>
                      <td className="py-2 text-slate-700 dark:text-white/80">{phaseName(inv.phase_id)}</td>
                      <td className="py-2 text-slate-700 dark:text-white/80">
                        <span className="font-mono text-slate-400 dark:text-white/35 ml-1" dir="ltr">{inv.expense_account_code}</span>
                        {accountName(inv.expense_account_code, inv.expense_account_name)}
                      </td>
                      <td className="py-2 text-left tabular-nums text-slate-900 dark:text-white font-semibold" dir="ltr">{formatMoney(inv.total_amount, false)}</td>
                      <td className="py-2 text-left tabular-nums text-[#0e7a5f] dark:text-emerald-200" dir="ltr">{formatMoney(inv.paid_amount, false)}</td>
                      <td className="py-2"><InvoiceStatusPill status={inv._status} /></td>
                      <td className="py-2">
                        <div className="flex items-center gap-1 justify-end">
                          <button type="button" onClick={() => setEditInvoice(inv)} className={`${ws.iconButton} w-8 h-8`} title="القسم والحساب">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {inv.source !== "lease" ? (
                            <button type="button" onClick={() => handleDelete(inv)} className={`${ws.iconButton} w-8 h-8 text-rose-600 dark:text-rose-300`} title="حذف نهائي من فواتير المشتريات">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* الجوال */}
            <div className="md:hidden space-y-2">
              {filtered.map((inv) => (
                <div key={inv.id} className={`${ws.innerCard} p-3 space-y-2`}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-sm text-slate-900 dark:text-white" dir="ltr">{inv.invoice_number}</span>
                        <LeaseChip invoice={inv} />
                      </div>
                      <div className="text-xs text-slate-700 dark:text-white/80">{inv.supplier_name}</div>
                    </div>
                    <InvoiceStatusPill status={inv._status} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="text-slate-500 dark:text-white/45">تاريخ</div>
                    <div className="text-slate-900 dark:text-white tabular-nums text-left" dir="ltr">{formatDate(inv.invoice_date)}</div>
                    <div className="text-slate-500 dark:text-white/45">قسم</div>
                    <div className="text-slate-900 dark:text-white text-left">{phaseName(inv.phase_id)}</div>
                    <div className="text-slate-500 dark:text-white/45">حساب</div>
                    <div className="text-slate-900 dark:text-white text-left">{accountName(inv.expense_account_code, inv.expense_account_name)}</div>
                    <div className="text-slate-500 dark:text-white/45">إجمالي</div>
                    <div className="text-slate-900 dark:text-white tabular-nums font-semibold text-left" dir="ltr">{formatMoney(inv.total_amount, false)}</div>
                    <div className="text-slate-500 dark:text-white/45">مسدد</div>
                    <div className="text-[#0e7a5f] dark:text-emerald-200 tabular-nums text-left" dir="ltr">{formatMoney(inv.paid_amount, false)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <button type="button" onClick={() => setEditInvoice(inv)} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs`}>
                      <Pencil className="w-3.5 h-3.5" />
                      القسم والحساب
                    </button>
                    {inv.source !== "lease" ? (
                      <button type="button" onClick={() => handleDelete(inv)} className={`${ws.btnDanger} px-2.5 py-1.5 text-xs`}>
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* فاتورة مشتريات جديدة مرتبطة بالمشروع */}
      <PurchaseInvoiceModal
        open={invoiceModalOpen}
        invoice={null}
        contacts={contacts}
        accounts={accounts}
        bankAccounts={bankAccounts}
        branches={branches}
        projects={projects}
        prefill={prefill}
        isSubmitting={createMut.isPending}
        onClose={() => setInvoiceModalOpen(false)}
        onSubmit={handleCreate}
        allowArrival={false}
      />

      <LinkInvoiceModal
        open={linkOpen}
        project={project}
        phases={phases}
        defaultPhaseId={defaultPhaseId}
        employeeId={employeeId}
        isAdmin={isAdmin}
        onClose={() => setLinkOpen(false)}
      />

      <ExpenseModal open={!!editInvoice} project={project} invoice={editInvoice} onClose={() => setEditInvoice(null)} />
    </div>
  );
}
