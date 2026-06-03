import { Plus, RefreshCw } from "lucide-react";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { ws } from "@/components/Workspace/ui";

export function BeanSelector({
  calculatorMode,
  selectedId,
  setSelectedId,
  newName,
  handleChangeNewName,
  onAdd,
  handleRefresh,
  refreshDisabled,
  addDisabled,
  beanOptions,
  beansStatusBlock,
  errorBlock,
  successBlock,
}) {
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const selectDisabled = calculatorMode !== "register";

  return (
    <div className={cardShell}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-slate-900 dark:text-white font-bold tracking-tight">البن الأخضر</div>
          <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
            إضافة اسم فقط، ثم اختره واملأ الأسعار. (الضريبة 15%)
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className={`${ws.btnNeutral} px-4 py-2`}
          disabled={refreshDisabled}
        >
          <RefreshCw className="w-4 h-4" />
          تحديث
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            اختر البن (في وضع التسجيل)
          </label>
          <GlassSelect
            value={selectedId}
            onChange={setSelectedId}
            options={beanOptions}
            disabled={selectDisabled}
          />
          {selectDisabled ? (
            <div className="mt-2 text-xs text-slate-400 dark:text-white/40">
              أنت الآن في وضع "تسعير فقط" — اختيار البن معطّل حتى لا يرتبط
              التسعير باسم.
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            إضافة بن جديد (اسم فقط)
          </label>
          <div className="flex gap-2">
            <input
              className={`${ws.input} px-4 py-2.5`}
              value={newName}
              onChange={handleChangeNewName}
              placeholder="مثال: كولومبيا"
            />
            <button
              type="button"
              onClick={onAdd}
              disabled={addDisabled}
              className={`${ws.btnPrimary} px-4 py-2.5 justify-center whitespace-nowrap`}
            >
              <Plus className="w-4 h-4" />
              إضافة
            </button>
          </div>
        </div>
      </div>

      {beansStatusBlock}
      {errorBlock}
      {successBlock}
    </div>
  );
}
