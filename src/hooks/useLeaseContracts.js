import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "@/utils/queryKeys";

// العقود التأجيرية — الاستعلامات والطفرات. كل طفرة تُبطل كاش العقود
// والدفعات والاستقطاع (والفواتير بعد السداد/التراجع لأن السداد ينشئ
// فاتورة مشتريات تحت حساب «إيجارات»).

const BASE = "/api/accounting/lease-contracts";

// خطأ يحمل كود الخادم (stale_contract / has_paid / already_paid /
// paid_row / invoice_exists …) حتى تتصرف الواجهة بحسبه.
function apiError(data, fallback, status) {
  const error = new Error(data?.error || fallback);
  error.code = data?.code || null;
  error.status = status || null;
  error.data = data || null;
  return error;
}

async function readJson(res) {
  return res.json().catch(() => ({}));
}

function showWarnings(data) {
  const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
  for (const warning of warnings) toast.warning(warning, { duration: 8000 });
}

function invalidateLeaseQueries(queryClient, { invoices = false } = {}) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: queryKeys.leaseContracts() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.leaseContract() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.leasePayments() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.leaseReserve() }),
  ];
  if (invoices) {
    tasks.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.accountingPurchaseInvoices(),
      }),
    );
  }
  return Promise.all(tasks);
}

// ---------- الاستعلامات ----------

export function useLeaseContracts({
  employeeId,
  isAdmin,
  includeInactive,
  q,
} = {}) {
  return useQuery({
    queryKey: queryKeys.leaseContracts(!!includeInactive, q || ""),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (includeInactive) qs.set("includeInactive", "1");
      if (q) qs.set("q", q);
      const url = qs.toString() ? `${BASE}?${qs.toString()}` : BASE;
      const res = await adminFetch(url);
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تحميل العقود التأجيرية", res.status);
      return Array.isArray(data?.contracts) ? data.contracts : [];
    },
  });
}

// عقد واحد مع جدول دفعاته — للدرج ونافذة التعديل.
export function useLeaseContract(id) {
  return useQuery({
    queryKey: queryKeys.leaseContract(id ? Number(id) : null),
    enabled: !!id,
    queryFn: async () => {
      const res = await adminFetch(`${BASE}/${id}`);
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تحميل العقد", res.status);
      return data?.contract || null;
    },
  });
}

export function useLeasePayments({
  employeeId,
  isAdmin,
  status,
  from,
  to,
  contractId,
} = {}) {
  return useQuery({
    queryKey: queryKeys.leasePayments(
      status || "pending",
      from || "",
      to || "",
      contractId ? Number(contractId) : null,
    ),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("status", status || "pending");
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (contractId) qs.set("contract_id", String(contractId));
      const res = await adminFetch(`${BASE}/payments?${qs.toString()}`);
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تحميل دفعات العقود", res.status);
      return Array.isArray(data?.payments) ? data.payments : [];
    },
  });
}

export function useLeaseReserve({ employeeId, isAdmin, month, branchId } = {}) {
  return useQuery({
    queryKey: queryKeys.leaseReserve(month || "", branchId || ""),
    enabled: !!employeeId && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (month) qs.set("month", month);
      if (branchId) qs.set("branch_id", String(branchId));
      const url = qs.toString()
        ? `${BASE}/reserve?${qs.toString()}`
        : `${BASE}/reserve`;
      const res = await adminFetch(url);
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تحميل الاستقطاع الشهري", res.status);
      return data || null;
    },
  });
}

// ---------- الطفرات ----------

export function useCreateLeaseContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const res = await adminFetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل إضافة العقد", res.status);
      return data;
    },
    onSuccess: async (data) => {
      await invalidateLeaseQueries(queryClient);
      const count = data?.contract?.payments_total ?? data?.contract?.payments?.length;
      toast.success(
        count ? `تم إضافة العقد — ${count} دفعة في الجدول` : "تم إضافة العقد",
      );
      showWarnings(data);
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل الإضافة: ${error.message}`);
    },
  });
}

export function useUpdateLeaseContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await adminFetch(`${BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تعديل العقد", res.status);
      return data;
    },
    onSuccess: async (data) => {
      await invalidateLeaseQueries(queryClient);
      toast.success("تم حفظ العقد");
      showWarnings(data);
    },
    onError: (error) => {
      console.error(error);
      if (error.code === "stale_contract") {
        toast.error(
          "تم تعديل هذا العقد من جهاز آخر أثناء التحرير — أغلق النافذة وأعد فتحه ثم كرر التعديل.",
          { duration: 9000 },
        );
        return;
      }
      toast.error(`فشل التعديل: ${error.message}`);
    },
  });
}

// إعادة تفعيل عقد موقوف (PUT مختصر { reactivate: true }).
export function useReactivateLeaseContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const res = await adminFetch(`${BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactivate: true }),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل إعادة تفعيل العقد", res.status);
      return data;
    },
    onSuccess: async () => {
      await invalidateLeaseQueries(queryClient);
      toast.success("تمت إعادة تفعيل العقد");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل إعادة التفعيل: ${error.message}`);
    },
  });
}

export function useDeleteLeaseContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, force = false }) => {
      const url = force ? `${BASE}/${id}?force=1` : `${BASE}/${id}`;
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل إيقاف العقد", res.status);
      return data;
    },
    onSuccess: async (data) => {
      await invalidateLeaseQueries(queryClient);
      toast.success(data?.hard ? "تم حذف العقد نهائياً" : "تم إيقاف العقد");
    },
    onError: (error) => {
      console.error(error);
      if (error.code === "has_paid") {
        toast.error(
          "لا يمكن الحذف النهائي: للعقد دفعات مسددة. أوقفه بدلاً من ذلك.",
        );
        return;
      }
      toast.error(`فشل الإيقاف: ${error.message}`);
    },
  });
}

