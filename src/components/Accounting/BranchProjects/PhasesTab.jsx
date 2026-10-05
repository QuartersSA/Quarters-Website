"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Flag,
  HardHat,
  Layers,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { ws } from "@/components/Workspace/uiPurchases";
import {
  useDeleteBranchProjectPhase,
  useDeleteBranchProjectTask,
  useReorderBranchProjectPhases,
  useSaveBranchProjectTask,
} from "@/hooks/useBranchProjects";
import {
  phaseBudget,
  phaseHealth,
  phaseProgress,
  phaseTasks,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import {
  EmptyState,
  HealthPill,
  PhaseStatusPill,
  ProgressBar,
  formatDate,
  formatMoney,
  healthTone,
} from "./shared";
import PhaseModal from "./PhaseModal";
import TaskModal from "./TaskModal";

// تبويب الأقسام: بطاقة لكل قسم مع مهامه.

function sortedPhases(project) {
  const phases = Array.isArray(project?.phases) ? [...project.phases] : [];
  phases.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
  return phases;
}

function TaskRow({ task, today, onToggle, onEdit, onDelete, busy }) {
  const done = task.status === "done";
  const overdue = !done && task.due_date && task.due_date < today;
  return (
    <div className={`flex items-start gap-2.5 py-2 ${ws.innerCard} px-3`}>
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={busy}
        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
          done
            ? "bg-[#0e7a5f] border-[#0e7a5f] text-white dark:bg-emerald-400/80 dark:border-emerald-400/80"
            : "bg-white border-slate-300 dark:bg-white/[0.04] dark:border-white/25"
        }`}
        title={done ? "إعادة فتح" : "إكمال"}
        aria-pressed={done}
      >
        {done ? (
          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.is_milestone ? <Flag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" /> : null}
          <span className={`text-sm ${done ? "line-through text-slate-400 dark:text-white/40" : "text-slate-900 dark:text-white"}`}>
            {task.title}
          </span>
          {task.status === "blocked" ? (
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-200 bg-rose-100 dark:bg-rose-400/15 rounded-full px-1.5">معلّقة</span>
          ) : task.status === "in_progress" ? (
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-200 bg-amber-100 dark:bg-amber-400/15 rounded-full px-1.5">جارية</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 flex-wrap text-[11px] mt-0.5">
          {task.due_date ? (
            <span className={`inline-flex items-center gap-1 ${overdue ? "text-rose-600 dark:text-rose-300 font-semibold" : "text-slate-500 dark:text-white/45"}`}>
              <CalendarDays className="w-3 h-3" />
              <span dir="ltr">{formatDate(task.due_date)}</span>
              {overdue ? "· متأخرة" : null}
            </span>
          ) : null}
          {task.assignee_name ? (
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-white/45">
              <UserRound className="w-3 h-3" />
              {task.assignee_name}
            </span>
          ) : null}
          {done && task.done_at ? (
            <span className="text-slate-400 dark:text-white/35" dir="ltr">
              ✓ {formatDate(task.done_at)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onEdit(task)} className={`${ws.iconButton} w-8 h-8`} title="تعديل">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => onDelete(task)} className={`${ws.iconButton} w-8 h-8 text-rose-600 dark:text-rose-300`} title="حذف">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function PhaseCard({
  project,
  phase,
  index,
  count,
  today,
  selected,
  onSelect,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
  onEditPhase,
  onDeletePhase,
  onMove,
  taskBusy,
  reorderBusy,
}) {
  const ref = useRef(null);
  const tasks = useMemo(() => phaseTasks(project, phase.id) || [], [project, phase.id]);
  const progress = phaseProgress(phase, tasks);
  const health = phaseHealth(phase, tasks, today);
  const budget = phaseBudget(phase, project?.invoices || []);
  const invoiceCount = (project?.invoices || []).filter((inv) => Number(inv?.phase_id) === Number(phase.id)).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  useEffect(() => {
    if (selected && ref.current && typeof ref.current.scrollIntoView === "function") {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      onClick={() => onSelect?.(phase.id)}
      className={`${ws.glass} ${ws.card} overflow-hidden transition-shadow ${
        selected ? "ring-2 ring-[#0e7a5f]/60 dark:ring-emerald-400/50" : ""
      }`}
    >
      <div className="h-1" style={{ background: phase.color || "#0e7a5f" }} />
      <div className="p-4 space-y-3">
        {/* الرأس */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: phase.color || "#0e7a5f" }} />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate">
                <span className="text-slate-400 dark:text-white/35 tabular-nums ml-1" dir="ltr">
                  {index + 1}.
                </span>
                {phase.name}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <PhaseStatusPill status={phase.status} />
                <HealthPill health={health} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onMove(index, -1)}
              disabled={index === 0 || reorderBusy}
              className={`${ws.iconButton} w-8 h-8 disabled:opacity-40`}
              title="تحريك لأعلى"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onMove(index, 1)}
              disabled={index === count - 1 || reorderBusy}
              className={`${ws.iconButton} w-8 h-8 disabled:opacity-40`}
              title="تحريك لأسفل"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => onEditPhase(phase)} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs`}>
              <Pencil className="w-3.5 h-3.5" />
              تعديل القسم
            </button>
            <button type="button" onClick={() => onDeletePhase(phase, invoiceCount)} className={`${ws.btnDanger} px-2.5 py-1.5 text-xs`}>
              <Trash2 className="w-3.5 h-3.5" />
              حذف القسم
            </button>
          </div>
        </div>

        {/* التفاصيل */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-white/45">مخطط</span>
            <span className="text-slate-900 dark:text-white tabular-nums" dir="ltr">
              {formatDate(phase.planned_start)} → {formatDate(phase.planned_end)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-white/45">فعلي</span>
            <span className="text-slate-900 dark:text-white tabular-nums" dir="ltr">
              {phase.actual_start || phase.actual_end ? `${formatDate(phase.actual_start)} → ${formatDate(phase.actual_end)}` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-white/45">
              <UserRound className="w-3 h-3" /> المسؤول
            </span>
            <span className="text-slate-900 dark:text-white">{phase.owner_name || "—"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-white/45">
              <HardHat className="w-3 h-3" /> المقاول
            </span>
            <span className="text-slate-900 dark:text-white">{phase.contractor_name || "—"}</span>
          </div>
        </div>

        {/* الميزانية والتقدم */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500 dark:text-white/45">الميزانية مقابل الملتزم</span>
              <span className={`tabular-nums font-semibold ${budget.over ? "text-rose-600 dark:text-rose-300" : "text-slate-900 dark:text-white"}`} dir="ltr">
                {formatMoney(budget.committed, false)} / {formatMoney(budget.budget, false)}
              </span>
            </div>
            <ProgressBar pct={budget.pct} tone={budget.over ? "rose" : "sky"} />
            {budget.over ? (
              <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">تجاوز بمقدار {formatMoney(Math.abs(budget.remaining))}</div>
            ) : null}
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-500 dark:text-white/45">
                التقدم {phase.progress_override != null ? "(يدوي)" : `(${doneCount}/${tasks.length} مهام)`}
              </span>
              <span className="tabular-nums font-semibold text-slate-900 dark:text-white" dir="ltr">
                {Math.round(progress)}%
              </span>
            </div>
            <ProgressBar pct={progress} tone={healthTone(health)} />
          </div>
        </div>

        {/* المهام */}
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-700 dark:text-white/70">المهام</div>
            <button type="button" onClick={() => onAddTask(phase)} className={`${ws.btnPrimary} px-2.5 py-1.5 text-xs`}>
              <Plus className="w-3.5 h-3.5" />
              مهمة
            </button>
          </div>
          {tasks.length === 0 ? (
            <div className="text-[11px] text-slate-400 dark:text-white/35 py-2">لا مهام في هذا القسم بعد.</div>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                today={today}
                busy={taskBusy}
                onToggle={onToggleTask}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))
          )}
        </div>

        {phase.notes ? <div className="text-[11px] text-slate-500 dark:text-white/45 whitespace-pre-line">{phase.notes}</div> : null}
      </div>
    </div>
  );
}

export default function PhasesTab({ project, selectedPhaseId, onSelectPhase }) {
  const today = useMemo(() => todayRiyadh(), []);
  const phases = useMemo(() => sortedPhases(project), [project]);

  const saveTask = useSaveBranchProjectTask();
  const deleteTask = useDeleteBranchProjectTask();
  const deletePhase = useDeleteBranchProjectPhase();
  const reorder = useReorderBranchProjectPhases();

  const [phaseModal, setPhaseModal] = useState({ open: false, phase: null });
  const [taskModal, setTaskModal] = useState({ open: false, phaseId: null, task: null });

  const summary = useMemo(() => {
    let done = 0;
    let late = 0;
    for (const phase of phases) {
      const tasks = phaseTasks(project, phase.id) || [];
      const health = phaseHealth(phase, tasks, today);
      if (health === "done" || phase.status === "done") done += 1;
      else if (health === "late") late += 1;
    }
    return { total: phases.length, done, late };
  }, [phases, project, today]);

  function handleToggleTask(task) {
    if (!project?.id) return;
    const nextDone = task.status !== "done";
    saveTask.mutate({
      project_id: project.id,
      ...task,
      id: task.id,
      status: nextDone ? "done" : "todo",
      done_at: nextDone ? todayRiyadh() : null,
    });
  }

  function handleDeleteTask(task) {
    if (!project?.id) return;
    if (!window.confirm(`حذف المهمة «${task.title}»؟`)) return;
    deleteTask.mutate({ project_id: project.id, id: task.id });
  }

  function handleDeletePhase(phase, invoiceCount) {
    if (!project?.id) return;
    if (invoiceCount > 0) {
      toast.error(`لا يمكن حذف «${phase.name}»: مرتبط بـ ${invoiceCount} فاتورة. انقل الفواتير أو احذفها أولاً.`);
      return;
    }
    const taskCount = (phaseTasks(project, phase.id) || []).length;
    const msg = taskCount > 0 ? `حذف القسم «${phase.name}» مع ${taskCount} مهمة؟` : `حذف القسم «${phase.name}»؟`;
    if (!window.confirm(msg)) return;
    deletePhase.mutate({ project_id: project.id, id: phase.id });
  }

  function handleMove(index, delta) {
    if (!project?.id) return;
    const target = index + delta;
    if (target < 0 || target >= phases.length) return;
    const ids = phases.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ project_id: project.id, ids });
  }

  return (
    <div className="space-y-4">
      {/* الشريط العلوي */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/70">
          <Layers className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-200" />
          <span className="tabular-nums">
            {summary.total} أقسام · <span className="text-[#0e7a5f] dark:text-emerald-200">{summary.done} مكتمل</span> ·{" "}
            <span className={summary.late > 0 ? "text-rose-600 dark:text-rose-300" : ""}>{summary.late} متأخر</span>
          </span>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => setPhaseModal({ open: true, phase: null })} className={`${ws.btnPrimary} px-3 py-2 text-sm`}>
          <Plus className="w-4 h-4" />
          قسم
        </button>
      </div>

      {phases.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="لا أقسام بعد"
          hint="أضف أقسام المشروع (العقد، التراخيص، التشطيب…) لتتبع التقدم والميزانية."
          action={
            <button type="button" onClick={() => setPhaseModal({ open: true, phase: null })} className={`${ws.btnPrimary} px-4 py-2 text-sm`}>
              <Plus className="w-4 h-4" />
              إضافة قسم
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {phases.map((phase, index) => (
            <PhaseCard
              key={phase.id}
              project={project}
              phase={phase}
              index={index}
              count={phases.length}
              today={today}
              selected={selectedPhaseId != null && String(selectedPhaseId) === String(phase.id)}
              onSelect={onSelectPhase}
              onAddTask={(p) => setTaskModal({ open: true, phaseId: p.id, task: null })}
              onEditTask={(task) => setTaskModal({ open: true, phaseId: task.phase_id, task })}
              onDeleteTask={handleDeleteTask}
              onToggleTask={handleToggleTask}
              onEditPhase={(p) => setPhaseModal({ open: true, phase: p })}
              onDeletePhase={handleDeletePhase}
              onMove={handleMove}
              taskBusy={saveTask.isPending}
              reorderBusy={reorder.isPending}
            />
          ))}
        </div>
      )}

      <PhaseModal
        open={phaseModal.open}
        project={project}
        phase={phaseModal.phase}
        onClose={() => setPhaseModal({ open: false, phase: null })}
      />
      <TaskModal
        open={taskModal.open}
        project={project}
        phaseId={taskModal.phaseId}
        task={taskModal.task}
        onClose={() => setTaskModal({ open: false, phaseId: null, task: null })}
      />
    </div>
  );
}
