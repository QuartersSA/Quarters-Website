"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Flag,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageSquareText,
  Paperclip,
  PartyPopper,
  Receipt,
  Settings2,
} from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { useBranchProject, useOpenBranchProject } from "@/hooks/useBranchProjects";
import { todayRiyadh } from "@/utils/branchProjectMath";
import { ModalShell, formatDate } from "@/components/Accounting/BranchProjects/shared";
import ProjectHeader from "@/components/Accounting/BranchProjects/ProjectHeader";
import OverviewTab from "@/components/Accounting/BranchProjects/OverviewTab";
import PhasesTab from "@/components/Accounting/BranchProjects/PhasesTab";
import ExpensesTab from "@/components/Accounting/BranchProjects/ExpensesTab";
import UpdatesTab from "@/components/Accounting/BranchProjects/UpdatesTab";
import AttachmentsTab from "@/components/Accounting/BranchProjects/AttachmentsTab";
import SettingsTab from "@/components/Accounting/BranchProjects/SettingsTab";
import ProjectModal from "@/components/Accounting/BranchProjects/ProjectModal";

/**
 * تأسيس الفروع — تفاصيل مشروع واحد.
 *
 * التبويب النشط في `?tab=`، والقسم المحدد (للتمييز داخل تبويب
 * الأقسام بعد النقر على الخط الزمني) في `?phase=`.
 */

const PAGE_TITLE = "تأسيس الفروع";
const LIST_PATH = "/accounting/branch-projects";

const TABS = [
  { key: "overview", label: "نظرة عامة", Icon: LayoutDashboard, description: "الخط الزمني، التنبيهات، وآخر التطورات." },
  { key: "phases", label: "الأقسام", Icon: ListChecks, description: "أقسام المشروع ومهامها ومعالمها." },
  { key: "expenses", label: "المصاريف", Icon: Receipt, description: "الميزانية مقابل الفعلي وفواتير التأسيس." },
  { key: "updates", label: "التطورات", Icon: MessageSquareText, description: "سجل التطورات والصور من الموقع." },
  { key: "attachments", label: "المرفقات", Icon: Paperclip, description: "العقود والتراخيص والتصاميم وعروض الأسعار." },
  { key: "settings", label: "الإعدادات", Icon: Settings2, description: "بيانات المشروع وحالته وحذفه." },
];
const TAB_KEYS = new Set(TABS.map((tab) => tab.key));

function MobileHeader({ project, activeTab }) {
  return (
    <div className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}>
      <Link to={LIST_PATH} className={`${ws.iconButton} shrink-0`} title="العودة إلى القائمة">
        <ArrowRight className="w-4 h-4" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
          {project?.name || PAGE_TITLE}
        </div>
        <div className="text-xs text-slate-500 dark:text-white/50 truncate">{activeTab?.label || ""}</div>
      </div>
    </div>
  );
}

function DesktopHeader({ project, activeTab }) {
  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className={ws.iconBox}>
        <Building2 className="w-6 h-6 text-[#0e7a5f] dark:text-emerald-200" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/50">
          <Link to={LIST_PATH} className="inline-flex items-center gap-1 hover:text-[#0e7a5f] dark:hover:text-emerald-200">
            <ArrowRight className="w-3.5 h-3.5" />
            {PAGE_TITLE}
          </Link>
          {project ? (
            <>
              <span>/</span>
              <span className="tabular-nums" dir="ltr">
                {project.code}
              </span>
            </>
          ) : null}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
          {project?.name || "مشروع"}
        </h1>
        <p className="text-slate-500 dark:text-white/50 text-sm mt-0.5">{activeTab?.description || ""}</p>
      </div>
    </div>
  );
}

function pendingMilestonesOf(project) {
  return (project?.tasks || []).filter((task) => task.is_milestone && task.status !== "done");
}

