import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";

export function useAccountingPurchaseInvoices({
  employeeId,
  isAdmin,
  q,
  status,
  includeInactive,
} = {}) {
  return useQuery({
    queryKey: queryKeys.accountingPurchaseInvoices(
      q || "",
      status || "",
      !!includeInactive,
    ),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (status) qs.set("status", status);
      if (includeInactive) qs.set("includeInactive", "1");
      const url = qs.toString()
        ? `/api/accounting/purchase-invoices?${qs.toString()}`
        : "/api/accounting/purchase-invoices";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل فواتير المشتريات");
      }
      return Array.isArray(data?.invoices) ? data.invoices : [];
    },
  });
}

export function useCreateAccountingPurchaseInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/purchase-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة فاتورة المشتريات");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success("تم إضافة فاتورة المشتريات");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإضافة: ${error.message}`);
    },
  });
}

export function useUpdateAccountingPurchaseInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/purchase-invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تعديل فاتورة المشتريات");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success("تم حفظ فاتورة المشتريات");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

export function useDeleteAccountingPurchaseInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force = false }) => {
      const url = force
        ? `/api/accounting/purchase-invoices?id=${id}&force=1`
        : `/api/accounting/purchase-invoices?id=${id}`;
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إيقاف الفاتورة");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success(data?.hard ? "تم حذف الفاتورة نهائياً" : "تم إيقاف الفاتورة");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإيقاف: ${error.message}`);
    },
  });
}
