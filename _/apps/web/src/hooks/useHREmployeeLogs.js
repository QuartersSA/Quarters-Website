import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useHREmployeeLogs({ employeeId, enabled }) {
  const employeeIdNumber = Number(employeeId);
  const safeEmployeeId = Number.isFinite(employeeIdNumber)
    ? employeeIdNumber
    : null;

  const logsQuery = useQuery({
    queryKey: ["hr-employee-logs", safeEmployeeId],
    queryFn: async () => {
      const response = await adminFetch(
        `/api/hr/employees/${safeEmployeeId}/logs`,
      );
      if (!response.ok) {
        throw new Error(
          `When fetching /api/hr/employees/${safeEmployeeId}/logs, the response was [${response.status}] ${response.statusText}`,
        );
      }
      return response.json();
    },
    enabled: !!enabled && !!safeEmployeeId,
  });

  return {
    logs: logsQuery.data,
    isLoadingLogs: logsQuery.isLoading,
    logsError: logsQuery.error,
    refetchLogs: logsQuery.refetch,
  };
}
