"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Copy,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import useUpload from "@/utils/useUpload";
import { compressImage } from "@/utils/compressImage";
import { computeDraftTotals } from "@/utils/invoiceDraftMath";
import { buildExpenseAccountOptions } from "@/components/Accounting/PurchaseInvoiceModal";
import { useAccountingContacts } from "@/hooks/useAccountingContacts";
import { useAccountingAccounts } from "@/hooks/useAccountingAccounts";
import {
  useInvoiceBatches,
  useInvoiceBatchDetail,
  useCreateInvoiceBatch,
  useBatchItemAction,
  useSubmitBatchItem,
  useDeleteBatchItem,
} from "@/hooks/useInvoiceBatches";

/**
 * الرفع الجماعي لفواتير المشتريات — حتى 50 فاتورة دفعة واحدة:
 * سحب/اختيار الملفات ← رفع ← تحليل ذكي متسلسل (نفس محرك الفاتورة
 * الواحدة) ← طابور مراجعة ببنود قابلة للتعديل مع المستند بجانبها ←
 * اعتماد ← إرسال لمسار الفواتير القائم نفسه.
 *
 * التقدم كله محفوظ في القاعدة: أغلق الصفحة وارجع متى شئت — التحليل
 * غير المكتمل يُستأنف تلقائياً والتعديلات محفوظة أولاً بأول.
 */

const MAX_FILES = 50;
const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const STATUS_META = {
  uploaded: {
    label: "بانتظار التحليل",
    cls: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/[0.06] dark:text-white/70 dark:border-white/10",
  },
  analyzing: {
    label: "قيد التحليل",
    cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-400/25",
  },
  ready: {
    label: "جاهزة للمراجعة",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/25",
  },
  needs_attention: {
    label: "تحتاج انتباهاً",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/25",
  },
  approved: {
    label: "معتمدة",
    cls: "bg-[#0b3d31]/10 text-[#0b3d31] border-[#0b3d31]/20 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30",
  },
  submitting: {
    label: "قيد الإرسال",
    cls: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-400/25",
  },
  submitted: {
    label: "مُرسلة",
    cls: "bg-[#0e7a5f] text-white border-[#0e7a5f] dark:bg-emerald-500 dark:text-white dark:border-emerald-400",
  },
  failed: {
    label: "فشلت",
    cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/25",
  },
};

const FLAG_LABELS = {
  missing_number: "بلا رقم فاتورة",
  missing_date: "بلا تاريخ",
  missing_supplier: "بلا مورد",
  new_supplier: "مورد جديد",
  no_items: "بلا بنود",
  zero_total: "الإجمالي صفر",
  duplicate_invoice: "مكررة مع فاتورة قائمة",
  duplicate_in_batch: "مكررة داخل الدفعة",
  operator_note: "ملاحظة من المحلل",
};

const CURRENCIES = ["SAR", "USD", "EUR", "AED", "KWD", "BHD", "QAR", "OMR"];

