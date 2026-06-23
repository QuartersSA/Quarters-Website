import { useQuery } from "@tanstack/react-query";
import { workspaceFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useTaskAttachments(taskId, viewerEmployeeId, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspaceTaskAttachments(viewerEmployeeId,taskId),
    enabled: enabled && !!taskId && !!viewerEmployeeId,
    queryFn: async () => {
      const res = await workspaceFetch(
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
