import { useQuery } from "@tanstack/react-query";

export function useTaskAttachments(taskId, viewerEmployeeId, enabled = true) {
  return useQuery({
    queryKey: ["workspaceTaskAttachments", viewerEmployeeId, taskId],
    enabled: enabled && !!taskId && !!viewerEmployeeId,
    queryFn: async () => {
      const res = await fetch(
        `/api/workspace/tasks/${taskId}/attachments?employeeId=${viewerEmployeeId}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تحميل المرفقات");
      }
      return data;
    },
  });
}
