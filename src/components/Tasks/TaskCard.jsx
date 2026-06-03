import {
  CalendarDays,
  CheckCircle2,
  Circle,
  ChevronLeft,
  GitBranch,
  Paperclip,
  PlayCircle,
  Loader2,
} from "lucide-react";
import { normalizeDate, safeArray } from "@/utils/taskUtils";
import { StatusPill } from "./StatusPill";
import { PriorityPill } from "./PriorityPill";
import { AssigneesStack } from "./AssigneesStack";
import { ws } from "@/components/Workspace/ui";

const SYSTEM_DELETED_TAG = "__system_deleted__";
const SYSTEM_CLOSED_TAG = "__closed_not_completed__";

const STATUS_CYCLE = ["Todo", "In Progress", "Done"];

function nextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return "In Progress";
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

export function TaskCard({ task, onOpen, onQuickStatus, changingId }) {
  const title = task.title || "—";
  const due = normalizeDate(task.due_date);
  const dueLabel = due || "بدون تاريخ";

  const rawTags = safeArray(task.tags);
  const tags = rawTags.filter(
    (t) => String(t) !== SYSTEM_DELETED_TAG && String(t) !== SYSTEM_CLOSED_TAG,
  );

  const status = task.status || "Todo";
  const priority = task.priority || "Normal";

  const isClosedNotCompleted = rawTags.includes(SYSTEM_CLOSED_TAG);
  const isChanging = changingId === task.id;
  const isSubtask = !!task.parent_task_id;

  const handleCycleStatus = (e) => {
    e.stopPropagation();
    if (isChanging || !onQuickStatus) return;
    onQuickStatus(task.id, nextStatus(status));
  };

  const iconWrapClass =
    "w-10 h-10 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] hover:bg-slate-200 dark:bg-white/[0.08] transition-colors cursor-pointer";

  const statusIcon = isChanging ? (
    <Loader2 className="w-5 h-5 text-slate-500 dark:text-white/50 animate-spin" />
  ) : status === "Done" ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
  ) : status === "In Progress" ? (
    <PlayCircle className="w-5 h-5 text-sky-700 dark:text-sky-300" />
  ) : (
    <Circle className="w-5 h-5 text-slate-400 dark:text-white/35" />
  );

  const hasSpace = !!task.space_name;
  const spaceName = task.space_name || "";

  const hasAttachment =
    !!task.image_url || Number(task?.attachments_count || 0) > 0;

  const cardClass = isSubtask
    ? `w-full text-right ${ws.glassSoft} ${ws.card} p-4 transition-colors hover:bg-violet-500/[0.06] !border-violet-400/15 bg-violet-500/[0.03]`
    : `w-full text-right ${ws.glassSoft} ${ws.card} p-4 transition-colors hover:bg-slate-100 dark:bg-white/[0.06]`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className={`${cardClass} relative cursor-pointer`}
    >
      {/* Subtask badge */}
      {isSubtask ? (
        <div className="flex items-center gap-1.5 mb-2">
          <GitBranch className="w-3 h-3 text-violet-700 dark:text-violet-300" />
          <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300/80">
            مهمة فرعية
          </span>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3">
          <div
            className={iconWrapClass}
            role="button"
            tabIndex={0}
            onClick={handleCycleStatus}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCycleStatus(e);
              }
            }}
            title={
              onQuickStatus ? `تغيير إلى: ${nextStatus(status)}` : undefined
            }
          >
            {statusIcon}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white truncate tracking-tight">
              {title}
            </div>
            {hasSpace ? (
              <div className="mt-1 text-xs text-slate-600 dark:text-white/55 truncate">
                {spaceName}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-2">
          {hasAttachment ? (
            <div
              className="hidden sm:flex w-9 h-9 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 items-center justify-center text-slate-600 dark:text-white/60"
              title="يوجد مرفق"
            >
              <Paperclip className="w-4 h-4" />
            </div>
          ) : null}
          <AssigneesStack assignees={task.assignees} />
          <div className="hidden sm:flex w-9 h-9 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 items-center justify-center text-slate-600 dark:text-white/60">
            <ChevronLeft className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusPill
          status={status}
          isClosedNotCompleted={isClosedNotCompleted}
        />
        <PriorityPill priority={priority} />

        <span className={ws.chip}>
          <CalendarDays className="w-4 h-4 text-slate-600 dark:text-white/55" />
          {dueLabel}
        </span>

        {Number(task.subtasks_total || 0) > 0 ? (
          <span className={ws.chip}>
            <GitBranch className="w-3.5 h-3.5 text-violet-700 dark:text-violet-300" />
            {Number(task.subtasks_done || 0)}/{Number(task.subtasks_total || 0)}
          </span>
        ) : null}
      </div>

      {tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 6).map((t) => (
            <span key={t} className={ws.chip}>
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {task.description ? (
        <div className="mt-3 text-sm text-slate-700 dark:text-white/70 line-clamp-2">
          {task.description}
        </div>
      ) : null}
    </div>
  );
}
