import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useAdminDashboardData(isAuthenticated) {
  const { data: operations } = useQuery({
    queryKey: ["inventory-operations"],
    queryFn: async () => {
      const response = await adminFetch("/api/inventory-operations");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/inventory-operations, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches } = useQuery({
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

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const response = await adminFetch("/api/items");
      if (!response.ok) {
        throw new Error(
          `When fetching /api/items, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: employees } = useQuery({
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

  return { operations, branches, items, employees };
}
