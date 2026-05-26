import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

// Best-effort: after a suspension mutation, rebuild every unclosed
// payroll run so the suspension takes effect immediately on the
// payroll page. Closed runs are skipped (frozen financial record).
async function rebuildUnclosedPayrollRuns() {
  let runs = [];
  try {
    const res = await adminFetch("/api/accounting/payroll");
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      runs = Array.isArray(data?.runs) ? data.runs : [];
    }
  } catch {
    return [];
  }
  const rebuilt = [];
  for (const r of runs) {
    if (r.is_closed) continue;
    const monthStr = String(r.payroll_month).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthStr)) continue;
    try {
      const res = await adminFetch("/api/accounting/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthStr }),
      });
      if (res.ok) rebuilt.push(monthStr);
    } catch {
      // ignore
    }
  }
  return rebuilt;
}

export function useEmployeeSuspensions(employeeId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["hr_employee_suspensions", Number(employeeId) || null],
    enabled: !!employeeId && enabled,
    queryFn: async () => {
      const res = await adminFetch(
        `/api/hr/employees/${employeeId}/suspensions`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل الإيقافات");
      }
      return Array.isArray(data?.suspensions) ? data.suspensions : [];
    },
  });
}

export function useCreateSuspension(employeeId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch(
        `/api/hr/employees/${employeeId}/suspensions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة الإيقاف");
      }
      return data;
    },
    onSuccess: async () => {
      const rebuilt = await rebuildUnclosedPayrollRuns();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["hr_employee_suspensions", Number(employeeId)],
        }),
        queryClient.invalidateQueries({
          queryKey: ["accounting_payroll"],
        }),
      ]);
      toast.success(
        rebuilt.length > 0
          ? `تم الإيقاف وتحديث مسير الرواتب (${rebuilt.length} شهر)`
          : "تم الإيقاف",
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإيقاف: ${error.message}`);
    },
  });
}

export function useCancelSuspension(employeeId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ suspensionId, force = false }) => {
      const url = force
        ? `/api/hr/employees/${employeeId}/suspensions/${suspensionId}?force=1`
        : `/api/hr/employees/${employeeId}/suspensions/${suspensionId}`;
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إلغاء الإيقاف");
      }
      return data;
    },
    onSuccess: async () => {
      const rebuilt = await rebuildUnclosedPayrollRuns();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["hr_employee_suspensions", Number(employeeId)],
        }),
        queryClient.invalidateQueries({
          queryKey: ["accounting_payroll"],
        }),
      ]);
      toast.success(
        rebuilt.length > 0
          ? `تم إلغاء الإيقاف وتحديث مسير الرواتب (${rebuilt.length} شهر)`
          : "تم إلغاء الإيقاف",
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإلغاء: ${error.message}`);
    },
  });
}
