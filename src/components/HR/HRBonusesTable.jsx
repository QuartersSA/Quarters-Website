"use client";

import React from "react";
import { Gift, Pencil, Trash2, Users } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function formatBonusMonth(value) {
  if (!value) return "-";
  const s = String(value);
  if (s.length >= 7) return s.slice(0, 7);
  return s;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";

  try {
    return new Intl.NumberFormat("ar-SA-u-ca-gregory-nu-latn", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";

  try {
    return new Intl.NumberFormat("ar-SA-u-ca-gregory-nu-latn", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

export function HRBonusesTable({ bonuses, isLoading, onEdit, onDelete }) {
  // ✅ Theme: this table is embedded inside the Payroll page card
  // (so we don't render an extra card wrapper here)

  // ✅ User asked: show percent INSIDE amount cell (10% → 350.00)
  const headerCells = ["الموظف", "الشهر", "المبلغ", "مصدر البونص", "الإجراءات"];

  const tableShell = (body) => (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: 260 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 220 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr className="text-white/70 border-b border-white/10">
            {headerCells.map((h) => (
              <th
                key={h}
                className="text-right font-semibold py-2 px-3 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );

  if (isLoading) {
    return tableShell(
      <tr>
        <td
          colSpan={headerCells.length}
          className="px-6 py-12 text-center text-white/55"
        >
          جاري التحميل…
        </td>
      </tr>,
    );
  }

  if (!bonuses || bonuses.length === 0) {
    return tableShell(
      <tr>
        <td
          colSpan={headerCells.length}
          className="px-6 py-12 text-center text-white/45"
        >
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>لا يوجد بونص</p>
        </td>
      </tr>,
    );
  }

  return tableShell(
    bonuses.map((b) => {
      const employeeName = b.employee_name || "—";
      const monthValue = formatBonusMonth(b.bonus_date);
      const amountValue = formatMoney(b.amount);
      const sourceValue = b.source || b.created_by_employee_name || "—";

      const isPercent =
        b.amount_mode === "percent" ||
        b.amount_mode === "Percent" ||
        (b.amount_percent !== null && b.amount_percent !== undefined);

      const percentValue = isPercent
        ? `${formatPercent(b.amount_percent)}%`
        : null;

      const amountNode = percentValue ? (
        <span className="inline-flex items-center gap-2">
          <span className="text-white/70">{percentValue}</span>
          <span className="text-white/35">→</span>
          <span className="text-emerald-200 font-semibold">{amountValue}</span>
        </span>
      ) : (
        <span className="text-emerald-200 font-semibold">{amountValue}</span>
      );

      return (
        <tr
          key={b.id}
          className="border-t border-white/10 hover:bg-white/[0.04]"
        >
          <td className="py-3 px-3 font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`${ws.iconBox} w-9 h-9 text-white/85 shrink-0`}>
                <Gift className="w-5 h-5" />
              </div>
              <span className="truncate">{employeeName}</span>
            </div>
          </td>

          <td
            className="py-3 px-3 text-white/70 whitespace-nowrap text-right"
            dir="ltr"
          >
            {monthValue}
          </td>

          <td className="py-3 px-3 whitespace-nowrap text-right" dir="ltr">
            {amountNode}
          </td>

          <td className="py-3 px-3 text-white/70 whitespace-nowrap overflow-hidden text-ellipsis">
            {sourceValue}
          </td>

          <td className="py-3 px-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit?.(b)}
                className={`${ws.iconButton} text-sky-200`}
                aria-label="تعديل"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(b.id)}
                className={`${ws.iconButton} text-red-200`}
                aria-label="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      );
    }),
  );
}
