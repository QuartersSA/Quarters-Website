import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useOperationsData(isAuthenticated) {
  const queryClient = useQueryClient();

  const { data: operations, isLoading } = useQuery({
    queryKey: ["inventory-operations"],
    queryFn: async () => {
      const response = await adminFetch("/api/inventory-operations");
      if (!response.ok) throw new Error("Failed to fetch operations");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await adminFetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (operationId) => {
      const response = await adminFetch(
        `/api/inventory-operations?id=${operationId}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "فشل في حذف العملية");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-operations"] });
      queryClient.invalidateQueries({ queryKey: ["items-summary"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-receipts"] });
    },
  });

  return { operations, branches, isLoading, deleteMutation };
}
