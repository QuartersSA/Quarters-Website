"use client";

import React, { useMemo } from "react";
import { formatRiyadhDateForInput } from "@/utils/dateUtils";
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Clock,
  Flag,
  MessageSquareText,
  Wallet,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import {
  addDays,
  daysBetween,
  phaseBudget,
  phaseHealth,
  phaseTasks,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import ProjectTimeline from "@/components/Accounting/BranchProjects/ProjectTimeline";
import {
  SectionCard,
  formatDate,
  formatMoney,
} from "@/components/Accounting/BranchProjects/shared";

// نظرة عامة: الخط الزمني + تنبيهات + آخر التطورات.

const ALERT_TONE = {
  rose: {
    icon: "text-rose-700 dark:text-rose-200",
    box: "bg-rose-50 dark:bg-rose-400/10 border-rose-200 dark:border-rose-400/25",
  },
  amber: {
    icon: "text-amber-700 dark:text-amber-200",
    box: "bg-amber-50 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/25",
  },
  sky: {
    icon: "text-sky-700 dark:text-sky-200",
    box: "bg-sky-50 dark:bg-sky-400/10 border-sky-200 dark:border-sky-400/25",
  },
  emerald: {
    icon: "text-[#0e7a5f] dark:text-emerald-200",
    box: "bg-[#e7f2ee] dark:bg-emerald-400/10 border-[#c9e2d8] dark:border-emerald-400/25",
  },
};

function daysWord(n) {
  const abs = Math.abs(n);
  if (abs === 1) return "يوم";
  if (abs === 2) return "يومين";
  if (abs <= 10) return "أيام";
  return "يوماً";
}

function truncate(text, max = 140) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

function AlertLine({ icon: Icon, tone = "amber", title, detail, phaseId, phaseName, onSelectPhase }) {
  const t = ALERT_TONE[tone] || ALERT_TONE.amber;
  return (
    <div className={`rounded-[10px] border px-3 py-2 flex items-start gap-2 ${t.box}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${t.icon}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
        {detail ? <div className="text-[11px] text-slate-600 dark:text-white/60 mt-0.5">{detail}</div> : null}
      </div>
      {phaseId != null ? (
        <button
          type="button"
          onClick={() => onSelectPhase?.(phaseId)}
          className="text-[11px] font-bold text-[#0e7a5f] dark:text-emerald-200 hover:underline whitespace-nowrap shrink-0"
          title={phaseName ? `فتح قسم «${phaseName}»` : "فتح القسم"}
        >
          عرض القسم
        </button>
      ) : null}
    </div>
  );
}

// طابع زمني ISO → يوم بتوقيت الرياض (تجنّب انزياح اليوم قرب منتصف الليل).
function formatTimestampDay(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return formatRiyadhDateForInput(d);
}

export default function OverviewTab({ project, onSelectPhase, selectedPhaseId = null }) {
  const today = useMemo(() => todayRiyadh(), []);
  const phases = project?.phases || [];
  const tasks = project?.tasks || [];
  const invoices = project?.invoices || [];
  const phaseById = useMemo(() => new Map(phases.map((phase) => [phase.id, phase])), [phases]);

  const latePhases = useMemo(
    () => phases.filter((phase) => phaseHealth(phase, phaseTasks(project, phase.id), today) === "late"),
    [phases, project, today],
  );

  const overBudgetPhases = useMemo(
    () =>
      phases
        .map((phase) => ({ phase, budget: phaseBudget(phase, invoices) }))
        .filter(({ budget }) => budget.over > 0),
    [phases, invoices],
  );

  const weekLimit = useMemo(() => addDays(today, 7), [today]);
  const dueSoon = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.status !== "done" &&
            task.due_date &&
            task.due_date >= today &&
            task.due_date <= weekLimit,
        )
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))),
    [tasks, today, weekLimit],
  );

  const upcomingMilestones = useMemo(
    () =>
      tasks
        .filter((task) => task.is_milestone && task.status !== "done" && task.due_date && task.due_date >= today)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
        .slice(0, 3),
    [tasks, today],
  );

  const latestUpdates = useMemo(
    () =>
      [...(project?.updates || [])]
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, 5),
    [project],
  );

  const extraMilestones = useMemo(
    () => upcomingMilestones.filter((task) => !dueSoon.some((due) => due.id === task.id)),
    [upcomingMilestones, dueSoon],
  );
  const alertCount = latePhases.length + overBudgetPhases.length + dueSoon.length + extraMilestones.length;

  return (
    <div className="space-y-5">
      <ProjectTimeline project={project} onSelectPhase={onSelectPhase} selectedPhaseId={selectedPhaseId} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="تنبيهات"
          icon={Bell}
          description={alertCount > 0 ? `${alertCount} ${alertCount === 1 ? "تنبيه" : "تنبيهات"}` : "لا تنبيهات"}
        >
          {alertCount === 0 ? (
            <div className="flex items-center gap-2 text-sm text-[#0e7a5f] dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              كل شيء في المسار — لا أقسام متأخرة ولا تجاوز في الميزانية.
            </div>
          ) : (
            <div className="space-y-2">
              {latePhases.map((phase) => {
                const overdue = daysBetween(phase.planned_end, today);
                return (
                  <AlertLine
                    key={`late-${phase.id}`}
                    icon={AlertTriangle}
                    tone="rose"
                    title={`القسم «${phase.name}» متأخر`}
                    detail={`كان مقرراً أن ينتهي في ${formatDate(phase.planned_end)}${
                      Number.isFinite(overdue) && overdue > 0 ? ` — تجاوز بـ ${overdue} ${daysWord(overdue)}` : ""
                    }`}
                    phaseId={phase.id}
                    phaseName={phase.name}
                    onSelectPhase={onSelectPhase}
                  />
                );
              })}
              {overBudgetPhases.map(({ phase, budget }) => (
                <AlertLine
                  key={`over-${phase.id}`}
                  icon={Wallet}
                  tone="rose"
                  title={`تجاوز ميزانية «${phase.name}»`}
                  detail={`الملتزم به ${formatMoney(budget.committed, false)} مقابل ميزانية ${formatMoney(budget.budget, false)} — تجاوز ${formatMoney(budget.over)}`}
                  phaseId={phase.id}
                  phaseName={phase.name}
                  onSelectPhase={onSelectPhase}
                />
              ))}
              {dueSoon.map((task) => {
                const phase = phaseById.get(task.phase_id);
                const left = daysBetween(today, task.due_date);
                return (
                  <AlertLine
                    key={`due-${task.id}`}
                    icon={task.is_milestone ? Flag : Clock}
                    tone="amber"
                    title={task.title}
                    detail={`${task.is_milestone ? "معلم" : "مهمة"} مستحق${task.is_milestone ? "" : "ة"} في ${formatDate(task.due_date)}${
                      Number.isFinite(left) ? (left === 0 ? " (اليوم)" : ` (باقي ${left} ${daysWord(left)})`) : ""
                    }${phase ? ` · ${phase.name}` : ""}${task.assignee_name ? ` · ${task.assignee_name}` : ""}`}
                    phaseId={task.phase_id}
                    phaseName={phase?.name}
                    onSelectPhase={onSelectPhase}
                  />
                );
              })}
              {extraMilestones
                .map((task) => {
                  const phase = phaseById.get(task.phase_id);
                  const left = daysBetween(today, task.due_date);
                  return (
                    <AlertLine
                      key={`ms-${task.id}`}
                      icon={Flag}
                      tone="sky"
                      title={`معلم قادم: ${task.title}`}
                      detail={`${formatDate(task.due_date)}${
                        Number.isFinite(left) && left > 0 ? ` (باقي ${left} ${daysWord(left)})` : ""
                      }${phase ? ` · ${phase.name}` : ""}`}
                      phaseId={task.phase_id}
                      phaseName={phase?.name}
                      onSelectPhase={onSelectPhase}
                    />
                  );
                })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="آخر التطورات" icon={MessageSquareText} description="أحدث 5 تطورات">
          {latestUpdates.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-white/50">لا تطورات مسجلة بعد.</div>
          ) : (
            <div className="space-y-2">
              {latestUpdates.map((update) => {
                const phase = update.phase_id != null ? phaseById.get(update.phase_id) : null;
                const photoCount = Array.isArray(update.photos) ? update.photos.length : 0;
                return (
                  <div key={update.id} className={`${ws.innerCard} px-3 py-2`}>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-white/50">
                      <span className="tabular-nums" dir="ltr">
                        {formatTimestampDay(update.created_at)}
                      </span>
                      {phase ? (
                        <span className="rounded-full border border-[#e2e7e4] dark:border-white/10 px-2 py-0.5 font-semibold text-slate-700 dark:text-white/75">
                          {phase.name}
                        </span>
                      ) : null}
                      {update.created_by_name ? <span>{update.created_by_name}</span> : null}
                      {photoCount > 0 ? (
                        <span className="inline-flex items-center gap-1 mr-auto">
                          <Camera className="w-3.5 h-3.5" />
                          <span className="tabular-nums" dir="ltr">
                            {photoCount}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-800 dark:text-white/85 mt-1 whitespace-pre-line">
                      {truncate(update.body)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
