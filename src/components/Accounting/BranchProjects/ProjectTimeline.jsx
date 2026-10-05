"use client";

import React, { useMemo } from "react";
import { Flag } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import {
  barPosition,
  phaseHealth,
  phaseProgress,
  phaseTasks,
  timelineRange,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import {
  HealthPill,
  ProgressBar,
  formatDate,
  healthTone,
} from "@/components/Accounting/BranchProjects/shared";

// خط زمني (Gantt) بـ CSS فقط. RTL: الزمن يسير من اليمين إلى اليسار،
// لذلك تُطبّق نسب الإزاحة على `right` بدل `left` في الأشهر والأشرطة
// وخط اليوم والمعالم معاً.

const DEFAULT_COLOR = "#0e7a5f";

function normalizeHex(color) {
  const raw = String(color || "").trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return DEFAULT_COLOR;
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return raw;
}

export function withAlpha(color, alpha) {
  const hex = normalizeHex(color);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function clampBar(pos) {
  const left = clampPct(pos?.left_pct);
  const width = Math.max(0, Math.min(100 - left, Number(pos?.width_pct) || 0));
  return { left, width };
}

function milestoneClass(task, today) {
  if (task.status === "done") return "bg-[#0e7a5f] dark:bg-emerald-300 border-white dark:border-[#132044]";
  if (task.due_date && task.due_date < today) return "bg-rose-500 dark:bg-rose-300 border-white dark:border-[#132044]";
  return "bg-amber-500 dark:bg-amber-300 border-white dark:border-[#132044]";
}

function LegendItem({ swatch, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-white/60">
      {swatch}
      {label}
    </span>
  );
}

export default function ProjectTimeline({ project, onSelectPhase, selectedPhaseId = null }) {
  const today = useMemo(() => todayRiyadh(), []);
  const range = useMemo(() => timelineRange(project, today), [project, today]);
  const phases = useMemo(
    () => [...(project?.phases || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [project],
  );

  const rows = useMemo(
    () =>
      phases.map((phase) => {
        const tasks = phaseTasks(project, phase.id);
        const progress = phaseProgress(phase, tasks);
        const health = phaseHealth(phase, tasks, today);
        const planned =
          phase.planned_start && phase.planned_end
            ? clampBar(barPosition(phase.planned_start, phase.planned_end, range.start, range.end))
            : null;
        let actual = null;
        if (phase.actual_start) {
          const end =
            phase.actual_end || (phase.status === "done" ? phase.actual_start : today);
          const safeEnd = end < phase.actual_start ? phase.actual_start : end;
          actual = clampBar(barPosition(phase.actual_start, safeEnd, range.start, range.end));
        }
        const milestones = tasks
          .filter((task) => task.is_milestone && task.due_date)
          .map((task) => ({
            task,
            pct: clampPct(barPosition(task.due_date, task.due_date, range.start, range.end).left_pct),
          }));
        return { phase, tasks, progress, health, planned, actual, milestones, color: normalizeHex(phase.color) };
      }),
    [phases, project, range, today],
  );

  const todayPct = range.today_pct == null ? null : clampPct(range.today_pct);

  if (phases.length === 0) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-center text-sm text-slate-500 dark:text-white/50`}>
        لا أقسام بعد — أضف أقساماً من تبويب «الأقسام» ليظهر الخط الزمني.
      </div>
    );
  }

  const handleSelect = (phaseId) => {
    if (typeof onSelectPhase === "function") onSelectPhase(phaseId);
  };

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
      <div className={`px-4 py-3 border-b ${ws.divider} flex items-center gap-2 flex-wrap`}>
        <div className="text-sm font-bold text-slate-900 dark:text-white">الخط الزمني</div>
        <div className="text-[11px] text-slate-500 dark:text-white/45 tabular-nums" dir="ltr">
          {formatDate(range.start)} → {formatDate(range.end)}
        </div>
      </div>

      {/* سطح المكتب: Gantt */}
      <div className="hidden md:block p-4 overflow-x-auto">
        <div className="flex min-w-[640px]">
          {/* عمود التسميات — أول عنصر في RTL يقع على اليمين */}
          <div className="w-48 shrink-0 border-l border-[#e2e7e4] dark:border-white/10">
            <div className="h-9" />
            {rows.map(({ phase, health }) => {
              const isSelected = selectedPhaseId != null && String(selectedPhaseId) === String(phase.id);
              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => handleSelect(phase.id)}
                  className={`h-12 w-full flex items-center justify-between gap-2 pl-3 pr-1 text-right transition-colors ${
                    isSelected ? "bg-[#e7f2ee] dark:bg-emerald-400/10" : "hover:bg-[#f6f8f7] dark:hover:bg-white/[0.04]"
                  }`}
                  title={phase.name}
                >
                  <span className="text-xs font-semibold text-slate-800 dark:text-white/85 truncate">{phase.name}</span>
                  <span className="scale-90 origin-left shrink-0">
                    <HealthPill health={health} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* منطقة الأشرطة */}
          <div className="flex-1 relative min-w-0">
            <div className="h-9 relative border-b border-[#e2e7e4] dark:border-white/10">
              {range.months.map((month) => (
                <div
                  key={month.key}
                  className="absolute top-0 bottom-0 border-r border-[#e2e7e4] dark:border-white/10 text-[11px] font-semibold text-slate-600 dark:text-white/60 flex items-center justify-center overflow-hidden whitespace-nowrap"
                  style={{ right: `${clampPct(month.left_pct)}%`, width: `${clampPct(month.width_pct)}%` }}
                  title={month.label}
                >
                  <span className="px-1 truncate">{month.label}</span>
                </div>
              ))}
            </div>

            {rows.map(({ phase, progress, planned, actual, milestones, color }) => {
              const isSelected = selectedPhaseId != null && String(selectedPhaseId) === String(phase.id);
              return (
                <div
                  key={phase.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(phase.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleSelect(phase.id);
                    }
                  }}
                  className={`h-12 relative border-b border-[#e2e7e4]/70 dark:border-white/[0.06] cursor-pointer transition-colors ${
                    isSelected ? "bg-[#e7f2ee]/60 dark:bg-emerald-400/5" : "hover:bg-[#f6f8f7] dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {/* خطوط الأشهر */}
                  {range.months.map((month) => (
                    <div
                      key={month.key}
                      className="absolute top-0 bottom-0 border-r border-[#e2e7e4]/60 dark:border-white/[0.05] pointer-events-none"
                      style={{ right: `${clampPct(month.left_pct)}%`, width: `${clampPct(month.width_pct)}%` }}
                    />
                  ))}

                  {planned ? (
                    <div
                      className="absolute top-2 h-5 rounded-md flex items-center justify-center overflow-hidden"
                      style={{
                        right: `${planned.left}%`,
                        width: `${planned.width}%`,
                        backgroundColor: withAlpha(color, 0.3),
                        border: `1px solid ${withAlpha(color, 0.45)}`,
                      }}
                      title={`مخطط: ${formatDate(phase.planned_start)} → ${formatDate(phase.planned_end)} · التقدم ${progress}%`}
                    >
                      {planned.width >= 6 ? (
                        <span className="text-[10px] font-bold tabular-nums text-slate-800 dark:text-white/90" dir="ltr">
                          {progress}%
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {actual ? (
                    <div
                      className="absolute top-8 h-1.5 rounded-full"
                      style={{ right: `${actual.left}%`, width: `${Math.max(actual.width, 0.6)}%`, backgroundColor: color }}
                      title={`فعلي: ${formatDate(phase.actual_start)} → ${phase.actual_end ? formatDate(phase.actual_end) : "مستمر"}`}
                    />
                  ) : null}

                  {milestones.map(({ task, pct }) => (
                    <div
                      key={task.id}
                      className={`absolute top-[13px] w-2.5 h-2.5 border ${milestoneClass(task, today)} shadow-sm`}
                      style={{ right: `${pct}%`, transform: "translateX(50%) rotate(45deg)" }}
                      title={`${task.title} — ${formatDate(task.due_date)}`}
                    />
                  ))}
                </div>
              );
            })}

            {todayPct != null ? (
              <div
                className="absolute top-0 bottom-0 w-px bg-rose-500 dark:bg-rose-300 pointer-events-none z-10"
                style={{ right: `${todayPct}%` }}
                title={`اليوم ${formatDate(today)}`}
              >
                <span className="absolute top-0 right-1 text-[10px] font-bold text-rose-600 dark:text-rose-200 whitespace-nowrap">
                  اليوم
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* الجوال: قائمة مبسطة */}
      <div className="md:hidden p-4 space-y-2">
        {rows.map(({ phase, progress, health, color }) => {
          const isSelected = selectedPhaseId != null && String(selectedPhaseId) === String(phase.id);
          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => handleSelect(phase.id)}
              className={`${ws.innerCard} w-full text-right p-3 ${isSelected ? "ring-2 ring-[#0e7a5f]/30 dark:ring-emerald-400/30" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate flex-1">{phase.name}</span>
                <HealthPill health={health} />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-white/50 mt-1 tabular-nums" dir="ltr">
                {formatDate(phase.planned_start)} → {formatDate(phase.planned_end)}
                {phase.actual_start ? ` · فعلي ${formatDate(phase.actual_start)}` : ""}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <ProgressBar pct={progress} tone={healthTone(health)} className="flex-1" />
                <span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-white/80" dir="ltr">
                  {progress}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className={`px-4 py-2.5 border-t ${ws.divider} flex items-center gap-4 flex-wrap`}>
        <LegendItem
          swatch={<span className="w-6 h-2.5 rounded-sm bg-[#0e7a5f]/30 border border-[#0e7a5f]/40" />}
          label="مخطط"
        />
        <LegendItem swatch={<span className="w-6 h-1.5 rounded-full bg-[#0e7a5f]" />} label="فعلي" />
        <LegendItem swatch={<span className="w-px h-3.5 bg-rose-500 dark:bg-rose-300" />} label="اليوم" />
        <LegendItem
          swatch={<span className="w-2 h-2 rotate-45 bg-amber-500 dark:bg-amber-300" />}
          label="معلم"
        />
        <LegendItem swatch={<Flag className="w-3 h-3 text-[#0e7a5f] dark:text-emerald-200" />} label="معلم مكتمل بالأخضر، متأخر بالأحمر" />
      </div>
    </div>
  );
}
