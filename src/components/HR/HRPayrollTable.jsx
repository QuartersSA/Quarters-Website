"use client";

import React from "react";
import { Ban, Users } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatMoney } from "@/utils/payrollFormatters";

/**
 * Lightweight payroll table for the HR section.
 *
 * Renders the same per-employee salary breakdown as the accounting
 * payroll page (base / allowances / total / bonuses / deductions /
 * loan / net) but drops the columns that only the accountant uses:
 *   - payment method / paid amount / "✓" toggle
 *   - inline editing of payment state
 *
 * The HR side is responsible for what gets PAID (base, bonuses,
 * deductions, loans, suspensions). When the operator clicks "إرسال
 * إلى المحاسبة" upstream, the same data lands on /accounting/payroll
 * where the accountant handles payment.
 */
export function HRPayrollTable({ entries, isLoading }) {
  const headers = [
    "الموظف",
    "الفرع",
    "الأساسي",
    "البدلات",
    "الإجمالي",
    "البونص",
    "الخصم",
    "السلف",
    "الصافي",
  ];

  const headerRow = (
    <tr className="text-white/70 text-[11px]">
      {headers.map((h) => (
        <th
          key={h}
          className="text-right font-semibold py-2 px-2 whitespace-nowrap"
        >
          {h}
        </th>
      ))}
    </tr>
  );

  if (isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-white/60 text-sm`}>
        جاري التحميل…
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div
        className={`${ws.glass} ${ws.card} p-8 text-center text-white/60`}
      >
        <div className={`${ws.iconBox} w-12 h-12 mx-auto mb-3`}>
          <Users className="w-5 h-5 text-white/50" />
        </div>
        <div className="text-sm font-semibold text-white/75">
          لا توجد بيانات لهذا الشهر
        </div>
        <div className="text-xs text-white/45 mt-1">
          اضغط "إرسال إلى المحاسبة" لبناء المسير من بيانات HR الحالية.
        </div>
      </div>
    );
  }

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>{headerRow}</thead>
          <tbody>
            {entries.map((e) => {
              const isSuspended = !!e.is_suspended;
              const hasLoan = Number(e.loan_deduction || 0) > 0;
              return (
                <tr
                  key={e.id}
                  className={`border-t border-white/10 hover:bg-white/[0.04] ${
                    isSuspended ? "opacity-70" : ""
                  }`}
                >
                  <td
                    className="py-2 px-2 font-semibold text-white whitespace-nowrap"
                    style={{ maxWidth: 200 }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">
                        {e.employee_name || "—"}
                      </span>
                      {isSuspended ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/15 border border-amber-400/30 text-amber-200 shrink-0"
                          title="موظف موقوف هذا الشهر"
                        >
                          <Ban className="w-3 h-3" />
                          موقوف
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-white/70 whitespace-nowrap">
                    {e.branch_name || "—"}
                  </td>
                  <td
                    className="py-2 px-2 text-white/55 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(e.base_salary)}
                  </td>
                  <td
                    className="py-2 px-2 text-white/55 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(e.other_allowances)}
                  </td>
                  <td
                    className="py-2 px-2 text-white/75 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(e.total_salary)}
                  </td>
                  <td
                    className="py-2 px-2 text-emerald-200 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(e.total_bonuses)}
                  </td>
                  <td
                    className="py-2 px-2 text-red-300/80 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(e.total_deductions)}
                  </td>
                  <td
                    className={`py-2 px-2 whitespace-nowrap text-right ${
                      hasLoan ? "text-amber-300/90" : "text-white/30"
                    }`}
                    dir="ltr"
                  >
                    {hasLoan ? formatMoney(e.loan_deduction) : "—"}
                  </td>
                  <td
                    className="py-2 px-2 text-emerald-200 font-bold whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(e.net_salary)}
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
