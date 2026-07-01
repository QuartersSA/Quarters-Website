import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export default function useItemCategories(enabled = true, { scope = "inventory" } = {}) {
  const queryClient = useQueryClient();
  const categoriesUrl =
    scope === "purchases"
      ? "/api/item-categories?scope=purchases"
      : "/api/item-categories";

  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.itemCategories(scope),
    queryFn: async () => {
      const response = await adminFetch(categoriesUrl);
      if (!response.ok) {
        throw new Error(
          `When fetching ${categoriesUrl}, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled,
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, name_en, show_in_inventory }) => {
      const response = await adminFetch("/api/item-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, name_en, show_in_inventory }),
      });

      if (!response.ok) {
        let message = "Failed to create category";
        try {
          const errorBody = await response.json();
          message = errorBody?.error || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itemCategories() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseItemCategories(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.items() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseItems() });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, name_en, show_in_inventory }) => {
      const response = await adminFetch("/api/item-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, name_en, show_in_inventory }),
      });

      if (!response.ok) {
        let message = "Failed to update category";
        try {
          const errorBody = await response.json();
          message = errorBody?.error || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itemCategories() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseItemCategories(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.items() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseItems() });
    },
  });

  return {
    categories,
    isLoading,
    error,
    createMutation,
    updateMutation,
  };
}
