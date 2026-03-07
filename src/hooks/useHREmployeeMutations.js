import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";

export function useHREmployeeMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await adminFetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.details || result.error || "Failed to create employee",
        );
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      toast.success("تم إضافة الموظف بنجاح");
    },
    onError: (error) => {
      console.error("HR create employee error:", error);
      toast.error(`فشل إضافة الموظف: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await adminFetch(`/api/hr/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.details || result.error || "Failed to update employee",
        );
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      toast.success("تم تحديث الموظف بنجاح");
    },
    onError: (error) => {
      console.error("HR update employee error:", error);
      toast.error(error.message || "فشل تحديث الموظف");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await adminFetch(`/api/hr/employees/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to delete employee");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-employees"] });
      toast.success("تم حذف الموظف بنجاح");
    },
    onError: (error) => {
      console.error("HR delete employee error:", error);
      toast.error("فشل حذف الموظف");
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
