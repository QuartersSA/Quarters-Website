import { TaskCard } from "./TaskCard";

export function TaskListView({ tasks, onOpenEdit, onQuickStatus, changingId }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          onOpen={onOpenEdit}
          onQuickStatus={onQuickStatus}
          changingId={changingId}
        />
      ))}
    </div>
  );
}
