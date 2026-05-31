import { safeArray, initials } from "@/utils/taskUtils";

export function AssigneesStack({ assignees }) {
  const arr = safeArray(assignees);
  const visible = arr.slice(0, 3);
  const remaining = arr.length - visible.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((a) => {
          const key = a?.id || a?.name;
          const label = initials(a?.name);
          return (
            <div
              key={key}
              title={a?.name || ""}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.05] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] flex items-center justify-center text-xs font-bold"
            >
              {label}
            </div>
          );
        })}
      </div>
      {remaining > 0 ? (
        <div className="ml-2 text-xs font-semibold text-slate-600 dark:text-white/60">
          +{remaining}
        </div>
      ) : null}
    </div>
  );
}
