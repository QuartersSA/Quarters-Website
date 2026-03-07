import { TaskCard } from "./TaskCard";
import { ws } from "@/components/Workspace/ui";

export function TaskBoardView({
  grouped,
  onOpenEdit,
  onQuickStatus,
  changingId,
}) {
  const columnClass = `${ws.glassSoft} ${ws.card} overflow-hidden`;

  const columnHeaderClass =
    "px-4 py-3 border-b border-white/10 font-bold text-white flex items-center justify-between tracking-tight bg-white/[0.02]";

  const countClass =
    "text-xs text-white/55 bg-white/[0.04] border border-white/10 rounded-full px-2 py-1 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]";

  const emptyTextClass = "text-sm text-white/50";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className={columnClass}>
        <div className={columnHeaderClass}>
          <span>للإنجاز</span>
          <span className={countClass}>{grouped.todo.length}</span>
        </div>
        <div className="p-4 space-y-3">
          {grouped.todo.length ? (
            grouped.todo.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onOpen={onOpenEdit}
                onQuickStatus={onQuickStatus}
                changingId={changingId}
              />
            ))
          ) : (
            <div className={emptyTextClass}>لا يوجد</div>
          )}
        </div>
      </div>

      <div className={columnClass}>
        <div className={columnHeaderClass}>
          <span>قيد التنفيذ</span>
          <span className={countClass}>{grouped.inProgress.length}</span>
        </div>
        <div className="p-4 space-y-3">
          {grouped.inProgress.length ? (
            grouped.inProgress.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onOpen={onOpenEdit}
                onQuickStatus={onQuickStatus}
                changingId={changingId}
              />
            ))
          ) : (
            <div className={emptyTextClass}>لا يوجد</div>
          )}
        </div>
      </div>

      <div className={columnClass}>
        <div className={columnHeaderClass}>
          <span>مكتملة</span>
          <span className={countClass}>{grouped.done.length}</span>
        </div>
        <div className="p-4 space-y-3">
          {grouped.done.length ? (
            grouped.done.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onOpen={onOpenEdit}
                onQuickStatus={onQuickStatus}
                changingId={changingId}
              />
            ))
          ) : (
            <div className={emptyTextClass}>لا يوجد</div>
          )}
        </div>
      </div>
    </div>
  );
}
