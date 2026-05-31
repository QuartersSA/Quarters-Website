import { RefreshCw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function ActionsCard({
  mode,
  onChangeMode,
  onRefresh,
  refreshDisabled,
  error,
  success,
  onResetDraft,
  resetDisabled,
}) {
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const createActive = mode === "create";
  const archiveActive = mode === "archive";

  const createBtnClass = `${createActive ? ws.btnPrimary : ws.btnNeutral} px-4 py-2`;
  const archiveBtnClass = `${archiveActive ? ws.btnPrimary : ws.btnNeutral} px-4 py-2`;

  return (
    <div className={cardShell}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-slate-900 dark:text-white font-bold tracking-tight">
            توريد البن الأخضر
          </div>
          <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
            اختر أنواع البن ثم احفظ الطلب ليظهر في الأرشيف حسب التاريخ.
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={onRefresh}
            className={`${ws.btnNeutral} px-4 py-2`}
            disabled={refreshDisabled}
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              className={createBtnClass}
              onClick={() => onChangeMode("create")}
            >
              توريد جديد
            </button>
            <button
              type="button"
              className={archiveBtnClass}
              onClick={() => onChangeMode("archive")}
            >
              الأرشيف
            </button>
          </div>

          {createActive ? (
            <button
              type="button"
              className={`${ws.btnDanger} px-4 py-2`}
              onClick={onResetDraft}
              disabled={resetDisabled}
              title="تفريغ عناصر الطلب"
            >
              تفريغ
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="mt-4 text-red-300">{error}</div> : null}
      {success ? <div className="mt-4 text-emerald-700 dark:text-emerald-200">{success}</div> : null}
    </div>
  );
}
