import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useEmployeesData(isAuthenticated) {
  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const response = await adminFetch("/api/employees");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/employees, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await adminFetch("/api/branches");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/branches, the response was [${response.status}] ${response.statusText}`,
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
    branches: branchesQuery.data,
    branchesError: branchesQuery.error,
  };
}
