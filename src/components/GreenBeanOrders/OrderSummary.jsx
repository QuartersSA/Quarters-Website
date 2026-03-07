import React, { useMemo } from "react";
import { formatMoney } from "@/utils/greenBeanOrderUtils";

export function OrderSummary({ totals }) {
  const summarySection = useMemo(() => {
    if (!totals) return null;

    const statItems = [
      {
        label: "عدد أنواع البن",
        value: String(totals.beanTypesCount),
        color: "text-blue-200",
      },
      {
        label: "عدد الخياش",
        value: String(totals.totalBags),
        color: "text-blue-200",
      },
      {
        label: "مجموع الكيلوات",
        value: `${formatMoney(totals.totalKg)} كغ`,
        color: "text-white",
      },
      {
        label: "مجموع الكيلوات الواصلة بعد الهدر",
        value: `${formatMoney(totals.totalReceivedKg)} كغ`,
        color: "text-white",
      },
      {
        label: "كمية الهدر",
        value: `${formatMoney(totals.wasteKg)} كغ (${formatMoney(totals.wastePercent)}%)`,
        color: "text-orange-200",
      },
      {
        label: "إجمالي تكلفة البن (شامل الضريبة)",
        value: `${formatMoney(totals.totalBeanCostIncl)} ر.س`,
        color: "text-white",
      },
      {
        label: "إجمالي تكلفة التحميص (شامل الضريبة)",
        value: `${formatMoney(totals.totalRoastIncl)} ر.س`,
        color: "text-white",
      },
      {
        label: "إجمالي التكلفة الإضافية",
        value: `${formatMoney(totals.totalExtra)} ر.س`,
        color: "text-white",
      },
      {
        label: "متوسط السعر الصافي / كغ",
        value: `${formatMoney(totals.avgPricePerKg)} ر.س`,
        color: "text-emerald-200",
      },
    ];

    return (
      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="text-white font-bold text-sm mb-3">ملخص الطلب</div>
        <div className="flex flex-col gap-2">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-white/55">{item.label}:</span>
              <span className={`font-bold ${item.color}`}>{item.value}</span>
            </div>
          ))}

          <div className="flex items-center justify-between text-sm mt-2 pt-3 border-t border-white/15">
            <span className="text-white font-bold">إجمالي الطلب (شامل):</span>
            <span className="text-emerald-200 font-extrabold text-base">
              {formatMoney(totals.totalGrand)} ر.س
            </span>
          </div>
        </div>
      </div>
    );
  }, [totals]);

  return summarySection;
}
