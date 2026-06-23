import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";
import { invalidatePayrollQueries, queryKeys } from "../utils/queryKeys.js";

export function useBonusesEmployees(employeeId, isAdmin) {
  return useQuery({
    queryKey: queryKeys.accountingPayrollBonusEmployees(),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/hr/bonuses/employees");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/hr/bonuses/employees, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });
}

export function useBonuses(month, employeeId, isAdmin) {
  return useQuery({
    queryKey: queryKeys.accountingPayrollBonuses(month),
    enabled: !!employeeId && isAdmin && !!month,
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("month", String(month));
      const res = await adminFetch(`/api/hr/bonuses?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/hr/bonuses, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });
}

export function useCreateBonus(month, payrollRebuildMutation) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/hr/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/hr/bonuses, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPayrollBonuses(month),
      });
      if (month) {
        await payrollRebuildMutation.mutateAsync({ month });
      }
      await invalidatePayrollQueries(queryClient);
      toast.success("تم إضافة البونص");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل إضافة البونص: ${error.message}`);
    },
  });
}

export function useUpdateBonus(month, payrollRebuildMutation) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await adminFetch(`/api/hr/bonuses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          result?.error ||
            `When fetching /api/hr/bonuses/${id}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPayrollBonuses(month),
      });
      if (month) {
        await payrollRebuildMutation.mutateAsync({ month });
      }
      await invalidatePayrollQueries(queryClient);
      toast.success("تم تحديث البونص");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تحديث البونص: ${error.message}`);
    },
  });
}

export function useDeleteBonus(month, payrollRebuildMutation) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const res = await adminFetch(`/api/hr/bonuses/${id}`, {
        method: "DELETE",
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          result?.error ||
            `When fetching /api/hr/bonuses/${id}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPayrollBonuses(month),
      });
      if (month) {
        await payrollRebuildMutation.mutateAsync({ month });
      }
      await invalidatePayrollQueries(queryClient);
      toast.success("تم حذف البونص");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل حذف البونص: ${error.message}`);
    },
  });
}
