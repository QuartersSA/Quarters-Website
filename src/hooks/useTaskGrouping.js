import { useMemo } from "react";

export function useTaskGrouping(tasks) {
  return useMemo(() => {
    const todo = [];
    const inProgress = [];
    const done = [];

    for (const t of tasks) {
      const s = t.status || "Todo";
      if (s === "In Progress") inProgress.push(t);
      else if (s === "Done") done.push(t);
      else todo.push(t);
    }

    return { todo, inProgress, done };
  }, [tasks]);
}
