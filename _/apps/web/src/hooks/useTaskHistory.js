import { useQuery } from "@tanstack/react-query";

export function useTaskHistory(taskId, viewerEmployeeId, enabled = true) {
  return useQuery({
    queryKey: ["workspaceTaskHistory", viewerEmployeeId, taskId],
    enabled: enabled && !!taskId && !!viewerEmployeeId,
    queryFn: async () => {
      const res = await fetch(
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
