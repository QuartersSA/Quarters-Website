import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function usePayrollData(month, employeeId, isAdmin) {
  return useQuery({
    queryKey: queryKeys.accountingPayroll(month),
    enabled: !!employeeId && isAdmin && !!month,
    queryFn: async () => {
      const qs = new URLSearchParams({ month: String(month) });
      const res = await adminFetch(`/api/accounting/payroll?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/payroll, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });
}
