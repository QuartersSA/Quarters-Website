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

// خطأ يحمل كود الخادم (stale_invoice / roast_paid / unusual_price /
// deposited_line / high_waste …) حتى تتصرف الواجهة بحسبه.
function apiError(data, fallback, status) {
  const error = new Error(data?.error || fallback);
  error.code = data?.code || null;
  error.status = status || null;
  error.data = data || null;
  return error;
}

function showWarnings(data) {
  const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
  for (const warning of warnings) toast.warning(warning, { duration: 8000 });
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
        throw apiError(data, "فشل إضافة فاتورة المشتريات", res.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      // فاتورة البن قد تعيد حساب تكلفة الصنف وتودع في المخزون.
      queryClient.invalidateQueries({ queryKey: queryKeys.items() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReceipts() });
      toast.success(
        data?.roast?.invoice_number
          ? `تم إضافة الفاتورة — وفاتورة التحميص ${data.roast.invoice_number}`
          : "تم إضافة فاتورة المشتريات",
      );
      showWarnings(data);
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
        throw apiError(data, "فشل تعديل فاتورة المشتريات", res.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.items() });
      toast.success("تم حفظ فاتورة المشتريات");
      showWarnings(data);
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

// دفعة جماعية: سداد أكثر من فاتورة لنفس المورد دفعة واحدة بإيصال
// واحد وحساب بنكي واحد — كل فاتورة تُسدَّد بكامل رصيدها.
export function useBulkPayPurchaseInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch(
        "/api/accounting/purchase-invoice-payments/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تسجيل الدفعة الجماعية");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      toast.success(
        `تم سداد ${data?.count || 0} فاتورة بإجمالي ${Number(
          data?.total || 0,
        ).toFixed(2)} ${data?.currency || "SAR"}`,
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الدفع الجماعي: ${error.message}`);
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
    mutationFn: async ({ id, force = false, detach = false }) => {
      const params = new URLSearchParams({ id: String(id) });
      if (force) params.set("force", "1");
      // فاتورة تحميص مرتبطة بفاتورة بن: إيقافها يتطلب «فك الارتباط».
      if (detach) params.set("detach", "1");
      const res = await adminFetch(
        `/api/accounting/purchase-invoices?${params.toString()}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw apiError(data, "فشل إيقاف الفاتورة", res.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.items() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReceipts() });
      toast.success(data?.hard ? "تم حذف الفاتورة نهائياً" : "تم إيقاف الفاتورة");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإيقاف: ${error.message}`);
    },
  });
}

// تسجيل وصول بنود البن (الكمية الواصلة، الاكتمال، الإيداع) — أو عكس
// الإيداع. الخادم يعيد حساب الهدر وصافي الكيلو وتكلفة الصنف.
export function useRecordCoffeeArrival() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch("/api/accounting/purchase-invoices/arrival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw apiError(data, "فشل تسجيل الوصول", res.status);
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.items() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseReceipts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryOperations() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockValue() });
      if (data?.reversed !== undefined) {
        toast.success("تم عكس الإيداع");
      } else {
        toast.success(
          data?.mode === "reported"
            ? "تم إبلاغ الكمية الواصلة — بانتظار اعتماد الإدارة"
            : "تم تسجيل الوصول",
        );
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل تسجيل الوصول: ${error.message}`);
    },
  });
}
