"use client";

import React from "react";
import { Pencil, Trash2, RotateCcw, Wallet } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";

/**
 * Loans table.
 *
 * Each row shows the loan plan + a small "X / N شهر" progress hint
 * derived from start_month / installments_count. The "monthly_amount"
 * column matches what the payroll route deducts each month.
 */
export default function LoansList({
  loans,
  isLoading,
  onEdit,
  onToggleActive,
  onDelete,
}) {
  if (isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري التحميل…
      </div>
    );
  }

  if (!loans || loans.length === 0) {
    return (
      <div
        className={`${ws.glass} ${ws.card} p-8 text-center text-slate-600 dark:text-white/60`}
      >
        <div
          className={`${ws.iconBox} w-12 h-12 mx-auto mb-3`}
        >
          <Wallet className="w-5 h-5 text-slate-500 dark:text-white/50" />
        </div>
        <div className="text-sm font-semibold text-slate-700 dark:text-white/75">
          لا توجد سلف مسجّلة
        </div>
        <div className="text-xs text-slate-500 dark:text-white/45 mt-1">
          أضف قرضاً جديداً ليُخصم تلقائياً من مسير الرواتب الشهري.
        </div>
      </div>
    );
  }

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-700 dark:text-white/70 text-xs">
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                الموظف
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                إجمالي القرض
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                القسط الشهري
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                الأقساط
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                شهر البداية
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                مدفوع
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                الحالة
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                ملاحظة
              </th>
              <th className="py-3 px-3" style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => {
              const inst = Number(l.installments_count || 0);
              const paid = Math.max(
                0,
                Math.min(inst, Number(l.paid_months_to_date || 0)),
              );
              const remaining = Math.max(0, inst - paid);
              const startMonthShort = l.start_month
                ? String(l.start_month).slice(0, 7)
                : "";
              const isActive = l.is_active !== false;

              return (
                <tr
                  key={l.id}
                  className="border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                >
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {l.employee_name || `#${l.employee_id}`}
                  </td>
                  <td
                    className="py-3 px-3 text-slate-800 dark:text-white/85 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(l.total_amount)}
                  </td>
                  <td
                    className="py-3 px-3 text-emerald-700 dark:text-emerald-200 font-bold whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(l.monthly_amount)}
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-white/75 whitespace-nowrap">
                    {inst} شهر
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap">
                    {startMonthShort
                      ? monthLabel(startMonthShort)
                      : "—"}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-white/75 text-xs">
                        {paid} / {inst}
                      </span>
                      <div className="w-20 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-emerald-400/60"
                          style={{
                            width:
                              inst > 0
                                ? `${Math.round((paid / inst) * 100)}%`
                                : "0%",
                          }}
                        />
                      </div>
                      {remaining === 0 ? (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300/80">
                          مكتمل
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`${ws.pill} ${
                        isActive
                          ? "text-emerald-700 dark:text-emerald-200 border-emerald-400/30 bg-emerald-400/10"
                          : "text-slate-500 dark:text-white/50 border-slate-200 dark:border-white/15 bg-slate-100 dark:bg-white/[0.04]"
                      }`}
                    >
                      {isActive ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td
                    className="py-3 px-3 text-slate-600 dark:text-white/60 text-xs"
                    style={{ maxWidth: 200 }}
                  >
                    <div className="truncate" title={l.note || ""}>
                      {l.note || "—"}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(l)}
                        className={`${ws.iconButton} w-8 h-8`}
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleActive(l)}
                        className={`${ws.iconButton} w-8 h-8`}
                        title={isActive ? "إيقاف" : "إعادة تفعيل"}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(l)}
                        className={`${ws.iconButton} w-8 h-8 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-700 dark:hover:text-red-200`}
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