// تعديل دفعة معلّقة/ملغاة (تاريخ الاستحقاق، المبلغ، الضريبة، ملاحظة،
// أو الحالة pending|cancelled). الدفعات المسددة لا تُعدَّل (409 paid_row).
export function useUpdateLeasePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await adminFetch(`${BASE}/payments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تعديل الدفعة", res.status);
      return data;
    },
    onSuccess: async (data, variables) => {
      await invalidateLeaseQueries(queryClient);
      if (variables?.status === "cancelled") toast.success("تم إلغاء الدفعة");
      else if (variables?.status === "pending" && Object.keys(variables).length === 2)
        toast.success("تمت إعادة الدفعة إلى المعلّقة");
      else toast.success("تم حفظ الدفعة");
    },
    onError: (error) => {
      console.error(error);
      if (error.code === "paid_row") {
        toast.error("الدفعة مسددة — تراجع عن السداد أولاً ثم عدّلها.");
        return;
      }
      toast.error(`فشل تعديل الدفعة: ${error.message}`);
    },
  });
}

// سداد دفعة: يعلّم الدفعة مسددة (بلا فاتورة مشتريات) وتُتابع من
// «سداد المستحق».
export function usePayLeasePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const res = await adminFetch(`${BASE}/payments/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تسجيل السداد", res.status);
      return data;
    },
    onSuccess: async (data) => {
      await invalidateLeaseQueries(queryClient, { invoices: true });
      toast.success("تم تسجيل السداد");
      showWarnings(data);
    },
    onError: (error) => {
      console.error(error);
      if (error.code === "already_paid") {
        toast.error("هذه الدفعة مسددة مسبقاً.");
        return;
      }
      if (error.code === "invoice_exists") {
        toast.error(
          "توجد فاتورة نشطة بنفس رقم الدفعة — أوقفها من فواتير المشتريات ثم أعد السداد.",
          { duration: 9000 },
        );
        return;
      }
      toast.error(`فشل السداد: ${error.message}`);
    },
  });
}

// التراجع عن السداد: تعود الدفعة معلّقة (وتُوقف فاتورة قديمة إن كانت مرتبطة).
export function useUnpayLeasePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const res = await adminFetch(`${BASE}/payments/${id}/unpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل التراجع عن السداد", res.status);
      return data;
    },
    onSuccess: async () => {
      await invalidateLeaseQueries(queryClient, { invoices: true });
      toast.success("تم التراجع عن السداد — عادت الدفعة معلّقة");
    },
    onError: (error) => {
      console.error(error);
      toast.error(`فشل التراجع: ${error.message}`);
    },
  });
}

// تأكيد الاستقطاع الشهري لدفعة (سجل ما حُجز فعليًا). amount = 0 يحذف
// صف الشهر. يُبطل كاش الاستقطاع فقط.
export function useConfirmLeaseReserve() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payment_id, month, amount, note, suggested_amount, revenue_basis }) => {
      const res = await adminFetch(`${BASE}/reserve/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id,
          month,
          amount,
          note: note || null,
          suggested_amount: suggested_amount ?? null,
          revenue_basis: revenue_basis ?? null,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل تأكيد الاستقطاع", res.status);
      return data;
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaseReserve() });
      if (variables?.silent) return;
      toast.success(
        data?.removed || Number(variables?.amount) === 0
          ? "أُلغي استقطاع هذا الشهر"
          : "تم تأكيد الاستقطاع",
      );
    },
    onError: (error) => {
      console.error(error);
      if (error.code === "future_month") {
        toast.error("لا يمكن تأكيد استقطاع لشهر مستقبلي — إيراداته لم تتحقق بعد.");
        return;
      }
      if (error.code === "paid_row") {
        toast.error("الدفعة مسددة — لا يُعدَّل استقطاعها.");
        return;
      }
      toast.error(`فشل تأكيد الاستقطاع: ${error.message}`);
    },
  });
}

// إنشاء فاتورة استقطاع لشهر واحد (بعد حذفها مثلًا).
export function useCreateLeaseSetAsideInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payment_id, month }) => {
      const res = await adminFetch(`${BASE}/reserve/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id, month }),
      });
      const data = await readJson(res);
      if (!res.ok) throw apiError(data, "فشل إنشاء فاتورة الاستقطاع", res.status);
      return data;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.leaseReserve() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accountingPurchaseInvoices() }),
      ]);
      toast.success(data?.invoice?.invoice_number ? `أُنشئت الفاتورة ${data.invoice.invoice_number}` : "أُنشئت فاتورة الاستقطاع");
    },
    onError: (error) => {
      console.error(error);
      toast.error(error.message);
    },
  });
}

// التحليل الذكي لملف العقد — يعيد analysis فقط؛ النافذة تتولى العرض
// والتعبئة، ولا توست عند النجاح.
export function useAnalyzeLeaseContract() {
  return useMutation({
    mutationFn: async ({ file_base64, media_type, text } = {}) => {
      const res = await adminFetch(`${BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_base64: file_base64 || null,
          media_type: media_type || null,
          text: text || "",
        }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        const fallback =
          res.status === 503
            ? "التحليل الذكي غير مفعّل على الخادم (ANTHROPIC_API_KEY)"
            : res.status === 413
              ? "الملف أكبر من الحد المسموح للتحليل"
              : "تعذر تحليل المستند";
        const error = apiError(data, fallback, res.status);
        // سبب الفشل الفعلي (details) يظهر للمشغّل بدل رسالة عامة.
        if (data?.details && !String(error.message).includes(String(data.details))) {
          error.message = `${error.message} — ${String(data.details).slice(0, 200)}`;
        }
        throw error;
      }
      return data?.analysis || null;
    },
  });
}
