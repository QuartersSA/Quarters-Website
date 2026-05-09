import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

// List active fixed-expense templates
export function useFixedExpenses(employeeId, isAdmin, includeInactive = false) {
  return useQuery({
    queryKey: ["accounting_fixed_expenses", { includeInactive }],
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = includeInactive ? "?includeInactive=1" : "";
      const res = await adminFetch(`/api/accounting/fixed-expenses${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل المصروفات الثابتة");
      }
      return Array.isArray(data.fixed_expenses) ? data.fixed_expenses : [];
    },
  });
}

export function useCreateFixedExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      expense_type_id,
      expense_name,
      default_amount,
      start_month,
    }) => {
      const res = await adminFetch("/api/accounting/fixed-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_type_id,
          expense_name,
          default_amount,
          start_month,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة المصروف الثابت");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_fixed_expenses"],
      });
      // Also refresh expenses list since pending_fixed will change
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
      toast.success("تم إضافة المصروف الثابت بنجاح");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإضافة: ${error.message}`);
    },
  });
}

export function useUpdateFixedExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const res = await adminFetch(`/api/accounting/fixed-expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تعديل المصروف الثابت");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_fixed_expenses"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
      toast.success("تم تعديل المصروف الثابت");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

export function useDeleteFixedExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await adminFetch(`/api/accounting/fixed-expenses/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل حذف المصروف الثابت");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_fixed_expenses"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
      toast.success("تم إلغاء تنشيط المصروف الثابت");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الحذف: ${error.message}`);
    },
  });
}

// Confirm payment of a fixed-expense template for a specific month.
// This materializes a real accounting_expenses row.
export function useConfirmFixedExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, month, confirmed_amount, confirmed_note }) => {
      const res = await adminFetch(
        `/api/accounting/fixed-expenses/${id}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month, confirmed_amount, confirmed_note }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تأكيد الدفع");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
      toast.success("تم تأكيد الدفع");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التأكيد: ${error.message}`);
    },
  });
}
