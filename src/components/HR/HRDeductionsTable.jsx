"use client";

import React from "react";
import {
  DollarSign,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function formatIsoDate(value) {
  if (!value) return "-";
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";

  try {
    return new Intl.NumberFormat("ar-SA-u-nu-latn", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

export function HRDeductionsTable({ deductions, isLoading, onEdit, onDelete }) {
  const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

  const headerCells = [
    "الموظف",
    "تاريخ المخالفة",
    "تصنيف المخالفة",
    "السبب",
    "المبلغ",
    "مصدر المخالفة",
    "مرفق",
    "الإجراءات",
  ];

  if (isLoading) {
    return (
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.04]">
                {headerCells.map((h) => (
                  <th
                    key={h}
                    className="text-right px-5 py-4 text-sm font-semibold text-white/55 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={headerCells.length}
                  className="px-6 py-12 text-center text-white/55"
                >
                  جاري التحميل…
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!deductions || deductions.length === 0) {
    return (
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.04]">
                {headerCells.map((h) => (
                  <th
                    key={h}
                    className="text-right px-5 py-4 text-sm font-semibold text-white/55 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={headerCells.length}
                  className="px-6 py-12 text-center text-white/45"
                >
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>لا يوجد خصميات</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={sectionCard}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.04]">
              {headerCells.map((h) => (
                <th
                  key={h}
                  className="text-right px-5 py-4 text-sm font-semibold text-white/55 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {deductions.map((d) => {
              const employeeName = d.employee_name || "-";
              const dateValue = formatIsoDate(d.violation_date);
              const categoryValue = d.violation_category || "-";
              const reasonValue = d.reason || "-";
              const amountValue = formatMoney(d.amount);
              // UPDATED: "مصدر المخالفة" = username of the user who entered it (fallbacks for old data)
              const sourceValue = d.source || d.created_by_employee_name || "-";
              const imagesArr = Array.isArray(d.images) ? d.images : [];
              const firstImageUrl = imagesArr[0]?.url || d.image_url || null;
              const imagesCount = imagesArr.length || (d.image_url ? 1 : 0);
              const hasImage = !!firstImageUrl;

              return (
                <tr
                  key={d.id}
                  className="border-t border-white/5 hover:bg-white/[0.05] transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className={`${ws.iconBox} w-10 h-10 text-white/85`}>
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <span className="text-white font-medium truncate">
                        {employeeName}
                      </span>
                    </div>
                  </td>

                  <td
                    className="px-5 py-4 text-white/75 whitespace-nowrap"
                    dir="ltr"
                  >
                    {dateValue}
                  </td>

                  <td className="px-5 py-4 text-white/75 whitespace-nowrap">
                    {categoryValue}
                  </td>

                  <td className="px-5 py-4 text-white/70 min-w-[240px]">
                    <div className="truncate" title={reasonValue}>
                      {reasonValue}
                    </div>
                  </td>

                  <td
                    className="px-5 py-4 text-white/75 whitespace-nowrap"
                    dir="ltr"
                  >
                    {amountValue}
                  </td>

                  <td className="px-5 py-4 text-white/75 whitespace-nowrap">
                    {sourceValue}
                  </td>

                  <td className="px-5 py-4">
                    {hasImage ? (
                      <a
                        href={firstImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${ws.iconButton} text-emerald-200 inline-flex items-center gap-1`}
                        aria-label="عرض المرفق"
                        title={
                          imagesCount > 1
                            ? `عرض المرفقات (${imagesCount})`
                            : "عرض المرفق"
                        }
                      >
                        <ImageIcon className="w-4 h-4" />
                        {imagesCount > 1 ? (
                          <span className="text-xs font-semibold">
                            {imagesCount}
                          </span>
                        ) : null}
                      </a>
                    ) : (
                      <span className="text-white/30">-</span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(d)}
                        className={`${ws.iconButton} inline-flex items-center justify-center text-sky-200`}
                        aria-label="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(d.id)}
                        className={`${ws.iconButton} inline-flex items-center justify-center text-red-200`}
                        aria-label="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
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
