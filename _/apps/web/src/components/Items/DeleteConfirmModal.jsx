import { Trash2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function DeleteConfirmModal({
  item,
  onConfirm,
  onCancel,
  deleteMutation,
}) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      dir="rtl"
    >
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-md shadow-2xl border border-red-500/25`}
      >
        <div className={`p-6 border-b ${ws.divider}`}>
          <h3 className="text-xl font-bold text-white flex items-center gap-3 tracking-tight">
            <div className={`${ws.iconBox} w-10 h-10 text-red-200`}>
              <Trash2 className="w-5 h-5" />
            </div>
            تأكيد الحذف
          </h3>
        </div>

        <div className="p-6">
          <p className="text-white/80 mb-4">
            هل أنت متأكد من حذف الصنف{" "}
            <span className="font-bold text-white">"{item.name}"</span>؟
          </p>
          <p className="text-amber-200 text-sm flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
            <span className="text-lg">⚠️</span>
            <span>لا يمكن حذف الصنف إذا كان مرتبطاً بعمليات جرد</span>
          </p>

          {deleteMutation.error ? (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/25 rounded-2xl">
              <p className="text-red-200 text-sm">
                {deleteMutation.error.message}
              </p>
            </div>
          ) : null}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleteMutation.isPending}
              className={`${ws.btnDanger} flex-1 px-6 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {deleteMutation.isPending ? "جاري الحذف…" : "نعم، احذف"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={`${ws.btnNeutral} px-6 py-3 justify-center`}
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
