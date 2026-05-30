"use client";

import React from "react";
import {
  Pencil,
  Trash2,
  HandCoins,
  Building,
  Hash,
  Link as LinkIcon,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function formatIban(iban) {
  if (!iban) return "—";
  // Insert a thin space every 4 chars for readability.
  return String(iban).replace(/(.{4})/g, "$1 ").trim();
}

export default function BeneficiariesList({
  beneficiaries,
  isLoading,
  onEdit,
  onDelete,
  onAdd,
}) {
  if (isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري التحميل…
      </div>
    );
  }

  if (!beneficiaries || beneficiaries.length === 0) {
    return (
      <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
        <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
          <HandCoins className="w-6 h-6 text-slate-500 dark:text-white/50" />
        </div>
        <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          لا يوجد مستفيدون بعد
        </div>
        <div className="text-sm text-slate-600 dark:text-white/60 mt-1 mb-4 max-w-md mx-auto">
          أضف أول مستفيد (حساب بنكي لطرف تتعامل معه) لاستخدامه في
          عمليات الدفع داخل المشتريات.
        </div>
        <button
          type="button"
          onClick={onAdd}
          className={`${ws.btnPrimary} px-4 py-2`}
        >
          + إضافة مستفيد
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
                اسم المستفيد
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                جهة الاتصال
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                الآيبان
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                البنك
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                العملة
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                SWIFT
              </th>
              <th className="text-right font-semibold py-3 px-3 whitespace-nowrap">
                الحالة
              </th>
              <th className="py-3 px-3" style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {beneficiaries.map((b) => {
              const isActive = b.is_active !== false;
              return (
                <tr
                  key={b.id}
                  className="border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                >
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                    {b.name}
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap">
                    {b.contact_name ? (
                      <span className="inline-flex items-center gap-1">
                        <LinkIcon className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                        {b.contact_name}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-white/40">
                        — مستقل —
                      </span>
                    )}
                  </td>
                  <td
                    className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap font-mono text-xs"
                    dir="ltr"
                  >
                    {formatIban(b.iban)}
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap">
                    {b.bank_name ? (
                      <span className="inline-flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {b.bank_name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap font-mono"
                    dir="ltr"
                  >
                    {b.currency || "SAR"}
                  </td>
                  <td
                    className="py-3 px-3 text-slate-700 dark:text-white/70 whitespace-nowrap font-mono text-xs"
                    dir="ltr"
                  >
                    {b.swift ? (
                      <span className="inline-flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {b.swift}
                      </span>
                    ) : (
                      "—"
                    )}
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
                      <button
                        type="button"
                        onClick={() => onEdit(b)}
                        className={`${ws.iconButton} w-8 h-8`}
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(b)}
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
