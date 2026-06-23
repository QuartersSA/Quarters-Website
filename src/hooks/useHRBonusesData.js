import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useHRBonusesData(isAuthenticated, employeeId, month) {
  const bonusesQuery = useQuery({
    queryKey: queryKeys.hrBonuses(employeeId||null,month||null),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (employeeId) qs.set("employeeId", String(employeeId));
      if (month) qs.set("month", String(month));

      const response = await adminFetch(`/api/hr/bonuses?${qs.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/hr/bonuses, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return data;
    },
    enabled: isAuthenticated,
  });

  return {
    bonuses: bonusesQuery.data,
    isLoading: bonusesQuery.isLoading,
    error: bonusesQuery.error,
  };
}
