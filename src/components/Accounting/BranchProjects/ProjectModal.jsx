"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LayoutTemplate, Loader2, Save } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { useCreateBranchProject, useUpdateBranchProject } from "@/hooks/useBranchProjects";
import { DEFAULT_PHASE_TEMPLATE } from "@/utils/branchProjectMath";
import { ModalShell, FieldLabel } from "./shared";

// نافذة إنشاء/تعديل مشروع تأسيس فرع.

const inputCls = `${ws.input} px-3 py-2 text-sm`;

function numberOrNull(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildInitial(project) {
  return {
    name: project?.name || "",
    city: project?.city || "",
    district: project?.district || "",
    address: project?.address || "",
    area_sqm: project?.area_sqm != null ? String(project.area_sqm) : "",
    contract_signed_date: project?.contract_signed_date || "",
    target_opening_date: project?.target_opening_date || "",
    budget_total: project?.budget_total != null ? String(project.budget_total) : "",
    manager_name: project?.manager_name || "",
    lease_contract_number: project?.lease_contract_number || "",
    notes: project?.notes || "",
    template: "default",
  };
}

export default function ProjectModal({ open, project, onClose }) {
  const isEditing = !!project?.id;
  const navigate = useNavigate();
  const createMut = useCreateBranchProject();
  const updateMut = useUpdateBranchProject();
  const isPending = createMut.isPending || updateMut.isPending;

  const [form, setForm] = useState(() => buildInitial(project));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(buildInitial(project));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id]);

  const templateNames = useMemo(
    () => (Array.isArray(DEFAULT_PHASE_TEMPLATE) ? DEFAULT_PHASE_TEMPLATE.map((t) => t?.name).filter(Boolean) : []),
    [],
  );

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setInput = (key) => (event) => set(key)(event.target.value);

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "اسم المشروع مطلوب";
    if (!form.city.trim()) next.city = "المدينة مطلوبة";
    if (!form.contract_signed_date) next.contract_signed_date = "تاريخ توقيع العقد مطلوب";
    if (!form.target_opening_date) next.target_opening_date = "موعد الافتتاح المستهدف مطلوب";
    if (form.contract_signed_date && form.target_opening_date && form.target_opening_date < form.contract_signed_date) {
      next.target_opening_date = "موعد الافتتاح يجب أن يكون بعد توقيع العقد";
    }
    const area = numberOrNull(form.area_sqm);
    if (form.area_sqm !== "" && (area === null || area < 0)) next.area_sqm = "المساحة رقم غير صالح";
    const budget = numberOrNull(form.budget_total);
    if (form.budget_total !== "" && (budget === null || budget < 0)) next.budget_total = "الميزانية رقم غير صالح";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    if (isPending) return;
    if (!validate()) return;
    const fields = {
      name: form.name.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      address: form.address.trim(),
      area_sqm: numberOrNull(form.area_sqm),
      contract_signed_date: form.contract_signed_date,
      target_opening_date: form.target_opening_date,
      budget_total: numberOrNull(form.budget_total) ?? 0,
      manager_name: form.manager_name.trim(),
      lease_contract_id: project?.lease_contract_id ?? null,
      lease_contract_number: form.lease_contract_number.trim(),
      notes: form.notes,
    };
    if (isEditing) {
      updateMut.mutate({ id: project.id, ...fields }, { onSuccess: () => onClose?.() });
      return;
    }
    createMut.mutate(
      { ...fields, template: form.template },
      {
        onSuccess: (created) => {
          onClose?.();
          if (created?.id != null) navigate(`/accounting/branch-projects/${created.id}`);
        },
      },
    );
  }

  const errorText = (key) =>
    errors[key] ? <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">{errors[key]}</div> : null;

  return (
    <ModalShell
      open={open}
      title={isEditing ? "تعديل بيانات المشروع" : "مشروع تأسيس جديد"}
      description={isEditing ? project?.code : "الفرع يُنشأ لاحقاً من صفحة الفروع بعد الافتتاح"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${ws.btnNeutral} px-4 py-2 text-sm`}>
            إلغاء
          </button>
          <button
            type="submit"
            form="branch-project-form"
            disabled={isPending}
            className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? "حفظ التعديلات" : "إنشاء المشروع"}
          </button>
        </>
      }
    >
      <form id="branch-project-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>الاسم *</FieldLabel>
          <input type="text" value={form.name} onChange={setInput("name")} className={inputCls} placeholder="مثال: فرع الملقا" />
          {errorText("name")}
        </div>
        <div>
          <FieldLabel>المدينة *</FieldLabel>
          <input type="text" value={form.city} onChange={setInput("city")} className={inputCls} placeholder="الرياض" />
          {errorText("city")}
        </div>

        <div>
          <FieldLabel>الحي</FieldLabel>
          <input type="text" value={form.district} onChange={setInput("district")} className={inputCls} placeholder="الحي" />
        </div>
        <div>
          <FieldLabel>العنوان</FieldLabel>
          <input type="text" value={form.address} onChange={setInput("address")} className={inputCls} placeholder="الشارع / المجمع" />
        </div>

        <div>
          <FieldLabel>المساحة (م²)</FieldLabel>
          <input type="number" min="0" step="0.1" value={form.area_sqm} onChange={setInput("area_sqm")} className={inputCls} placeholder="0" dir="ltr" />
          {errorText("area_sqm")}
        </div>
        <div>
          <FieldLabel hint="SAR">الميزانية الإجمالية</FieldLabel>
          <input type="number" min="0" step="0.01" value={form.budget_total} onChange={setInput("budget_total")} className={inputCls} placeholder="0.00" dir="ltr" />
          {errorText("budget_total")}
        </div>

        <div>
          <FieldLabel>تاريخ توقيع العقد *</FieldLabel>
          <GlassDatePicker value={form.contract_signed_date} onChange={(v) => set("contract_signed_date")(v || "")} placeholder="اختر التاريخ" allowClear={false} />
          {errorText("contract_signed_date")}
        </div>
        <div>
          <FieldLabel>موعد الافتتاح المستهدف *</FieldLabel>
          <GlassDatePicker value={form.target_opening_date} onChange={(v) => set("target_opening_date")(v || "")} placeholder="اختر التاريخ" allowClear={false} />
          {errorText("target_opening_date")}
        </div>

        <div>
          <FieldLabel>مدير المشروع</FieldLabel>
          <input type="text" value={form.manager_name} onChange={setInput("manager_name")} className={inputCls} placeholder="اسم المدير" />
        </div>
        <div>
          <FieldLabel hint="اختياري">رقم عقد الإيجار</FieldLabel>
          <input type="text" value={form.lease_contract_number} onChange={setInput("lease_contract_number")} className={inputCls} placeholder="C-2026-01" dir="ltr" />
        </div>

        <div className="sm:col-span-2">
          <FieldLabel>ملاحظات</FieldLabel>
          <textarea value={form.notes} onChange={setInput("notes")} rows={3} className={`${inputCls} resize-y`} placeholder="ملاحظات اختيارية" />
        </div>

        {!isEditing ? (
          <div className={`sm:col-span-2 ${ws.innerCard} p-3`}>
            <div className="flex items-center gap-2 mb-2">
              <LayoutTemplate className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-200" />
              <FieldLabel>قالب الأقسام</FieldLabel>
            </div>
            <div className={`${ws.segWrap} flex-wrap`}>
              {[
                { value: "default", label: `افتراضي (${templateNames.length || 11} قسماً)` },
                { value: "empty", label: "فارغ" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("template")(opt.value)}
                  className={`${ws.segBtn} text-xs ${form.template === opt.value ? ws.segActive : ws.segInactive}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.template === "default" && templateNames.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {templateNames.map((name, index) => (
                  <span key={name} className={`${ws.chip} px-2 py-0.5 text-[11px]`}>
                    <span className="text-slate-400 dark:text-white/35 tabular-nums" dir="ltr">
                      {index + 1}
                    </span>
                    {name}
                  </span>
                ))}
              </div>
            ) : form.template === "empty" ? (
              <div className="mt-2 text-[11px] text-slate-500 dark:text-white/45">يُنشأ المشروع بلا أقسام وتضيفها يدوياً.</div>
            ) : null}
            <div className="mt-2 text-[11px] text-slate-500 dark:text-white/45">
              تُوزَّع مواعيد الأقسام بالتساوي بين توقيع العقد وموعد الافتتاح.
            </div>
          </div>
        ) : null}
      </form>
    </ModalShell>
  );
}
