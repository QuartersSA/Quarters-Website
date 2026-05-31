import { Trash2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { formatMoney, formatQty } from "@/utils/greenBeanOrderUtils";

export function OrderItemRow({
  idx,
  line,
  computed,
  beanOptions,
  onUpdate,
  onRemove,
  canRemove,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden bg-slate-50/50 dark:bg-white/[0.02]">
      <div className="px-4 py-3 flex items-center justify-between gap-2 bg-slate-50 dark:bg-white/[0.03]">
        <div className="text-slate-800 dark:text-white/80 font-semibold">صنف #{idx + 1}</div>
        <button
          type="button"
          className={`${ws.btnDanger} px-3 py-2`}
          onClick={() => onRemove(idx)}
          disabled={!canRemove}
        >
          <Trash2 className="w-4 h-4" />
          حذف
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            نوع البن
          </label>
          <GlassSelect
            value={line.beanId}
            onChange={(v) => onUpdate(idx, { beanId: v })}
            options={beanOptions}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            سعر الكيلو الخام (Excl. tax)
          </label>
          <input
            className={`${ws.input} px-4 py-2.5`}
            type="number"
            step="0.01"
            inputMode="decimal"
            value={line.priceKgExclTax}
            onChange={(e) => onUpdate(idx, { priceKgExclTax: e.target.value })}
            placeholder="مثال: 35"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            حجم الخيشة (كغ)
          </label>
          <input
            className={`${ws.input} px-4 py-2.5`}
            type="number"
            step="0.001"
            inputMode="decimal"
            value={line.bagSizeKg}
            onChange={(e) => onUpdate(idx, { bagSizeKg: e.target.value })}
            placeholder="مثال: 60"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            نسبة الهدر %
          </label>
          <input
            className={`${ws.input} px-4 py-2.5`}
            type="number"
            step="0.01"
            inputMode="decimal"
            value={line.wastePercent}
            onChange={(e) => onUpdate(idx, { wastePercent: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            تكلفة التحميص للكيلو (شامل الضريبة)
          </label>
          <input
            className={`${ws.input} px-4 py-2.5`}
            type="number"
            step="0.01"
            inputMode="decimal"
            value={line.roastCostInclTax}
            onChange={(e) =>
              onUpdate(idx, { roastCostInclTax: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            تكاليف إضافية للكيلو
          </label>
          <input
            className={`${ws.input} px-4 py-2.5`}
            type="number"
            step="0.01"
            inputMode="decimal"
            value={line.extraCostPerKg}
            onChange={(e) => onUpdate(idx, { extraCostPerKg: e.target.value })}
          />
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-slate-500 dark:text-white/50">الإجمالي (شامل الضريبة)</div>
            <div className="text-slate-900 dark:text-white font-bold mt-1">
              {formatMoney(computed.totalIncl)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-slate-500 dark:text-white/50">الواصل بعد الهدر</div>
            <div className="text-slate-900 dark:text-white font-bold mt-1">
              {formatQty(computed.receivedAfterWaste)}
            </div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-slate-500 dark:text-white/50">سعر الكيلو الصافي</div>
            <div className="text-emerald-200 font-extrabold mt-1">
              {formatMoney(computed.finalPricePerKg)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
