import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import {
  invalidatePayrollQueries,
  queryKeys,
} from "../utils/queryKeys.js";

function getCreatedCount(result) {
  if (!result) return 0;
  if (Array.isArray(result)) return result.length;
  if (typeof result === "object") {
    if (Array.isArray(result.rows)) return result.rows.length;
    if (typeof result.count === "number") return result.count;
    if (result.id) return 1;
  }
  return 1;
}

export function useHRBonusMutations() {
  const queryClient = useQueryClient();
  const invalidateAffectedQueries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.hrBonuses() }),
      invalidatePayrollQueries(queryClient),
    ]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await adminFetch("/api/hr/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to create");
      }
      return result;
    },
    onSuccess: async (result) => {
      await invalidateAffectedQueries();

      const count = getCreatedCount(result);
      if (count > 1) {
        toast.success(`تم إضافة البونص لـ ${count} موظفين`);
      } else {
        toast.success("تم إضافة البونص");
      }
    },
    onError: (error) => {
      console.error("HR create bonus error:", error);
      toast.error(`فشل إضافة البونص: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await adminFetch(`/api/hr/bonuses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to update");
      }
      return result;
    },
    onSuccess: async () => {
      await invalidateAffectedQueries();
      toast.success("تم تحديث البونص");
    },
    onError: (error) => {
      console.error("HR update bonus error:", error);
      toast.error(`فشل تحديث البونص: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await adminFetch(`/api/hr/bonuses/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details || result.error || "Failed to delete");
      }
      return result;
    },
    onSuccess: async () => {
      await invalidateAffectedQueries();
      toast.success("تم حذف البونص");
    },
    onError: (error) => {
      console.error("HR delete bonus error:", error);
      toast.error(`فشل حذف البونص: ${error.message}`);
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
