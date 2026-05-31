import { ArrowRight, Circle, GitBranch, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function TaskModalHeader({
  mode,
  onClose,
  isSubtask,
  parentTaskTitle,
  onGoToParent,
}) {
  const titleText = mode === "edit" ? "تعديل المهمة" : "إضافة مهمة";

  return (
    <div className="p-5 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`${ws.iconBox} w-10 h-10 ${isSubtask ? "!bg-violet-500/15 !border-violet-400/20" : ""}`}
          >
            {isSubtask ? (
              <GitBranch className="w-5 h-5 text-violet-300" />
            ) : (
              <Circle className="w-5 h-5 text-slate-700 dark:text-white/70" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {isSubtask ? "تعديل مهمة فرعية" : titleText}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 truncate">
              {isSubtask
                ? "هذه مهمة فرعية مرتبطة بمهمة رئيسية"
                : "عدّل التفاصيل ثم احفظ"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`${ws.iconButton} flex items-center justify-center`}
          aria-label="إغلاق"
        >
          <X className="w-5 h-5 text-slate-900 dark:text-white" />
        </button>
      </div>

      {/* Parent task breadcrumb */}
      {isSubtask && parentTaskTitle ? (
        <button
          type="button"
          onClick={onGoToParent}
          className="mt-3 w-full flex items-center gap-2 rounded-2xl border border-violet-400/15 bg-violet-500/[0.06] px-3.5 py-2.5 hover:bg-violet-500/[0.12] transition-colors text-right"
        >
          <ArrowRight className="w-4 h-4 text-violet-300 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-violet-300/70 font-semibold">
              المهمة الرئيسية
            </div>
            <div className="text-sm text-slate-800 dark:text-white/85 truncate font-semibold">
              {parentTaskTitle}
            </div>
          </div>
        </button>
      ) : null}
    </div>
  );
}
