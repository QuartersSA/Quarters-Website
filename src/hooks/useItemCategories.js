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

  // حقول البن المحمّص تُمرَّر كما هي؛ undefined = لا تغيير.
  const pickCoffee = (input) => ({
    is_roasted_coffee: input.is_roasted_coffee,
    roast_cost_per_kg: input.roast_cost_per_kg,
    roast_tax_rate: input.roast_tax_rate,
    default_roaster_contact_id: input.default_roaster_contact_id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.itemCategories() });
    queryClient.invalidateQueries({
      queryKey: queryKeys.purchaseItemCategories(),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.items() });
    queryClient.invalidateQueries({ queryKey: queryKeys.purchaseItems() });
    // شجرة الحسابات تحمل معلومات البن لكل حساب صنف (bean/…)
    queryClient.invalidateQueries({ queryKey: queryKeys.accountingAccounts() });
  };

  const createMutation = useMutation({
    mutationFn: async (input) => {
      const { name, name_en, show_in_inventory } = input;
      const response = await adminFetch("/api/item-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          name_en,
          show_in_inventory,
          ...pickCoffee(input),
        }),
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
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: async (input) => {
      const { id, name, name_en, show_in_inventory } = input;
      const response = await adminFetch("/api/item-categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          name_en,
          show_in_inventory,
          ...pickCoffee(input),
        }),
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
    onSuccess: invalidateAll,
  });

  return {
    categories,
    isLoading,
    error,
    createMutation,
    updateMutation,
  };
}
