import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";
import { queryKeys } from "../utils/queryKeys.js";

export function usePayrollRebuild() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ month }) => {
      const res = await adminFetch("/api/accounting/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: String(month) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/payroll, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPayroll(String(vars.month)),
      });
      toast.success("تم تحديث مسير الرواتب");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تحديث المسير: ${error.message}`);
    },
  });
}

export function usePayrollPayment(month) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entry_id,
      is_paid,
      paid_amount,
      payment_method,
      payment_note,
    }) => {
      const res = await adminFetch("/api/accounting/payroll/payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id,
          is_paid,
          paid_amount,
          payment_method,
          payment_note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `فشل تحديث حالة الدفع [${res.status}]`);
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPayroll(String(month)),
      });
      // Marking an entry paid (or un-paid) inside a closed month
      // changes the loans page's paid_months_to_date counter.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.employeeLoans(),
      });
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تحديث حالة الدفع: ${error.message}`);
    },
  });
}

export function usePayrollClose(month) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/api/accounting/payroll/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: String(month) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `فشل تقفيلة الشهر [${res.status}]`);
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPayroll(String(month)),
      });
      // Closing / reopening the month flips which entries the loans
      // page counts as paid installments — refresh the loans cache so
      // the "x / N شهر" column reflects reality without a manual
      // page reload.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.employeeLoans(),
      });
      const msg = data?.run?.is_closed
        ? "تم تقفيل الشهر بنجاح"
        : "تم فتح الشهر بنجاح";
      toast.success(msg);
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل العملية: ${error.message}`);
    },
  });
}
