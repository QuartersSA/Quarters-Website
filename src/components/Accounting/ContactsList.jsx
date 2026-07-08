"use client";

import React from "react";
import {
  Pencil,
  Trash2,
  Contact,
  Hash,
  MapPin,
  CheckCircle2,
  ScanEye,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

const COUNTRY_LABELS = {
  SA: "السعودية",
  AE: "الإمارات",
  BH: "البحرين",
  KW: "الكويت",
  OM: "عُمان",
  QA: "قطر",
  EG: "مصر",
  JO: "الأردن",
  LB: "لبنان",
  TR: "تركيا",
  OTHER: "أخرى",
};

export default function ContactsList({
  contacts,
  isLoading,
  onEdit,
  onDelete,
  onAdd,
  onView = null,
}) {
  if (isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري التحميل…
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
        <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
          <Contact className="w-6 h-6 text-slate-500 dark:text-white/50" />
        </div>
        <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          لا توجد جهات اتصال بعد
        </div>
        <div className="text-sm text-slate-600 dark:text-white/60 mt-1 mb-4">
          أضف أول جهة اتصال (مورد، شريك، مكتب، …) للبدء.
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={`${ws.btnPrimary} px-4 py-2`}
        >
          + إضافة جهة اتصال
        </button>
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
                اسم المنشأة
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                البلد
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                التسجيل الضريبي
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                رقم الضريبة
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                الضريبة الافتراضية
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                الحالة
              </th>
              <th className="py-3 px-3" style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const isActive = c.is_active !== false;
              const country = c.country
                ? COUNTRY_LABELS[c.country] || c.country
                : "—";
              return (
                <tr
                  key={c.id}
                  className="border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                >
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {c.name}
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap">
                    {country !== "—" ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {country}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {c.vat_registered ? (
                      <span
                        className={`${ws.pill} bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        مسجلة
                      </span>
                    ) : (
                      <span
                        className={`${ws.pill} bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10`}
                      >
                        غير مسجلة
                      </span>
                    )}
                  </td>
                  <td
                    className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap font-mono"
                    dir="ltr"
                  >
                    {c.vat_number ? (
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {c.vat_number}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className="py-3 px-3 text-slate-700 dark:text-white/75 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {Number(c.default_tax_rate || 0).toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`${ws.pill} ${
                        isActive
                          ? "bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25"
                          : "bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-white/50 border-slate-200 dark:border-white/10"
                      }`}
                    >
                      {isActive ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-end gap-1">
                      {onView ? (
                        <button
                          type="button"
                          onClick={() => onView(c)}
                          className={`${ws.iconButton} w-8 h-8 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:border-emerald-200 dark:hover:border-emerald-500/30 hover:text-emerald-700 dark:hover:text-emerald-200`}
                          title="بطاقة المورد 360°"
                        >
                          <ScanEye className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onEdit(c)}
                        className={`${ws.iconButton} w-8 h-8`}
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
                        className={`${ws.iconButton} w-8 h-8 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 hover:text-red-700 dark:hover:text-red-200`}
                        title="حذف"
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
