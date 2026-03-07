import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useTaskMutations(myId, closeModal) {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["workspaceTasks"] });
    queryClient.invalidateQueries({
      queryKey: ["workspaceOverdueTasks", myId],
    });

    // NEW: task modal also shows history + updates, so refresh those too
    queryClient.invalidateQueries({ queryKey: ["workspaceTaskUpdates"] });
    queryClient.invalidateQueries({ queryKey: ["workspaceTaskHistory"] });
    queryClient.invalidateQueries({ queryKey: ["workspaceTaskAttachments"] });
    queryClient.invalidateQueries({ queryKey: ["workspaceTaskChecklist"] });
    queryClient.invalidateQueries({ queryKey: ["workspaceSubtasks"] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      // ignore any draft update on create
      const safePayload = payload && typeof payload === "object" ? payload : {};
      const { taskUpdate, ...taskPayload } = safePayload;

      const res = await fetch("/api/workspace/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: myId, ...taskPayload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "فشل إنشاء المهمة");
      }
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const safePayload = payload && typeof payload === "object" ? payload : {};
      const { taskUpdate, ...taskPayload } = safePayload;

      // 1) Update the task itself
      const res = await fetch(`/api/workspace/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: myId, ...taskPayload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "فشل تحديث المهمة");
      }

      // 2) If user wrote a draft update (note) inside the modal, add it too.
      const bodyText = String(taskUpdate?.body || "").trim();
      const attachments = Array.isArray(taskUpdate?.attachments)
        ? taskUpdate.attachments
        : [];

      const hasAttachments = attachments.some((a) => a && a.url);
      const shouldCreateUpdate = bodyText.length > 0 || hasAttachments;

      if (shouldCreateUpdate) {
        // The updates endpoint requires text, so if user attached files only, send a short default note.
        const finalText = bodyText.length > 0 ? bodyText : "تم إضافة مرفقات";

        const res2 = await fetch(`/api/workspace/tasks/${id}/updates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: myId,
            body: finalText,
            attachments: attachments.map((a) => ({
              url: a?.url,
              mimeType: a?.mimeType || null,
              name: a?.name || null,
              sizeBytes: a?.sizeBytes || null,
            })),
          }),
        });

        const data2 = await res2.json();
        if (!res2.ok) {
          throw new Error(
            data2.details || data2.error || "فشل إضافة تحديث للمهمة",
          );
        }
      }

      return data;
    },
    onSuccess: () => {
      invalidateAll();
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/workspace/tasks/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: myId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "فشل حذف المهمة");
      }
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      closeModal();
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
