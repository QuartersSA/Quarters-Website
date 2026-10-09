"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCheck,
  ExternalLink,
  FileSignature,
  HardHat,
  Link2,
  Link2Off,
  Loader2,
  Package,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassPopover from "@/components/Workspace/GlassPopover";
import { useAccountingContacts } from "@/hooks/useAccountingContacts";
import {
  useDeleteBranchProjectContract,
  useLinkContractInstallmentInvoice,
  useSaveBranchProjectContract,
} from "@/hooks/useBranchProjects";
import {
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  DEFAULT_PHASE_TEMPLATE,
  INSTALLMENT_STATUS_LABELS,
  contractTotals,
  installmentStatus,
  summarizeContracts,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import { EmptyState, ProgressBar, SectionCard, SummaryCard, formatDate, formatMoney } from "./shared";
import ContractModal from "./ContractModal";

// قسم «العقود» داخل تبويب المصاريف: عقود المقاولين والموردين ودفعاتها.
// السداد الفعلي يبقى عبر فواتير المشتريات: «تسجيل دفعة» يفتح نافذة
// فاتورة المشتريات معبّأة ويربطها بالدفعة، أو «ربط فاتورة موجودة».

const DEFAULT_ACCOUNT = "5399";

const KIND_ICONS = {
  contractor: HardHat,
  supplier: Package,
  service: Wrench,
  other: FileSignature,
};

const STATUS_CLASS = {
  active: "bg-[#e7f2ee] dark:bg-emerald-400/15 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25",
  completed: "bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-400/25",
  cancelled: "bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/15",
};

const INSTALLMENT_CLASS = {
  paid: "bg-[#e7f2ee] dark:bg-emerald-400/15 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25 hover:bg-[#d9ebe3] dark:hover:bg-emerald-400/20",
  invoiced: "bg-sky-50 dark:bg-sky-400/15 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-400/25 hover:bg-sky-100 dark:hover:bg-sky-400/20",
  overdue: "bg-rose-50 dark:bg-rose-400/15 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-400/25 hover:bg-rose-100 dark:hover:bg-rose-400/20",
  pending: "bg-white dark:bg-white/[0.04] text-slate-700 dark:text-white/75 border-[#e2e7e4] dark:border-white/15 hover:bg-[#f6f8f7] dark:hover:bg-white/[0.07]",
};

const STATUS_ORDER = Array.isArray(CONTRACT_STATUSES) && CONTRACT_STATUSES.length ? CONTRACT_STATUSES : ["active", "completed", "cancelled"];

function compactMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// «15/11» — يوم/شهر بأرقام لاتينية.
function shortDate(key) {
  const text = String(key || "");
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return "بلا تاريخ";
  return `${Number(m[3])}/${Number(m[2])}`;
}

// الحساب الافتراضي للقسم (نفس منطق تبويب المصاريف).
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

// حمولة PUT كاملة من عقد موجود (الدفعات بمعرّفاتها حتى لا تُستبدل).
function contractPayload(contract, overrides = {}) {
  return {
    project_id: contract.project_id,
    id: contract.id,
    title: contract.title,
    kind: contract.kind,
    party_name: contract.party_name,
    party_contact_id: contract.party_contact_id ?? null,
    phase_id: contract.phase_id ?? null,
    agreed_amount: Number(contract.agreed_amount) || 0,
    vat_included: contract.vat_included !== false,
    start_date: contract.start_date || null,
    end_date: contract.end_date || null,
    status: contract.status,
    attachment_url: contract.attachment_url || null,
    attachment_name: contract.attachment_name || null,
    notes: contract.notes || "",
    installments: (Array.isArray(contract.installments) ? contract.installments : []).map((inst, i) => ({
      id: inst.id,
      seq: Number(inst.seq) || i + 1,
      label: inst.label || `الدفعة ${i + 1}`,
      due_date: inst.due_date || null,
      amount: Number(inst.amount) || 0,
      notes: inst.notes || "",
    })),
    ...overrides,
  };
}

function ContractStatusPill({ status }) {
  const cls = STATUS_CLASS[status] || STATUS_CLASS.cancelled;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${cls}`}>
      {CONTRACT_STATUS_LABELS?.[status] || status}
    </span>
  );
}

function KindChip({ kind }) {
  const Icon = KIND_ICONS[kind] || FileSignature;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 dark:border-violet-400/25 bg-violet-50 dark:bg-violet-400/10 text-violet-800 dark:text-violet-200 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
      <Icon className="w-3 h-3" />
      {CONTRACT_KIND_LABELS?.[kind] || kind || "—"}
    </span>
  );
}

function MenuItem({ icon: Icon, children, onClick, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-right flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors disabled:opacity-50 ${
        danger
          ? "text-rose-700 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-400/10"
          : "text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {children}
    </button>
  );
}

// رقاقة دفعة: «د1 · 15/11 · 5,000» بلون الحالة؛ النقر يفتح قائمة الإجراءات.
function InstallmentChip({ contract, installment, today, busy, canAct, onRecord, onLink, onOpenInvoice, onUnlink }) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const status = installmentStatus(installment, today);
  const cls = INSTALLMENT_CLASS[status] || INSTALLMENT_CLASS.pending;
  const linked = installment.invoice_id != null && installment.invoice_id !== "";
  const title = `${installment.label || `الدفعة ${installment.seq}`} — ${INSTALLMENT_STATUS_LABELS?.[status] || status}${
    installment.due_date ? ` — تستحق ${formatDate(installment.due_date)}` : ""
  }${linked ? ` — فاتورة ${installment.invoice_number || `#${installment.invoice_id}`}` : ""}`;
  const close = () => setOpen(false);
  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors disabled:opacity-60 ${cls}`}
        title={title}
      >
        <span>د{installment.seq}</span>
        <span className="opacity-50">·</span>
        <span className="tabular-nums" dir="ltr">{shortDate(installment.due_date)}</span>
        <span className="opacity-50">·</span>
        <span className="tabular-nums" dir="ltr">{compactMoney(installment.amount)}</span>
        {linked ? <Link2 className="w-3 h-3 opacity-70" /> : null}
      </button>
      <GlassPopover open={open} anchorRef={anchorRef} onClose={close} className="p-1" style={{ minWidth: 240 }}>
        <div className="px-3 py-2 text-[11px] text-slate-500 dark:text-white/50 border-b border-slate-200 dark:border-white/10">
          <div className="font-bold text-slate-900 dark:text-white text-xs">{installment.label || `الدفعة ${installment.seq}`}</div>
          <div className="mt-0.5">
            {INSTALLMENT_STATUS_LABELS?.[status] || status} · <span className="tabular-nums" dir="ltr">{formatMoney(installment.amount, false)}</span>
            {installment.due_date ? ` · ${formatDate(installment.due_date)}` : ""}
          </div>
          {linked ? (
            <div className="mt-0.5">
              فاتورة <span className="font-mono" dir="ltr">{installment.invoice_number || `#${installment.invoice_id}`}</span>
              {" — "}
              <span className="tabular-nums" dir="ltr">
                {formatMoney(installment.invoice_paid, false)} / {formatMoney(installment.invoice_total, false)}
              </span>
            </div>
          ) : null}
        </div>
        <div className="py-1">
          {!linked ? (
            <>
              <MenuItem icon={Receipt} disabled={!canAct} onClick={() => { close(); onRecord(contract, installment); }}>
                تسجيل دفعة (فاتورة جديدة)
              </MenuItem>
              <MenuItem icon={Link2} disabled={!canAct} onClick={() => { close(); onLink(contract, installment); }}>
                ربط فاتورة موجودة
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem icon={ExternalLink} onClick={() => { close(); onOpenInvoice(contract, installment); }}>
                فتح الفاتورة
              </MenuItem>
              <MenuItem icon={Link2Off} danger onClick={() => { close(); onUnlink(contract, installment); }}>
                فك الربط
              </MenuItem>
            </>
          )}
        </div>
      </GlassPopover>
    </>
  );
}

