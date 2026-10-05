"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { useSaveBranchProjectPhase } from "@/hooks/useBranchProjects";
import {
  PHASE_STATUSES,
  PHASE_STATUS_LABELS,
  DEFAULT_PHASE_TEMPLATE,
} from "@/utils/branchProjectMath";
import { ModalShell, FieldLabel } from "./shared";

// نافذة إضافة/تعديل قسم في مشروع تأسيس فرع.

const FALLBACK_COLORS = [
  "#0e7a5f",
  "#0284c7",
  "#7c3aed",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#65a30d",
  "#db2777",
  "#9333ea",
  "#ea580c",
  "#475569",
];

const inputCls = `${ws.input} px-3 py-2 text-sm`;

function numberOrNull(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function buildInitial(phase, project) {
  const phases = Array.isArray(project?.phases) ? project.phases : [];
  const presets = presetColors();
  return {
    name: phase?.name || "",
    planned_start: phase?.planned_start || project?.contract_signed_date || "",
    planned_end: phase?.planned_end || project?.target_opening_date || "",
    actual_start: phase?.actual_start || "",
    actual_end: phase?.actual_end || "",
    status: phase?.status || "not_started",
    budget: phase?.budget != null ? String(phase.budget) : "",
    weight: phase?.weight != null ? String(phase.weight) : "1",
    progress_override:
      phase?.progress_override != null ? String(phase.progress_override) : "",
    owner_name: phase?.owner_name || "",
    contractor_name: phase?.contractor_name || "",
    color: phase?.color || presets[phases.length % presets.length] || presets[0],
    notes: phase?.notes || "",
  };
}

function presetColors() {
  const fromTemplate = Array.isArray(DEFAULT_PHASE_TEMPLATE)
    ? DEFAULT_PHASE_TEMPLATE.map((t) => t?.color).filter(Boolean)
    : [];
  return fromTemplate.length >= 11 ? fromTemplate.slice(0, 11) : FALLBACK_COLORS;
}

export default function PhaseModal({ open, project, phase, onClose }) {
  const isEditing = !!phase?.id;
  const saveMut = useSaveBranchProjectPhase();
  const [form, setForm] = useState(() => buildInitial(phase, project));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(buildInitial(phase, project));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase?.id]);

  const swatches = useMemo(() => {
    const list = presetColors();
    if (form.color && !list.includes(form.color)) return [...list, form.color];
    return list;
  }, [form.color]);

  const statusOptions = useMemo(
    () =>
      (Array.isArray(PHASE_STATUSES) ? PHASE_STATUSES : Object.keys(PHASE_STATUS_LABELS || {})).map(
        (value) => ({ value, label: PHASE_STATUS_LABELS?.[value] || value }),
      ),
    [],
  );

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setInput = (key) => (event) => set(key)(event.target.value);

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "اسم القسم مطلوب";
    if (!form.planned_start) next.planned_start = "تاريخ البداية المخطط مطلوب";
    if (!form.planned_end) next.planned_end = "تاريخ النهاية المخطط مطلوب";
    if (form.planned_start && form.planned_end && form.planned_end < form.planned_start) {
      next.planned_end = "النهاية يجب أن تكون بعد البداية أو تساويها";
    }
    if (form.actual_start && form.actual_end && form.actual_end < form.actual_start) {
      next.actual_end = "النهاية الفعلية قبل البداية الفعلية";
    }
    const budget = numberOrNull(form.budget);
    if (form.budget !== "" && (budget === null || budget < 0)) next.budget = "الميزانية رقم غير صالح";
    const weight = numberOrNull(form.weight);
    if (weight === null || weight < 1 || weight > 5) next.weight = "الوزن بين 1 و5";
    const override = numberOrNull(form.progress_override);
    if (form.progress_override !== "" && (override === null || override < 0 || override > 100)) {
      next.progress_override = "النسبة بين 0 و100";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    if (!project?.id || saveMut.isPending) return;
    if (!validate()) return;
    const phases = Array.isArray(project.phases) ? project.phases : [];
    const maxOrder = phases.reduce((m, p) => Math.max(m, Number(p?.sort_order) || 0), 0);
    const payload = {
      project_id: project.id,
      ...(isEditing ? { id: phase.id } : {}),
      name: form.name.trim(),
      sort_order: isEditing ? phase.sort_order : maxOrder + 1,
      planned_start: form.planned_start,
      planned_end: form.planned_end,
      actual_start: form.actual_start || null,
      actual_end: form.actual_end || null,
      status: form.status,
      budget: numberOrNull(form.budget) ?? 0,
      weight: numberOrNull(form.weight) ?? 1,
      progress_override: numberOrNull(form.progress_override),
      owner_employee_id: phase?.owner_employee_id ?? null,
      owner_name: form.owner_name.trim(),
      contractor_contact_id: phase?.contractor_contact_id ?? null,
      contractor_name: form.contractor_name.trim(),
      color: form.color,
      notes: form.notes,
    };
    saveMut.mutate(payload, { onSuccess: () => onClose?.() });
  }

  const errorText = (key) =>
    errors[key] ? <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">{errors[key]}</div> : null;

  return (
    <ModalShell
      open={open}
      title={isEditing ? "تعديل القسم" : "قسم جديد"}
      description={project?.name ? `المشروع: ${project.name}` : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${ws.btnNeutral} px-4 py-2 text-sm`}>
            إلغاء
          </button>
          <button
            type="submit"
            form="branch-phase-form"
            disabled={saveMut.isPending}
            className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? "حفظ التعديلات" : "إضافة القسم"}
          </button>
        </>
      }
    >
      <form id="branch-phase-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <FieldLabel>اسم القسم *</FieldLabel>
          <input type="text" value={form.name} onChange={setInput("name")} className={inputCls} placeholder="مثال: الديكور والتشطيب" />
          {errorText("name")}
        </div>

        <div>
          <FieldLabel>البداية المخططة *</FieldLabel>
          <GlassDatePicker value={form.planned_start} onChange={(v) => set("planned_start")(v || "")} placeholder="اختر التاريخ" allowClear={false} />
          {errorText("planned_start")}
        </div>
        <div>
          <FieldLabel>النهاية المخططة *</FieldLabel>
          <GlassDatePicker value={form.planned_end} onChange={(v) => set("planned_end")(v || "")} placeholder="اختر التاريخ" allowClear={false} />
          {errorText("planned_end")}
        </div>

        <div>
          <FieldLabel hint="اختياري">البداية الفعلية</FieldLabel>
          <GlassDatePicker value={form.actual_start} onChange={(v) => set("actual_start")(v || "")} placeholder="لم يبدأ بعد" allowClear />
        </div>
        <div>
          <FieldLabel hint="اختياري">النهاية الفعلية</FieldLabel>
          <GlassDatePicker value={form.actual_end} onChange={(v) => set("actual_end")(v || "")} placeholder="لم ينتهِ بعد" allowClear />
          {errorText("actual_end")}
        </div>

        <div>
          <FieldLabel>الحالة</FieldLabel>
          <GlassSelect value={form.status} onChange={set("status")} options={statusOptions} placeholder="اختر الحالة" buttonClassName="text-sm py-2 px-3" />
        </div>
        <div>
          <FieldLabel hint="SAR">الميزانية</FieldLabel>
          <input type="number" min="0" step="0.01" value={form.budget} onChange={setInput("budget")} className={inputCls} placeholder="0.00" dir="ltr" />
          {errorText("budget")}
        </div>

        <div>
          <FieldLabel hint="1–5، يؤثر على تقدم المشروع">الوزن</FieldLabel>
          <input type="number" min="1" max="5" step="1" value={form.weight} onChange={setInput("weight")} className={inputCls} dir="ltr" />
          {errorText("weight")}
        </div>
        <div>
          <FieldLabel hint="اتركه فارغاً للحساب التلقائي من المهام">تقدم يدوي %</FieldLabel>
          <input type="number" min="0" max="100" step="1" value={form.progress_override} onChange={setInput("progress_override")} className={inputCls} placeholder="تلقائي" dir="ltr" />
          {errorText("progress_override")}
        </div>

        <div>
          <FieldLabel>المسؤول</FieldLabel>
          <input type="text" value={form.owner_name} onChange={setInput("owner_name")} className={inputCls} placeholder="اسم المسؤول" />
        </div>
        <div>
          <FieldLabel>المقاول / المورد</FieldLabel>
          <input type="text" value={form.contractor_name} onChange={setInput("contractor_name")} className={inputCls} placeholder="اسم المقاول" />
        </div>

        <div className="sm:col-span-2">
          <FieldLabel>اللون</FieldLabel>
          <div className="flex items-center gap-2 flex-wrap">
            {swatches.map((color) => {
              const active = form.color === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => set("color")(color)}
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                    active ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
                  }`}
                  style={{ background: color }}
                  title={color}
                  aria-label={color}
                >
                  {active ? <Check className="w-4 h-4 text-white drop-shadow" /> : null}
                </button>
              );
            })}
            <input
              type="color"
              value={form.color || "#0e7a5f"}
              onChange={setInput("color")}
              className="w-8 h-8 rounded-full border border-slate-300 dark:border-white/20 bg-transparent cursor-pointer p-0"
              title="لون مخصص"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <FieldLabel>ملاحظات</FieldLabel>
          <textarea value={form.notes} onChange={setInput("notes")} rows={3} className={`${inputCls} resize-y`} placeholder="ملاحظات اختيارية" />
        </div>
      </form>
    </ModalShell>
  );
}
