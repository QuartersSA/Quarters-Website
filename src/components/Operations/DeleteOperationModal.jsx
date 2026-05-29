import {
  Trash2,
  X,
  AlertTriangle,
  ArrowLeftRight,
  PackagePlus,
  ClipboardList,
  FolderOpen,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function getTypeLabel(type) {
  if (type === "Daily") return "جرد يومي";
  if (type === "Weekly") return "جرد أسبوعي";
  if (type === "Transfer") return "تحويل";
  if (type === "Receipt") return "وارد";
  if (type === "Opening") return "مخزون افتتاحي";
  return type || "عملية";
}

function getTypeIcon(type) {
  if (type === "Transfer") return <ArrowLeftRight className="w-5 h-5" />;
  if (type === "Receipt") return <PackagePlus className="w-5 h-5" />;
  if (type === "Opening") return <FolderOpen className="w-5 h-5" />;
  return <ClipboardList className="w-5 h-5" />;
}

function getWarningText(type) {
  if (type === "Receipt") {
    return "حذف هذا الوارد سيخصم الكمية من المخزون الحالي تلقائياً.";
  }
  if (type === "Transfer") {
    return "حذف هذا التحويل سيحذف عملية الإرسال والاستلام معاً، وسيُعاد حساب المخزون للفرعين.";
  }
  if (type === "Opening") {
    return "حذف المخزون الافتتاحي سيُزيل نقطة البداية لهذه الفترة وقد يؤثر على حسابات الفرق.";
  }
  return "حذف هذا الجرد سيُعيد حساب المخزون بناءً على آخر جرد سابق + الواردات بعده.";
}

export default function DeleteOperationModal({
  operation,
  onConfirm,
  onCancel,
  isPending,
  error,
}) {
  if (!operation) return null;

  const typeLabel = getTypeLabel(operation.inventory_type);
  const typeIcon = getTypeIcon(operation.inventory_type);
  const warningText = getWarningText(operation.inventory_type);

  const isReceipt = operation.inventory_type === "Receipt";
  const isTransfer = operation.inventory_type === "Transfer";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
      dir="rtl"
    >
      <div className={`${ws.glass} ${ws.card} max-w-lg w-full`}>
        {/* Header */}
        <div
          className={`p-6 flex items-center justify-between border-b ${ws.divider}`}
        >
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className={`${ws.iconBox} w-10 h-10 text-red-700 dark:text-red-200`}>
              <Trash2 className="w-5 h-5" />
            </span>
            <span>حذف العملية</span>
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className={ws.iconButton}
            aria-label="إغلاق"
            disabled={isPending}
          >
            <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Operation info */}
          <div
            className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-2xl p-4`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isReceipt
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : isTransfer
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-200"
                      : "bg-sky-500/10 text-sky-700 dark:text-sky-200"
                }`}
              >
                {typeIcon}
              </div>
              <div>
                <p className="text-slate-900 dark:text-white font-semibold">{typeLabel}</p>
                <p className="text-slate-500 dark:text-white/50 font-mono text-xs">
                  {operation.inventory_number}
                </p>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              {operation.branch_name ? (
                <p className="text-slate-600 dark:text-white/60">
                  <span className="text-slate-500 dark:text-white/40">الفرع: </span>
                  <span className="text-white/80">{operation.branch_name}</span>
                </p>
              ) : null}
              {isReceipt && operation.receipt_item_name ? (
                <p className="text-slate-600 dark:text-white/60">
                  <span className="text-slate-500 dark:text-white/40">الصنف: </span>
                  <span className="text-white/80">
                    {operation.receipt_item_name} ({operation.receipt_quantity})
                  </span>
                </p>
              ) : null}
              {!isReceipt && operation.employee_name ? (
                <p className="text-slate-600 dark:text-white/60">
                  <span className="text-slate-500 dark:text-white/40">الموظف: </span>
                  <span className="text-white/80">
                    {operation.employee_name}
                  </span>
                </p>
              ) : null}
              {isTransfer && operation.transfer_branch_name ? (
                <p className="text-slate-600 dark:text-white/60">
                  <span className="text-slate-500 dark:text-white/40">الفرع الآخر: </span>
                  <span className="text-white/80">
                    {operation.transfer_branch_name}
                  </span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 dark:text-red-200 font-semibold text-sm mb-1">
                تحذير: لا يمكن التراجع عن هذا الإجراء
              </p>
              <p className="text-red-700 dark:text-red-200/70 text-sm">{warningText}</p>
            </div>
          </div>

          {/* Error */}
          {error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-red-700 dark:text-red-200 text-sm text-center">
              {error}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t ${ws.divider} flex items-center gap-3`}>
          <button
            type="button"
            onClick={onCancel}
            className={`${ws.btnNeutral} flex-1 px-4 py-3 justify-center`}
            disabled={isPending}
          >
            <span>إلغاء</span>
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`${ws.btnDanger} flex-1 px-4 py-3 justify-center`}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-red-200/60 border-t-transparent rounded-full animate-spin" />
                <span>جاري الحذف…</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
