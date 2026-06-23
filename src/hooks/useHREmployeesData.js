import { useQuery } from "@tanstack/react-query";
import { adminFetch, clearAdminSession } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

function statusFromError(err) {
  const status = err?.status;
  if (Number.isFinite(status)) return status;

  const msg = err?.message ? String(err.message) : "";
  const m = msg.match(/\[(\d{3})\]/);
  if (m) return Number(m[1]);
  return null;
}

async function checkedAdminFetch(url) {
  const response = await adminFetch(url);
  if (!response.ok) {
    let details = null;
    try {
      details = await response.json();
    } catch {
      // ignore
    }

    const error = new Error(
      `When fetching ${url}, the response was [${response.status}] ${response.statusText}`,
    );
    error.status = response.status;
    error.details = details;

    // If token is expired/invalid, clear admin session so UI can recover cleanly.
    if (response.status === 401) {
      clearAdminSession();
    }

    throw error;
  }
  return response.json();
}

export function useHREmployeesData(isAuthenticated) {
  const employeesQuery = useQuery({
    queryKey: queryKeys.hrEmployees(),
    queryFn: async () => checkedAdminFetch("/api/hr/employees"),
    enabled: isAuthenticated,
  });

  const branchesQuery = useQuery({
    queryKey: queryKeys.branches(),
    queryFn: async () => checkedAdminFetch("/api/branches"),
    enabled: isAuthenticated,
  });

  return {
    employees: employeesQuery.data,
    isLoadingEmployees: employeesQuery.isLoading,
    employeesError: employeesQuery.error,
    employeesErrorStatus: statusFromError(employeesQuery.error),
    branches: branchesQuery.data,
    branchesError: branchesQuery.error,
    branchesErrorStatus: statusFromError(branchesQuery.error),
  };
}
