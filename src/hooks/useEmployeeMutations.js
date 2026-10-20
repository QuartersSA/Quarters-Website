import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

// نص الخادم + التفاصيل الأصلية إن وُجدت حتى يظهر السبب الحقيقي.
function describeApiError(result, fallback) {
  const base = result?.error || fallback;
  const details = result?.details ? String(result.details) : "";
  if (!details || details === base) return base;
  return `${base} — ${details}`;
}

export function useEmployeeMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await adminFetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(describeApiError(result, "فشل إضافة الموظف"));
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees() });
      toast.success("تم إضافة الموظف بنجاح");
    },
    onError: (error) => {
      console.error("Create employee error:", error);
      toast.error(`فشل إضافة الموظف: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await adminFetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(describeApiError(result, "فشل تحديث الموظف"));
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees() });
      toast.success("تم تحديث الموظف بنجاح");
    },
    onError: (error) => {
      console.error("Update employee error:", error);
      toast.error(error.message || "فشل تحديث الموظف");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await adminFetch(`/api/employees/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete employee");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employees() });
      toast.success("تم حذف الموظف بنجاح");
    },
    onError: (error) => {
      toast.error("فشل حذف الموظف");
      console.error(error);
    },
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
