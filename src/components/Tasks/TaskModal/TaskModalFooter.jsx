import { ws } from "@/components/Workspace/ui";

export function TaskModalFooter({
  mode,
  initialTask,
  canSubmit,
  submitting,
  submitError,
  validationMessage,
  onSubmit,
  onDelete,
}) {
  const submitText = mode === "edit" ? "تحديث المهمة" : "حفظ";
  const allowDelete = mode === "edit" && !!initialTask?.id;

  return (
    <div className="pt-5 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] border-t border-slate-200 dark:border-white/10 flex-shrink-0">
      {submitError ? (
        <div className="mb-3 text-sm text-red-300">{submitError}</div>
      ) : validationMessage ? (
        <div className="mb-3 text-sm text-amber-200">{validationMessage}</div>
      ) : null}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {allowDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className={`${ws.btnDanger} px-4 py-3 justify-center`}
          >
            حذف
          </button>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className={`${ws.btnPrimary} flex-1 justify-center py-3 disabled:opacity-50`}
        >
          {submitting ? "جاري الحفظ…" : submitText}
        </button>
      </div>
    </div>
  );
}
