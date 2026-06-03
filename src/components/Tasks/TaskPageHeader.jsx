import { Plus, CheckSquare } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function TaskPageHeader({ onOpenCreate }) {
  return (
    <>
      {/* Mobile top bar */}
      <div className={`lg:hidden sticky top-0 z-20 ${ws.topBar}`}>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <CheckSquare className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
                المهام
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 truncate">
                مهامك + مهام الفريق
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            className={`${ws.btnPrimary} px-3 py-2`}
          >
            <Plus className="w-4 h-4" />
            إضافة
          </button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={ws.iconBox}>
            <CheckSquare className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              المهام
            </div>
            <div className="text-slate-600 dark:text-white/55 mt-1">مهامك + مهام الفريق</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCreate}
          className={`${ws.btnPrimary} px-4 py-3`}
        >
          <Plus className="w-5 h-5" />
          إضافة مهمة
        </button>
      </div>
    </>
  );
}
