import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authedFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";

// طبقة بيانات الرفع الجماعي لفواتير المشتريات.
//
// الضخ (التحليل المتسلسل) تقوده الصفحة: بند واحد قيد التحليل في كل
// لحظة — يحترم حدود الخادم ويجعل فشل أي بند معزولاً عن إخوته،
// والتقدم محفوظ في القاعدة فيُستأنف بعد مغادرة الصفحة.

async function readJson(response, fallbackError) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || fallbackError);
    error.status = response.status;
    error.duplicate = !!data?.duplicate;
    throw error;
  }
  return data;
}

export function useInvoiceBatches({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.invoiceBatches(),
    enabled,
    queryFn: async () => {
      const response = await authedFetch(
        "/api/accounting/purchase-invoice-batches",
      );
      const data = await readJson(response, "فشل تحميل الدفعات");
      return Array.isArray(data?.batches) ? data.batches : [];
    },
  });
}

export function useInvoiceBatchDetail(batchId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.invoiceBatchDetail(batchId),
    enabled: enabled && !!batchId,
    // ما دام في الدفعة بنود لم يكتمل تحليلها نستطلع كل 4 ثوانٍ —
    // «قيد التحليل» تظهر حية، وتقدم مستخدم آخر على نفس الدفعة يصل.
    refetchInterval: (query) => {
      const items = query.state.data?.items;
      if (!Array.isArray(items)) return false;
      return items.some((item) =>
        ["uploaded", "analyzing", "submitting"].includes(item.status),
      )
        ? 4000
        : false;
    },
    queryFn: async () => {
      const response = await authedFetch(
        `/api/accounting/purchase-invoice-batches/${batchId}`,
      );
      return readJson(response, "فشل تحميل الدفعة");
    },
  });
}

export function useCreateInvoiceBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items) => {
      const response = await authedFetch(
        "/api/accounting/purchase-invoice-batches",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        },
      );
      return readJson(response, "فشل إنشاء الدفعة");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceBatches(),
      });
    },
    onError: (error) => toast.error(`فشل إنشاء الدفعة: ${error.message}`),
  });
}

// إجراء على بند: analyze / save_draft / approve / retry.
export function useBatchItemAction(batchId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, action, draft, force, invoiceId }) => {
      const response = await authedFetch(
        `/api/accounting/purchase-invoice-batches/${batchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: itemId,
            action,
            ...(draft !== undefined ? { draft } : {}),
            ...(force ? { force: true } : {}),
            ...(invoiceId ? { invoice_id: invoiceId } : {}),
          }),
        },
      );
      return readJson(response, "فشل تنفيذ الإجراء");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceBatchDetail(batchId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceBatches(),
      });
    },
  });
}

// الإرسال: إجراء خادمي واحد — الخادم يبني الفاتورة من المسودة
// المخزنة المعتمدة (لا من حالة المتصفح) عبر نفس نواة إنشاء الفاتورة
// (نفس التحقق والترقيم والتدقيق وإشعارات واتساب)، بمطالبة ذرية تمنع
// الإرسال المزدوج.
export function useSubmitBatchItem(batchId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item }) => {
      const response = await authedFetch(
        `/api/accounting/purchase-invoice-batches/${batchId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: item.id, action: "submit" }),
        },
      );
      const data = await readJson(response, "فشل الإرسال");
      return { invoiceId: data?.invoice_id || null };
    },
    onSuccess: () => toast.success("أُرسلت الفاتورة لمسار المشتريات"),
    onError: (error) => toast.error(`فشل الإرسال: ${error.message}`),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceBatchDetail(batchId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceBatches(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      });
    },
  });
}

export function useDeleteBatchItem(batchId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId } = {}) => {
      const url = itemId
        ? `/api/accounting/purchase-invoice-batches/${batchId}?item_id=${itemId}`
        : `/api/accounting/purchase-invoice-batches/${batchId}`;
      const response = await authedFetch(url, { method: "DELETE" });
      return readJson(response, "فشل الحذف");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceBatchDetail(batchId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.invoiceBatches(),
      });
    },
  });
}
