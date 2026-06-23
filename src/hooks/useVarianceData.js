import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useVarianceData(
  isAuthenticated,
  varianceBranchId,
  varianceItemId,
  varianceFrom,
  varianceTo,
) {
  const {
    data: variance,
    isLoading: varianceLoading,
    error: varianceError,
  } = useQuery({
    queryKey: queryKeys.variance(varianceBranchId,varianceItemId,varianceFrom,varianceTo),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("branchId", String(varianceBranchId));
      params.set("itemId", String(varianceItemId));
      params.set("from", varianceFrom);
      params.set("to", varianceTo);

      const response = await adminFetch(`/api/variance?${params.toString()}`);
      if (!response.ok) {
        throw new Error(
          `When fetching /api/variance, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled:
      isAuthenticated &&
      !!varianceBranchId &&
      !!varianceItemId &&
      !!varianceFrom &&
      !!varianceTo,
  });

  return { variance, varianceLoading, varianceError };
}
