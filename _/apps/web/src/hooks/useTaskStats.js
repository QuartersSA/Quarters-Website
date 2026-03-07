import { useMemo } from "react";
import { normalizeDate, isBeforeDate } from "@/utils/taskUtils";

export function useTaskStats(tasks, today) {
  return useMemo(() => {
    const out = {
      overdue: 0,
      today: 0,
      inProgress: 0,
      done: 0,
      noDate: 0,
      total: tasks.length,
    };

    for (const t of tasks) {
      const status = t.status || "Todo";
      const due = normalizeDate(t.due_date);

      if (status === "Done") {
        out.done += 1;
        continue;
      }

      if (status === "In Progress") {
        out.inProgress += 1;
      }

      if (!due) {
        out.noDate += 1;
        continue;
      }

      if (due === today) {
        out.today += 1;
        continue;
      }

      if (isBeforeDate(due, today)) {
        out.overdue += 1;
      }
    }

    return out;
  }, [tasks, today]);
}
