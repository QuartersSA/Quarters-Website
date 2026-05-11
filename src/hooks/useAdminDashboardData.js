import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

// 5 minutes — matches the admin analytics auto-refresh interval and
// avoids a refetch storm when navigating between admin pages.
const FIVE_MINUTES = 5 * 60 * 1000;

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
    staleTime: FIVE_MINUTES,
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
    // Branches list changes rarely — cache aggressively.
    staleTime: 30 * 60 * 1000,
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
    // Items endpoint is the most expensive (branch stock aggregation).
    staleTime: FIVE_MINUTES,
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
    staleTime: FIVE_MINUTES,
  });

  return { operations, branches, items, employees };
}
