import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  GitBranch,
  Link2,
  Loader2,
  PlayCircle,
  Plus,
  Unlink,
  User2,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { StatusPill } from "../StatusPill";
import { PriorityPill } from "../PriorityPill";
import { workspaceFetch } from "@/utils/apiAuth";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { queryKeys } from "../../../utils/queryKeys.js";
import { todayRiyadhDateKey } from "@/utils/dateUtils";

const STATUS_CYCLE = ["Todo", "In Progress", "Done"];
function nextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return "In Progress";
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00+03:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Riyadh",
    });
  } catch {
    return null;
  }
}

function isDateOverdue(dateStr) {
  if (!dateStr) return false;
  return String(dateStr).slice(0, 10) < todayRiyadhDateKey();
}

function SubtaskRow({ subtask, onQuickStatus, isChanging, onUnlink, onOpen }) {
  const status = subtask.status || "Todo";
  const isDone = status === "Done";

  const handleCycle = (e) => {
    e.stopPropagation();
    if (isChanging) return;
    onQuickStatus(subtask.id, nextStatus(status));
  };

  const statusIconEl = isChanging ? (
    <Loader2 className="w-4 h-4 text-slate-400 dark:text-white/40" />
  ) : isDone ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
  ) : status === "In Progress" ? (
    <PlayCircle className="w-4 h-4 text-sky-700 dark:text-sky-300" />
  ) : (
    <Circle className="w-4 h-4 text-slate-400 dark:text-white/35" />
  );

  const assignees = Array.isArray(subtask.assignees) ? subtask.assignees : [];
  const assigneeNames = assignees
    .map((a) => a?.name)
    .filter(Boolean)
    .join("، ");

  const dueDateDisplay = formatShortDate(subtask.due_date);
  const overdue = !isDone && isDateOverdue(subtask.due_date);

  return (
    <div
      className="group rounded-xl py-2.5 px-3 hover:bg-violet-500/[0.06] border border-transparent hover:border-violet-400/10 transition-colors cursor-pointer"
      onClick={() => onOpen && onOpen(subtask)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen && onOpen(subtask);
      }}
    >
      {/* Top row */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleCycle}
          disabled={isChanging}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
          title={`تغيير إلى: ${nextStatus(status)}`}
        >
          {statusIconEl}
        </button>

        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-semibold truncate ${isDone ? "line-through text-slate-400 dark:text-white/40" : "text-slate-800 dark:text-white/85"}`}
          >
            {subtask.title}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <PriorityPill priority={subtask.priority || "Normal"} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnlink(subtask.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-red-700 dark:hover:text-red-300"
            title="إلغاء الربط"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom row: assignee + due date */}
      {assigneeNames || dueDateDisplay ? (
        <div className="flex items-center gap-3 mt-1.5 mr-8">
          {assigneeNames ? (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-white/45">
              <User2 className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{assigneeNames}</span>
            </div>
          ) : null}
          {dueDateDisplay ? (
            <div
              className={`flex items-center gap-1 text-[11px] ${overdue ? "text-red-700 dark:text-red-300" : "text-slate-500 dark:text-white/45"}`}
            >
              <CalendarDays className="w-3 h-3" />
              <span>{dueDateDisplay}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SubtasksSection({
  taskId,
  viewerEmployeeId,
  users,
  allTasks,
  onOpenSubtask,
}) {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [showAddFields, setShowAddFields] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [changingId, setChangingId] = useState(null);

  const safeUsers = Array.isArray(users) ? users : [];

  const subtasksQuery = useQuery({
    queryKey: queryKeys.workspaceSubtasks(taskId,viewerEmployeeId),
    enabled: !!taskId && !!viewerEmployeeId,
    queryFn: async () => {
      const res = await workspaceFetch(
        `/api/workspace/tasks/${taskId}/subtasks?employeeId=${viewerEmployeeId}`,
      );
      if (!res.ok) throw new Error("فشل تحميل المهام الفرعية");
      return res.json();
    },
  });

  const subtasks = subtasksQuery.data?.subtasks || [];
  const completedCount = subtasks.filter((s) => s.status === "Done").length;
  const totalCount = subtasks.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSubtasks(taskId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaceTasks() });
  }, [queryClient, taskId]);

  // Create subtask
  const createMutation = useMutation({
    mutationFn: async ({ title, dueDate, assigneeEmployeeIds }) => {
      const res = await workspaceFetch(`/api/workspace/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          title,
          dueDate: dueDate || null,
          assigneeEmployeeIds: assigneeEmployeeIds || [],
        }),
      });
      if (!res.ok) throw new Error("فشل إنشاء المهمة الفرعية");
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setNewTitle("");
      setNewAssignee(null);
      setNewDueDate("");
      setShowAddFields(false);
    },
  });

  // Link existing task
  const linkMutation = useMutation({
    mutationFn: async (childTaskId) => {
      const res = await workspaceFetch(`/api/workspace/tasks/${taskId}/subtasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          childTaskId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "فشل ربط المهمة");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setShowLinkPicker(false);
      setLinkSearch("");
    },
  });

  // Unlink subtask
  const unlinkMutation = useMutation({
    mutationFn: async (childTaskId) => {
      const res = await workspaceFetch(`/api/workspace/tasks/${taskId}/subtasks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          childTaskId,
        }),
      });
      if (!res.ok) throw new Error("فشل إلغاء الربط");
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  // Quick status change for subtask
  const quickStatusMutation = useMutation({
    mutationFn: async ({ subtaskId, status }) => {
      const res = await workspaceFetch("/api/workspace/tasks/quick-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          taskId: subtaskId,
          status,
        }),
      });
      if (!res.ok) throw new Error("فشل تغيير الحالة");
      return res.json();
    },
    onMutate: ({ subtaskId }) => setChangingId(subtaskId),
    onSuccess: invalidateAll,
    onSettled: () => setChangingId(null),
  });

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    const assigneeIds = newAssignee ? [Number(newAssignee)] : [];
    createMutation.mutate({
      title,
      dueDate: newDueDate || null,
      assigneeEmployeeIds: assigneeIds,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleQuickStatus = useCallback((subtaskId, status) => {
    quickStatusMutation.mutate({ subtaskId, status });
  }, []);

  const handleUnlink = useCallback((childId) => {
    unlinkMutation.mutate(childId);
  }, []);

  // Linkable tasks
  const subtaskIds = useMemo(
    () => new Set(subtasks.map((s) => s.id)),
    [subtasks],
  );

  const linkableTasks = useMemo(() => {
    const safe = Array.isArray(allTasks) ? allTasks : [];
    return safe.filter((t) => {
      if (t.id === taskId) return false;
      if (subtaskIds.has(t.id)) return false;
      if (t.parent_task_id) return false;
      if (Number(t.subtasks_total || 0) > 0) return false;
      if (!linkSearch.trim()) return true;
      return (t.title || "")
        .toLowerCase()
        .includes(linkSearch.trim().toLowerCase());
    });
  }, [allTasks, taskId, subtaskIds, linkSearch]);

  const sectionClass = `rounded-3xl border border-violet-400/15 bg-violet-500/[0.04] p-4 mt-4`;
  const hasNewTitle = newTitle.trim().length > 0;

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-700 dark:text-violet-300" />
          <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
            المهام الفرعية
          </span>
        </div>
        {totalCount > 0 ? (
          <span className="text-xs text-slate-600 dark:text-white/55">
            {completedCount}/{totalCount}
          </span>
        ) : null}
      </div>

      {/* Progress bar */}
      {totalCount > 0 ? (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-400/60 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Subtask rows */}
      {subtasksQuery.isLoading ? (
        <div className="text-slate-500 dark:text-white/50 text-xs py-2">جاري التحميل…</div>
      ) : (
        <div className="space-y-0.5">
          {subtasks.map((st) => (
            <SubtaskRow
              key={st.id}
              subtask={st}
              onQuickStatus={handleQuickStatus}
              isChanging={changingId === st.id}
              onUnlink={handleUnlink}
              onOpen={onOpenSubtask}
            />
          ))}
        </div>
      )}

      {/* Add new subtask */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowAddFields(true)}
            className={`flex-1 ${ws.input} px-3 py-2 text-sm`}
            placeholder="أضف مهمة فرعية جديدة…"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!hasNewTitle || createMutation.isPending}
            className={`${ws.btnPrimary} px-2.5 py-2 disabled:opacity-40`}
            title="إضافة"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowLinkPicker(!showLinkPicker)}
            className={`${ws.btnNeutral} px-2.5 py-2`}
            title="ربط مهمة موجودة"
          >
            <Link2 className="w-4 h-4" />
          </button>
        </div>

        {/* Assignee + Due date for new subtask */}
        {showAddFields && hasNewTitle ? (
          <div className="flex items-center gap-3 mr-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <User2 className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
              <select
                value={newAssignee || ""}
                onChange={(e) =>
                  setNewAssignee(e.target.value ? Number(e.target.value) : null)
                }
                className={`${ws.input} px-2 py-1.5 text-xs !rounded-lg !w-auto min-w-[100px]`}
              >
                <option value="">بدون مكلف</option>
                {safeUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className={`${ws.input} px-2 py-1.5 text-xs !rounded-lg !w-auto`}
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>
        ) : null}

        {/* Link existing task picker */}
        {showLinkPicker ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-700 dark:text-white/70 font-semibold">
                ربط مهمة موجودة
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowLinkPicker(false);
                  setLinkSearch("");
                }}
                className="w-5 h-5 flex items-center justify-center text-slate-400 dark:text-white/40 hover:text-slate-900 dark:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              className={`${ws.input} px-3 py-2 text-sm w-full mb-2`}
              placeholder="ابحث عن مهمة…"
              autoFocus
            />
            <div className="max-h-[180px] overflow-y-auto space-y-1">
              {linkableTasks.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-white/40 py-2 text-center">
                  لا توجد مهام متاحة للربط
                </div>
              ) : (
                linkableTasks.slice(0, 20).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => linkMutation.mutate(t.id)}
                    disabled={linkMutation.isPending}
                    className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:bg-white/[0.06] transition-colors"
                  >
                    <StatusPill status={t.status} />
                    <span className="flex-1 text-sm text-slate-800 dark:text-white/85 truncate">
                      {t.title}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-white/40">#{t.id}</span>
                  </button>
                ))
              )}
            </div>
            {linkMutation.error ? (
              <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                {linkMutation.error.message}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {createMutation.error ? (
        <div className="text-xs text-red-700 dark:text-red-300 mt-1">
          {createMutation.error.message}
        </div>
      ) : null}
    </div>
  );
}
