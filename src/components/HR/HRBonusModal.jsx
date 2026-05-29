"use client";

import React, { useMemo } from "react";
import { DollarSign, FileText, Percent, User, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassMultiSelect from "@/components/Workspace/GlassMultiSelect";

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (v == null ? "" : String(v))).filter((v) => v !== "");
}

export function HRBonusModal({
  isOpen,
  isEditing,
  formData,
  setFormData,
  employees,
  onSubmit,
  onClose,
  isSubmitting,
  sourceDisplay,
  monthValue,
  monthHint,
}) {
  const employeeOptions = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];
    return list;
  }, [employees]);

  const employeeSelectOptions = useMemo(() => {
    return employeeOptions.map((emp) => ({
      value: String(emp.id),
      // Append the branch name when the API surfaces it so operators
      // can disambiguate same-named employees across branches.
      label: emp.branch_name
        ? `${emp.name} — ${emp.branch_name}`
        : emp.name,
    }));
  }, [employeeOptions]);

  const selectedEmployeeIds = useMemo(() => {
    return normalizeIds(formData.employeeIds);
  }, [formData.employeeIds]);

  const selectedEmployeesPreview = useMemo(() => {
    if (!selectedEmployeeIds.length) return null;

    const map = new Map(
      employeeOptions.map((e) => [
        String(e.id),
        e.branch_name ? `${e.name} — ${e.branch_name}` : e.name,
      ]),
    );
    const names = selectedEmployeeIds
      .map((id) => map.get(id) || id)
      .filter(Boolean);

    const shown = names.slice(0, 6);
    const rest = names.length - shown.length;
    const summary = shown.join("، ");
    return rest > 0 ? `${summary} (+${rest})` : summary;
  }, [employeeOptions, selectedEmployeeIds]);

  const amountMode = formData.amount_mode || "fixed";

  const amountModeOptions = useMemo(
    () => [
      { value: "fixed", label: "مبلغ ثابت" },
      { value: "percent", label: "نسبة من إجمالي الراتب (الأساسي + البدلات)" },
    ],
    [],
  );

  if (!isOpen) return null;

  const title = isEditing ? "تعديل بونص" : "إضافة بونص";
  const currentEmployeeSingleValue = selectedEmployeeIds[0] || "";
  const monthText = monthHint || monthValue || "-";

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

          {/* Month (read-only, selected from the page filter) */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <FileText className="w-4 h-4 inline ml-2" />
              شهر البونص *
            </label>
            <div
              className={`${ws.input} px-4 py-3 bg-white/[0.03] text-white/80`}
              title={monthText}
              dir="ltr"
            >
              {monthText}
            </div>
            <div className="mt-2 text-xs text-white/45">
              يتم تحديد الشهر من فلتر مسير الرواتب.
            </div>
          </div>

          {/* Amount mode */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <DollarSign className="w-4 h-4 inline ml-2" />
              طريقة احتساب البونص *
            </label>
            <GlassSelect
              value={amountMode}
              onChange={(v) => {
                const next = v || "fixed";
                const nextForm = {
                  ...formData,
                  amount_mode: next,
                };

                if (next === "percent") {
                  nextForm.amount = "";
                } else {
                  nextForm.amount_percent = "";
                }

                setFormData(nextForm);
              }}
              options={amountModeOptions}
            />
          </div>

          {/* Amount / Percent */}
          {amountMode === "percent" ? (
            <div>
              <label className="block text-sm font-semibold text-white/70 mb-2">
                <Percent className="w-4 h-4 inline ml-2" />
                النسبة (%) *
              </label>
              <input
                type="number"
                required
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.amount_percent || ""}
                onChange={(e) =>
                  setFormData({ ...formData, amount_percent: e.target.value })
                }
                className={`${ws.input} px-4 py-3`}
                placeholder="مثال: 10"
                dir="ltr"
              />
              <div className="mt-2 text-xs text-white/45">
                يتم حسابها من إجمالي الراتب (الأساسي + البدلات) لكل موظف.
              </div>
            </div>
          ) : (
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
                value={formData.amount || ""}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                className={`${ws.input} px-4 py-3`}
                placeholder="0.00"
                dir="ltr"
              />
            </div>
          )}

          {/* Source (read-only) */}
          <div>
            <label className="block text-sm font-semibold text-white/70 mb-2">
              <FileText className="w-4 h-4 inline ml-2" />
              مصدر البونص
            </label>
            <div
              className={`${ws.input} px-4 py-3 bg-white/[0.03] text-white/80`}
              title={sourceDisplay || ""}
            >
              {sourceDisplay || "-"}
            </div>
          </div>

          {/* Actions */}
          <div className={`flex gap-3 pt-4 border-t ${ws.divider}`}>
            <button
              type="submit"
              disabled={isSubmitting}
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
