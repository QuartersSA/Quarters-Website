import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

// Helper: make sure the loan's deduction is reflected in every open
// payroll month in its installment window, including PAST months that
// don't have a payroll run yet. Closed months are intentionally
// skipped so the financial audit trail stays intact.
//
// Strategy:
//   - When `loan` carries a start_month + installments_count, iterate
//     every calendar month from start_month up to (but not past) the
//     current calendar month, and POST /api/accounting/payroll for
//     each. POST is idempotent and creates a fresh run if missing.
//     Closed months reply 409 — we swallow that and move on.
//   - When `loan` is null (edits / deletes where the old window is
//     unknown or shifting) we instead refresh every existing unclosed
//     run from the runs list. That covers months whose deduction
//     needs to be cleared.
async function rebuildAffectedPayrollRuns(loan) {
  const rebuilt = [];
  const tryRebuild = async (monthStr) => {
    try {
      const res = await adminFetch("/api/accounting/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthStr }),
      });
      if (res.ok) rebuilt.push(monthStr);
      // 409 = month is closed; silently ignore.
    } catch {
      // network blip — best effort
    }
  };

  if (loan?.start_month && Number.isFinite(Number(loan?.installments_count))) {
    // Walk the installment window month-by-month, stopping at the
    // current calendar month. Future months stay un-built — we don't
    // want to surprise the admin with empty runs for months they
    // haven't reached yet.
    const startStr = String(loan.start_month).slice(0, 7); // YYYY-MM
    const [sy, sm] = startStr.split("-").map(Number);
    if (Number.isFinite(sy) && Number.isFinite(sm)) {
      const now = new Date();
      const nowKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
      const startKey = sy * 12 + (sm - 1);
      const installments = Number(loan.installments_count);
      const endKey = Math.min(startKey + installments - 1, nowKey);
      for (let k = startKey; k <= endKey; k += 1) {
        const y = Math.floor(k / 12);
        const m = String((k % 12) + 1).padStart(2, "0");
        await tryRebuild(`${y}-${m}`);
      }
    }
    return rebuilt;
  }

  // Loan window unknown — refresh every unclosed run we can see.
  let runs = [];
  try {
    const res = await adminFetch("/api/accounting/payroll");
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      runs = Array.isArray(data?.runs) ? data.runs : [];
    }
  } catch {
    return rebuilt;
  }
  for (const r of runs) {
    if (r.is_closed) continue;
    const monthStr = String(r.payroll_month).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthStr)) continue;
    await tryRebuild(monthStr);
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
      // OLD installment window can shrink or shift. We do two passes:
      //   1. sweep every existing unclosed run — clears stale
      //      deductions in months that are no longer in-window.
      //   2. build the loan's NEW window — creates any past months
      //      that don't have a run yet so the deduction shows up
      //      retroactively.
      const sweep = await rebuildAffectedPayrollRuns(null);
      const window = await rebuildAffectedPayrollRuns(data?.loan);
      const rebuilt = Array.from(new Set([...sweep, ...window]));
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
