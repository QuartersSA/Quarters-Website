import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

export function useExpensesData(month, employeeId, isAdmin) {
  return useQuery({
    queryKey: ["accounting_expenses", month],
    enabled: !!employeeId && isAdmin && !!month,
    queryFn: async () => {
      const qs = new URLSearchParams({ month: String(month) });
      const res = await adminFetch(`/api/accounting/expenses?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/expenses, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });
}

export function useExpenseTypes(employeeId, isAdmin) {
  return useQuery({
    queryKey: ["accounting_expense_types"],
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/accounting/expense-types");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل أنواع المصروفات");
      }
      return data.types || [];
    },
  });
}

export function useCreateExpense(month) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      expense_type_id,
      expense_name,
      amount,
      month: expenseMonth,
    }) => {
      const m = expenseMonth || month;
      const res = await adminFetch("/api/accounting/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_type_id,
          expense_name,
          amount,
          month: m,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة المصروف");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
      toast.success("تم إضافة المصروف بنجاح");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل إضافة المصروف: ${error.message}`);
    },
  });
}

export function useUpdateExpense(month) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, expense_type_id, expense_name, amount }) => {
      const res = await adminFetch(`/api/accounting/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expense_type_id, expense_name, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تعديل المصروف");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
      toast.success("تم تعديل المصروف بنجاح");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تعديل المصروف: ${error.message}`);
    },
  });
}

export function useConfirmExpense(month) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      is_confirmed,
      confirmed_amount,
      confirmed_note,
    }) => {
      const res = await adminFetch(`/api/accounting/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_confirmed,
          confirmed_amount,
          confirmed_note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تأكيد المصروف");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تأكيد المصروف: ${error.message}`);
    },
  });
}

export function useDeleteExpense(month) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const res = await adminFetch(`/api/accounting/expenses/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل حذف المصروف");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expenses"],
      });
      toast.success("تم حذف المصروف");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل حذف المصروف: ${error.message}`);
    },
  });
}

export function useCreateExpenseType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }) => {
      const res = await adminFetch("/api/accounting/expense-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة نوع المصروف");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting_expense_types"],
      });
      toast.success("تم إضافة نوع المصروف بنجاح");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل إضافة نوع المصروف: ${error.message}`);
    },
  });
}
