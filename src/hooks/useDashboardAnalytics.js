import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useDashboardAnalytics(isAuthenticated) {
  const {
    data: analytics,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.dashboardAnalytics(),
    queryFn: async () => {
      const response = await adminFetch("/api/dashboard/analytics");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/dashboard/analytics, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 5 * 60 * 1000, // refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // consider data stale after 2 minutes
  });

  return {
    analytics: analytics || null,
    isAnalyticsLoading: isLoading,
    analyticsError: error,
  };
}
