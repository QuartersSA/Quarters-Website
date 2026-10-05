"use client";

import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import {
  PROJECT_STATUS_LABELS,
  PHASE_STATUS_LABELS,
  HEALTH_LABELS,
} from "@/utils/branchProjectMath";

// عناصر مشتركة لوحدة تأسيس الفروع — ثيم المشتريات، RTL، دارك/لايت.

export function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value, withCurrency = true) {
  const n = moneyValue(value);
  const text = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withCurrency ? `${text} SAR` : text;
}

export function formatDate(value) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

const TONE_TEXT = {
  rose: "text-rose-700 dark:text-rose-200",
  emerald: "text-[#0e7a5f] dark:text-emerald-200",
  amber: "text-amber-700 dark:text-amber-200",
  sky: "text-sky-700 dark:text-sky-200",
  slate: "text-slate-700 dark:text-white/80",
};

const TONE_BAR = {
  rose: "bg-rose-500 dark:bg-rose-400",
  emerald: "bg-[#0e7a5f] dark:bg-emerald-400",
  amber: "bg-amber-500 dark:bg-amber-300",
  sky: "bg-sky-500 dark:bg-sky-400",
  slate: "bg-slate-400 dark:bg-white/40",
};

export function toneText(tone = "slate") {
  return TONE_TEXT[tone] || TONE_TEXT.slate;
}

export function SummaryCard({ label, value, icon: Icon, tone = "slate", suffix }) {
  const toneClass = toneText(tone);
  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-white/50">{label}</div>
          <div className={`text-xl font-bold mt-1 tabular-nums ${toneClass}`} dir="ltr">
            {value}
          </div>
          {suffix ? <div className="text-xs text-slate-500 dark:text-white/45 mt-1">{suffix}</div> : null}
        </div>
        {Icon ? (
          <div className={`${ws.iconBox} w-10 h-10 shrink-0 ${toneClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
      {Icon ? (
        <div className={`${ws.iconBox} mx-auto text-[#0e7a5f] dark:text-emerald-200`}>
          <Icon className="w-5 h-5" />
        </div>
      ) : null}
      <div className="font-bold text-slate-900 dark:text-white mt-3">{title}</div>
      {hint ? <div className="text-sm text-slate-500 dark:text-white/50 mt-1">{hint}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const PROJECT_STATUS_CLASS = {
  planning: "bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-400/25",
  in_progress: "bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-400/25",
  on_hold: "bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/15",
  opened: "bg-[#e7f2ee] dark:bg-emerald-400/15 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25",
  cancelled: "bg-rose-100 dark:bg-rose-400/15 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-400/25",
};

export function StatusPill({ status }) {
  const cls = PROJECT_STATUS_CLASS[status] || PROJECT_STATUS_CLASS.on_hold;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${cls}`}>
      {PROJECT_STATUS_LABELS[status] || status}
    </span>
  );
}

const PHASE_STATUS_CLASS = {
  not_started: PROJECT_STATUS_CLASS.on_hold,
  in_progress: PROJECT_STATUS_CLASS.in_progress,
  done: PROJECT_STATUS_CLASS.opened,
  blocked: PROJECT_STATUS_CLASS.cancelled,
};

export function PhaseStatusPill({ status }) {
  const cls = PHASE_STATUS_CLASS[status] || PHASE_STATUS_CLASS.not_started;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${cls}`}>
      {PHASE_STATUS_LABELS[status] || status}
    </span>
  );
}

const HEALTH_CLASS = {
  done: PROJECT_STATUS_CLASS.opened,
  on_track: PROJECT_STATUS_CLASS.opened,
  at_risk: PROJECT_STATUS_CLASS.in_progress,
  late: PROJECT_STATUS_CLASS.cancelled,
  not_started: PROJECT_STATUS_CLASS.on_hold,
};

export function HealthPill({ health }) {
  const cls = HEALTH_CLASS[health] || HEALTH_CLASS.not_started;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${cls}`}>
      {HEALTH_LABELS[health] || health}
    </span>
  );
}

export function healthTone(health) {
  if (health === "late") return "rose";
  if (health === "at_risk") return "amber";
  if (health === "done" || health === "on_track") return "emerald";
  return "slate";
}

export function ProgressBar({ pct, tone = "emerald", className = "" }) {
  const width = Math.max(0, Math.min(100, Math.round(moneyValue(pct))));
  return (
    <div className={`h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden ${className}`}>
      <div className={`h-full transition-all ${TONE_BAR[tone] || TONE_BAR.slate}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function ProgressRing({ pct, size = 56, tone = "emerald", label }) {
  const value = Math.max(0, Math.min(100, Math.round(moneyValue(pct))));
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const colors = {
    emerald: "#0e7a5f",
    amber: "#d97706",
    rose: "#e11d48",
    sky: "#0284c7",
    slate: "#94a3b8",
  };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-slate-200 dark:text-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors[tone] || colors.emerald}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
        {label ?? `${value}%`}
      </div>
    </div>
  );
}

export function SectionCard({ title, icon: Icon, description, action, children, className = "" }) {
  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden ${className}`}>
      {title ? (
        <div className={`px-4 py-3 border-b ${ws.divider} flex items-center gap-2 flex-wrap`}>
          {Icon ? <Icon className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-200 shrink-0" /> : null}
          <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
          {description ? <div className="text-[11px] text-slate-500 dark:text-white/45">{description}</div> : null}
          <div className="flex-1" />
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function ModalShell({ open, title, description, onClose, children, footer, width = "max-w-2xl" }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" dir="rtl" onClick={onClose}>
      <div
        className={`${ws.popover} ${ws.card} w-full ${width} max-h-[92svh] flex flex-col rounded-b-none sm:rounded-b-[10px]`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={`px-5 py-4 border-b ${ws.divider} flex items-start gap-3`}>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-slate-900 dark:text-white">{title}</div>
            {description ? <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">{description}</div> : null}
          </div>
          <button type="button" onClick={onClose} className={ws.iconButton} title="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer ? <div className={`px-5 py-3 border-t ${ws.divider} flex items-center justify-end gap-2 flex-wrap`}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function FieldLabel({ children, hint }) {
  return (
    <div className="text-xs font-semibold text-slate-700 dark:text-white/70 mb-1 flex items-center gap-2">
      {children}
      {hint ? <span className="text-[10px] font-normal text-slate-400 dark:text-white/35">{hint}</span> : null}
    </div>
  );
}
