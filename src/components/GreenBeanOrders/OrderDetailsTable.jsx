import React, { useMemo, useCallback } from "react";
import { Save } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatMoney, formatQty } from "@/utils/greenBeanOrderUtils";

export function OrderDetailsTable({
  orderItems,
  receivedById,
  onChangeReceived,
  onSaveReceived,
  isRowSaving,
}) {
  const handleReceivedInputChange = useCallback(
    (e) => {
      const itemId = e.currentTarget?.dataset?.itemId;
      if (!itemId) return;
      onChangeReceived(itemId, e.target.value);
    },
    [onChangeReceived],
  );

  const handleSaveReceivedClick = useCallback(
    (e) => {
      const itemId = e.currentTarget?.dataset?.itemId;
      if (!itemId) return;
      onSaveReceived(itemId);
    },
    [onSaveReceived],
  );

  const tableRows = useMemo(() => {
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return (
        <tr className="bg-white/[0.02] border-t border-white/10">
          <td className="py-3 text-white/60" colSpan={7}>
            لا توجد أصناف.
          </td>
        </tr>
      );
    }

    return orderItems.map((it) => {
      const beanName = it.bean_name_snapshot || it.bean_name_current || "—";
      const receivedValue = receivedById[String(it.id)] ?? "";
      const itemIdText = String(it.id);
      const extraCostKgText =
        it.extra_cost_kg != null ? formatQty(it.extra_cost_kg) : "الكل";

      return (
        <tr key={it.id} className="bg-white/[0.02] border-t border-white/10">
          <td className="py-2 text-white font-semibold truncate">{beanName}</td>
          <td className="py-2 text-white/80">
            {formatMoney(it.price_kg_excl_tax)}
          </td>
          <td className="py-2 text-white/80">
            {formatMoney(it.waste_percent)}
          </td>
          <td className="py-2 text-white/80">{extraCostKgText}</td>
          <td className="py-2 text-white/80">
            {formatQty(it.computed_received_after_waste_kg)}
          </td>
          <td className="py-2 text-emerald-200 font-extrabold">
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
                data-item-id={itemIdText}
                onChange={handleReceivedInputChange}
                placeholder="مثال: 58"
                disabled={isRowSaving}
              />
              <button
                type="button"
                className={`${ws.btnPrimary} px-3 py-2`}
                data-item-id={itemIdText}
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
    orderItems,
    receivedById,
    handleReceivedInputChange,
    handleSaveReceivedClick,
    isRowSaving,
  ]);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col style={{ width: "180px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "120px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "140px" }} />
          <col style={{ width: "160px" }} />
        </colgroup>
        <thead>
          <tr className="text-xs text-white/55">
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
