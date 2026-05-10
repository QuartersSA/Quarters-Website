import { Plus, Banknote, Sparkles } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";

/**
 * Sticky top bar for the expenses page.
 * Stays visible across all tabs so the operator can add an expense
 * from any view in two clicks (open sheet → save).
 *
 * Layout:
 *   [+ إضافة مصروف سريع]  [الشهر ▾]  [إجمالي الشهر: SAR]  [+ تصنيفات الكوفي]?
 */
export function QuickAddBar({
  month,
  onMonthChange,
  monthOptions,
  totalAmount,
  totalCount,
  onOpenAdd,
  onSeedCategories,
  showSeedButton,
  isSeeding,
}) {
  return (
    <div
      className={`${ws.glassSoft} ${ws.card} p-3 sticky top-0 lg:top-4 z-40 backdrop-blur-xl`}
      dir="rtl"
    >
      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <button
          type="button"
          onClick={onOpenAdd}
          className={`${ws.btnPrimary} px-4 py-2.5 text-sm flex items-center gap-2`}
        >
          <Plus className="w-4 h-4" />
          <span>مصروف سريع</span>
        </button>

        <div className="w-32 sm:w-44">
          <GlassSelect
            value={month}
            onChange={onMonthChange}
            options={monthOptions}
            placeholder="الشهر"
            buttonClassName="text-xs py-2 px-2.5"
          />
        </div>

        <div
          className={`${ws.glass} ${ws.card} px-3 py-2 flex items-center gap-2 flex-1 min-w-0`}
        >
          <Banknote className="w-4 h-4 text-emerald-200 shrink-0" />
          <div className="flex flex-col leading-tight min-w-0">
            <div className="text-[10px] text-white/50 truncate">
              {month
                ? `إجمالي ${monthLabel(month)}`
                : "إجمالي مصروفات الشهر"}
            </div>
            <div className="text-white font-extrabold text-sm" dir="ltr">
              {formatMoney(totalAmount)}{" "}
              <span className="text-white/40 text-[10px] font-normal">
                ({totalCount} مصروف)
              </span>
            </div>
          </div>
        </div>

        {showSeedButton && (
          <button
            type="button"
            onClick={onSeedCategories}
            disabled={isSeeding}
            title="إضافة قائمة تصنيفات شائعة في الكوفيهات (إيجار، رواتب، بن، حليب، ...)"
            className={`${ws.btnNeutral} px-3 py-2 text-xs flex items-center gap-2 disabled:opacity-50`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">
              {isSeeding ? "جاري الإضافة…" : "تصنيفات الكوفي"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
