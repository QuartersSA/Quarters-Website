import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";

export function useAccountingBankAccounts({
  employeeId,
  isAdmin,
  q,
  includeInactive,
} = {}) {
  return useQuery({
    queryKey: queryKeys.accountingBankAccounts(q || "", !!includeInactive),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (includeInactive) qs.set("includeInactive", "1");
      const url = qs.toString()
        ? `/api/accounting/bank-accounts?${qs.toString()}`
        : "/api/accounting/bank-accounts";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل الحسابات البنكية");
      }
      return Array.isArray(data?.accounts) ? data.accounts : [];
    },
  });
}

export function useCreateAccountingBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة الحساب البنكي");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingBankAccounts(),
      });
      toast.success("تم إضافة الحساب البنكي");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإضافة: ${error.message}`);
    },
  });
}

export function useUpdateAccountingBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await adminFetch(`/api/accounting/bank-accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تعديل الحساب البنكي");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingBankAccounts(),
      });
      toast.success("تم حفظ الحساب البنكي");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

export function useDeleteAccountingBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force = false }) => {
      const url = force
        ? `/api/accounting/bank-accounts/${id}?force=1`
        : `/api/accounting/bank-accounts/${id}`;
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إيقاف الحساب البنكي");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingBankAccounts(),
      });
      toast.success(data?.hard ? "تم حذف الحساب نهائياً" : "تم إيقاف الحساب");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإيقاف: ${error.message}`);
    },
  });
}
