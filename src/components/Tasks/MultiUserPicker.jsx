import { useMemo } from "react";
import { ws } from "@/components/Workspace/ui";

export function MultiUserPicker({ users, selectedIds, onChange }) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className={`${ws.glassSoft} rounded-3xl overflow-hidden`}>
      <div className="px-4 py-3 bg-slate-50 dark:bg-white/[0.03] text-xs font-bold text-slate-600 dark:text-white/60 border-b border-slate-200 dark:border-white/10">
        اختر موظف أو أكثر
      </div>
      <div className="max-h-[220px] overflow-auto divide-y divide-white/10">
        {users.map((u) => {
          const id = u.id;
          const checked = selectedSet.has(id);
          const role = u.role || "";

          const badgeClass =
            role === "Admin"
              ? "bg-emerald-400/15 text-emerald-700 dark:text-emerald-200 border border-emerald-400/25"
              : "bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-white/70 border border-slate-200 dark:border-white/10";

          const checkboxClass = checked
            ? "bg-emerald-400/20 border-emerald-400/30"
            : "border-slate-300 dark:border-white/25";

          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-100 dark:bg-white/[0.06]"
            >
              <div className="min-w-0 text-right">
                <div className="font-semibold text-slate-900 dark:text-white truncate">
                  {u.name}
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-[11px] font-bold ${badgeClass}`}
                  >
                    {role}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`w-5 h-5 rounded-md border shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] ${checkboxClass}`}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
