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

// سجل الدفعات المتعدد: كل دفعة سطر مستقل، والخادم يحدّث رأس
// الفاتورة في نفس العملية — إبطال كاش الفواتير يكفي للتحديث.
export function useAddPurchaseInvoicePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/purchase-invoice-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تسجيل الدفعة");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success("تم تسجيل الدفعة");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تسجيل الدفعة: ${error.message}`);
    },
  });
}

export function useDeletePurchaseInvoicePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const res = await adminFetch(
        `/api/accounting/purchase-invoice-payments?id=${id}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل حذف الدفعة");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success("تم حذف الدفعة وتحديث الفاتورة");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل حذف الدفعة: ${error.message}`);
    },
  });
}

// مرفقات إضافية على الفاتورة (عرض سعر ثم فاتورة ضريبية…).
export function useAddInvoiceAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch(
        "/api/accounting/purchase-invoice-attachments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل إضافة المرفق");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success("تم إرفاق المستند");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإرفاق: ${error.message}`);
    },
  });
}

export function useDeleteInvoiceAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const res = await adminFetch(
        `/api/accounting/purchase-invoice-attachments?id=${id}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل حذف المرفق");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success("تم حذف المرفق");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل حذف المرفق: ${error.message}`);
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
