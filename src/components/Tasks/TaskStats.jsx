import {
  ListTodo,
  AlertTriangle,
  CalendarDays,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function TaskStats({ stats }) {
  const cardClass = `${ws.glassSoft} ${ws.card} p-4`;

  const labelClass = "text-xs font-semibold text-slate-600 dark:text-white/55";
  const numberClass = "mt-2 text-3xl font-extrabold tracking-tight";

  const items = [
    {
      key: "total",
      label: "الإجمالي",
      value: stats.total,
      Icon: ListTodo,
      tint: "text-slate-900 dark:text-white",
      iconTint: "text-slate-700 dark:text-white/75",
    },
    {
      key: "overdue",
      label: "متأخرة",
      value: stats.overdue,
      Icon: AlertTriangle,
      tint: "text-red-300",
      iconTint: "text-red-200",
    },
    {
      key: "today",
      label: "اليوم",
      value: stats.today,
      Icon: CalendarDays,
      tint: "text-amber-700 dark:text-amber-300",
      iconTint: "text-amber-700 dark:text-amber-200",
    },
    {
      key: "inProgress",
      label: "قيد التنفيذ",
      value: stats.inProgress,
      Icon: Activity,
      tint: "text-sky-700 dark:text-sky-300",
      iconTint: "text-sky-700 dark:text-sky-200",
    },
    {
      key: "done",
      label: "مكتملة",
      value: stats.done,
      Icon: CheckCircle2,
      tint: "text-emerald-700 dark:text-emerald-300",
      iconTint: "text-emerald-700 dark:text-emerald-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((it) => {
        const Icon = it.Icon;
        return (
          <div key={it.key} className={cardClass}>
            <div className="flex items-center justify-between">
              <div className={labelClass}>{it.label}</div>
              <div className={`${ws.iconBox} w-10 h-10`}>
                <Icon className={`w-5 h-5 ${it.iconTint}`} />
              </div>
            </div>
            <div className={`${numberClass} ${it.tint}`}>{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}
