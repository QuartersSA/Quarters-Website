import React, { useMemo, useCallback } from "react";
import { Save } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatMoney, formatQty } from "@/utils/greenBeanOrderUtils";

// Renders one row per bean+params group. When the same bean+price+waste+
// extra+bag_size repeats across multiple bags, they collapse into a single
// row labelled "× N خيشة" with summed received qty. Edits address the
// whole group; the receive-qty hook distributes the input across the
// underlying per-bag DB ids.
export function OrderDetailsTable({
  groupedItems,
  receivedById,
  onChangeReceived,
  onSaveReceived,
  isRowSaving,
}) {
  const handleReceivedInputChange = useCallback(
    (e) => {
      const groupKey = e.currentTarget?.dataset?.groupKey;
      if (!groupKey) return;
      onChangeReceived(groupKey, e.target.value);
    },
    [onChangeReceived],
  );

  const handleSaveReceivedClick = useCallback(
    (e) => {
      const groupKey = e.currentTarget?.dataset?.groupKey;
      if (!groupKey) return;
      onSaveReceived(groupKey);
    },
    [onSaveReceived],
  );

  const tableRows = useMemo(() => {
    if (!Array.isArray(groupedItems) || groupedItems.length === 0) {
      return (
        <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/10">
          <td className="py-3 text-slate-600 dark:text-white/60" colSpan={7}>
            لا توجد أصناف.
          </td>
        </tr>
      );
    }

    return groupedItems.map((g) => {
      const it = g.firstItem;
      const beanName = it.bean_name_snapshot || it.bean_name_current || "—";
      const receivedValue = receivedById[g.groupKey] ?? "";
      const extraCostKgText =
        it.extra_cost_kg != null ? formatQty(it.extra_cost_kg) : "الكل";
      const totalReceivedDisplay = formatQty(g.totalReceived);
      const showBagCount = g.bagCount > 1;

      return (
        <tr
          key={g.groupKey}
          className="bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/10"
        >
          <td className="py-2 text-slate-900 dark:text-white font-semibold truncate">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{beanName}</span>
              {showBagCount ? (
                <span className="text-xs text-emerald-700 dark:text-emerald-200/80 font-bold bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-1.5 py-0.5">
                  × {g.bagCount} خيشة
                </span>
              ) : null}
            </div>
          </td>
          <td className="py-2 text-slate-800 dark:text-white/80">
            {formatMoney(it.price_kg_excl_tax)}
          </td>
          <td className="py-2 text-slate-800 dark:text-white/80">{formatMoney(it.waste_percent)}</td>
          <td className="py-2 text-slate-800 dark:text-white/80">{extraCostKgText}</td>
          <td className="py-2 text-slate-800 dark:text-white/80">{totalReceivedDisplay}</td>
          <td className="py-2 text-emerald-700 dark:text-emerald-200 font-extrabold">
            {formatMoney(it.computed_final_price_per_kg)}
          </td>
          <td className="py-2">
            <div className="flex items-center gap-2">
              <input
                className={`${ws.input} px-3 py-2 w-[110px]`}
                type="number"
                step="0.001"
                inputMode="decimal"
                value={receivedValue}
                data-group-key={g.groupKey}
                onChange={handleReceivedInputChange}
                placeholder={
                  showBagCount
                    ? `إجمالي ${g.bagCount} خياشات`
                    : "مثال: 58"
                }
                disabled={isRowSaving}
                title={
                  showBagCount
                    ? `القيمة المُدخلة تُوزَّع بالتساوي على ${g.bagCount} خياشات`
                    : "كمية الواصل بعد الهدر"
                }
              />
              <button
                type="button"
                className={`${ws.btnPrimary} px-3 py-2`}
                data-group-key={g.groupKey}
                onClick={handleSaveReceivedClick}
                disabled={isRowSaving}
                title="حفظ الكمية الواصلة"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      );
    });
  }, [
    groupedItems,
    receivedById,
    handleReceivedInputChange,
    handleSaveReceivedClick,
    isRowSaving,
  ]);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col style={{ width: "200px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "160px" }} />
        </colgroup>
        <thead>
          <tr className="text-xs text-slate-600 dark:text-white/55">
            <th className="text-right py-2">البن</th>
            <th className="text-right py-2">سعر الكيلو</th>
            <th className="text-right py-2">الهدر %</th>
            <th className="text-right py-2">كمية الإضافي</th>
            <th className="text-right py-2">الواصل</th>
            <th className="text-right py-2">السعر الصافي/كغ</th>
            <th className="text-right py-2">تعديل الواصل</th>
          </tr>
        </thead>
        <tbody>{tableRows}</tbody>
      </table>
    </div>
  );
}
