"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  X,
  Save,
  Calendar,
  CalendarOff,
  Infinity as InfinityIcon,
  RotateCcw,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { buildRecentMonthOptions, monthLabel } from "@/utils/payrollFormatters";
import {
  useEmployeeSuspensions,
  useCreateSuspension,
  useCancelSuspension,
} from "@/hooks/useEmployeeSuspensions";

function formatMonthOrDate(s) {
  if (!s) return "—";
  const str = String(s);
  if (/^\d{4}-\d{2}/.test(str)) {
    return monthLabel(str.slice(0, 7));
  }
  return str;
}

export default function SuspensionModal({ open, onClose, employee }) {
  const employeeId = employee?.id;
  const suspensionsQuery = useEmployeeSuspensions(employeeId, { enabled: open });
  const createMutation = useCreateSuspension(employeeId);
  const cancelMutation = useCancelSuspension(employeeId);

  const [kind, setKind] = useState("monthly"); // 'monthly' | 'indefinite'
  const [month, setMonth] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");

  // Wider month picker so admins can suspend a future month too.
  const monthOptions = useMemo(() => {
    const opts = buildRecentMonthOptions(36).filter((o) => o.value !== "");
    const now = new Date();
    for (let i = 1; i <= 6; i += 1) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1),
      );
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const value = `${y}-${m}`;
      if (!opts.find((o) => o.value === value)) {
        opts.unshift({ value, label: monthLabel(value) });
      }
    }
    return [{ value: "", label: "اختر الشهر" }, ...opts];
  }, []);

  useEffect(() => {
    if (!open) return;
    // Reset the form whenever the modal opens for a fresh employee.
    setKind("monthly");
    setMonth("");
    setEffectiveFrom("");
    setReason("");
  }, [open, employeeId]);

  const suspensions = suspensionsQuery.data || [];

  const canSubmit = (() => {
    if (createMutation.isPending) return false;
    if (kind === "monthly") return !!month;
    return !!effectiveFrom;
  })();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      kind,
      reason: reason ? reason.trim() : null,
    };
    if (kind === "monthly") {
      payload.month = month;
    } else {
      payload.effective_from = effectiveFrom;
    }
    createMutation.mutate(payload, {
      onSuccess: () => {
        setKind("monthly");
        setMonth("");
        setEffectiveFrom("");
        setReason("");
      },
    });
  };

  const handleCancel = (suspension) => {
    const label =
      suspension.kind === "monthly"
        ? `إيقاف شهر ${formatMonthOrDate(suspension.month)}`
        : `إيقاف حتى إشعار آخر (من ${formatMonthOrDate(suspension.effective_from)})`;
    const confirmed = window.confirm(
      `إلغاء "${label}" للموظف ${employee?.name || ""}؟\nسيُعاد بناء مسير الرواتب للأشهر المفتوحة.`,
    );
    if (!confirmed) return;
    cancelMutation.mutate({ suspensionId: suspension.id, force: false });
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
        className={`${ws.glass} ${ws.card} w-full sm:max-w-xl p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <Ban className="w-5 h-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                إيقاف موظف
              </div>
              <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
                {employee?.name || "—"}
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

        {/* Kind segmented control */}
        <div className={`${ws.segWrap} mb-3`}>
          <button
            type="button"
            onClick={() => setKind("monthly")}
            className={`${ws.segBtn} ${kind === "monthly" ? ws.segActive : ws.segInactive}`}
          >
            <CalendarOff className="w-4 h-4 inline ml-1" />
            إيقاف شهر معيّن
          </button>
          <button
            type="button"
            onClick={() => setKind("indefinite")}
            className={`${ws.segBtn} ${kind === "indefinite" ? ws.segActive : ws.segInactive}`}
          >
            <InfinityIcon className="w-4 h-4 inline ml-1" />
            حتى إشعار آخر
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {kind === "monthly" ? (
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">الشهر المُوقَف</div>
              <GlassSelect
                value={month}
                onChange={setMonth}
                options={monthOptions}
                placeholder="اختر الشهر"
                buttonClassName="text-sm py-2.5 px-3"
              />
              <div className="text-[11px] text-slate-400 dark:text-white/35 mt-1">
                يُستبعد الموظف من مسير الرواتب لهذا الشهر فقط.
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">تاريخ بدء الإيقاف</div>
              <GlassDatePicker
                value={effectiveFrom}
                onChange={(v) => setEffectiveFrom(v || "")}
                placeholder="اختر التاريخ"
                allowClear
              />
              <div className="text-[11px] text-slate-400 dark:text-white/35 mt-1">
                يُستبعد الموظف من كل مسير رواتب يبدأ من هذا التاريخ أو بعده،
                حتى يتم إلغاء الإيقاف يدوياً.
              </div>
            </div>
          )}

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              السبب <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${ws.input} px-3 py-2`}
              placeholder="مرض / إجازة بدون راتب / غياب…"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              تسجيل الإيقاف
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-4 py-2`}
            >
              إغلاق
            </button>
          </div>
        </form>

        {/* Active suspensions list */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/10">
          <div className="text-sm font-semibold text-slate-800 dark:text-white/80 mb-2">
            الإيقافات النشطة
          </div>
          {suspensionsQuery.isLoading ? (
            <div className="text-slate-600 dark:text-white/55 text-xs py-3">جاري التحميل…</div>
          ) : suspensions.length === 0 ? (
            <div className="text-slate-500 dark:text-white/45 text-xs py-3">
              لا توجد إيقافات نشطة لهذا الموظف.
            </div>
          ) : (
            <div className="space-y-2">
              {suspensions.map((s) => {
                const isMonthly = s.kind === "monthly";
                const Icon = isMonthly ? Calendar : InfinityIcon;
                const label = isMonthly
                  ? `شهر ${formatMonthOrDate(s.month)}`
                  : `حتى إشعار آخر — من ${formatMonthOrDate(s.effective_from)}`;
                return (
                  <div
                    key={s.id}
                    className={`${ws.glassSoft} ${ws.card} p-3 flex items-center gap-3`}
                  >
                    <div className={`${ws.iconBox} w-8 h-8 shrink-0`}>
                      <Icon className="w-4 h-4 text-amber-700 dark:text-amber-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {label}
                      </div>
                      {s.reason ? (
                        <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5 truncate">
                          {s.reason}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancel(s)}
                      disabled={cancelMutation.isPending}
                      className={`${ws.iconButton} w-8 h-8 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-700 dark:hover:text-emerald-200`}
                      title="إلغاء الإيقاف"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
