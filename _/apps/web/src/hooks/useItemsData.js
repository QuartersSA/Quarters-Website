import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useItemsData(isAuthenticated) {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const response = await adminFetch("/api/items");
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
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
        const error = await response.json();
        throw new Error(error.error || "Failed to create item");
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Item created successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
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
        const error = await response.json();
        throw new Error(error.error || "Failed to update item");
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Item updated successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["items"] });
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
        const error = await response.json();
        throw new Error(error.error || "Failed to delete item");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
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
        const error = await response.json();
        throw new Error(error.error || "Failed to batch update items");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
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
