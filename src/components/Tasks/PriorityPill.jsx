import { ws } from "@/components/Workspace/ui";

const PRIORITY_LABELS_AR = {
  Low: "منخفضة",
  Normal: "عادية",
  High: "عالية",
  Urgent: "عاجلة",
};

export function PriorityPill({ priority }) {
  const raw = priority || "Normal";
  const label = PRIORITY_LABELS_AR[raw] || raw;

  let className = "bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10";

  if (raw === "Low")
    className = "bg-slate-500/15 text-slate-200 border-slate-500/25";
  if (raw === "Normal")
    className = "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 border-indigo-500/25";
  if (raw === "High")
    className = "bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-500/25";
  if (raw === "Urgent")
    className = "bg-red-500/15 text-red-200 border-red-500/25";

  return <span className={`${ws.pill} ${className}`}>{label}</span>;
}
