"use client";

import React, { useMemo } from "react";
import {
  CalendarCheck,
  MapPin,
  PartyPopper,
  Pencil,
  ScrollText,
  UserRound,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import {
  daysToOpening,
  projectBudget,
  projectHealth,
  projectProgress,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import {
  HealthPill,
  ProgressBar,
  ProgressRing,
  StatusPill,
  formatDate,
  formatMoney,
  healthTone,
} from "@/components/Accounting/BranchProjects/shared";

// بطاقة رأس المشروع: الهوية، الصحة، العد التنازلي، والميزانية.

export function daysWord(n) {
  const abs = Math.abs(n);
  if (abs === 1) return "يوم";
  if (abs === 2) return "يومين";
  if (abs <= 10) return "أيام";
  return "يوماً";
}

export function countdownText(project, today) {
  if (project?.status === "opened") {
    return { text: `افتُتح في ${formatDate(project.actual_opening_date || project.target_opening_date)}`, tone: "emerald" };
  }
  if (project?.status === "cancelled") return { text: "مشروع ملغى", tone: "slate" };
  const days = daysToOpening(project, today);
  if (!Number.isFinite(days)) return { text: "بلا موعد افتتاح", tone: "slate" };
  if (days === 0) return { text: "الافتتاح اليوم", tone: "amber" };
  if (days < 0) return { text: `تجاوز الموعد بـ ${Math.abs(days)} ${daysWord(days)}`, tone: "rose" };
  return { text: `باقي ${days} ${daysWord(days)} للافتتاح`, tone: days <= 14 ? "amber" : "slate" };
}

const TONE_TEXT = {
  rose: "text-rose-700 dark:text-rose-200",
  emerald: "text-[#0e7a5f] dark:text-emerald-200",
  amber: "text-amber-700 dark:text-amber-200",
  sky: "text-sky-700 dark:text-sky-200",
  slate: "text-slate-600 dark:text-white/60",
};

function MiniStat({ label, value, tone = "slate" }) {
  const toneClass =
    tone === "slate" ? "text-slate-900 dark:text-white" : TONE_TEXT[tone] || TONE_TEXT.slate;
  return (
    <div className={`${ws.innerCard} px-3 py-2`}>
      <div className="text-[11px] text-slate-500 dark:text-white/50">{label}</div>
      <div className={`text-sm font-bold tabular-nums mt-0.5 ${toneClass}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}

export default function ProjectHeader({ project, onEdit, onOpen }) {
  const today = useMemo(() => todayRiyadh(), []);
  const progress = projectProgress(project);
  const health = projectHealth(project, today);
  const budget = projectBudget(project);
  const countdown = countdownText(project, today);
  const place = [project.city, project.district].filter(Boolean).join(" · ");
  const overBudget = budget.over > 0;
  const budgetPct =
    budget.budget_total > 0 ? Math.round((budget.committed / budget.budget_total) * 100) : 0;
  const isOpened = project.status === "opened";
  const canOpen = project.status !== "opened" && project.status !== "cancelled";

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {project.name}
            </h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-white/45 tabular-nums" dir="ltr">
              {project.code}
            </span>
            <StatusPill status={project.status} />
            <HealthPill health={health} />
          </div>
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2 text-xs text-slate-600 dark:text-white/60">
            {place ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {place}
              </span>
            ) : null}
            {project.manager_name ? (
              <span className="inline-flex items-center gap-1">
                <UserRound className="w-3.5 h-3.5 shrink-0" />
                {project.manager_name}
              </span>
            ) : null}
            {project.lease_contract_number ? (
              <span className="inline-flex items-center gap-1">
                <ScrollText className="w-3.5 h-3.5 shrink-0" />
                عقد إيجار
                <span className="tabular-nums" dir="ltr">
                  {project.lease_contract_number}
                </span>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
              الافتتاح المستهدف {formatDate(project.target_opening_date)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-4">
            <button type="button" onClick={onEdit} className={`${ws.btnNeutral} px-3 py-2 text-sm`}>
              <Pencil className="w-4 h-4" />
              تعديل
            </button>
            {canOpen ? (
              <button type="button" onClick={onOpen} className={`${ws.btnPrimary} px-3 py-2 text-sm`}>
                <PartyPopper className="w-4 h-4" />
                تأكيد الافتتاح
              </button>
            ) : null}
            {isOpened ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold bg-[#e7f2ee] dark:bg-emerald-400/15 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25">
                <PartyPopper className="w-3.5 h-3.5" />
                افتُتح في
                <span className="tabular-nums" dir="ltr">
                  {formatDate(project.actual_opening_date)}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 lg:flex-col lg:items-end lg:text-left">
          <ProgressRing pct={progress} size={72} tone={healthTone(health)} />
          <div className={`text-xs font-semibold ${TONE_TEXT[countdown.tone] || TONE_TEXT.slate}`}>
            {countdown.text}
          </div>
        </div>
      </div>

      <div className={`border-t ${ws.divider} px-4 sm:px-5 py-4`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <MiniStat label="الميزانية" value={formatMoney(budget.budget_total)} />
          <MiniStat label="الملتزم به" value={formatMoney(budget.committed)} tone={overBudget ? "rose" : "amber"} />
          <MiniStat label="المسدد" value={formatMoney(budget.paid)} tone="emerald" />
          <MiniStat
            label={overBudget ? "التجاوز" : "المتبقي"}
            value={formatMoney(overBudget ? budget.over : budget.remaining)}
            tone={overBudget ? "rose" : "sky"}
          />
        </div>
        <ProgressBar pct={budgetPct} tone={overBudget ? "rose" : "emerald"} className="mt-3" />
        <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1 tabular-nums">
          الملتزم به {budgetPct}% من الميزانية
          {budget.unallocated > 0 ? ` · غير موزّع على الأقسام ${formatMoney(budget.unallocated, false)}` : ""}
        </div>
      </div>
    </div>
  );
}
