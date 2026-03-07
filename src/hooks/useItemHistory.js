import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useItemHistory(
  isAuthenticated,
  selectedItemId,
  selectedBranchId,
  dateFrom,
  dateTo,
) {
  const {
    data: itemHistory,
    isLoading: isHistoryLoading,
    error: historyError,
  } = useQuery({
    queryKey: [
      "item-history",
      selectedItemId,
      selectedBranchId,
      dateFrom,
      dateTo,
    ],
    queryFn: async () => {
      const branchQuery = selectedBranchId
        ? `&branchId=${encodeURIComponent(selectedBranchId)}`
        : "";

      const fromQuery = dateFrom ? `from=${encodeURIComponent(dateFrom)}` : "";
      const toQuery = dateTo ? `&to=${encodeURIComponent(dateTo)}` : "";

      const response = await adminFetch(
        `/api/items/${encodeURIComponent(selectedItemId)}/history?${fromQuery}${toQuery}${branchQuery}`,
      );
      if (!response.ok) {
        throw new Error(
          `When fetching item history, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: isAuthenticated && !!selectedItemId && !!dateFrom && !!dateTo,
  });

  return { itemHistory, isHistoryLoading, historyError };
}
