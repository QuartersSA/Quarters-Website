"use client";

import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import WorkspaceSidebar from "@/components/Workspace/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { todayISO, safeArray } from "@/utils/taskUtils";
import {
  useTasksData,
  useUsersData,
  useSpacesData,
} from "@/hooks/useTasksData";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { useTaskStats } from "@/hooks/useTaskStats";
import { useTaskGrouping } from "@/hooks/useTaskGrouping";
import { TaskModal } from "@/components/Tasks/TaskModal";
import { TaskFilters } from "@/components/Tasks/TaskFilters";
import { TaskStats } from "@/components/Tasks/TaskStats";
import { TaskBoardView } from "@/components/Tasks/TaskBoardView";
import { TaskListView } from "@/components/Tasks/TaskListView";
import { TaskViewControls } from "@/components/Tasks/TaskViewControls";
import { TaskPageHeader } from "@/components/Tasks/TaskPageHeader";
import { StatusPill } from "@/components/Tasks/StatusPill";
import { ws } from "@/components/Workspace/ui";

function formatDateTime(dateString) {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString("ar-SA-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateString);
  }
}

function formatDateOnly(dateString) {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("ar-SA-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dateString);
  }
}

export default function WorkspaceTasksPage() {
  const { employeeId } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const myId = employeeId;
  const today = todayISO();

  const [scope, setScope] = useState("my"); // my | team
  const [view, setView] = useState("board"); // board | list
  const [statusFilter, setStatusFilter] = useState("all");
  const [spaceFilter, setSpaceFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("default");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // In "My tasks" we hide the assignee filter (assignees are for team view only).
  useEffect(() => {
    if (scope === "my") {
      setAssigneeFilter("all");
    }
  }, [scope]);

  const usersQuery = useUsersData(myId);
  const spacesQuery = useSpacesData(myId);
  const tasksQuery = useTasksData(myId, scope, statusFilter, spaceFilter, q);

  const users = usersQuery.data?.users || [];
  const spaces = spacesQuery.data?.spaces || [];
  const rawTasks = tasksQuery.data?.tasks || [];

  const tasks = useMemo(() => {
    const filterAssignee =
      scope === "team" && assigneeFilter !== "all"
        ? Number(assigneeFilter)
        : null;

    const filtered = rawTasks.filter((t) => {
      if (!filterAssignee) return true;
      const ids = safeArray(t.assignees)
        .map((a) => a?.id)
        .filter(Boolean);
      return ids.includes(filterAssignee);
    });

    // Apply sorting
    const sorted = [...filtered];
    if (sortBy === "priority") {
      const priorityOrder = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
      sorted.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 4;
        const pb = priorityOrder[b.priority] ?? 4;
        return pa - pb;
      });
    } else if (sortBy === "dueDate") {
      sorted.sort((a, b) => {
        const da = a.due_date || "9999";
        const db = b.due_date || "9999";
        return String(da).localeCompare(String(db));
      });
    } else if (sortBy === "newest") {
      sorted.sort((a, b) => b.id - a.id);
    }

    return sorted;
  }, [rawTasks, assigneeFilter, scope, sortBy]);

  const stats = useTaskStats(tasks, today);
  const grouped = useTaskGrouping(tasks);

  const overdueEnabled = !!myId && scope === "team";
  const overdueQuery = useQuery({
    queryKey: ["workspaceOverdueTasks", myId],
    enabled: overdueEnabled,
    queryFn: async () => {
      const res = await fetch(`/api/workspace/overdue?employeeId=${myId}`);
      if (!res.ok) {
        throw new Error(
          `When fetching /api/workspace/overdue, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return res.json();
    },
  });

  const overdueTasks = overdueQuery.data?.tasks || [];

  const openCreate = useCallback(() => {
    setEditingTask(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((task) => {
    setEditingTask(task);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingTask(null);
  }, []);

  const { createMutation, updateMutation, deleteMutation } = useTaskMutations(
    myId,
    closeModal,
  );

  const submitting = createMutation.isPending || updateMutation.isPending;
  const submitError =
    createMutation.error?.message || updateMutation.error?.message || null;

  const submitModal = (payload) => {
    if (!myId) return;

    const mode = editingTask?.id ? "edit" : "create";

    if (mode === "create") {
      createMutation.mutate(payload);
      return;
    }

    updateMutation.mutate({ id: editingTask.id, payload });
  };

  const deleteCurrent = () => {
    const id = editingTask?.id;
    if (!id) return;
    // simple confirm
    const ok = window.confirm("هل أنت متأكد من حذف المهمة؟");
    if (!ok) return;
    deleteMutation.mutate(id);
  };

  // Quick status change
  const [changingTaskId, setChangingTaskId] = useState(null);

  const quickStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }) => {
      const res = await fetch("/api/workspace/tasks/quick-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: myId, taskId, status }),
      });
      if (!res.ok) {
        throw new Error("فشل تغيير الحالة");
      }
      return res.json();
    },
    onMutate: ({ taskId }) => {
      setChangingTaskId(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaceTasks"] });
      queryClient.invalidateQueries({ queryKey: ["workspaceSummary"] });
      queryClient.invalidateQueries({ queryKey: ["workspaceOverdueTasks"] });
    },
    onSettled: () => {
      setChangingTaskId(null);
    },
  });

  const handleQuickStatus = useCallback(
    (taskId, newStatus) => {
      quickStatusMutation.mutate({ taskId, status: newStatus });
    },
    [quickStatusMutation],
  );

  const isLoading =
    tasksQuery.isLoading || usersQuery.isLoading || spacesQuery.isLoading;
  const hasError = tasksQuery.error || usersQuery.error || spacesQuery.error;

  const emptyCardClass = `${ws.glassSoft} rounded-3xl p-6 text-white/60`;

  const overdueCardClass = `${ws.glassSoft} ${ws.card} p-4`;

  const overdueContent = useMemo(() => {
    if (scope !== "team") return null;

    if (!overdueEnabled) {
      return <div className="text-white/60">جاري التحميل…</div>;
    }

    if (overdueQuery.isLoading) {
      return <div className="text-white/60">جاري تحميل السجل…</div>;
    }

    if (overdueQuery.error) {
      return <div className="text-red-300">فشل تحميل سجل المهام المتأخرة</div>;
    }

    if (!overdueTasks.length) {
      return <div className="text-white/60">لا يوجد مهام متأخرة مسجّلة.</div>;
    }

    const rows = overdueTasks.map((t) => {
      const title = t.title || "—";
      const due = t.due_date ? formatDateOnly(t.due_date) : "—";
      const completed = t.completed_at ? formatDateTime(t.completed_at) : "—";

      const assignees = safeArray(t.assignees)
        .map((a) => a?.name)
        .filter(Boolean);
      const assigneesText = assignees.length ? assignees.join("، ") : "—";

      const isCurrentlyOverdue = !!t.is_currently_overdue;
      const wasCompletedLate = !!t.was_completed_late;

      let note = "تجاوزت موعدها سابقاً";
      if (isCurrentlyOverdue) note = "متأخرة الآن";
      if (wasCompletedLate) note = "تمت متأخرة";

      return {
        id: t.id,
        title,
        due,
        completed,
        assigneesText,
        status: t.status,
        note,
        spaceName: t.space_name || "—",
      };
    });

    return (
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full text-sm">
          <thead>
            <tr className="text-white/70">
              <th className="text-right font-semibold py-2 px-3">المهمة</th>
              <th className="text-right font-semibold py-2 px-3">المساحة</th>
              <th className="text-right font-semibold py-2 px-3">المكلفون</th>
              <th className="text-right font-semibold py-2 px-3">الاستحقاق</th>
              <th className="text-right font-semibold py-2 px-3">الحالة</th>
              <th className="text-right font-semibold py-2 px-3">تمت في</th>
              <th className="text-right font-semibold py-2 px-3">ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              return (
                <tr
                  key={r.id}
                  className="border-t border-white/10 hover:bg-white/[0.04] cursor-pointer"
                  onClick={() => {
                    const task = overdueTasks.find((x) => x.id === r.id);
                    if (task) openEdit(task);
                  }}
                >
                  <td className="py-3 px-3 font-semibold text-white">
                    {r.title}
                  </td>
                  <td className="py-3 px-3 text-white/70">{r.spaceName}</td>
                  <td className="py-3 px-3 text-white/70">{r.assigneesText}</td>
                  <td className="py-3 px-3 text-white/70">{r.due}</td>
                  <td className="py-3 px-3">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="py-3 px-3 text-white/70">{r.completed}</td>
                  <td className="py-3 px-3 text-white/70">{r.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }, [
    overdueEnabled,
    overdueQuery.isLoading,
    overdueQuery.error,
    overdueTasks,
    scope,
    openEdit,
  ]);

  const showAssigneeFilter = scope === "team";
  // Allow re-assigning from inside the task page (modal) for both "مهامي" and "فريق العمل".
  const showAssigneesInModal = true;

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <WorkspaceSidebar active="tasks" />

      <TaskPageHeader onOpenCreate={openCreate} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-5">
          <TaskViewControls
            scope={scope}
            setScope={setScope}
            view={view}
            setView={setView}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />

          <TaskFilters
            q={q}
            setQ={setQ}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            spaceFilter={spaceFilter}
            setSpaceFilter={setSpaceFilter}
            assigneeFilter={assigneeFilter}
            setAssigneeFilter={setAssigneeFilter}
            spaces={spaces}
            users={users}
            showAssigneeFilter={showAssigneeFilter}
          />

          <TaskStats stats={stats} />

          {scope === "team" ? (
            <div className={overdueCardClass}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`${ws.iconBox} w-10 h-10`}>
                  <AlertTriangle className="w-5 h-5 text-red-200" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white tracking-tight">
                    سجل المهام المتأخرة
                  </div>
                  <div className="text-xs text-white/50">
                    يبقى كمرجع حتى لو تغيّرت الحالة لاحقاً
                  </div>
                </div>
              </div>
              {overdueContent}
            </div>
          ) : null}

          {/* content */}
          {isLoading ? (
            <div className={emptyCardClass}>جاري التحميل…</div>
          ) : hasError ? (
            <div
              className={`${ws.glassSoft} border-red-500/30 rounded-3xl p-6 text-red-300`}
            >
              فشل تحميل بيانات المهام
            </div>
          ) : tasks.length === 0 ? (
            <div className={emptyCardClass}>لا توجد مهام حالياً</div>
          ) : view === "list" ? (
            <TaskListView
              tasks={tasks}
              onOpenEdit={openEdit}
              onQuickStatus={handleQuickStatus}
              changingId={changingTaskId}
            />
          ) : (
            <TaskBoardView
              grouped={grouped}
              onOpenEdit={openEdit}
              onQuickStatus={handleQuickStatus}
              changingId={changingTaskId}
            />
          )}
        </div>
      </main>

      {modalOpen ? (
        <TaskModal
          key={editingTask?.id ? String(editingTask.id) : "new"}
          mode={editingTask?.id ? "edit" : "create"}
          users={users}
          spaces={spaces}
          initialTask={editingTask}
          onClose={closeModal}
          onSubmit={submitModal}
          onDelete={deleteCurrent}
          submitting={submitting}
          submitError={submitError}
          showAssignees={showAssigneesInModal}
          viewerEmployeeId={myId}
          allTasks={rawTasks}
          onOpenSubtask={(subtask) => {
            setEditingTask(subtask);
          }}
          onGoToParent={() => {
            const parentId = editingTask?.parent_task_id;
            if (!parentId) return;
            const parent = rawTasks.find((t) => t.id === parentId);
            if (parent) {
              setEditingTask(parent);
            }
          }}
        />
      ) : null}
    </div>
  );
}
