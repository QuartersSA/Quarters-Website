import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";

// Chart of accounts (شجرة الحسابات). Returns the FLAT account list —
// consumers build the tree client-side from parent_id.
export function useAccountingAccounts({
  employeeId,
  isAdmin,
  includeInactive,
} = {}) {
  return useQuery({
    queryKey: queryKeys.accountingAccounts(!!includeInactive),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const url = includeInactive
        ? "/api/accounting/accounts?includeInactive=1"
        : "/api/accounting/accounts";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل شجرة الحسابات");
      }
      return Array.isArray(data?.accounts) ? data.accounts : [];
    },
  });
}

function invalidateAccounts(queryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.accountingAccounts() }),
    // Invoices render account names/codes, banks carry auto-links.
    queryClient.invalidateQueries({
      queryKey: queryKeys.accountingPurchaseInvoices(),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.accountingBankAccounts(),
    }),
  ]);
}

export function useCreateAccountingAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة الحساب");
      }
      return data;
    },
    onSuccess: async () => {
      await invalidateAccounts(queryClient);
      toast.success("تم إضافة الحساب");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإضافة: ${error.message}`);
    },
  });
}

export function useUpdateAccountingAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تعديل الحساب");
      }
      return data;
    },
    onSuccess: async () => {
      await invalidateAccounts(queryClient);
      toast.success("تم حفظ الحساب");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

export function useDeleteAccountingAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const res = await adminFetch(`/api/accounting/accounts?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إيقاف الحساب");
      }
      return data;
    },
    onSuccess: async () => {
      await invalidateAccounts(queryClient);
      toast.success("تم إيقاف الحساب");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإيقاف: ${error.message}`);
    },
  });
}
