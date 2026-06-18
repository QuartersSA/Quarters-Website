"use client";

import { useMemo } from "react";
import {
  User,
  Phone,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Briefcase,
  Building2,
  DollarSign,
  CalendarCheck,
  ScrollText,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import HRModalHeader from "@/components/HR/HRModalHeader";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassMultiSelect from "@/components/Workspace/GlassMultiSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import DualCalendarDatePicker from "@/components/Workspace/DualCalendarDatePicker";
import { HREmployeeLogPanel } from "@/components/HR/HREmployeeLogPanel";

// Today as YYYY-MM-DD pinned to Asia/Riyadh — the project's
// canonical timezone — so the "منتهي" flag flips at Riyadh midnight
// regardless of the viewer's device timezone. en-CA locale formats
// as YYYY-MM-DD natively.
function todayLocalISO() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Riyadh",
  });
}

function YesNoSelect({ value, onChange }) {
  const stringValue = value ? "yes" : "no";

  const options = [
    { value: "no", label: "لا" },
    { value: "yes", label: "نعم" },
  ];

  return (
    <GlassSelect
      value={stringValue}
      onChange={(v) => onChange(v === "yes")}
      options={options}
    />
  );
}

export function HREmployeeModal({
  isOpen,
  isEditing,
  employeeId = null,
  formData,
  setFormData,
  branches,
  onSubmit,
  onClose,
  isSubmitting,
}) {
  const branchOptions = useMemo(() => {
    const list = Array.isArray(branches) ? branches : [];
    return list;
  }, [branches]);

  // Multi-select feeds raw branch options (no "— بدون —" sentinel —
  // an empty selection naturally means "no branch"). Each value is the
  // branch id as a string so GlassMultiSelect's Set-based comparison
  // works cleanly across re-renders.
  const branchSelectOptions = useMemo(() => {
    return branchOptions.map((b) => {
      const label = b.location ? `${b.name} (${b.location})` : b.name;
      return {
        value: String(b.id),
        label,
      };
    });
  }, [branchOptions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-2xl max-h-[90svh] overflow-hidden`}
      >
        <HRModalHeader isEditing={isEditing} onClose={onClose} />

        <form
          onSubmit={onSubmit}
          className="p-6 space-y-6 overflow-y-auto max-h-[calc(90svh-84px)]"
        >
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
              <User className="w-4 h-4 inline ml-2" />
              الاسم الكامل *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={`${ws.input} px-4 py-3`}
              placeholder="أدخل اسم الموظف"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
              <Phone className="w-4 h-4 inline ml-2" />
              رقم الجوال
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className={`${ws.input} px-4 py-3`}
              placeholder="05xxxxxxxx أو +9665xxxxxxxx"
              dir="ltr"
            />
          </div>

          {/* IQAMA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <FileText className="w-4 h-4 inline ml-2" />
                رقم الإقامة
              </label>
              <input
                type="text"
                value={formData.iqama_number}
                onChange={(e) =>
                  setFormData({ ...formData, iqama_number: e.target.value })
                }
                className={`${ws.input} px-4 py-3`}
                placeholder="رقم الإقامة"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <Calendar className="w-4 h-4 inline ml-2" />
                موعد انتهاء الإقامة
              </label>

              <DualCalendarDatePicker
                gregorianValue={formData.iqama_expiry_date || ""}
                calendar={formData.iqama_expiry_calendar || "gregory"}
                hijriValue={formData.iqama_expiry_hijri || ""}
                onChange={(next) =>
                  setFormData({
                    ...formData,
                    iqama_expiry_date: next.gregorian || "",
                    iqama_expiry_calendar: next.calendar || "gregory",
                    iqama_expiry_hijri: next.hijri || "",
                  })
                }
                placeholder="اختر التاريخ"
                allowClear
              />
            </div>
          </div>

          {/* Flags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <CheckCircle2 className="w-4 h-4 inline ml-2" />
                تم نقل الكفالة
              </label>
              <YesNoSelect
                value={!!formData.sponsorship_transferred}
                onChange={(v) =>
                  setFormData({ ...formData, sponsorship_transferred: v })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <CheckCircle2 className="w-4 h-4 inline ml-2" />
                تم إصدار كرت عمل
              </label>
              <YesNoSelect
                value={!!formData.work_card_issued}
                onChange={(v) =>
                  setFormData({ ...formData, work_card_issued: v })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <CheckCircle2 className="w-4 h-4 inline ml-2" />
                تم إصدار كشف طبي
              </label>
              <YesNoSelect
                value={!!formData.medical_check_issued}
                onChange={(v) =>
                  setFormData({ ...formData, medical_check_issued: v })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <CheckCircle2 className="w-4 h-4 inline ml-2" />
                تم إصدار كرت صحي
              </label>
              <YesNoSelect
                value={!!formData.health_card_issued}
                onChange={(v) =>
                  setFormData({
                    ...formData,
                    health_card_issued: v,
                    // Switching to "لا" clears the date so a stale
                    // expiry never lingers in the form state. Mirror
                    // the same clear for the calendar + Hijri fields.
                    health_card_expiry_date: v
                      ? formData.health_card_expiry_date || ""
                      : "",
                    health_card_expiry_calendar: v
                      ? formData.health_card_expiry_calendar || "gregory"
                      : "gregory",
                    health_card_expiry_hijri: v
                      ? formData.health_card_expiry_hijri || ""
                      : "",
                  })
                }
              />
            </div>
          </div>

          {/* Health card expiry — only shown while the card is
              issued. Past dates are intentionally allowed: an
              issued-but-expired card is a real state HR tracks. */}
          {formData.health_card_issued ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <Calendar className="w-4 h-4 inline ml-2" />
                موعد انتهاء الكرت الصحي
              </label>
              <DualCalendarDatePicker
                gregorianValue={formData.health_card_expiry_date || ""}
                calendar={formData.health_card_expiry_calendar || "gregory"}
                hijriValue={formData.health_card_expiry_hijri || ""}
                onChange={(next) =>
                  setFormData({
                    ...formData,
                    health_card_expiry_date: next.gregorian || "",
                    health_card_expiry_calendar: next.calendar || "gregory",
                    health_card_expiry_hijri: next.hijri || "",
                  })
                }
                placeholder="اختر التاريخ"
                allowClear
              />
              {formData.health_card_expiry_date &&
              formData.health_card_expiry_date < todayLocalISO() ? (
                <p className="text-xs text-red-700 dark:text-red-300 mt-1 font-semibold">
                  ⚠️ الكرت الصحي منتهي
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Position + Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <Briefcase className="w-4 h-4 inline ml-2" />
                المنصب
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) =>
                  setFormData({ ...formData, position: e.target.value })
                }
                className={`${ws.input} px-4 py-3`}
                placeholder="مثال: كاشير / مشرف"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <Building2 className="w-4 h-4 inline ml-2" />
                الفروع
              </label>
              <GlassMultiSelect
                values={
                  Array.isArray(formData.branchIds) ? formData.branchIds : []
                }
                onChange={(vals) =>
                  setFormData({
                    ...formData,
                    branchIds: Array.isArray(vals) ? vals : [],
                  })
                }
                options={branchSelectOptions}
                placeholder="— بدون —"
              />
            </div>
          </div>

          {/* Start date — toggle + date picker. When the toggle is on
              the field expands; when off the form posts start_date as
              null (employee paid full salary every month from creation
              onwards, no proration). */}
          <div
            className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-2xl p-4`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-slate-900 dark:text-white font-semibold">
                  <CalendarCheck className="w-4 h-4 inline ml-2" />
                  تاريخ المباشرة
                </p>
                <p className="text-sm text-slate-600 dark:text-white/55 mt-1 leading-relaxed">
                  فعّل وحدّد التاريخ ليبدأ مسير الرواتب من ذلك اليوم. مسير
                  الشهر الذي يقع فيه التاريخ يُحسب على أساس{" "}
                  <span className="text-slate-800 dark:text-white/80">
                    (الراتب ÷ 30) × أيام العمل في الشهر
                  </span>
                  . الأشهر السابقة لا يُسجَّل لها راتب لهذا الموظف.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (formData.start_date) {
                    setFormData({ ...formData, start_date: "" });
                  } else {
                    // Default to today when the admin first turns the
                    // toggle on, so the date picker isn't stuck
                    // showing the placeholder.
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, "0");
                    const d = String(now.getDate()).padStart(2, "0");
                    setFormData({
                      ...formData,
                      start_date: `${y}-${m}-${d}`,
                    });
                  }
                }}
                className={
                  formData.start_date
                    ? `${ws.btnPrimary} px-4 py-2`
                    : `${ws.btnNeutral} px-4 py-2`
                }
              >
                {formData.start_date ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                {formData.start_date ? "مفعّل" : "غير مفعّل"}
              </button>
            </div>

            {formData.start_date ? (
              <div className="mt-3">
                <GlassDatePicker
                  value={formData.start_date}
                  onChange={(v) =>
                    setFormData({
                      ...formData,
                      start_date: v || "",
                    })
                  }
                  placeholder="اختر تاريخ المباشرة"
                  allowClear
                />
              </div>
            ) : null}
          </div>

          {/* Salary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <DollarSign className="w-4 h-4 inline ml-2" />
                الراتب الأساسي
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={formData.base_salary}
                onChange={(e) =>
                  setFormData({ ...formData, base_salary: e.target.value })
                }
                className={`${ws.input} px-4 py-3`}
                placeholder="0.00"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
                <DollarSign className="w-4 h-4 inline ml-2" />
                بدلات أخرى
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={formData.other_allowances}
                onChange={(e) =>
                  setFormData({ ...formData, other_allowances: e.target.value })
                }
                className={`${ws.input} px-4 py-3`}
                placeholder="0.00"
                dir="ltr"
              />
            </div>
          </div>

          {/* Actions */}
          <div className={`flex gap-3 pt-4 border-t ${ws.divider}`}>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${ws.btnPrimary} flex-1 px-6 py-3 justify-center disabled:opacity-50`}
            >
              {isEditing ? "تحديث الموظف" : "إضافة الموظف"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-6 py-3 justify-center`}
            >
              إلغاء
            </button>
          </div>

          {/* Activity log — embedded inline when editing an existing
              employee so the operator sees the full change history in
              the same popup. Hidden when adding a new employee (no
              history yet, no id to fetch). */}
          {isEditing && employeeId ? (
            <div className={`pt-5 mt-1 border-t ${ws.divider}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`${ws.iconBox} w-9 h-9 text-slate-700 dark:text-white/80`}>
                  <ScrollText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">
                    سجل التعديلات
                  </p>
                  <p className="text-slate-500 dark:text-white/50 text-xs mt-0.5">
                    كل تغيير على بيانات هذا الموظف — آخر 200 حركة
                  </p>
                </div>
              </div>
              <HREmployeeLogPanel
                employeeId={employeeId}
                enabled={isOpen}
                compact
              />
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