function OpenConfirmModal({ open, project, onClose }) {
  const [date, setDate] = useState(() => todayRiyadh());
  const [pending, setPending] = useState(null);
  const openMut = useOpenBranchProject();

  useEffect(() => {
    if (!open) return;
    setDate(todayRiyadh());
    setPending(null);
  }, [open]);

  const submit = (force) => {
    if (!project || !date) return;
    openMut.mutate(
      { id: project.id, actual_opening_date: date, force: !!force },
      {
        onSuccess: () => onClose?.(),
        onError: (error) => {
          if (error?.code === "milestones_pending") {
            const fromError = error.milestones || error.pending || error.details?.milestones;
            const list = Array.isArray(fromError) && fromError.length > 0 ? fromError : pendingMilestonesOf(project);
            setPending(list.map((item) => (typeof item === "string" ? item : item?.title || "")).filter(Boolean));
          }
        },
      },
    );
  };

  const busy = openMut.isPending;

  return (
    <ModalShell
      open={open}
      title="تأكيد افتتاح الفرع"
      description={project ? `${project.name} · ${project.code}` : ""}
      onClose={busy ? () => {} : onClose}
      width="max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={`${ws.btnNeutral} px-4 py-2 text-sm disabled:opacity-50`}>
            إلغاء
          </button>
          {pending ? (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={busy || !date}
              className={`${ws.btnDanger} px-4 py-2 text-sm disabled:opacity-50`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              تأكيد رغم ذلك
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={busy || !date}
              className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-50`}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PartyPopper className="w-4 h-4" />}
              تأكيد الافتتاح
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-white/70 mb-1">تاريخ الافتتاح الفعلي</div>
          <GlassDatePicker value={date} onChange={setDate} placeholder="اختر التاريخ" allowClear={false} />
          <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
            الموعد المستهدف كان {formatDate(project?.target_opening_date)}. سيتحول المشروع إلى حالة «افتُتح».
          </div>
        </div>

        {pending ? (
          <div className="rounded-[10px] border border-amber-200 dark:border-amber-400/25 bg-amber-50 dark:bg-amber-400/10 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              معالم لم تكتمل بعد
            </div>
            <div className="text-[11px] text-amber-800/80 dark:text-amber-100/70 mt-1">
              يمكنك التأكيد رغم ذلك، أو إغلاق النافذة وإكمال المعالم أولاً.
            </div>
            <ul className="mt-2 space-y-1">
              {pending.map((title, index) => (
                <li key={`${title}-${index}`} className="flex items-center gap-2 text-sm text-slate-800 dark:text-white/85">
                  <Flag className="w-3.5 h-3.5 shrink-0 text-amber-700 dark:text-amber-200" />
                  {title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}

export default function BranchProjectDetailPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";
  const canAccess =
    user?.can_manage_accounting !== false || !!user?.can_manage_branch_projects;

  const params = useParams();
  const projectId = Number(params?.id);
  const validId = Number.isFinite(projectId) && projectId > 0;

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") || "overview";
  const activeTabKey = TAB_KEYS.has(rawTab) ? rawTab : "overview";
  const activeTab = TABS.find((tab) => tab.key === activeTabKey) || TABS[0];
  const rawPhase = searchParams.get("phase");
  const selectedPhaseId = useMemo(() => {
    const n = Number(rawPhase);
    return rawPhase && Number.isFinite(n) ? n : null;
  }, [rawPhase]);

  const setTab = useCallback(
    (tabKey, extras = {}) => {
      const next = new URLSearchParams();
      next.set("tab", tabKey);
      if (extras.phase != null) next.set("phase", String(extras.phase));
      // تغيير القسم داخل نفس التبويب لا يضيف سجلاً في التاريخ.
      setSearchParams(next, { replace: tabKey === activeTabKey });
    },
    [setSearchParams, activeTabKey],
  );

  // نقرة على قسم (من الخط الزمني أو التنبيهات) → تبويب الأقسام مع تمييزه.
  const selectPhase = useCallback(
    (phaseId) => {
      if (phaseId == null) {
        setTab("phases");
        return;
      }
      setTab("phases", { phase: phaseId });
    },
    [setTab],
  );

  useEffect(() => {
    // عند فتح تبويب الأقسام بقسم محدد تتولى البطاقة التمرير إليها.
    if (activeTabKey === "phases" && rawPhase) return;
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabKey]);

  const [showEdit, setShowEdit] = useState(false);
  const [showOpen, setShowOpen] = useState(false);

  const projectQuery = useBranchProject(validId ? projectId : null);
  const project = projectQuery.data || null;

  let body = null;
  if (!ready) {
    body = <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>جاري التحميل…</div>;
  } else if (!employeeId) {
    body = <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>الرجاء تسجيل الدخول.</div>;
  } else if (!isAdmin || !canAccess) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
        تحتاج صلاحية «المحاسبة» أو «تأسيس الفروع».
      </div>
    );
  } else if (!validId) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
        <div className="font-bold text-slate-900 dark:text-white">معرّف مشروع غير صالح</div>
        <Link to={LIST_PATH} className={`${ws.btnNeutral} px-4 py-2 text-sm mt-4`}>
          <ArrowRight className="w-4 h-4" />
          العودة إلى القائمة
        </Link>
      </div>
    );
  } else if (projectQuery.isLoading) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-10 text-center text-slate-500 dark:text-white/50`}>
        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        <div className="mt-2 text-sm">جاري تحميل المشروع…</div>
      </div>
    );
  } else if (projectQuery.isError) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
        <div className="text-sm text-rose-700 dark:text-rose-300">
          {projectQuery.error?.message || "فشل تحميل المشروع"}
        </div>
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <button type="button" onClick={() => projectQuery.refetch()} className={`${ws.btnPrimary} px-4 py-2 text-sm`}>
            إعادة المحاولة
          </button>
          <Link to={LIST_PATH} className={`${ws.btnNeutral} px-4 py-2 text-sm`}>
            <ArrowRight className="w-4 h-4" />
            العودة إلى القائمة
          </Link>
        </div>
      </div>
    );
  } else if (!project) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
        <div className={`${ws.iconBox} mx-auto text-[#0e7a5f] dark:text-emerald-200`}>
          <Building2 className="w-5 h-5" />
        </div>
        <div className="font-bold text-slate-900 dark:text-white mt-3">المشروع غير موجود</div>
        <div className="text-sm text-slate-500 dark:text-white/50 mt-1">ربما حُذف أو أن الرابط غير صحيح.</div>
        <Link to={LIST_PATH} className={`${ws.btnNeutral} px-4 py-2 text-sm mt-4`}>
          <ArrowRight className="w-4 h-4" />
          العودة إلى القائمة
        </Link>
      </div>
    );
  } else {
    body = (
      <>
        <ProjectHeader project={project} onEdit={() => setShowEdit(true)} onOpen={() => setShowOpen(true)} />

        <div className={`${ws.glass} ${ws.card} p-2 overflow-x-auto`}>
          <div className="flex items-center gap-1 min-w-max">
            {TABS.map((tab) => {
              const isActive = tab.key === activeTabKey;
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTab(tab.key, tab.key === "phases" && selectedPhaseId != null ? { phase: selectedPhaseId } : {})}
                  className={`${ws.segBtn} ${isActive ? ws.segActive : ws.segInactive} flex items-center gap-2 whitespace-nowrap`}
                  title={tab.description}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTabKey === "overview" ? (
          <OverviewTab project={project} onSelectPhase={selectPhase} selectedPhaseId={selectedPhaseId} />
        ) : activeTabKey === "phases" ? (
          <PhasesTab project={project} selectedPhaseId={selectedPhaseId} onSelectPhase={selectPhase} />
        ) : activeTabKey === "expenses" ? (
          <ExpensesTab project={project} />
        ) : activeTabKey === "updates" ? (
          <UpdatesTab project={project} />
        ) : activeTabKey === "attachments" ? (
          <AttachmentsTab project={project} />
        ) : (
          <SettingsTab project={project} />
        )}

        <ProjectModal open={showEdit} project={project} onClose={() => setShowEdit(false)} />
        <OpenConfirmModal open={showOpen} project={project} onClose={() => setShowOpen(false)} />
      </>
    );
  }

  return (
    <div
      className="min-h-[100svh] pb-24 lg:pb-0 bg-[#f6f8f7] text-[#1a2332] dark:bg-transparent dark:text-white"
      dir="rtl"
    >
      <AccountingSidebar active="branch-projects" />
      <MobileHeader project={project} activeTab={activeTab} />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <DesktopHeader project={project} activeTab={activeTab} />
          {body}
        </div>
      </main>
    </div>
  );
}
