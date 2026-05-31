import { ws } from "@/components/Workspace/ui";

const STATUS_LABELS_AR = {
  Todo: "للإنجاز",
  "In Progress": "قيد التنفيذ",
  Done: "مكتملة",
};

export function StatusPill({ status, isClosedNotCompleted = false }) {
  const raw = status || "Todo";

  const isClosed = raw === "Done" && !!isClosedNotCompleted;
  const label = isClosed ? "مغلقة" : STATUS_LABELS_AR[raw] || raw;

  let className = "bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10";

  if (raw === "Todo")
    className = "bg-slate-500/15 text-slate-200 border-slate-500/25";
  if (raw === "In Progress")
    className = "bg-sky-500/15 text-sky-200 border-sky-500/25";
  if (raw === "Done") {
    className = "bg-emerald-500/15 text-emerald-200 border-emerald-500/25";
  }

  if (isClosed) {
    className = "bg-amber-500/15 text-amber-200 border-amber-500/25";
  }

  return <span className={`${ws.pill} ${className}`}>{label}</span>;
}
