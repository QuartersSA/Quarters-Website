import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useTaskUpdates(taskId, viewerEmployeeId, enabled = true) {
  const queryClient = useQueryClient();

  const updatesQuery = useQuery({
    queryKey: ["workspaceTaskUpdates", viewerEmployeeId, taskId],
    enabled: enabled && !!taskId && !!viewerEmployeeId,
    queryFn: async () => {
      const res = await fetch(
        `/api/workspace/tasks/${taskId}/updates?employeeId=${viewerEmployeeId}`,
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تحميل تحديثات المهمة");
      }
      return data;
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async ({ body, attachments }) => {
      const bodyText = String(body || "").trim();
      const list = Array.isArray(attachments) ? attachments : [];

      const res = await fetch(`/api/workspace/tasks/${taskId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          body: bodyText,
          attachments: list.map((a) => ({
            url: a?.url,
            mimeType: a?.mimeType || null,
            name: a?.name || null,
            sizeBytes: a?.sizeBytes || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "فشل إضافة تحديث للمهمة");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaceTaskUpdates", viewerEmployeeId, taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaceTaskHistory", viewerEmployeeId, taskId],
      });
    },
  });

  return {
    updates: updatesQuery.data?.updates || [],
    isLoading: updatesQuery.isLoading,
    error: updatesQuery.error,
    addUpdate: addUpdateMutation.mutate,
    isAddingUpdate: addUpdateMutation.isPending,
  };
}
