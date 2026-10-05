"use client";

import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  Building2,
  CalendarCheck,
  Info,
  Loader2,
  MapPin,
  PartyPopper,
  Plus,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import { useBranchProjects, BRANCH_PROJECTS_MOCK } from "@/hooks/useBranchProjects";
import {
  PROJECT_STATUS_LABELS,
  daysToOpening,
  phaseHealth,
  phaseTasks,
  projectBudget,
  projectHealth,
  projectProgress,
  summarizeProjects,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import ProjectModal from "@/components/Accounting/BranchProjects/ProjectModal";
import { countdownText, daysWord } from "@/components/Accounting/BranchProjects/ProjectHeader";
import {
  EmptyState,
  HealthPill,
  ProgressBar,
  ProgressRing,
  StatusPill,
  SummaryCard,
  formatDate,
  formatMoney,
  healthTone,
} from "@/components/Accounting/BranchProjects/shared";

// قائمة مشاريع تأسيس الفروع: مؤشرات، فلتر حالة، بحث، وبطاقات.

const STATUS_FILTERS = [
  { key: "all", label: "الكل" },
  { key: "planning", label: "تخطيط" },
  { key: "in_progress", label: "قيد التنفيذ" },
  { key: "on_hold", label: "متوقف" },
  { key: "opened", label: "افتُتح" },
  { key: "cancelled", label: "ملغى" },
];

const TONE_TEXT = {
  rose: "text-rose-700 dark:text-rose-200",
  emerald: "text-[#0e7a5f] dark:text-emerald-200",
  amber: "text-amber-700 dark:text-amber-200",
  slate: "text-slate-600 dark:text-white/60",
};

function ProjectCard({ project, today }) {
  const progress = projectProgress(project);
  const health = projectHealth(project, today);
  const budget = projectBudget(project);
  const countdown = countdownText(project, today);
  const latePhases = (project.phases || []).filter(
    (phase) => phaseHealth(phase, phaseTasks(project, phase.id), today) === "late",
  ).length;
  const overBudget = budget.over > 0;
  const budgetPct =
    budget.budget_total > 0 ? Math.round((budget.committed / budget.budget_total) * 100) : 0;
  const place = [project.city, project.district].filter(Boolean).join(" · ");

  return (
    <Link
      to={`/accounting/branch-projects/${project.id}`}
      className={`${ws.glass} ${ws.card} p-4 flex flex-col gap-3 transition-colors hover:border-[#c9d3ce] dark:hover:border-white/20`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-slate-900 dark:text-white truncate">{project.name}</div>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-white/45 tabular-nums" dir="ltr">
              {project.code}
            </span>
          </div>
          {place ? (
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{place}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <StatusPill status={project.status} />
            <HealthPill health={health} />
          </div>
        </div>
        <ProgressRing pct={progress} size={56} tone={healthTone(health)} />
      </div>

      <div className={`text-xs font-semibold flex items-center gap-1.5 ${TONE_TEXT[countdown.tone] || TONE_TEXT.slate}`}>
        {project.status === "opened" ? (
          <PartyPopper className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{countdown.text}</span>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-white/50">
          <span>الملتزم به / الميزانية</span>
          <span className={`tabular-nums font-semibold ${overBudget ? TONE_TEXT.rose : "text-slate-700 dark:text-white/80"}`} dir="ltr">
            {formatMoney(budget.committed, false)} / {formatMoney(budget.budget_total, false)}
          </span>
        </div>
        <ProgressBar pct={budgetPct} tone={overBudget ? "rose" : "emerald"} className="mt-1.5" />
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-500 dark:text-white/45">
          {(project.phases || []).length} قسم
        </span>
        {latePhases > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {latePhases} {latePhases === 1 ? "قسم متأخر" : "أقسام متأخرة"}
          </span>
        ) : (
          <span className="text-[#0e7a5f] dark:text-emerald-200 font-semibold">لا أقسام متأخرة</span>
        )}
      </div>
    </Link>
  );
}

export default function ProjectsListPanel({ employeeId, isAdmin }) {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const today = useMemo(() => todayRiyadh(), []);

  const projectsQuery = useBranchProjects({ employeeId, isAdmin });
  const projects = projectsQuery.data || [];

  const summary = useMemo(() => summarizeProjects(projects, today), [projects, today]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((project) => {
      if (status !== "all" && project.status !== status) return false;
      if (!needle) return true;
      return [project.name, project.code, project.city, project.district, project.manager_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [projects, status, q]);

  const counts = useMemo(() => {
    const map = { all: projects.length };
    for (const project of projects) {
      map[project.status] = (map[project.status] || 0) + 1;
    }
    return map;
  }, [projects]);

  const nearest = summary.nearest_opening;
  const nearestValue = nearest
    ? nearest.days < 0
      ? `تجاوز بـ ${Math.abs(nearest.days)} ${daysWord(nearest.days)}`
      : nearest.days === 0
        ? "اليوم"
        : `${nearest.days} ${daysWord(nearest.days)}`
    : "—";

  return (
    <>
      {BRANCH_PROJECTS_MOCK ? (
        <div className={`${ws.glassSoft} ${ws.card} px-4 py-2.5 flex items-center gap-2 text-xs text-slate-600 dark:text-white/60`}>
          <Info className="w-4 h-4 shrink-0 text-sky-700 dark:text-sky-200" />
          <span>وضع تجريبي: البيانات محفوظة في هذا المتصفح فقط حتى ربط الخلفية</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <SummaryCard label="مشاريع نشطة" value={summary.active_count} icon={Building2} tone="emerald" />
        <SummaryCard label="إجمالي الميزانيات" value={formatMoney(summary.budget_total)} icon={Wallet} tone="sky" />
        <SummaryCard
          label="الملتزم به (الفواتير)"
          value={formatMoney(summary.committed_total)}
          icon={Receipt}
          tone={summary.committed_total > summary.budget_total ? "rose" : "amber"}
          suffix={`المسدد ${formatMoney(summary.paid_total, false)}`}
        />
        <SummaryCard
          label="أقرب افتتاح"
          value={nearestValue}
          icon={CalendarCheck}
          tone={nearest && nearest.days < 0 ? "rose" : "emerald"}
          suffix={nearest ? nearest.name : "لا مشاريع قادمة"}
        />
      </div>

      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو الكود أو المدينة"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className={`${ws.btnPrimary} px-4 py-2`}>
            <Plus className="w-4 h-4" />
            مشروع جديد
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {STATUS_FILTERS.map((filter) => {
            const isActive = filter.key === status;
            const count = counts[filter.key] || 0;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatus(filter.key)}
                className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-[#0b3d31] text-white border-[#0b3d31] dark:bg-white/10 dark:text-white dark:border-white/20"
                    : "bg-white text-[#4a5568] border-[#e2e7e4] hover:bg-[#f6f8f7] dark:bg-white/[0.04] dark:text-white/70 dark:border-white/10 dark:hover:bg-white/[0.07]"
                }`}
              >
                {filter.label}
                <span className="tabular-nums opacity-70 mr-1" dir="ltr">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {projectsQuery.isLoading ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center text-slate-500 dark:text-white/50`}>
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          <div className="mt-2 text-sm">جاري تحميل المشاريع…</div>
        </div>
      ) : projectsQuery.isError ? (
        <div className={`${ws.glass} ${ws.card} p-6 text-center text-rose-700 dark:text-rose-300 text-sm`}>
          {projectsQuery.error?.message || "فشل تحميل المشاريع"}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={projects.length === 0 ? "لا مشاريع بعد" : "لا نتائج مطابقة"}
          hint={
            projects.length === 0
              ? "ابدأ بإنشاء مشروع لمتابعة تأسيس فرع جديد من العقد حتى الافتتاح."
              : "جرّب تغيير الفلتر أو كلمة البحث."
          }
          action={
            projects.length === 0 ? (
              <button type="button" onClick={() => setShowCreate(true)} className={`${ws.btnPrimary} px-4 py-2`}>
                <Plus className="w-4 h-4" />
                مشروع جديد
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} today={today} />
          ))}
        </div>
      )}

      <ProjectModal open={showCreate} project={null} onClose={() => setShowCreate(false)} />

    </>
  );
}
