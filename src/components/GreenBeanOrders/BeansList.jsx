import React, { useCallback, useMemo } from "react";
import { CheckSquare, Square, Plus, Minus } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function BeansList({
  beans,
  selectedBeanIds,
  beanQtyMap,
  onToggleBean,
  onIncrementQty,
  onDecrementQty,
  isLoading,
  error,
}) {
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const selectedSet = useMemo(() => {
    const s = new Set();
    for (const id of selectedBeanIds || []) s.add(String(id));
    return s;
  }, [selectedBeanIds]);

  const onRowClick = useCallback(
    (e) => {
      // don't toggle if clicking +/- buttons
      if (e.target.closest("[data-qty-btn]")) return;
      const id = e.currentTarget?.dataset?.beanId;
      if (!id) return;
      onToggleBean(id);
    },
    [onToggleBean],
  );

  const onPlusClick = useCallback(
    (e) => {
      e.stopPropagation();
      const id = e.currentTarget?.dataset?.beanId;
      if (!id) return;
      onIncrementQty(id);
    },
    [onIncrementQty],
  );

  const onMinusClick = useCallback(
    (e) => {
      e.stopPropagation();
      const id = e.currentTarget?.dataset?.beanId;
      if (!id) return;
      onDecrementQty(id);
    },
    [onDecrementQty],
  );

  let body = null;
  if (isLoading) {
    body = <div className="mt-4 text-slate-600 dark:text-white/60">جاري التحميل…</div>;
  } else if (error) {
    body = <div className="mt-4 text-red-300">{error}</div>;
  } else if (!Array.isArray(beans) || beans.length === 0) {
    body = <div className="mt-4 text-slate-600 dark:text-white/60">لا يوجد بن مسجّل.</div>;
  } else {
    const rows = beans.map((b) => {
      const isSelected = selectedSet.has(String(b.id));
      const qty = beanQtyMap?.[String(b.id)] || 0;
      const rowClass = isSelected
        ? "bg-slate-200 dark:bg-white/10"
        : "bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:bg-white/[0.05]";

      const Icon = isSelected ? CheckSquare : Square;
      const iconClass = isSelected ? "text-emerald-200" : "text-slate-400 dark:text-white/40";

      return (
        <tr
          key={b.id}
          data-bean-id={String(b.id)}
          className={`${rowClass} border-t border-slate-200 dark:border-white/10 cursor-pointer`}
          onClick={onRowClick}
          title="اختيار/إلغاء اختيار"
        >
          <td className="py-2 text-slate-800 dark:text-white/80">
            <div className="flex items-center justify-center">
              <Icon className={`w-5 h-5 ${iconClass}`} />
            </div>
          </td>
          <td className="py-2 text-slate-900 dark:text-white font-semibold truncate">{b.name}</td>
          <td className="py-2">
            {isSelected ? (
              <div className="flex items-center gap-1 justify-center">
                <button
                  type="button"
                  data-qty-btn="true"
                  data-bean-id={String(b.id)}
                  onClick={onMinusClick}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:bg-white/20 flex items-center justify-center text-slate-800 dark:text-white/80 transition-colors"
                  title="تقليل"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="min-w-[28px] text-center text-emerald-200 font-bold text-sm">
                  {qty}
                </span>
                <button
                  type="button"
                  data-qty-btn="true"
                  data-bean-id={String(b.id)}
                  onClick={onPlusClick}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:bg-white/20 flex items-center justify-center text-slate-800 dark:text-white/80 transition-colors"
                  title="زيادة"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
          </td>
        </tr>
      );
    });

    body = (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: "46px" }} />
            <col />
            <col style={{ width: "120px" }} />
          </colgroup>
          <thead>
            <tr className="text-xs text-slate-600 dark:text-white/55">
              <th className="text-right py-2"> </th>
              <th className="text-right py-2">الاسم</th>
              <th className="text-center py-2">عدد الخياش</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cardShell}>
      <div className="text-slate-900 dark:text-white font-bold tracking-tight">أنواع البن</div>
      <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
        اضغط على نوع البن لإضافته، واستخدم + / − لزيادة عدد الخياش.
      </div>

      {body}

      <div className="mt-3 text-xs text-slate-500 dark:text-white/45">
        ملاحظة: إضافة/تعديل أنواع البن يتم من صفحة حاسبة البن الأخضر.
      </div>
    </div>
  );
}
