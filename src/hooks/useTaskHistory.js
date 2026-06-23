import { useQuery } from "@tanstack/react-query";
import { workspaceFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useTaskHistory(taskId, viewerEmployeeId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaceTaskHistory(viewerEmployeeId,taskId),
    enabled: enabled && !!taskId && !!viewerEmployeeId,
    queryFn: async () => {
      const res = await workspaceFetch(
        `/api/workspace/tasks/${taskId}/history?employeeId=${viewerEmployeeId}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تحميل سجل المهمة");
      }
      return data;
    },
  });
}