function ContractCard({ contract, phase, today, busy, onEdit, onToggleStatus, onDelete, chipHandlers }) {
  const totals = contractTotals(contract, today);
  const installments = Array.isArray(contract.installments) ? contract.installments : [];
  const isActive = contract.status === "active";
  const canAct = isActive;
  const hasInvoices = installments.some((i) => i.invoice_id != null) || totals.invoiced > 0;
  const tone = totals.paid >= totals.agreed && totals.agreed > 0 ? "emerald" : totals.overdue_count > 0 ? "rose" : "sky";
  return (
    <div className={`${ws.glass} ${ws.card} p-4 space-y-3 ${contract.status === "cancelled" ? "opacity-70" : ""}`}>
      {/* الرأس */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-slate-900 dark:text-white">{contract.title}</div>
            <KindChip kind={contract.kind} />
            <ContractStatusPill status={contract.status} />
          </div>
          <div className="text-xs text-slate-600 dark:text-white/60 mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span>{contract.party_name || "—"}</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: phase?.color || "#94a3b8" }} />
              {phase?.name || "بلا قسم"}
            </span>
            {contract.start_date || contract.end_date ? (
              <span className="tabular-nums" dir="ltr">
                {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
              </span>
            ) : null}
            {contract.attachment_url ? (
              <a
                href={contract.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#0e7a5f] dark:text-emerald-200 hover:underline"
                title={contract.attachment_name || "مرفق العقد"}
              >
                <Paperclip className="w-3 h-3" />
                {contract.attachment_name || "المرفق"}
              </a>
            ) : null}
          </div>
        </div>
        <div className="text-left shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-white/45">المتفق عليه{contract.vat_included === false ? " (بلا ضريبة)" : ""}</div>
          <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
            {formatMoney(totals.agreed, false)}
          </div>
        </div>
      </div>

      {/* المسدد مقابل المتفق عليه */}
      <div>
        <div className="flex items-center justify-between gap-2 text-[11px] mb-1 flex-wrap">
          <span className="text-slate-500 dark:text-white/45">
            المسدد {formatMoney(totals.paid, false)} من {formatMoney(totals.agreed, false)}
            {totals.invoiced > totals.paid ? ` · مُفوتر غير مسدد ${formatMoney(totals.invoiced - totals.paid, false)}` : ""}
          </span>
          <span className={`tabular-nums font-semibold ${totals.remaining < 0 ? "text-rose-600 dark:text-rose-300" : "text-slate-900 dark:text-white"}`} dir="ltr">
            {Math.round(totals.pct || 0)}% · متبقٍ {formatMoney(totals.remaining, false)}
          </span>
        </div>
        <ProgressBar pct={totals.pct} tone={tone} />
      </div>

      {/* الدفعات */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
          <span className="font-bold text-slate-700 dark:text-white/70">
            الدفعات{" "}
            <span className="font-normal text-slate-500 dark:text-white/45 tabular-nums" dir="ltr">
              {totals.installments_paid}/{totals.installments_total}
            </span>
            {totals.overdue_count > 0 ? (
              <span className="mr-2 inline-flex items-center gap-1 text-rose-600 dark:text-rose-300 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                {totals.overdue_count} متأخرة
              </span>
            ) : null}
          </span>
          {totals.next_due ? (
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-white/60">
              <CalendarClock className="w-3 h-3" />
              الدفعة التالية: د{totals.next_due.seq} · {totals.next_due.due_date ? formatDate(totals.next_due.due_date) : "بلا تاريخ"} ·{" "}
              <span className="tabular-nums" dir="ltr">{formatMoney(totals.next_due.amount, false)}</span>
            </span>
          ) : installments.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-[#0e7a5f] dark:text-emerald-200">
              <CheckCheck className="w-3 h-3" />
              كل الدفعات مسددة
            </span>
          ) : null}
        </div>
        {installments.length === 0 ? (
          <div className="text-[11px] text-slate-400 dark:text-white/35">لا دفعات محددة — عدّل العقد لإضافة جدول دفعات.</div>
        ) : (
          <div className="flex items-center gap-1.5 flex-wrap">
            {installments.map((inst) => (
              <InstallmentChip
                key={inst.id ?? `${contract.id}-${inst.seq}`}
                contract={contract}
                installment={inst}
                today={today}
                busy={busy}
                canAct={canAct}
                {...chipHandlers}
              />
            ))}
          </div>
        )}
        {Math.abs(totals.installments_sum - totals.agreed) > 0.005 && installments.length > 0 ? (
          <div className="text-[10px] text-amber-700 dark:text-amber-200">
            مجموع الدفعات {formatMoney(totals.installments_sum, false)} يختلف عن المتفق عليه.
          </div>
        ) : null}
      </div>

      {contract.notes ? <div className="text-[11px] text-slate-500 dark:text-white/45 whitespace-pre-line">{contract.notes}</div> : null}

      {/* الأزرار */}
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <button type="button" onClick={() => onEdit(contract)} disabled={busy} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs disabled:opacity-50`}>
          <Pencil className="w-3.5 h-3.5" />
          تعديل
        </button>
        {contract.status === "active" ? (
          <button type="button" onClick={() => onToggleStatus(contract, "completed")} disabled={busy} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs disabled:opacity-50`} title="تحويل العقد إلى مكتمل">
            <CheckCheck className="w-3.5 h-3.5" />
            إكمال
          </button>
        ) : (
          <button type="button" onClick={() => onToggleStatus(contract, "active")} disabled={busy} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs disabled:opacity-50`} title="إعادة العقد إلى نشط">
            <RotateCcw className="w-3.5 h-3.5" />
            إعادة تفعيل
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(contract)}
          disabled={busy}
          className={`${ws.btnDanger} px-2.5 py-1.5 text-xs disabled:opacity-50`}
          title={hasInvoices ? "للعقد فواتير مرتبطة — فك الربط أولاً" : "حذف العقد"}
        >
          <Trash2 className="w-3.5 h-3.5" />
          حذف
        </button>
      </div>
    </div>
  );
}

export default function ContractsSection({ project, phases, employeeId, isAdmin, onNewInvoice, onLinkInvoice, onOpenInvoice }) {
  const today = useMemo(() => todayRiyadh(), []);
  // قد تكون `contracts` غير موجودة في بيانات مخزّنة قديمة.
  const contracts = useMemo(() => (Array.isArray(project?.contracts) ? project.contracts : []), [project?.contracts]);
  const phaseList = useMemo(() => {
    const list = Array.isArray(phases) ? [...phases] : Array.isArray(project?.phases) ? [...project.phases] : [];
    list.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return list;
  }, [phases, project?.phases]);
  const phaseById = useMemo(() => new Map(phaseList.map((p) => [String(p.id), p])), [phaseList]);

  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const contacts = contactsQuery.data || [];

  const saveMut = useSaveBranchProjectContract();
  const deleteMut = useDeleteBranchProjectContract();
  const linkMut = useLinkContractInstallmentInvoice();
  const busy = saveMut.isPending || deleteMut.isPending || linkMut.isPending;

  const [modal, setModal] = useState({ open: false, contract: null });
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const summary = useMemo(() => summarizeContracts(contracts, today), [contracts, today]);

  const phaseOptions = useMemo(
    () => [{ value: "all", label: "كل الأقسام" }, { value: "none", label: "بلا قسم" }, ...phaseList.map((p) => ({ value: String(p.id), label: p.name }))],
    [phaseList],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts
      .filter((c) => {
        if (phaseFilter === "none" && c.phase_id != null) return false;
        if (phaseFilter !== "all" && phaseFilter !== "none" && String(c.phase_id) !== phaseFilter) return false;
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (q) {
          const hay = `${c.title || ""} ${c.party_name || ""} ${c.notes || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rank = (c) => (c.status === "active" ? 0 : c.status === "completed" ? 1 : 2);
        return rank(a) - rank(b) || String(b.created_at || "").localeCompare(String(a.created_at || "")) || (Number(b.id) || 0) - (Number(a.id) || 0);
      });
  }, [contracts, phaseFilter, statusFilter, search]);

  function handleRecord(contract, inst) {
    if (!project?.id) return;
    onNewInvoice?.({
      project_id: project.id,
      project_phase_id: contract.phase_id ?? null,
      expense_account_code: inferAccountForPhase(project, contract.phase_id),
      supplier_name: contract.party_name || "",
      contact_id: contract.party_contact_id ?? null,
      due_date: inst.due_date || null,
      line_description: `${contract.title} — الدفعة ${inst.seq}`,
      line_amount: Number(inst.amount) || 0,
      project_contract_id: contract.id,
      project_installment_id: inst.id,
      contract_label: `${contract.title} — الدفعة ${inst.seq}`,
    });
  }

  function handleLink(contract, inst) {
    onLinkInvoice?.({ contract, installment: inst });
  }

  function handleOpenInvoice(contract, inst) {
    onOpenInvoice?.({ contract, installment: inst });
  }

  function handleUnlink(contract, inst) {
    if (!project?.id || linkMut.isPending) return;
    const number = inst.invoice_number || `#${inst.invoice_id}`;
    if (!window.confirm(`فك ربط الفاتورة «${number}» من الدفعة ${inst.seq} في عقد «${contract.title}»؟ الفاتورة نفسها لا تُحذف.`)) return;
    linkMut.mutate({ project_id: project.id, contract_id: contract.id, installment_id: inst.id, invoice_id: null });
  }

  function handleToggleStatus(contract, status) {
    if (!project?.id || saveMut.isPending) return;
    saveMut.mutate(contractPayload(contract, { project_id: project.id, status }));
  }

  function handleDelete(contract) {
    if (!project?.id || deleteMut.isPending) return;
    if (!window.confirm(`حذف عقد «${contract.title}» ودفعاته؟ لا يمكن التراجع.`)) return;
    deleteMut.mutate({ project_id: project.id, id: contract.id });
  }

  const chipHandlers = {
    onRecord: handleRecord,
    onLink: handleLink,
    onOpenInvoice: handleOpenInvoice,
    onUnlink: handleUnlink,
  };

  const statCards = [
    { label: "عقود نشطة", value: String(summary.active_count), icon: FileSignature, tone: "slate" },
    { label: "إجمالي التعاقدات", value: formatMoney(summary.agreed_total, false), icon: Wallet, tone: "sky", suffix: "العقود النشطة والمكتملة" },
    { label: "المسدد", value: formatMoney(summary.paid_total, false), icon: Banknote, tone: "emerald" },
    { label: "المتبقي", value: formatMoney(summary.remaining_total, false), icon: Receipt, tone: summary.remaining_total < 0 ? "rose" : "amber" },
    {
      label: "دفعات متأخرة",
      value: String(summary.overdue_installments),
      icon: AlertTriangle,
      tone: summary.overdue_installments > 0 ? "rose" : "slate",
      suffix: summary.due_soon.length > 0 ? `${summary.due_soon.length} تستحق خلال 7 أيام` : undefined,
    },
  ];

  const openNew = () => setModal({ open: true, contract: null });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {statCards.map((c) => (
          <SummaryCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} suffix={c.suffix} />
        ))}
      </div>

      <SectionCard
        title="العقود"
        icon={FileSignature}
        description={`${filtered.length} من ${contracts.length}`}
        action={
          <div className="flex items-center gap-1.5 flex-wrap">
            {busy ? <Loader2 className="w-4 h-4 animate-spin text-slate-400 dark:text-white/40" /> : null}
            <button type="button" onClick={openNew} className={`${ws.btnPrimary} px-3 py-1.5 text-xs`}>
              <Plus className="w-3.5 h-3.5" />
              عقد
            </button>
          </div>
        }
      >
        {/* الفلاتر */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/35" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${ws.input} pr-9 pl-3 py-2 text-sm`}
              placeholder="بحث بعنوان العقد أو اسم الطرف…"
            />
          </div>
          <GlassSelect value={phaseFilter} onChange={setPhaseFilter} options={phaseOptions} placeholder="القسم" buttonClassName="text-sm py-2 px-3" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {[{ value: "all", label: "الكل" }, ...STATUS_ORDER.map((s) => ({ value: s, label: CONTRACT_STATUS_LABELS?.[s] || s }))].map((opt) => {
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
            icon={FileSignature}
            title={contracts.length === 0 ? "لا عقود بعد" : "لا نتائج مطابقة"}
            hint={
              contracts.length === 0
                ? "سجّل عقودك مع المقاولين والموردين: المبلغ المتفق عليه وجدول الدفعات، ثم سدّد كل دفعة بفاتورة مشتريات."
                : "عدّل الفلاتر أو البحث."
            }
            action={
              contracts.length === 0 ? (
                <button type="button" onClick={openNew} className={`${ws.btnPrimary} px-4 py-2 text-sm`}>
                  <Plus className="w-4 h-4" />
                  عقد جديد
                </button>
              ) : null
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                phase={contract.phase_id != null ? phaseById.get(String(contract.phase_id)) : null}
                today={today}
                busy={busy}
                onEdit={(c) => setModal({ open: true, contract: c })}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
                chipHandlers={chipHandlers}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <ContractModal
        open={modal.open}
        project={project}
        phases={phaseList}
        contract={modal.contract}
        contacts={contacts}
        onClose={() => setModal({ open: false, contract: null })}
      />
    </div>
  );
}
