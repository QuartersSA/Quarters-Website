import { Clock } from "lucide-react";
import { FormRowLabel } from "../FormRowLabel";
import { ws } from "@/components/Workspace/ui";
import {
  formatDateTime,
  safeMeta,
  buildChangeLines,
} from "@/utils/taskHistoryFormatters";

export function TaskHistorySection({
  events,
  isLoading,
  error,
  viewerEmployeeId,
  spaceNameById,
  userNameById,
}) {
  const renderEventLine = (e) => {
    const type = e?.event_type;
    const actor = e?.actor_name ? String(e.actor_name) : "النظام";
    const at = formatDateTime(e?.created_at);

    let badge = "";
    if (type === "created") badge = "تم الإنشاء";
    else if (type === "updated") badge = "تم التعديل";
    else if (type === "overdue") badge = "تأخير";
    else if (type === "deleted") badge = "حذف";
    else badge = String(type || "");

    const badgeClass =
      type === "overdue"
        ? "bg-red-500/15 text-red-200 border-red-500/25"
        : type === "created"
          ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/25"
          : type === "deleted"
            ? "bg-amber-500/15 text-amber-200 border-amber-500/25"
            : "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10";

    const summary = e?.summary ? String(e.summary) : "—";

    const meta = safeMeta(e?.meta);
    const diff = meta?.diff;
    const changeLines = buildChangeLines(diff, { spaceNameById, userNameById });
    const showChanges = type === "updated" && changeLines.length > 0;

    return (
      <div
        key={e.id}
        className="py-3 border-t border-slate-200 dark:border-white/10 first:border-t-0"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {summary}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/45 mt-1">
              {actor} • {at}
            </div>
          </div>

          {badge ? (
            <span className={`${ws.pill} border ${badgeClass}`}>{badge}</span>
          ) : null}
        </div>

        {showChanges ? (
          <div className="mt-3 text-xs text-slate-600 dark:text-white/60 space-y-1">
            {changeLines.slice(0, 8).map((c) => {
              const lineText = `${c.label}: من ${c.fromText} إلى ${c.toText}`;
              return (
                <div key={c.label} className="leading-5">
                  {lineText}
                </div>
              );
            })}
            {changeLines.length > 8 ? (
              <div className="text-slate-500 dark:text-white/45">…</div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <FormRowLabel
        icon={<Clock className="w-4 h-4" />}
        label="سجل التغييرات"
      />

      {!viewerEmployeeId ? (
        <div className="mt-3 text-xs text-slate-500 dark:text-white/50">
          لا يمكن تحميل السجل بدون هوية المستخدم
        </div>
      ) : isLoading ? (
        <div className="mt-3 text-sm text-slate-600 dark:text-white/60">جاري تحميل السجل…</div>
      ) : error ? (
        <div className="mt-3 text-sm text-red-300">
          {error?.message || "فشل تحميل السجل"}
        </div>
      ) : events.length === 0 ? (
        <div className="mt-3 text-sm text-slate-600 dark:text-white/60">
          لا يوجد سجل تغييرات حتى الآن.
        </div>
      ) : (
        <div className="mt-3 max-h-[260px] overflow-y-auto">
          {events.map(renderEventLine)}
        </div>
      )}
    </div>
  );
}
