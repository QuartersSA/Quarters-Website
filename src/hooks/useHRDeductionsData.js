import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useHRDeductionsData(isAuthenticated, employeeId, month) {
  const employeeKey = employeeId ? Number(employeeId) : null;
  const monthKey = month ? String(month) : "";

  const deductionsQuery = useQuery({
    queryKey: queryKeys.hrDeductions(employeeKey||"all",monthKey||"all"),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (employeeKey) {
        params.set("employeeId", String(employeeKey));
      }
      if (monthKey) {
        params.set("month", monthKey);
      }

      const qs = params.toString();
      const url = qs ? `/api/hr/deductions?${qs}` : "/api/hr/deductions";

      const response = await adminFetch(url);
      if (!response.ok) {
        throw new Error(
          `When fetching ${url}, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  return {
    deductions: deductionsQuery.data,
    isLoading: deductionsQuery.isLoading,
    error: deductionsQuery.error,
  };
}
