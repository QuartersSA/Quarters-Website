import React, { useCallback, useMemo } from "react";
import { Save, Trash2, Plus, Minus, Pencil, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatMoney } from "@/utils/greenBeanOrderUtils";

export function OrderBuilder({
  draft,
  previewRows,
  onSetOrderField,
  onUpdateItem,
  onRemoveBean,
  onIncrementQty,
  onDecrementQty,
  onSave,
  isSaving,
  error,
  editingOrderId,
  onCancelEdit,
}) {
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const isEditMode = !!editingOrderId;

  const hasItems = Array.isArray(previewRows) && previewRows.length > 0;

  const totals = useMemo(() => {
    let totalBeanCostIncl = 0;
    let totalRoastIncl = 0;
    let totalExtra = 0;
    let totalBags = 0;
    let totalKg = 0;
    let totalReceivedKg = 0;
    let ok = true;

    if (!hasItems) {
      return {
        ok: false,
        totalBeanCostIncl: 0,
        totalRoastIncl: 0,
        totalExtra: 0,
        grandTotal: 0,
        totalBags: 0,
        totalKg: 0,
        totalReceivedKg: 0,
      };
    }

    for (const row of previewRows) {
      const line = row.line;
      const qty = row.qty || 1;

      const price = Number(line.priceKgExclTax);
      const bag = Number(line.bagSizeKg);
      const received = Number(line.receivedAfterWasteKg);

      totalBags += qty;

      if (Number.isFinite(bag) && bag > 0) {
        totalKg += bag * qty;
      }

      if (Number.isFinite(received) && received > 0) {
        totalReceivedKg += received;
      }

      if (
        !Number.isFinite(price) ||
        !Number.isFinite(bag) ||
        price <= 0 ||
        bag <= 0
      ) {
        ok = false;
        continue;
      }

      totalBeanCostIncl += price * 1.15 * bag * qty;

      const roast = Number(line.roastCostInclTax);
      if (Number.isFinite(roast) && roast > 0) {
        totalRoastIncl += roast * bag * qty;
      }

      const extra = Number(line.extraCostPerKg);
      const extraKgRaw = line.extraCostKg;
      const extraKg =
        extraKgRaw !== "" && extraKgRaw != null ? Number(extraKgRaw) : null;
      const effectiveExtraKg =
        extraKg !== null && Number.isFinite(extraKg) ? extraKg : bag;
      if (
        Number.isFinite(extra) &&
        extra > 0 &&
        Number.isFinite(effectiveExtraKg)
      ) {
        totalExtra += extra * effectiveExtraKg * qty;
      }
    }

    totalBeanCostIncl = Math.round(totalBeanCostIncl * 100) / 100;
    totalRoastIncl = Math.round(totalRoastIncl * 100) / 100;
    totalExtra = Math.round(totalExtra * 100) / 100;
    totalKg = Math.round(totalKg * 1000) / 1000;
    totalReceivedKg = Math.round(totalReceivedKg * 1000) / 1000;
    const grandTotal =
      Math.round((totalBeanCostIncl + totalRoastIncl + totalExtra) * 100) / 100;

    return {
      ok,
      totalBeanCostIncl,
      totalRoastIncl,
      totalExtra,
      grandTotal,
      totalBags,
      totalKg,
      totalReceivedKg,
    };
  }, [previewRows, hasItems]);

  const onChangeOrderDate = useCallback(
    (e) => {
      onSetOrderField({ orderDate: e.target.value });
    },
    [onSetOrderField],
  );

  const onChangeSupplier = useCallback(
    (e) => {
      onSetOrderField({ supplierName: e.target.value });
    },
    [onSetOrderField],
  );

  const onChangeNote = useCallback(
    (e) => {
      onSetOrderField({ note: e.target.value });
    },
    [onSetOrderField],
  );

  const handleItemChange = useCallback(
    (e) => {
      const beanId = e.currentTarget?.dataset?.beanId;
      const field = e.currentTarget?.dataset?.field;
      if (!beanId || !field) return;
      onUpdateItem(beanId, { [field]: e.target.value });
    },
    [onUpdateItem],
  );

  const handleRemoveClick = useCallback(
    (e) => {
      const beanId = e.currentTarget?.dataset?.beanId;
      if (!beanId) return;
      onRemoveBean(beanId);
    },
    [onRemoveBean],
  );

  const handlePlusClick = useCallback(
    (e) => {
      const beanId = e.currentTarget?.dataset?.beanId;
      if (!beanId) return;
      onIncrementQty(beanId);
    },
    [onIncrementQty],
  );

  const handleMinusClick = useCallback(
    (e) => {
      const beanId = e.currentTarget?.dataset?.beanId;
      if (!beanId) return;
      onDecrementQty(beanId);
    },
    [onDecrementQty],
  );

  const tableBody = useMemo(() => {
    if (!hasItems) {
      return (
        <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/10">
          <td className="py-3 text-slate-600 dark:text-white/60" colSpan={11}>
            اختر نوع/أنواع البن من القائمة.
          </td>
        </tr>
      );
    }

    return previewRows.map((row) => {
      const beanIdText = String(row.beanId);
      const line = row.line;
      const computed = row.computed;
      const qty = row.qty || 1;

      const wasteText = Number.isFinite(computed?.wastePercent)
        ? `${formatMoney(computed.wastePercent)}%`
        : "—";

      const finalPriceText = formatMoney(computed?.finalPricePerKg);

      return (
        <tr
          key={beanIdText}
          className="bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/10"
        >
          <td className="py-2 text-slate-900 dark:text-white font-semibold truncate">
            {row.beanName}
          </td>
          <td className="py-2">
            <div className="flex items-center gap-1 justify-center">
              <button
                type="button"
                className="w-6 h-6 rounded-md bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:bg-white/20 flex items-center justify-center text-slate-800 dark:text-white/80 transition-colors"
                data-bean-id={beanIdText}
                onClick={handleMinusClick}
                disabled={isSaving}
                title="تقليل"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="min-w-[24px] text-center text-emerald-700 dark:text-emerald-200 font-bold text-sm">
                {qty}
              </span>
              <button
                type="button"
                className="w-6 h-6 rounded-md bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:bg-white/20 flex items-center justify-center text-slate-800 dark:text-white/80 transition-colors"
                data-bean-id={beanIdText}
                onClick={handlePlusClick}
                disabled={isSaving}
                title="زيادة"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </td>
          <td className="py-2">
            <input
              className={`${ws.input} px-3 py-2 w-[120px]`}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={line.priceKgExclTax}
              data-bean-id={beanIdText}
              data-field="priceKgExclTax"
              onChange={handleItemChange}
              placeholder="مثال: 45"
              disabled={isSaving}
            />
          </td>
          <td className="py-2">
            <input
              className={`${ws.input} px-3 py-2 w-[120px]`}
              type="number"
              step="0.001"
              inputMode="decimal"
              value={line.bagSizeKg}
              data-bean-id={beanIdText}
              data-field="bagSizeKg"
              onChange={handleItemChange}
              placeholder="مثال: 60"
              disabled={isSaving}
            />
          </td>
          <td className="py-2">
            <input
              className={`${ws.input} px-3 py-2 w-[140px]`}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={line.roastCostInclTax}
              data-bean-id={beanIdText}
              data-field="roastCostInclTax"
              onChange={handleItemChange}
              placeholder="8.05"
              disabled={isSaving}
            />
          </td>
          <td className="py-2">
            <input
              className={`${ws.input} px-3 py-2 w-[140px]`}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={line.extraCostPerKg}
              data-bean-id={beanIdText}
              data-field="extraCostPerKg"
              onChange={handleItemChange}
              placeholder="0"
              disabled={isSaving}
            />
          </td>
          <td className="py-2">
            <input
              className={`${ws.input} px-3 py-2 w-[140px]`}
              type="number"
              step="0.001"
              inputMode="decimal"
              value={line.extraCostKg}
              data-bean-id={beanIdText}
              data-field="extraCostKg"
              onChange={handleItemChange}
              placeholder="الكل"
              disabled={isSaving}
            />
          </td>
          <td className="py-2">
            <input
              className={`${ws.input} px-3 py-2 w-[150px]`}
              type="number"
              step="0.001"
              inputMode="decimal"
              value={line.receivedAfterWasteKg}
              data-bean-id={beanIdText}
              data-field="receivedAfterWasteKg"
              onChange={handleItemChange}
              placeholder="الواصل"
              disabled={isSaving}
            />
          </td>
          <td className="py-2 text-slate-800 dark:text-white/80">{wasteText}</td>
          <td className="py-2 text-emerald-700 dark:text-emerald-200 font-extrabold">
            {finalPriceText}
          </td>
          <td className="py-2">
            <button
              type="button"
              className={`${ws.btnDanger} px-3 py-2`}
              data-bean-id={beanIdText}
              onClick={handleRemoveClick}
              disabled={isSaving}
              title="إزالة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </td>
        </tr>
      );
    });
  }, [
    hasItems,
    previewRows,
    handleItemChange,
    handleRemoveClick,
    handlePlusClick,
    handleMinusClick,
    isSaving,
  ]);

  const totalBeanCostText = hasItems
    ? formatMoney(totals.totalBeanCostIncl)
    : "—";
  const totalRoastText = hasItems ? formatMoney(totals.totalRoastIncl) : "—";
  const totalExtraText = hasItems ? formatMoney(totals.totalExtra) : "—";
  const grandTotalText = totals.ok ? formatMoney(totals.grandTotal) : "—";
  const totalBagsText = hasItems ? String(totals.totalBags) : "—";
  const totalKgText = hasItems ? formatMoney(totals.totalKg) : "—";
  const totalReceivedKgText = hasItems
    ? formatMoney(totals.totalReceivedKg)
    : "—";

  return (
    <div className={cardShell}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-slate-900 dark:text-white font-bold tracking-tight">
            {isEditMode ? `تعديل الطلب #${editingOrderId}` : "عناصر الطلب"}
          </div>
          <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
            {isEditMode
              ? "عدّل البيانات ثم اضغط حفظ التعديل."
              : "اختر أنواع البن (يسار) ثم اكتب الكميات الواصلة واحفظ الطلب."}
          </div>
        </div>
        {isEditMode && onCancelEdit ? (
          <button
            type="button"
            className={`${ws.btnDanger} px-4 py-2`}
            onClick={onCancelEdit}
            disabled={isSaving}
          >
            <X className="w-4 h-4" />
            إلغاء
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-slate-600 dark:text-white/55 mb-1">تاريخ الطلب</div>
          <input
            className={`${ws.input} px-3 py-2 w-full`}
            type="date"
            value={draft.orderDate}
            onChange={onChangeOrderDate}
            disabled={isSaving}
          />
        </div>
        <div>
          <div className="text-xs text-slate-600 dark:text-white/55 mb-1">المورّد (اختياري)</div>
          <input
            className={`${ws.input} px-3 py-2 w-full`}
            value={draft.supplierName}
            onChange={onChangeSupplier}
            placeholder="اسم المورد"
            disabled={isSaving}
          />
        </div>
        <div>
          <div className="text-xs text-slate-600 dark:text-white/55 mb-1">ملاحظة (اختياري)</div>
          <input
            className={`${ws.input} px-3 py-2 w-full`}
            value={draft.note}
            onChange={onChangeNote}
            placeholder="مثال: توريد صباحي"
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: "160px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "150px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "160px" }} />
            <col style={{ width: "100px" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "60px" }} />
          </colgroup>
          <thead>
            <tr className="text-xs text-slate-600 dark:text-white/55">
              <th className="text-right py-2">البن</th>
              <th className="text-center py-2">عدد الخياش</th>
              <th className="text-right py-2">سعر الكيلو (Excl)</th>
              <th className="text-right py-2">حجم الخيشة (kg)</th>
              <th className="text-right py-2">تحميص/كغ (شامل)</th>
              <th className="text-right py-2">إضافي/كغ</th>
              <th className="text-right py-2">كمية الإضافي (كغ)</th>
              <th className="text-right py-2">الواصل بعد الهدر</th>
              <th className="text-right py-2">الهدر %</th>
              <th className="text-right py-2">السعر الصافي/كغ</th>
              <th className="text-right py-2"> </th>
            </tr>
          </thead>
          <tbody>{tableBody}</tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-slate-700 dark:text-white/75 text-sm">
          <span className="text-slate-600 dark:text-white/55">عدد الخياش:</span>{" "}
          <span className="font-bold">{totalBagsText}</span>
        </div>
        <div className="text-slate-700 dark:text-white/75 text-sm">
          <span className="text-slate-600 dark:text-white/55">مجموع الكيلوات:</span>{" "}
          <span className="font-bold">{totalKgText} كغ</span>
        </div>
        <div className="text-slate-700 dark:text-white/75 text-sm">
          <span className="text-slate-600 dark:text-white/55">
            مجموع الكيلوات الواصلة بعد الهدر:
          </span>{" "}
          <span className="font-bold">{totalReceivedKgText} كغ</span>
        </div>
        <div className="text-slate-700 dark:text-white/75 text-sm">
          <span className="text-slate-600 dark:text-white/55">
            إجمالي تكلفة البن (شامل الضريبة):
          </span>{" "}
          <span className="font-bold">{totalBeanCostText}</span>
        </div>
        <div className="text-slate-700 dark:text-white/75 text-sm">
          <span className="text-slate-600 dark:text-white/55">
            إجمالي تكلفة التحميص (شامل الضريبة):
          </span>{" "}
          <span className="font-bold">{totalRoastText}</span>
        </div>
        <div className="text-slate-700 dark:text-white/75 text-sm">
          <span className="text-slate-600 dark:text-white/55">إجمالي التكلفة الإضافية:</span>{" "}
          <span className="font-bold">{totalExtraText}</span>
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-slate-700 dark:text-white/75">
            <span className="text-slate-600 dark:text-white/55">إجمالي الطلب (شامل):</span>{" "}
            <span className="font-extrabold">{grandTotalText}</span>
          </div>

          <div className="flex items-center gap-2">
            {isEditMode && onCancelEdit ? (
              <button
                type="button"
                className={`${ws.btnNeutral} px-4 py-2`}
                onClick={onCancelEdit}
                disabled={isSaving}
              >
                رجوع
              </button>
            ) : null}
            <button
              type="button"
              className={`${ws.btnPrimary} px-4 py-2`}
              onClick={onSave}
              disabled={isSaving || !hasItems}
            >
              {isEditMode ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isEditMode ? "حفظ التعديل" : "حفظ الطلب"}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="mt-3 text-red-700 dark:text-red-300">{error}</div> : null}
      {isSaving ? <div className="mt-3 text-slate-600 dark:text-white/60">جاري الحفظ…</div> : null}

      <div className="mt-3 text-xs text-slate-500 dark:text-white/45">
        {isEditMode
          ? "سيتم تحديث الطلب واستبدال الأصناف القديمة."
          : "يتم حفظ الطلب كأرشيف بتاريخ الطلب."}
      </div>
    </div>
  );
}
