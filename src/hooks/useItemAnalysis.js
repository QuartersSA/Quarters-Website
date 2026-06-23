import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useItemAnalysis(
  isAuthenticated,
  itemId,
  branchIds,
  dateFrom,
  dateTo,
) {
  const {
    data: analysisData,
    isLoading: isAnalysisLoading,
    error: analysisError,
  } = useQuery({
    queryKey: queryKeys.itemAnalysis(itemId,branchIds,dateFrom,dateTo),
    queryFn: async () => {
      const qs = new URLSearchParams({
        branchIds: branchIds.join(","),
        from: dateFrom,
        to: dateTo,
      }).toString();

      const response = await adminFetch(
        `/api/items/${encodeURIComponent(itemId)}/analysis?${qs}`,
      );
      if (!response.ok) {
        throw new Error(
          `When fetching item analysis, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled:
      isAuthenticated &&
      !!itemId &&
      Array.isArray(branchIds) &&
      branchIds.length > 0 &&
      !!dateFrom &&
      !!dateTo,
  });

  return { analysisData, isAnalysisLoading, analysisError };
}
