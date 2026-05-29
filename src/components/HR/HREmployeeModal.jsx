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
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import HRModalHeader from "@/components/HR/HRModalHeader";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassMultiSelect from "@/components/Workspace/GlassMultiSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

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

              <GlassDatePicker
                value={formData.iqama_expiry_date || ""}
                onChange={(v) =>
                  setFormData({
                    ...formData,
                    iqama_expiry_date: v || "",
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
                  setFormData({ ...formData, health_card_issued: v })
                }
              />
            </div>
          </div>

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
        </form>
      </div>
    </div>
  );
}
