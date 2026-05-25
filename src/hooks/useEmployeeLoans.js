import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

// Helper: rebuild every unclosed payroll run whose payroll_month sits
// inside the loan's installment window. Called silently after any
// loan mutation so the deduction shows up on the payroll page right
// away — without forcing the admin to click "إعادة بناء" manually.
//
// `loan` should be the row returned from the API: it carries
// start_month + installments_count + is_active (or we pass null/empty
// when deleted in which case we just rebuild every unclosed run since
// we can't be sure which one is affected).
async function rebuildAffectedPayrollRuns(loan) {
  // Pull the recent runs list (last 24 months by default in the GET
  // route). Closed months are kept as-is — silently skipped here.
  let runs = [];
  try {
    const res = await adminFetch("/api/accounting/payroll");
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      runs = Array.isArray(data?.runs) ? data.runs : [];
    }
  } catch {
    // Network blip — give up; user can rebuild manually.
    return [];
  }

  // Compute the [start, end) window in months.
  const inWindow = (runDate) => {
    if (!loan?.start_month || !loan?.installments_count) return true;
    const sm = new Date(loan.start_month);
    if (Number.isNaN(sm.getTime())) return true;
    const end = new Date(sm);
    end.setUTCMonth(end.getUTCMonth() + Number(loan.installments_count));
    const d = new Date(runDate);
    if (Number.isNaN(d.getTime())) return false;
    return d >= sm && d < end;
  };

  const rebuilt = [];
  for (const r of runs) {
    if (r.is_closed) continue;
    if (!inWindow(r.payroll_month)) continue;
    const d = new Date(r.payroll_month);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const monthStr = `${y}-${m}`;
    try {
      const res = await adminFetch("/api/accounting/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthStr }),
      });
      if (res.ok) rebuilt.push(monthStr);
    } catch {
      // ignore — best effort
    }
  }
  return rebuilt;
}

async function invalidateLoansAndPayroll(queryClient) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ["accounting_employee_loans"],
    }),
    queryClient.invalidateQueries({ queryKey: ["accounting_payroll"] }),
  ]);
}

export function useEmployeeLoans({
  employeeId,
  isAdmin,
  filterEmployeeId,
  month,
  includeInactive,
} = {}) {
  return useQuery({
    queryKey: [
      "accounting_employee_loans",
      filterEmployeeId || null,
      month || null,
      !!includeInactive,
    ],
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filterEmployeeId) qs.set("employee_id", String(filterEmployeeId));
      if (month) qs.set("month", String(month));
      if (includeInactive) qs.set("includeInactive", "1");
      const url = qs.toString()
        ? `/api/accounting/employee-loans?${qs.toString()}`
        : "/api/accounting/employee-loans";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل السلف");
      }
      return Array.isArray(data?.loans) ? data.loans : [];
    },
  });
}

export function useLoanEmployees(employeeId, isAdmin) {
  return useQuery({
    queryKey: ["accounting_loan_employees"],
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/hr/bonuses/employees");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل قائمة الموظفين");
      }
      return Array.isArray(data) ? data : [];
    },
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/employee-loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة القرض");
      }
      return data;
    },
    onSuccess: async (data) => {
      const rebuilt = await rebuildAffectedPayrollRuns(data?.loan);
      await invalidateLoansAndPayroll(queryClient);
      if (rebuilt.length > 0) {
        toast.success(
          `تم تسجيل القرض وتحديث مسير الرواتب (${rebuilt.length} شهر)`,
        );
      } else {
        toast.success("تم تسجيل القرض");
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تسجيل القرض: ${error.message}`);
    },
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await adminFetch(`/api/accounting/employee-loans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تعديل القرض");
      }
      return data;
    },
    onSuccess: async (data) => {
      // Edits can move start_month / change installments_count, so the
      // OLD installment window can shrink or shift. Rebuilding only the
      // new window would leave stale deductions in months that used to
      // be in-window. Pass null → helper rebuilds every unclosed run.
      const rebuilt = await rebuildAffectedPayrollRuns(null);
      await invalidateLoansAndPayroll(queryClient);
      if (rebuilt.length > 0) {
        toast.success(
          `تم حفظ التعديلات وتحديث مسير الرواتب (${rebuilt.length} شهر)`,
        );
      } else {
        toast.success("تم حفظ التعديلات");
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force = false }) => {
      const url = force
        ? `/api/accounting/employee-loans/${id}?force=1`
        : `/api/accounting/employee-loans/${id}`;
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل الحذف");
      }
      return data;
    },
    onSuccess: async (data) => {
      // Deletion / deactivation drops the deduction from every month
      // it used to apply to. Rebuilding only "the window from the
      // returned row" misses cases where the loan was already shifted
      // before deletion. Cheapest correct fix: rebuild every unclosed
      // run.
      const rebuilt = await rebuildAffectedPayrollRuns(null);
      await invalidateLoansAndPayroll(queryClient);
      const base = data?.hard ? "تم الحذف نهائياً" : "تم إلغاء تفعيل القرض";
      if (rebuilt.length > 0) {
        toast.success(`${base} وتحديث مسير الرواتب (${rebuilt.length} شهر)`);
      } else {
        toast.success(base);
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الحذف: ${error.message}`);
    },
  });
}
