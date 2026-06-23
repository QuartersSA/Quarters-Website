"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X, Wallet } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import {
  buildRecentMonthOptions,
  formatMoney,
  monthLabel,
} from "@/utils/payrollFormatters";
import { riyadhMonthKeyFromOffset } from "@/utils/dateUtils";

/**
 * Modal for creating / editing an employee loan.
 *
 * Props:
 *   open          — boolean
 *   onClose       — () => void
 *   onSubmit      — (payload) => void
 *   isSubmitting  — boolean
 *   employees     — [{id, name}]
 *   loan          — existing row when editing, null when creating
 */
export default function LoanModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  employees,
  loan,
}) {
  const isEditing = !!loan;

  const [employeeId, setEmployeeId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installments, setInstallments] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Existing loan's start_month, normalized to YYYY-MM, so we can be
  // sure it appears as a real option even if it's outside the default
  // 36-month window (otherwise GlassSelect would render the placeholder
  // and the admin would think the field is empty — and worse, lose the
  // value if they click save without picking again).
  const existingStartMonth = useMemo(() => {
    if (!loan?.start_month) return "";
    return String(loan.start_month).slice(0, 7);
  }, [loan]);

  const monthOptions = useMemo(() => {
    // Drop the leading "اختر الشهر" placeholder — we want an explicit
    // selection on a loan because the installment math depends on it.
    const opts = buildRecentMonthOptions(36).filter((o) => o.value !== "");
    // Add a few future months too so admins can schedule deductions to
    // start later than the current calendar month.
    for (let i = 1; i <= 6; i += 1) {
      const value = riyadhMonthKeyFromOffset(i);
      if (!opts.find((o) => o.value === value)) {
        opts.unshift({ value, label: monthLabel(value) });
      }
    }
    // Make sure the loan's current start_month is selectable even if
    // it's older than 36 months back.
    if (
      existingStartMonth &&
      !opts.find((o) => o.value === existingStartMonth)
    ) {
      opts.push({
        value: existingStartMonth,
        label: monthLabel(existingStartMonth),
      });
    }
    return [{ value: "", label: "اختر الشهر" }, ...opts];
  }, [existingStartMonth]);

  useEffect(() => {
    if (!open) return;
    if (loan) {
      setEmployeeId(String(loan.employee_id || ""));
      setTotalAmount(String(loan.total_amount || ""));
      setInstallments(String(loan.installments_count || ""));
      const sm = loan.start_month
        ? String(loan.start_month).slice(0, 7)
        : "";
      setStartMonth(sm);
      setNote(loan.note || "");
      setIsActive(loan.is_active !== false);
    } else {
      setEmployeeId("");
      setTotalAmount("");
      setInstallments("");
      setStartMonth("");
      setNote("");
      setIsActive(true);
    }
  }, [open, loan]);

  const employeeOptions = [
    { value: "", label: "اختر الموظف" },
    ...(Array.isArray(employees) ? employees : []).map((e) => ({
      value: String(e.id),
      label: e.name,
    })),
  ];

  const totalNum = Number(totalAmount);
  const instNum = Number(installments);
  const monthly =
    Number.isFinite(totalNum) &&
    Number.isFinite(instNum) &&
    totalNum > 0 &&
    instNum > 0
      ? totalNum / instNum
      : 0;

  const canSubmit =
    !isSubmitting &&
    (isEditing ? true : !!employeeId) &&
    totalNum > 0 &&
    instNum > 0 &&
    !!startMonth;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      total_amount: totalNum,
      installments_count: instNum,
      start_month: startMonth,
      note: note ? note.trim() : null,
    };
    if (isEditing) {
      payload.id = loan.id;
      payload.is_active = isActive;
    } else {
      payload.employee_id = Number(employeeId);
    }
    onSubmit(payload);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-lg p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <Wallet className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? "تعديل قرض" : "إضافة قرض / سلفة"}
              </div>
              <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
                يُقسَّم المبلغ على عدد الأقساط ويُخصم تلقائياً كل شهر من
                مسير الرواتب.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isEditing ? (
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">الموظف</div>
              <GlassSelect
                value={employeeId}
                onChange={setEmployeeId}
                options={employeeOptions}
              />
            </div>
          ) : (
            <div className={`${ws.glassSoft} ${ws.card} px-3 py-2`}>
              <div className="text-xs text-slate-600 dark:text-white/55">الموظف</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {loan?.employee_name || `#${loan?.employee_id}`}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">إجمالي القرض</div>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className={`${ws.input} px-3 py-2 text-right`}
                placeholder="0.00"
                step="0.01"
                min="0"
                dir="ltr"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">عدد الأقساط</div>
              <input
                type="number"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className={`${ws.input} px-3 py-2 text-right`}
                placeholder="مثال: 6"
                step="1"
                min="1"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">شهر البداية</div>
            <GlassSelect
              value={startMonth}
              onChange={setStartMonth}
              options={monthOptions}
              placeholder="اختر الشهر"
              buttonClassName="text-sm py-2.5 px-3"
            />
            <div className="text-[11px] text-slate-400 dark:text-white/35 mt-1">
              أول شهر يبدأ الاستقطاع منه — يُخصم القسط الشهري لمدة الأقساط
              المُحددة ابتداءً من هذا الشهر.
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              ملاحظة{" "}
              <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
            </div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${ws.input} px-3 py-2`}
              placeholder="سبب القرض، اتفاق…"
            />
          </div>

          {monthly > 0 ? (
            <div
              className={`${ws.glassSoft} ${ws.card} px-3 py-2 flex items-center justify-between`}
            >
              <span className="text-xs text-slate-600 dark:text-white/60">قسط شهري متوقع</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-200" dir="ltr">
                {formatMoney(monthly)}
              </span>
            </div>
          ) : null}

          {isEditing ? (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-emerald-400"
              />
              <span className="text-sm text-slate-800 dark:text-white/80">
                نشط (يُخصم من مسير الرواتب)
              </span>
            </label>
          ) : null}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              {isEditing ? "حفظ التعديلات" : "إضافة"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-4 py-2`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
