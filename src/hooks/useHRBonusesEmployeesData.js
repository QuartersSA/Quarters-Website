import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useHRBonusesEmployeesData(isAuthenticated) {
  const employeesQuery = useQuery({
    queryKey: queryKeys.hrBonusEmployees(),
    queryFn: async () => {
      const response = await adminFetch("/api/hr/bonuses/employees");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/hr/bonuses/employees, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  return {
    employees: employeesQuery.data,
    isLoadingEmployees: employeesQuery.isLoading,
    employeesError: employeesQuery.error,
  };
}