const money = (value) =>
  (Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.uploaded;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${meta.cls}`}
    >
      {status === "analyzing" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : null}
      {meta.label}
    </span>
  );
}

// استخراج معرف جلسة الرفع من رابط الملف /api/uploads/<id>/file?t=…
function uploadSessionIdFromUrl(url) {
  const match = /\/api\/uploads\/(\d+)\/file/.exec(String(url || ""));
  return match ? Number(match[1]) : null;
}

export default function BulkInvoiceUploadPanel({ employeeId, isAdmin }) {
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewItemId, setReviewItemId] = useState(null);
  // حالة الرفع اللحظية قبل ولادة الدفعة: idx → {name, status, error}
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [upload] = useUpload();

  const batchesQuery = useInvoiceBatches({ enabled: !!employeeId && isAdmin });
  const detailQuery = useInvoiceBatchDetail(activeBatchId, {
    enabled: !!employeeId && isAdmin,
  });
  const createBatch = useCreateInvoiceBatch();
  // نسختان منفصلتان من الطفرة: واحدة للمضخة الخلفية وواحدة لإجراءات
  // نافذة المراجعة — حتى لا يعطل تحليل خلفي طويل زرّي الاعتماد
  // والإرسال (isPending مشتركة داخل النسخة الواحدة).
  const pumpAction = useBatchItemAction(activeBatchId);
  const itemAction = useBatchItemAction(activeBatchId);
  const submitItem = useSubmitBatchItem(activeBatchId);
  const deleteItem = useDeleteBatchItem(activeBatchId);

  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const accountsQuery = useAccountingAccounts({ employeeId, isAdmin });
  const contacts = contactsQuery.data || [];
  const accounts = accountsQuery.data || [];

  const items = detailQuery.data?.items || [];

  // ===== مضخة التحليل: بند واحد قيد التحليل في كل لحظة =====
  // فشل بند لا يوقف البقية؛ إغلاق الصفحة يوقفها مؤقتاً وتُستأنف
  // تلقائياً عند العودة (الحالة كلها في القاعدة). الخادم يحمي
  // بمطالبة ذرية: تبويب ثانٍ يطلب تحليل نفس البند يرتد 409 بصمت،
  // والبند العالق «قيد التحليل» لا يُعاد التقاطه إلا بعد 3 دقائق.
  const pumpBusyRef = useRef(false);
  // فشل نقل (شبكة) يُعاد مرتين فقط لكل بند — لا حلقة لا نهائية.
  const pumpAttemptsRef = useRef(new Map());
  // البند العالق «قيد التحليل» يُجرَّب مرة كل 3.5 دقيقة فقط — الخادم
  // يقبل إعادة الالتقاط بعد 3 دقائق من آخر تحديث ويرد 409 قبلها.
  const staleTryRef = useRef(new Map());
  useEffect(() => {
    if (!activeBatchId || pumpBusyRef.current) return;
    const now = Date.now();
    const next = items.find((item) => {
      if (item.status === "uploaded") {
        return (pumpAttemptsRef.current.get(item.id) || 0) < 3;
      }
      if (item.status === "analyzing") {
        return now - (staleTryRef.current.get(item.id) || 0) > 210000;
      }
      return false;
    });
    if (!next) return;
    pumpBusyRef.current = true;
    if (next.status === "analyzing") {
      staleTryRef.current.set(next.id, now);
    } else {
      pumpAttemptsRef.current.set(
        next.id,
        (pumpAttemptsRef.current.get(next.id) || 0) + 1,
      );
    }
    pumpAction
      .mutateAsync({ itemId: next.id, action: "analyze" })
      .then(() => {
        // نجاح الطلب (بما فيه فشل تحليل مسجل بالخادم) يصفر العداد.
        pumpAttemptsRef.current.delete(next.id);
      })
      .catch(() => {
        // 409 = مُطالب به من جلسة أخرى أو اكتمل — الاستطلاع الدوري
        // سيجلب حالته الحقيقية؛ لا شيء يُعمل هنا.
      })
      .finally(() => {
        pumpBusyRef.current = false;
      });
    // pumpAction هوية متجددة كل تصيير — الاعتماد على items يكفي.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatchId, items]);

  // ===== اختيار الملفات ورفعها =====
  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((file) =>
        ACCEPTED_TYPES.has(file.type),
      );
      const skipped = Array.from(fileList || []).length - files.length;
      if (skipped > 0) {
        toast.error(`${skipped} ملف بصيغة غير مدعومة (PDF/JPG/PNG/WEBP فقط)`);
      }
      if (!files.length) return;
      if (files.length > MAX_FILES) {
        toast.error(`الحد الأقصى ${MAX_FILES} فاتورة في الدفعة الواحدة`);
        return;
      }
      setUploadingFiles(
        files.map((file) => ({ name: file.name, status: "uploading" })),
      );
      const uploaded = [];
      for (let index = 0; index < files.length; index += 1) {
        const original = files[index];
        try {
          // الصور تُضغط قبل الرفع لتبقى تحت سقف التحليل الذكي (3MB)
          // — نفس ما يفعله مسار الفاتورة الواحدة قبل التحليل.
          const file = original.type.startsWith("image/")
            ? await compressImage(original, { maxEdge: 2200, quality: 0.85 })
            : original;
          const result = await upload({ file });
          if (result.error) throw new Error(result.error);
          uploaded.push({
            file_name: original.name,
            file_url: result.url,
            media_type: result.mimeType || file.type,
            upload_session_id: uploadSessionIdFromUrl(result.url),
          });
          setUploadingFiles((previous) =>
            previous.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, status: "done" } : entry,
            ),
          );
        } catch (error) {
          setUploadingFiles((previous) =>
            previous.map((entry, entryIndex) =>
              entryIndex === index
                ? { ...entry, status: "failed", error: error.message }
                : entry,
            ),
          );
        }
      }
      if (!uploaded.length) {
        toast.error("لم يُرفع أي ملف بنجاح");
        setUploadingFiles([]);
        return;
      }
      try {
        const created = await createBatch.mutateAsync(uploaded);
        setActiveBatchId(created.batch_id);
        setUploadingFiles([]);
        toast.success(`أُنشئت الدفعة — ${uploaded.length} فاتورة قيد التحليل`);
      } catch {
        // الخطأ ظهر من onError في الطفرة — حرر الزر لمحاولة جديدة.
        setUploadingFiles([]);
      }
    },
    [upload, createBatch],
  );

  // ===== الملخص والفلاتر =====
  const counts = useMemo(() => {
    const tally = {
      total: items.length,
      uploaded: 0,
      analyzing: 0,
      ready: 0,
      needs_attention: 0,
      approved: 0,
      submitting: 0,
      submitted: 0,
      failed: 0,
    };
    for (const item of items) {
      if (tally[item.status] !== undefined) tally[item.status] += 1;
    }
    return tally;
  }, [items]);

  const analyzedCount =
    counts.total - counts.uploaded - counts.analyzing;
  const progressPercent = counts.total
    ? Math.round((analyzedCount / counts.total) * 100)
    : 0;

  // فلتر «قيد التحليل» يجمع بانتظارها وجاريها معاً — نفس ما يعده
  // عداد البلاطة.
  const visibleItems = statusFilter
    ? items.filter((item) =>
        statusFilter === "analyzing"
          ? ["uploaded", "analyzing"].includes(item.status)
          : statusFilter === "approved"
            ? ["approved", "submitting"].includes(item.status)
            : item.status === statusFilter,
      )
    : items;

  // ترتيب المراجعة: كل ما يمكن فتحه للمراجعة/التعديل.
  const reviewableIds = useMemo(
    () =>
      items
        .filter((item) =>
          ["ready", "needs_attention", "approved"].includes(item.status),
        )
        .map((item) => item.id),
    [items],
  );
  const reviewItem = items.find((item) => item.id === reviewItemId) || null;

  const openNextReview = useCallback(
    (direction = 1) => {
      if (!reviewableIds.length) return;
      const currentIndex = reviewableIds.indexOf(reviewItemId);
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + reviewableIds.length) %
            reviewableIds.length;
      setReviewItemId(reviewableIds[nextIndex]);
    },
    [reviewableIds, reviewItemId],
  );

  if (!isAdmin) return null;

  // ===== شاشة اختيار/إنشاء الدفعة =====
  if (!activeBatchId) {
    const batches = batchesQuery.data || [];
    return (
      <div className="space-y-5">
        <div
          className={`${ws.glass} ${ws.card} p-8 text-center transition-colors ${
            dragOver ? "border-[#0e7a5f] bg-[#0e7a5f]/5" : ""
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            handleFiles(event.dataTransfer.files);
          }}
        >
          <div className={`${ws.iconBox} w-14 h-14 mx-auto text-[#0e7a5f] dark:text-emerald-300`}>
            <CloudUpload className="w-7 h-7" />
          </div>
          <h3 className={`${ws.title} text-lg mt-3`}>
            الرفع الجماعي لفواتير المشتريات
          </h3>
          <p className={`${ws.muted} text-sm mt-1 max-w-xl mx-auto leading-relaxed`}>
            اسحب حتى {MAX_FILES} فاتورة (PDF أو صور) أو اخترها من جهازك —
            يُحلل كل ملف بالذكاء الاصطناعي على حدة، ثم تراجع وتعتمد وترسل
            كل فاتورة بشكل مستقل. فشل فاتورة لا يوقف بقية الدفعة.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFiles.length > 0}
              className={`${ws.btnPrimary} px-5 py-2.5 text-sm disabled:opacity-50`}
            >
              <Plus className="w-4 h-4" />
              اختر الملفات
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {uploadingFiles.length > 0 ? (
            <div className="mt-5 max-w-md mx-auto text-right space-y-1.5">
              {uploadingFiles.map((entry, index) => (
                <div
                  key={`${entry.name}-${index}`}
                  className="flex items-center gap-2 text-xs"
                >
                  {entry.status === "uploading" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 dark:text-sky-300 shrink-0" />
                  ) : entry.status === "done" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-300 shrink-0" />
                  )}
                  <span className="truncate flex-1">{entry.name}</span>
                  {entry.error ? (
                    <span className="text-red-600 dark:text-red-300 text-[11px]">
                      {entry.error}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {batches.length > 0 ? (
          <div className={`${ws.glassSoft} ${ws.card} p-4`}>
            <div className={`${ws.title} text-sm mb-3`}>الدفعات السابقة</div>
            <div className="space-y-2">
              {batches.map((batch) => {
                const pending =
                  batch.uploaded_count +
                  batch.analyzing_count +
                  batch.ready_count +
                  batch.attention_count +
                  batch.approved_count;
                return (
                  <button
                    key={batch.id}
                    type="button"
                    onClick={() => setActiveBatchId(batch.id)}
                    className={`${ws.glass} w-full rounded-[10px] p-3 flex items-center gap-3 text-right hover:border-[#0e7a5f]/40 transition-colors`}
                  >
                    <FileText className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">
                        دفعة #{batch.id}
                        <span className={`${ws.muted} font-normal text-xs mr-2`}>
                          {batch.created_at} — {batch.created_by_employee_name || ""}
                        </span>
                      </div>
                      <div className={`${ws.muted} text-xs mt-0.5`}>
                        {batch.total_items} فاتورة · {batch.submitted_count} مُرسلة
                        {batch.failed_count ? ` · ${batch.failed_count} فاشلة` : ""}
                        {pending ? ` · ${pending} بانتظار الإكمال` : " · مكتملة"}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 rotate-180 opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ===== شاشة الدفعة النشطة =====
  const summaryTiles = [
    { key: "", label: "الكل", value: counts.total },
    { key: "analyzing", label: "قيد التحليل", value: counts.analyzing + counts.uploaded },
    { key: "ready", label: "جاهزة", value: counts.ready },
    { key: "needs_attention", label: "تحتاج انتباهاً", value: counts.needs_attention },
    { key: "approved", label: "معتمدة", value: counts.approved + counts.submitting },
    { key: "submitted", label: "مُرسلة", value: counts.submitted },
    { key: "failed", label: "فاشلة", value: counts.failed },
  ];

  return (
    <div className="space-y-4">
      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveBatchId(null);
              setStatusFilter("");
            }}
            className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            كل الدفعات
          </button>
          <div className={`${ws.title} text-base`}>
            دفعة #{activeBatchId}
          </div>
          <div className={`${ws.muted} text-xs`}>
            {detailQuery.data?.batch?.created_at || ""}
          </div>
          <div className="flex-1" />
          {counts.uploaded + counts.analyzing > 0 ? (
            <div className="flex items-center gap-2 text-xs font-bold text-sky-700 dark:text-sky-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              التحليل جارٍ… {analyzedCount}/{counts.total}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              اكتمل التحليل
            </div>
          )}
        </div>
        {/* شريط تقدم الدفعة */}
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#0e7a5f] dark:bg-emerald-400 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* عدادات الحالات — تعمل فلاتر أيضاً */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {summaryTiles.map((tile) => (
            <button
              key={tile.key || "all"}
              type="button"
              onClick={() => setStatusFilter(tile.key)}
              className={`px-3 py-1.5 rounded-[10px] border text-xs font-bold transition-colors ${
                statusFilter === tile.key
                  ? "bg-[#0b3d31] text-white border-[#0b3d31] dark:bg-emerald-500/30 dark:text-emerald-50 dark:border-emerald-400/40"
                  : "bg-white text-[#4a5568] border-[#e2e7e4] hover:border-[#0e7a5f]/40 dark:bg-white/[0.04] dark:text-white/60 dark:border-white/10"
              }`}
            >
              {tile.label}
              <span className="mr-1.5 font-mono">{tile.value}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e7e4] dark:border-white/10 text-right">
                <th className={`${ws.muted} font-bold text-xs px-4 py-3`}>الملف</th>
                <th className={`${ws.muted} font-bold text-xs px-4 py-3`}>الحالة</th>
                <th className={`${ws.muted} font-bold text-xs px-4 py-3`}>رقم الفاتورة</th>
                <th className={`${ws.muted} font-bold text-xs px-4 py-3`}>المورد</th>
                <th className={`${ws.muted} font-bold text-xs px-4 py-3`}>التاريخ</th>
                <th className={`${ws.muted} font-bold text-xs px-4 py-3`}>الإجمالي</th>
                <th className={`${ws.muted} font-bold text-xs px-4 py-3`}>ملاحظات</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const draft = item.draft || {};
                const totals = computeDraftTotals(draft);
                const flags = Array.isArray(item.flags) ? item.flags : [];
                const contactName = draft.contact_id
                  ? contacts.find((contact) => contact.id === draft.contact_id)
                      ?.name || draft.supplier_name
                  : draft.supplier_name;
                const reviewable = [
                  "ready",
                  "needs_attention",
                  "approved",
                ].includes(item.status);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-[#f0f3f1] dark:border-white/5 hover:bg-[#fafbfa] dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="truncate font-semibold text-xs" dir="ltr">
                        {item.file_name || `ملف ${item.id}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      {draft.invoice_number || "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="truncate text-xs">{contactName || "—"}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                      {draft.invoice_date || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold" dir="ltr">
                      {item.draft ? money(totals.total) : "—"}
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {item.error ? (
                        <span className="text-[11px] text-red-600 dark:text-red-300">
                          {item.error}
                        </span>
                      ) : flags.length ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {flags.slice(0, 3).map((flag) => (
                            <span
                              key={flag}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                flag.startsWith("duplicate")
                                  ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                              }`}
                            >
                              {flag.startsWith("duplicate") ? (
                                <Copy className="w-2.5 h-2.5" />
                              ) : null}
                              {FLAG_LABELS[flag] || flag}
                            </span>
                          ))}
                        </div>
                      ) : item.status === "submitted" && item.invoice_id ? (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                          فاتورة #{item.invoice_id}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {reviewable ? (
                          <button
                            type="button"
                            onClick={() => setReviewItemId(item.id)}
                            className={`${ws.btnPrimary} px-2.5 py-1 text-[11px]`}
                          >
                            مراجعة
                          </button>
                        ) : null}
                        {item.status === "failed" ? (
                          <button
                            type="button"
                            onClick={() =>
                              itemAction.mutate({
                                itemId: item.id,
                                action: "retry",
                              })
                            }
                            className={`${ws.btnNeutral} px-2.5 py-1 text-[11px]`}
                          >
                            <RefreshCw className="w-3 h-3" />
                            إعادة
                          </button>
                        ) : null}
                        {item.status !== "submitted" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `حذف «${item.file_name || item.id}» من الدفعة؟`,
                                )
                              ) {
                                deleteItem.mutate({ itemId: item.id });
                              }
                            }}
                            className={`${ws.iconButton} w-7 h-7 text-red-500 hover:text-red-700 dark:text-red-300`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visibleItems.length ? (
                <tr>
                  <td colSpan={8} className={`${ws.muted} text-center text-sm py-8`}>
                    {detailQuery.isLoading ? "جاري التحميل…" : "لا بنود بهذه الحالة"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {reviewItem ? (
        <BulkReviewModal
          key={reviewItem.id}
          item={reviewItem}
          contacts={contacts}
          accounts={accounts}
          onClose={() => setReviewItemId(null)}
          onNavigate={openNextReview}
          navigable={reviewableIds.length > 1}
          itemAction={itemAction}
          submitItem={submitItem}
        />
      ) : null}
    </div>
  );
}

// ===== نافذة المراجعة: المستند بجانب البيانات المستخرجة =====
function BulkReviewModal({
  item,
  contacts,
  accounts,
  onClose,
  onNavigate,
  navigable,
  itemAction,
  submitItem,
}) {
  const [draft, setDraft] = useState(() => ({
    invoice_number: "",
    contact_id: null,
    supplier_name: "",
    supplier_vat_number: "",
    invoice_date: "",
    due_date: "",
    currency: "SAR",
    discount: 0,
    notes: "",
    items: [],
    ...(item.draft || {}),
  }));
  const [dirty, setDirty] = useState(false);
  const saveTimerRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const totals = computeDraftTotals(draft);
  const flags = Array.isArray(item.flags) ? item.flags : [];
  const analysisNote = item.analysis?.operator_note || null;
  const isImage = /^image\//.test(item.media_type || "");
  const accountOptions = useMemo(
    () => buildExpenseAccountOptions(accounts),
    [accounts],
  );
  const contactOptions = useMemo(
    () => [
      { value: "", label: "بدون مورد مسجل — اسم حر" },
      ...contacts.map((contact) => ({
        value: String(contact.id),
        label: contact.name,
      })),
    ],
    [contacts],
  );

  const updateDraft = (patch) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setDirty(true);
  };
  const updateLine = (index, patch) => {
    setDraft((previous) => ({
      ...previous,
      items: previous.items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
    setDirty(true);
  };

  // حفظ تلقائي مدين (800ms) — التنقل بين الفواتير لا يضيع التعديلات.
  const flushSave = useCallback(async () => {
    if (!dirty) return;
    setDirty(false);
    try {
      await itemAction.mutateAsync({
        itemId: item.id,
        action: "save_draft",
        draft: draftRef.current,
      });
    } catch (error) {
      toast.error(`فشل حفظ المسودة: ${error.message}`);
      setDirty(true);
    }
  }, [dirty, item.id, itemAction]);

  useEffect(() => {
    if (!dirty) return undefined;
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [dirty, draft, flushSave]);

  const handleApprove = async () => {
    await flushSave();
    try {
      await itemAction.mutateAsync({ itemId: item.id, action: "approve" });
      toast.success("اعتُمدت الفاتورة");
    } catch (error) {
      if (error.duplicate) {
        if (
          window.confirm(`${error.message}\n\nهل تريد الاعتماد رغم التحذير؟`)
        ) {
          try {
            await itemAction.mutateAsync({
              itemId: item.id,
              action: "approve",
              force: true,
            });
            toast.success("اعتُمدت رغم تحذير التكرار");
          } catch (forceError) {
            toast.error(forceError.message);
          }
        }
      } else {
        toast.error(error.message);
      }
    }
  };

  const handleSubmit = async () => {
    // ادفع أي تعديل معلق للخادم أولاً — الإرسال خادمي من المسودة
    // المخزنة، فتعديل لم يُحفظ لن يدخل الفاتورة. الحفظ يسحب الاعتماد
    // (يرجع البند للمراجعة) فيرفض الخادم الإرسال حتى يُعاد الاعتماد —
    // هذا مقصود: لا فاتورة بأرقام لم تُعتمد.
    await flushSave();
    try {
      await submitItem.mutateAsync({ item });
      onClose();
    } catch {
      // الخطأ ظهر في onError — أبق النافذة مفتوحة للمعالجة.
    }
  };

  const busy = itemAction.isPending || submitItem.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={() => {
        flushSave();
        onClose();
      }}
    >
      <div
        className={`${ws.glassSoft} ${ws.card} w-full max-w-[1200px] max-h-[92svh] flex flex-col overflow-hidden`}
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        {/* الرأس */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e2e7e4] dark:border-white/10 shrink-0">
          <StatusPill status={item.status} />
          <div className={`${ws.title} text-sm truncate flex-1`} dir="ltr">
            {item.file_name}
          </div>
          {navigable ? (
            <>
              <button
                type="button"
                onClick={async () => {
                  await flushSave();
                  onNavigate(-1);
                }}
                className={`${ws.iconButton} w-8 h-8`}
                title="الفاتورة السابقة"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await flushSave();
                  onNavigate(1);
                }}
                className={`${ws.iconButton} w-8 h-8`}
                title="الفاتورة التالية"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await flushSave();
              onClose();
            }}
            className={`${ws.iconButton} w-8 h-8`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* التحذيرات */}
        {flags.length || analysisNote ? (
          <div className="px-4 py-2 border-b border-[#e2e7e4] dark:border-white/10 shrink-0 space-y-1">
            {flags.some((flag) => flag.startsWith("duplicate")) ? (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                <Copy className="w-3 h-3 shrink-0" />
                {flags.includes("duplicate_invoice")
                  ? "تحذير: يبدو أن هذه الفاتورة مسجلة مسبقاً في النظام (نفس الرقم والمورد/المبلغ)."
                  : "تحذير: رقم الفاتورة مكرر داخل هذه الدفعة."}
              </div>
            ) : null}
            {analysisNote ? (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                ملاحظة المحلل: {analysisNote}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* الجسم: مستند + نموذج */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
          {/* المستند الأصلي */}
          <div className="hidden lg:block bg-slate-100 dark:bg-black/30 overflow-auto">
            {isImage ? (
              <img
                src={item.file_url}
                alt={item.file_name || "invoice"}
                className="w-full h-auto"
              />
            ) : (
              <iframe
                src={item.file_url}
                title={item.file_name || "invoice"}
                className="w-full h-full min-h-[500px] border-0"
              />
            )}
          </div>

          {/* النموذج */}
          <div className="overflow-y-auto p-4 space-y-4">
            <div className="lg:hidden">
              <a
                href={item.file_url}
                target="_blank"
                rel="noreferrer"
                className={`${ws.btnNeutral} px-3 py-1.5 text-xs inline-flex`}
              >
                <FileText className="w-3.5 h-3.5" />
                عرض المستند الأصلي
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={`${ws.muted} text-[11px] font-bold block mb-1`}>
                  رقم الفاتورة
                </span>
                <input
                  type="text"
                  value={draft.invoice_number || ""}
                  onChange={(event) =>
                    updateDraft({ invoice_number: event.target.value })
                  }
                  className={`${ws.input} px-2.5 py-1.5 text-sm text-left`}
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className={`${ws.muted} text-[11px] font-bold block mb-1`}>
                  العملة
                </span>
                <GlassSelect
                  value={draft.currency || "SAR"}
                  onChange={(value) => updateDraft({ currency: value })}
                  options={CURRENCIES.map((code) => ({
                    value: code,
                    label: code,
                  }))}
                />
              </label>
              <label className="block col-span-2">
                <span className={`${ws.muted} text-[11px] font-bold block mb-1`}>
                  المورد
                </span>
                <GlassSelect
                  value={draft.contact_id ? String(draft.contact_id) : ""}
                  onChange={(value) => {
                    const contact = contacts.find(
                      (entry) => String(entry.id) === value,
                    );
                    updateDraft({
                      contact_id: value ? Number(value) : null,
                      supplier_name: contact?.name || draft.supplier_name,
                    });
                  }}
                  options={contactOptions}
                  placeholder="اختر المورد"
                />
                {!draft.contact_id ? (
                  <input
                    type="text"
                    value={draft.supplier_name || ""}
                    onChange={(event) =>
                      updateDraft({ supplier_name: event.target.value })
                    }
                    placeholder="اسم المورد (حر)"
                    className={`${ws.input} px-2.5 py-1.5 text-sm mt-1.5`}
                  />
                ) : null}
                {!draft.contact_id && draft.supplier_vat_number ? (
                  <div className={`${ws.muted} text-[10px] mt-1`} dir="ltr">
                    VAT: {draft.supplier_vat_number}
                  </div>
                ) : null}
              </label>
              <label className="block">
                <span className={`${ws.muted} text-[11px] font-bold block mb-1`}>
                  تاريخ الفاتورة
                </span>
                <input
                  type="date"
                  value={draft.invoice_date || ""}
                  onChange={(event) =>
                    updateDraft({ invoice_date: event.target.value })
                  }
                  className={`${ws.input} px-2.5 py-1.5 text-sm`}
                />
              </label>
              <label className="block">
                <span className={`${ws.muted} text-[11px] font-bold block mb-1`}>
                  تاريخ الاستحقاق
                </span>
                <input
                  type="date"
                  value={draft.due_date || ""}
                  onChange={(event) =>
                    updateDraft({ due_date: event.target.value })
                  }
                  className={`${ws.input} px-2.5 py-1.5 text-sm`}
                />
              </label>
            </div>

            {/* البنود */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`${ws.title} text-sm`}>البنود</span>
                <button
                  type="button"
                  onClick={() =>
                    updateDraft({
                      items: [
                        ...(draft.items || []),
                        {
                          description: "",
                          account_id: null,
                          quantity: 1,
                          unit_price: 0,
                          tax_rate: 15,
                          amount_includes_tax: false,
                        },
                      ],
                    })
                  }
                  className={`${ws.btnNeutral} px-2.5 py-1 text-[11px]`}
                >
                  <Plus className="w-3 h-3" />
                  بند
                </button>
              </div>
              <div className="space-y-2">
                {(draft.items || []).map((line, index) => {
                  const lineTotals = computeDraftTotals({
                    items: [line],
                    discount: 0,
                  });
                  return (
                    <div
                      key={index}
                      className={`${ws.glass} rounded-[10px] p-2.5 space-y-2`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={line.description || ""}
                          onChange={(event) =>
                            updateLine(index, {
                              description: event.target.value,
                            })
                          }
                          placeholder="وصف البند"
                          className={`${ws.input} px-2.5 py-1.5 text-sm flex-1`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft({
                              items: draft.items.filter(
                                (_, lineIndex) => lineIndex !== index,
                              ),
                            })
                          }
                          className={`${ws.iconButton} w-7 h-7 text-red-500 dark:text-red-300 shrink-0`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 items-end">
                        <label className="block">
                          <span className={`${ws.muted} text-[10px] block mb-0.5`}>
                            الكمية
                          </span>
                          <input
                            type="number"
                            step="any"
                            value={line.quantity ?? ""}
                            onChange={(event) =>
                              updateLine(index, {
                                quantity: event.target.value,
                              })
                            }
                            className={`${ws.input} px-2 py-1 text-xs text-left`}
                            dir="ltr"
                          />
                        </label>
                        <label className="block">
                          <span className={`${ws.muted} text-[10px] block mb-0.5`}>
                            سعر الوحدة
                          </span>
                          <input
                            type="number"
                            step="any"
                            value={line.unit_price ?? ""}
                            onChange={(event) =>
                              updateLine(index, {
                                unit_price: event.target.value,
                              })
                            }
                            className={`${ws.input} px-2 py-1 text-xs text-left`}
                            dir="ltr"
                          />
                        </label>
                        <label className="block">
                          <span className={`${ws.muted} text-[10px] block mb-0.5`}>
                            الضريبة %
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max="100"
                            value={line.tax_rate ?? 15}
                            onChange={(event) =>
                              updateLine(index, {
                                tax_rate: event.target.value,
                              })
                            }
                            className={`${ws.input} px-2 py-1 text-xs text-left`}
                            dir="ltr"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            updateLine(index, {
                              amount_includes_tax: !line.amount_includes_tax,
                            })
                          }
                          className={`px-2 py-1 rounded-[8px] border text-[10px] font-bold ${
                            line.amount_includes_tax
                              ? "bg-[#0b3d31]/10 text-[#0b3d31] border-[#0b3d31]/25 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/30"
                              : "bg-white text-[#4a5568] border-[#e2e7e4] dark:bg-white/[0.04] dark:text-white/60 dark:border-white/10"
                          }`}
                        >
                          {line.amount_includes_tax ? "شامل الضريبة" : "خالٍ من الضريبة"}
                        </button>
                      </div>
                      <div className="col-span-2">
                        <GlassSelect
                          value={line.account_id ? String(line.account_id) : ""}
                          onChange={(value) =>
                            updateLine(index, {
                              account_id: value ? Number(value) : null,
                            })
                          }
                          options={accountOptions}
                          placeholder="حساب المصروف"
                        />
                      </div>
                      <div
                        className={`${ws.muted} text-[10px] text-left font-mono`}
                        dir="ltr"
                      >
                        = {money(lineTotals.total)}
                      </div>
                    </div>
                  );
                })}
                {!(draft.items || []).length ? (
                  <div className={`${ws.muted} text-xs text-center py-3`}>
                    لا بنود — أضف بنداً واحداً على الأقل
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={`${ws.muted} text-[11px] font-bold block mb-1`}>
                  خصم قبل الضريبة
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={draft.discount ?? 0}
                  onChange={(event) =>
                    updateDraft({ discount: event.target.value })
                  }
                  className={`${ws.input} px-2.5 py-1.5 text-sm text-left`}
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className={`${ws.muted} text-[11px] font-bold block mb-1`}>
                  ملاحظات
                </span>
                <input
                  type="text"
                  value={draft.notes || ""}
                  onChange={(event) => updateDraft({ notes: event.target.value })}
                  className={`${ws.input} px-2.5 py-1.5 text-sm`}
                />
              </label>
            </div>

            {/* الإجماليات الحية */}
            <div className={`${ws.glass} rounded-[10px] p-3 grid grid-cols-4 gap-2 text-center`}>
              {[
                { label: "الصافي", value: totals.subtotal },
                { label: "الخصم", value: totals.discount },
                { label: "الضريبة", value: totals.tax },
                { label: "الإجمالي", value: totals.total, strong: true },
              ].map((cell) => (
                <div key={cell.label}>
                  <div className={`${ws.muted} text-[10px]`}>{cell.label}</div>
                  <div
                    className={`font-mono text-sm ${cell.strong ? "font-bold text-[#0b3d31] dark:text-emerald-200" : ""}`}
                    dir="ltr"
                  >
                    {money(cell.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* التذييل: الإجراءات */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[#e2e7e4] dark:border-white/10 shrink-0">
          <div className={`${ws.muted} text-[11px] flex-1`}>
            {dirty || itemAction.isPending
              ? "جاري الحفظ…"
              : "المسودة محفوظة تلقائياً"}
          </div>
          {item.status !== "approved" ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy}
              className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-50`}
            >
              <CheckCircle2 className="w-4 h-4" />
              اعتماد
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-50`}
            >
              {submitItem.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              إرسال إلى الفواتير
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
