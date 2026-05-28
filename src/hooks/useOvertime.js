import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

// Best-effort rebuild of every unclosed payroll run so a new
// overtime entry reflects in HR's and accounting's payroll tables
// without forcing a manual "إرسال إلى المحاسبة" click.
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

export function useOvertime({ month, employeeId: filterId } = {}) {
  return useQuery({
    queryKey: ["hr_overtime", month || null, filterId || null],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (month) qs.set("month", String(month));
      if (filterId) qs.set("employee_id", String(filterId));
      const url = qs.toString()
        ? `/api/hr/overtime?${qs.toString()}`
        : "/api/hr/overtime";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل الأوفر تايم");
      }
      return Array.isArray(data?.overtime) ? data.overtime : [];
    },
  });
}

export function useCreateOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/hr/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة الأوفر تايم");
      }
      return data;
    },
    onSuccess: async () => {
      const rebuilt = await rebuildUnclosedPayrollRuns();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hr_overtime"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting_payroll"] }),
      ]);
      toast.success(
        rebuilt.length > 0
          ? `تم تسجيل الأوفر تايم وتحديث مسير الرواتب (${rebuilt.length} شهر)`
          : "تم تسجيل الأوفر تايم",
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التسجيل: ${error.message}`);
    },
  });
}

export function useDeleteOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await adminFetch(`/api/hr/overtime/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل الحذف");
      }
      return data;
    },
    onSuccess: async () => {
      const rebuilt = await rebuildUnclosedPayrollRuns();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hr_overtime"] }),
        queryClient.invalidateQueries({ queryKey: ["accounting_payroll"] }),
      ]);
      toast.success(
        rebuilt.length > 0
          ? `تم الحذف وتحديث مسير الرواتب (${rebuilt.length} شهر)`
          : "تم الحذف",
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الحذف: ${error.message}`);
    },
  });
}
