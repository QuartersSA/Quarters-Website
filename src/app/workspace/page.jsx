"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WorkspaceSidebar from "@/components/Workspace/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  MessageSquare,
  ArrowLeft,
  ListTodo,
  Loader2,
  ChevronLeft,
  Activity,
  CalendarRange,
  PlayCircle,
  HeartPulse,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { StatusPill } from "@/components/Tasks/StatusPill";
import { PriorityPill } from "@/components/Tasks/PriorityPill";
import { LOCALE } from "@/utils/dateUtils";

function formatDateOnly(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(LOCALE, {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Riyadh",
    });
  } catch {
    return String(d);
  }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return "الآن";
    if (diffMin < 60) return `منذ ${diffMin} د`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `منذ ${diffHr} س`;
    const diffDay = Math.floor(diffHr / 24);
    return `منذ ${diffDay} ي`;
  } catch {
    return "";
  }
}

function greetingText() {
  const hr = new Date().getHours();
  if (hr < 12) return "صباح الخير";
  if (hr < 17) return "مساء الخير";
  return "مساء الخير";
}

const STATUS_CYCLE = ["Todo", "In Progress", "Done"];

function nextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return "In Progress";
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

function QuickTaskRow({ task, onQuickStatus, isChanging }) {
  const status = task.status || "Todo";
  const isDone = status === "Done";
  const priority = task.priority || "Normal";

  const handleCycleStatus = (e) => {
    e.stopPropagation();
    if (isChanging) return;
    onQuickStatus(task.id, nextStatus(status));
  };

  const rowClass = `flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:bg-white/[0.06] transition-colors ${isDone ? "opacity-60" : ""}`;

  return (
    <div className={rowClass}>
      <button
        type="button"
        onClick={handleCycleStatus}
        className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-200 dark:bg-white/[0.08] transition-colors"
        title={`تغيير إلى: ${nextStatus(status)}`}
        disabled={isChanging}
      >
        {isChanging ? (
          <Loader2 className="w-4 h-4 text-slate-500 dark:text-white/50 animate-spin" />
        ) : isDone ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
        ) : status === "In Progress" ? (
          <PlayCircle className="w-4 h-4 text-sky-700 dark:text-sky-300" />
        ) : (
          <Circle className="w-4 h-4 text-slate-400 dark:text-white/35" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={`font-semibold text-sm truncate tracking-tight ${isDone ? "line-through text-slate-500 dark:text-white/50" : "text-slate-900 dark:text-white"}`}
        >
          {task.title}
        </div>
        {task.space_name ? (
          <div className="text-xs text-slate-500 dark:text-white/45 truncate mt-0.5">
            {task.space_name}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <PriorityPill priority={priority} />
        <StatusPill status={status} />
      </div>
    </div>
  );
}

function HealthScoreCard({ healthScore }) {
  const { percent, onTime, late, totalDone } = healthScore;

  if (totalDone === 0) {
    return (
      <div className={`${ws.glassSoft} ${ws.card} p-5`}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-slate-500 dark:text-white/50" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white tracking-tight">
              مؤشر صحة المهام
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50">أداء الإنجاز هذا الشهر</div>
          </div>
        </div>
        <div className="text-slate-500 dark:text-white/50 text-sm text-center py-4">
          لا توجد مهام مكتملة هذا الشهر بعد
        </div>
      </div>
    );
  }

  const safePercent = typeof percent === "number" ? percent : 0;

  const gaugeColor =
    safePercent >= 80 ? "#6EE7B7" : safePercent >= 50 ? "#FCD34D" : "#F87171";

  const gaugeLabel =
    safePercent >= 80 ? "ممتاز" : safePercent >= 50 ? "مقبول" : "ضعيف";

  const gaugeBgColor =
    safePercent >= 80
      ? "bg-emerald-400/15 border-emerald-400/25 text-emerald-700 dark:text-emerald-200"
      : safePercent >= 50
        ? "bg-amber-400/15 border-amber-400/25 text-amber-700 dark:text-amber-200"
        : "bg-red-400/15 border-red-400/25 text-red-200";

  // SVG arc for the gauge
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-5`}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${gaugeBgColor}`}
        >
          <HeartPulse className="w-5 h-5" />
        </div>
        <div>
          <div className="font-bold text-slate-900 dark:text-white tracking-tight">
            مؤشر صحة المهام
          </div>
          <div className="text-xs text-slate-500 dark:text-white/50">
            المهام المُقفلة هذا الشهر بناءً على سجل التأخير
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Circular Gauge */}
        <div className="relative flex-shrink-0">
          <svg
            width="130"
            height="130"
            viewBox="0 0 130 130"
            className="-rotate-90"
          >
            <circle
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="10"
            />
            <circle
              cx="65"
              cy="65"
              r={radius}
              fill="none"
              stroke={gaugeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-slate-900 dark:text-white">{safePercent}%</div>
            <div
              className="text-xs font-semibold"
              style={{ color: gaugeColor }}
            >
              {gaugeLabel}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 grid grid-cols-3 gap-3 w-full">
          <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3 text-center">
            <div className="text-xl font-bold text-slate-900 dark:text-white">{totalDone}</div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1">مُقفلة</div>
          </div>
          <div className="rounded-2xl bg-emerald-400/[0.06] border border-emerald-400/15 p-3 text-center">
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-200">{onTime}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-200/60 mt-1">بدون تأخير</div>
          </div>
          <div className="rounded-2xl bg-red-400/[0.06] border border-red-400/15 p-3 text-center">
            <div className="text-xl font-bold text-red-200">{late}</div>
            <div className="text-xs text-red-200/60 mt-1">سجل المتأخرة</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceSummaryPage() {
  const { employeeId, user } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const myId = employeeId;

  const summaryQuery = useQuery({
    queryKey: ["workspaceSummary", myId],
    enabled: !!myId,
    refetchInterval: 30000,
    queryFn: async () => {
      const res = await fetch(`/api/workspace/summary?employeeId=${myId}`);
      if (!res.ok) {
        throw new Error(`[${res.status}] ${res.statusText}`);
      }
      return res.json();
    },
  });

  const data = summaryQuery.data;
  const todayTasks = data?.myTasksToday || [];
  const overdueTasks = data?.myOverdueTasks || [];
  const unreadCount = data?.unreadCount || 0;
  const stats = data?.stats || { todo: 0, inProgress: 0, done: 0, total: 0 };
  const recentActivity = data?.recentActivity || [];
  const upcomingTasks = data?.upcomingTasks || [];
  const healthScore = data?.healthScore || {
    percent: null,
    onTime: 0,
    late: 0,
    totalDone: 0,
  };

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
    onMutate: async ({ taskId }) => {
      setChangingTaskId(taskId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaceSummary"] });
      queryClient.invalidateQueries({ queryKey: ["workspaceTasks"] });
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

  const userName = user?.name || "";
  const greeting = greetingText();

  const cardClass = `${ws.glassSoft} ${ws.card} p-5`;
  const topBarClass = ws.topBar;

  const isLoading = summaryQuery.isLoading;
  const hasError = summaryQuery.error;

  const todayDoneCount = todayTasks.filter((t) => t.status === "Done").length;
  const todayPendingCount = todayTasks.length - todayDoneCount;

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <WorkspaceSidebar active="home" />

      {/* Mobile top bar */}
      <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
        <div className="px-4 py-3 flex items-center gap-2">
          <div className={`${ws.iconBox} w-10 h-10`}>
            <CalendarDays className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {greeting}، {userName || ""}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 truncate">ملخص يومك</div>
          </div>
        </div>
      </div>

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-5">
          {/* Desktop Header */}
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={ws.iconBox}>
                <CalendarDays className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {greeting}، {userName}
                </div>
                <div className="text-slate-600 dark:text-white/55 mt-1">ملخص اليوم وأهم المهام</div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className={cardClass}>
              <div className="text-slate-600 dark:text-white/60 flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري التحميل…
              </div>
            </div>
          ) : hasError ? (
            <div className={`${cardClass} border-red-500/30 text-red-300`}>
              فشل تحميل الملخص
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <a
                  href="/workspace/tasks"
                  className={`${cardClass} hover:bg-slate-100 dark:bg-white/[0.06] transition-colors block`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/15 text-amber-700 dark:text-amber-200 border border-amber-400/25 flex items-center justify-center">
                      <ListTodo className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats.todo}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-white/55">للإنجاز</div>
                    </div>
                  </div>
                </a>

                <a
                  href="/workspace/tasks"
                  className={`${cardClass} hover:bg-slate-100 dark:bg-white/[0.06] transition-colors block`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-400/15 text-sky-700 dark:text-sky-200 border border-sky-400/25 flex items-center justify-center">
                      <PlayCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats.inProgress}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-white/55">قيد التنفيذ</div>
                    </div>
                  </div>
                </a>

                <a
                  href="/workspace/tasks"
                  className={`${cardClass} hover:bg-slate-100 dark:bg-white/[0.06] transition-colors block`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-400/15 text-emerald-700 dark:text-emerald-200 border border-emerald-400/25 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats.done}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-white/55">مكتملة</div>
                    </div>
                  </div>
                </a>

                <a
                  href="/workspace/inbox"
                  className={`${cardClass} hover:bg-slate-100 dark:bg-white/[0.06] transition-colors block`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl ${unreadCount > 0 ? "bg-rose-400/15 text-rose-700 dark:text-rose-200 border-rose-400/25" : "bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10"} border flex items-center justify-center`}
                    >
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {unreadCount}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-white/55">
                        رسائل غير مقروءة
                      </div>
                    </div>
                  </div>
                </a>
              </div>

              {/* Health Score */}
              <HealthScoreCard healthScore={healthScore} />

              {/* Overdue Tasks */}
              {overdueTasks.length > 0 ? (
                <div
                  className={`${ws.glassSoft} ${ws.card} p-5 border-red-500/20`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-red-400/15 text-red-200 border border-red-400/25 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                        مهام متأخرة ({overdueTasks.length})
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/50">
                        تجاوزت موعد الاستحقاق
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {overdueTasks.map((t) => (
                      <QuickTaskRow
                        key={t.id}
                        task={t}
                        onQuickStatus={handleQuickStatus}
                        isChanging={changingTaskId === t.id}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Today's Tasks */}
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-400/15 text-emerald-700 dark:text-emerald-200 border border-emerald-400/25 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                        مهام اليوم{" "}
                        {todayTasks.length > 0
                          ? `(${todayPendingCount} متبقية)`
                          : ""}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/50">
                        المهام المستحقة اليوم
                      </div>
                    </div>
                  </div>
                  <a
                    href="/workspace/tasks"
                    className={`${ws.btnNeutral} px-3 py-2 text-sm`}
                  >
                    عرض الكل
                    <ChevronLeft className="w-4 h-4" />
                  </a>
                </div>

                {todayTasks.length === 0 ? (
                  <div className="text-slate-500 dark:text-white/50 text-sm py-4 text-center">
                    🎉 لا توجد مهام مستحقة اليوم
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayTasks.map((t) => (
                      <QuickTaskRow
                        key={t.id}
                        task={t}
                        onQuickStatus={handleQuickStatus}
                        isChanging={changingTaskId === t.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Upcoming Tasks */}
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-violet-400/15 text-violet-700 dark:text-violet-200 border border-violet-400/25 flex items-center justify-center">
                      <CalendarRange className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                        القادمة
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/50">خلال 7 أيام</div>
                    </div>
                  </div>
                  {upcomingTasks.length === 0 ? (
                    <div className="text-slate-500 dark:text-white/50 text-sm py-3 text-center">
                      لا توجد مهام قادمة
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingTasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white truncate tracking-tight">
                              {t.title}
                            </div>
                            {t.space_name ? (
                              <div className="text-xs text-slate-500 dark:text-white/45 truncate mt-0.5">
                                {t.space_name}
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={ws.chip}>
                              <CalendarDays className="w-3.5 h-3.5 text-slate-600 dark:text-white/55" />
                              {formatDateOnly(t.due_date)}
                            </span>
                            <PriorityPill priority={t.priority || "Normal"} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-sky-400/15 text-sky-700 dark:text-sky-200 border border-sky-400/25 flex items-center justify-center">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                        آخر النشاطات
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/50">
                        تحديثات الفريق
                      </div>
                    </div>
                  </div>
                  {recentActivity.length === 0 ? (
                    <div className="text-slate-500 dark:text-white/50 text-sm py-3 text-center">
                      لا توجد نشاطات حديثة
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentActivity.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]"
                        >
                          <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {ev.event_type === "created" ? (
                              <Circle className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-sky-700 dark:text-sky-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-900 dark:text-white font-semibold truncate">
                              {ev.task_title || "مهمة"}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
                              {ev.actor_name || "—"} · {ev.summary}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 dark:text-white/40 flex-shrink-0 mt-1">
                            {formatTimeAgo(ev.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
