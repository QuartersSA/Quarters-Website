"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  DollarSign,
  FileImage,
  FileText,
  Loader2,
  User,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassMultiSelect from "@/components/Workspace/GlassMultiSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import useUpload from "@/utils/useUpload";
import {
  HR_DEDUCTION_CATEGORIES,
  HR_DEDUCTION_CATEGORY_GROUPS,
} from "@/utils/hrDeductionOptions";

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (v == null ? "" : String(v))).filter((v) => v !== "");
}

export function HRDeductionModal({
  isOpen,
  isEditing,
  formData,
  setFormData,
  employees,
  onSubmit,
  onClose,
  isSubmitting,
  sourceDisplay,
}) {
  const [upload, { loading: uploading }] = useUpload();
  const [uploadError, setUploadError] = useState(null);

  const employeeOptions = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return list;
  }, [employees]);

  const knownCategories = useMemo(() => {
    return new Set(HR_DEDUCTION_CATEGORIES);
  }, []);

  const currentCategory = formData.violation_category || "";
  const showCustomCategoryOption =
    !!currentCategory && !knownCategories.has(currentCategory);

  const employeeSelectOptions = useMemo(() => {
    return employeeOptions.map((emp) => {
      const branchSuffix = emp.branch_name ? ` — ${emp.branch_name}` : "";
      return {
        value: String(emp.id),
        label: `${emp.name}${branchSuffix}`,
      };
    });
  }, [employeeOptions]);

  const selectedEmployeeIds = useMemo(() => {
    return normalizeIds(formData.employeeIds);
  }, [formData.employeeIds]);

  const selectedEmployeesPreview = useMemo(() => {
    if (!selectedEmployeeIds.length) return null;

    const map = new Map(employeeOptions.map((e) => [String(e.id), e.name]));
    const names = selectedEmployeeIds
      .map((id) => map.get(id) || id)
      .filter(Boolean);

    const shown = names.slice(0, 6);
    const rest = names.length - shown.length;
    const summary = shown.join("، ");
    return rest > 0 ? `${summary} (+${rest})` : summary;
  }, [employeeOptions, selectedEmployeeIds]);

  const categorySelectOptions = useMemo(() => {
    const list = [{ value: "", label: "— بدون تصنيف —" }];

    if (showCustomCategoryOption) {
      list.push({
        value: currentCategory,
        label: `قيمة محفوظة: ${currentCategory}`,
      });
    }

    HR_DEDUCTION_CATEGORY_GROUPS.forEach((g, idx) => {
      list.push({
        value: `group-${idx}`,
        label: g.label,
        isGroupLabel: true,
      });
      g.options.forEach((opt) => {
        list.push({ value: opt, label: opt });
      });
    });

    return list;
  }, [currentCategory, showCustomCategoryOption]);

  const onPickImage = useCallback(
    async (file) => {
      setUploadError(null);

      if (!file) {
        return;
      }

      const { url, mimeType, error } = await upload({ file });
      if (error) {
        setUploadError(error);
        return;
      }

      setFormData({
        ...formData,
        image_url: url || "",
        image_mime_type: mimeType || file.type || "",
        image_name: file.name || "",
        image_size_bytes: typeof file.size === "number" ? file.size : null,
      });
    },
    [formData, setFormData, upload],
  );

  const onClearImage = useCallback(() => {
    setUploadError(null);
    setFormData({
      ...formData,
      image_url: "",
      image_mime_type: "",
      image_name: "",
      image_size_bytes: null,
    });
  }, [formData, setFormData]);

  if (!isOpen) return null;

  const title = isEditing ? "تعديل خصمية" : "إضافة خصمية";

  const currentEmployeeSingleValue = selectedEmployeeIds[0] || "";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-2xl max-h-[90svh] overflow-hidden`}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="text-white font-bold text-lg tracking-tight">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} text-white/70`}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="p-6 space-y-6 overflow-y-auto max-h-[calc(90svh-84px)]"
        >
          {/* Employee(s) */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <User className="w-4 h-4 inline ml-2" />
              الموظف {isEditing ? "*" : "/ الموظفين *"}
            </label>

            {isEditing ? (
              <GlassSelect
                value={currentEmployeeSingleValue}
                onChange={(v) =>
                  setFormData({ ...formData, employeeIds: v ? [v] : [] })
                }
                options={employeeSelectOptions}
                placeholder="— اختر الموظف —"
              />
            ) : (
              <>
                <GlassMultiSelect
                  values={selectedEmployeeIds}
                  onChange={(vals) =>
                    setFormData({
                      ...formData,
                      employeeIds: normalizeIds(vals),
                    })
                  }
                  options={employeeSelectOptions}
                  placeholder="— اختر الموظفين —"
                />
                {selectedEmployeesPreview ? (
                  <div className="mt-2 text-xs text-white/45">
                    المختار: {selectedEmployeesPreview}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-white/45">
                    تقدر تختار أكثر من موظف في نفس العملية.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <Calendar className="w-4 h-4 inline ml-2" />
              تاريخ المخالفة *
            </label>

            <GlassDatePicker
              value={formData.violation_date || ""}
              onChange={(v) =>
                setFormData({ ...formData, violation_date: v || "" })
              }
              placeholder="اختر التاريخ"
              allowClear
            />

            <div className="mt-2 text-xs text-white/45">
              * التاريخ يكون فارغ حتى تختار تاريخ.
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <FileText className="w-4 h-4 inline ml-2" />
              تصنيف المخالفة
            </label>

            <GlassSelect
              value={currentCategory}
              onChange={(v) =>
                setFormData({ ...formData, violation_category: v || "" })
              }
              options={categorySelectOptions}
              placeholder="— اختر تصنيف المخالفة —"
            />

            <div className="mt-2 text-xs text-white/45">
              ملاحظة: تم اعتماد قائمة ثابتة لتصنيفات الخصميات.
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <FileText className="w-4 h-4 inline ml-2" />
              السبب
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className={`${ws.input} px-4 py-3 min-h-[110px]`}
              placeholder="اكتب سبب الخصم"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <DollarSign className="w-4 h-4 inline ml-2" />
              المبلغ *
            </label>
            <input
              type="number"
              required
              inputMode="decimal"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              className={`${ws.input} px-4 py-3`}
              placeholder="0.00"
              dir="ltr"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <FileImage className="w-4 h-4 inline ml-2" />
              صورة (اختياري)
            </label>

            <div className={`${ws.glassSoft} ${ws.card} p-4`}>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="text-white/70 text-sm">
                  {formData.image_url ? (
                    <div className="truncate" title={formData.image_name || ""}>
                      تم رفع الصورة
                      {formData.image_name ? `: ${formData.image_name}` : ""}
                    </div>
                  ) : (
                    <div>ارفع صورة للمخالفة (اختياري)</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label
                    className={`${ws.btnNeutral} px-4 py-2 justify-center cursor-pointer`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        // reset input so picking same file again works
                        try {
                          e.target.value = "";
                        } catch {
                          // ignore
                        }
                        onPickImage(file);
                      }}
                      disabled={uploading || isSubmitting}
                    />
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4" />
                        جاري الرفع…
                      </span>
                    ) : (
                      "اختيار صورة"
                    )}
                  </label>

                  {formData.image_url ? (
                    <button
                      type="button"
                      onClick={onClearImage}
                      className={`${ws.iconButton} text-red-200`}
                      aria-label="حذف الصورة"
                      title="حذف الصورة"
                      disabled={uploading || isSubmitting}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {uploadError ? (
                <div className="mt-3 text-sm text-red-200">{uploadError}</div>
              ) : null}

              {formData.image_url ? (
                <a
                  href={formData.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block mt-4"
                >
                  <img
                    src={formData.image_url}
                    alt="مرفق الخصمية"
                    className="w-full max-h-[240px] object-contain rounded-xl bg-black/20"
                  />
                </a>
              ) : null}
            </div>
          </div>

          {/* Source (read-only) */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <FileText className="w-4 h-4 inline ml-2" />
              مصدر المخالفة
            </label>
            <div
              className={`${ws.input} px-4 py-3 bg-white/[0.03] text-white/80`}
              title={sourceDisplay || ""}
            >
              {sourceDisplay || "-"}
            </div>
            <div className="mt-2 text-xs text-white/45">
              يتم تحديد المصدر تلقائيًا باسم المستخدم الذي أدخل البيانات.
            </div>
          </div>

          {/* Actions */}
          <div className={`flex gap-3 pt-4 border-t ${ws.divider}`}>
            <button
              type="submit"
              disabled={isSubmitting || uploading}
              className={`${ws.btnPrimary} flex-1 px-6 py-3 justify-center disabled:opacity-50`}
            >
              {isEditing ? "تحديث" : "إضافة"}
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
