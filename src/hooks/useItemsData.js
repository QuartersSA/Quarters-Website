import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import {
  invalidateInventoryQueries,
  queryKeys,
} from "../utils/queryKeys.js";

// رسالة الخطأ المعروضة للمستخدم: نص الخادم + التفاصيل الأصلية إن وُجدت،
// حتى يظهر السبب الحقيقي (قيد قاعدة بيانات، قيمة غير صالحة…) بدل رسالة عامة.
function describeApiError(error, fallback) {
  const base = error?.error || fallback;
  const details = error?.details ? String(error.details) : "";
  if (!details || details === base) return base;
  return `${base} — ${details}`;
}

export function useItemsData(isAuthenticated) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.items(),
    queryFn: async () => {
      const response = await adminFetch("/api/items");
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches(),
    queryFn: async () => {
      const response = await adminFetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Creating item with data:", data);
      const response = await adminFetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(describeApiError(error, "فشل إضافة الصنف"));
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Item created successfully:", data);
      invalidateInventoryQueries(queryClient);
      // شجرة الحسابات تعكس الأصناف (حساب لكل صنف + معلومات البن)
      queryClient.invalidateQueries({ queryKey: queryKeys.accountingAccounts() });
    },
    onError: (error) => {
      console.error("Failed to create item:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Updating item with data:", data);
      const response = await adminFetch("/api/items", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(describeApiError(error, "فشل تعديل الصنف"));
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Item updated successfully:", data);
      for (const warning of Array.isArray(data?.warnings) ? data.warnings : []) {
        toast.warning(warning);
      }
      invalidateInventoryQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.accountingAccounts() });
    },
    onError: (error) => {
      console.error("Failed to update item:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await adminFetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(describeApiError(error, "فشل حذف الصنف"));
      }
      return response.json();
    },
    onSuccess: () => {
      invalidateInventoryQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.accountingAccounts() });
    },
  });

  const batchInventoryMutation = useMutation({
    mutationFn: async ({ ids, show_in_inventory }) => {
      const response = await adminFetch("/api/items/batch-inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, show_in_inventory }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(describeApiError(error, "فشل التعديل الجماعي للأصناف"));
      }
      return response.json();
    },
    onSuccess: () => {
      invalidateInventoryQueries(queryClient);
    },
    onError: (error) => {
      console.error("Failed to batch update items:", error);
    },
  });

  return {
    items,
    branches,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    batchInventoryMutation,
  };
}
