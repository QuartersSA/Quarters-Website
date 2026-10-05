"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Flag, Loader2, Save } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { useSaveBranchProjectTask } from "@/hooks/useBranchProjects";
import { TASK_STATUSES, TASK_STATUS_LABELS, todayRiyadh } from "@/utils/branchProjectMath";
import { ModalShell, FieldLabel } from "./shared";

// نافذة إضافة/تعديل مهمة داخل قسم.

const inputCls = `${ws.input} px-3 py-2 text-sm`;

function buildInitial(task, phaseId) {
  return {
    title: task?.title || "",
    phase_id: task?.phase_id != null ? String(task.phase_id) : phaseId != null ? String(phaseId) : "",
    status: task?.status || "todo",
    is_milestone: !!task?.is_milestone,
    due_date: task?.due_date || "",
    assignee_name: task?.assignee_name || "",
    notes: task?.notes || "",
  };
}

export default function TaskModal({ open, project, phaseId, task, onClose }) {
  const isEditing = !!task?.id;
  const saveMut = useSaveBranchProjectTask();
  const [form, setForm] = useState(() => buildInitial(task, phaseId));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(buildInitial(task, phaseId));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, phaseId]);

  const phaseOptions = useMemo(() => {
    const phases = Array.isArray(project?.phases) ? [...project.phases] : [];
    phases.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return phases.map((p) => ({ value: String(p.id), label: p.name }));
  }, [project?.phases]);

  const statusOptions = useMemo(
    () =>
      (Array.isArray(TASK_STATUSES) ? TASK_STATUSES : Object.keys(TASK_STATUS_LABELS || {})).map(
        (value) => ({ value, label: TASK_STATUS_LABELS?.[value] || value }),
      ),
    [],
  );

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setInput = (key) => (event) => set(key)(event.target.value);

  function validate() {
    const next = {};
    if (!form.title.trim()) next.title = "عنوان المهمة مطلوب";
    if (!form.phase_id) next.phase_id = "اختر القسم";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    if (!project?.id || saveMut.isPending) return;
    if (!validate()) return;
    const tasks = Array.isArray(project.tasks) ? project.tasks : [];
    const phaseIdNum = Number(form.phase_id);
    const siblings = tasks.filter((t) => Number(t?.phase_id) === phaseIdNum);
    const maxOrder = siblings.reduce((m, t) => Math.max(m, Number(t?.sort_order) || 0), 0);
    const isDone = form.status === "done";
    const payload = {
      project_id: project.id,
      ...(isEditing ? { id: task.id } : {}),
      phase_id: phaseIdNum,
      title: form.title.trim(),
      status: form.status,
      is_milestone: form.is_milestone,
      due_date: form.due_date || null,
      done_at: isDone ? task?.done_at || todayRiyadh() : null,
      assignee_employee_id: task?.assignee_employee_id ?? null,
      assignee_name: form.assignee_name.trim(),
      sort_order: isEditing ? task.sort_order : maxOrder + 1,
      notes: form.notes,
    };
    saveMut.mutate(payload, { onSuccess: () => onClose?.() });
  }

  const errorText = (key) =>
    errors[key] ? <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">{errors[key]}</div> : null;

  return (
    <ModalShell
      open={open}
      title={isEditing ? "تعديل المهمة" : "مهمة جديدة"}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={`${ws.btnNeutral} px-4 py-2 text-sm`}>
            إلغاء
          </button>
          <button
            type="submit"
            form="branch-task-form"
            disabled={saveMut.isPending}
            className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? "حفظ التعديلات" : "إضافة المهمة"}
          </button>
        </>
      }
    >
      <form id="branch-task-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <FieldLabel>عنوان المهمة *</FieldLabel>
          <input type="text" value={form.title} onChange={setInput("title")} className={inputCls} placeholder="مثال: تركيب اللوحة الخارجية" />
          {errorText("title")}
        </div>

        <div>
          <FieldLabel>القسم *</FieldLabel>
          <GlassSelect value={form.phase_id} onChange={set("phase_id")} options={phaseOptions} placeholder="اختر القسم" buttonClassName="text-sm py-2 px-3" />
          {errorText("phase_id")}
        </div>
        <div>
          <FieldLabel>الحالة</FieldLabel>
          <GlassSelect value={form.status} onChange={set("status")} options={statusOptions} placeholder="اختر الحالة" buttonClassName="text-sm py-2 px-3" />
        </div>

        <div>
          <FieldLabel hint="اختياري">تاريخ الاستحقاق</FieldLabel>
          <GlassDatePicker value={form.due_date} onChange={(v) => set("due_date")(v || "")} placeholder="بدون مهلة" allowClear />
        </div>
        <div>
          <FieldLabel>المسؤول</FieldLabel>
          <input type="text" value={form.assignee_name} onChange={setInput("assignee_name")} className={inputCls} placeholder="اسم المسؤول" />
        </div>

        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => set("is_milestone")(!form.is_milestone)}
            className={`w-full flex items-center gap-3 ${ws.innerCard} px-3 py-2.5 text-right`}
            aria-pressed={form.is_milestone}
          >
            <span
              className={`inline-flex w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
                form.is_milestone ? "bg-[#0e7a5f] dark:bg-emerald-400/70" : "bg-slate-300 dark:bg-white/20"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  form.is_milestone ? "-translate-x-4" : "translate-x-0"
                }`}
              />
            </span>
            <Flag className={`w-4 h-4 ${form.is_milestone ? "text-amber-600 dark:text-amber-300" : "text-slate-400 dark:text-white/40"}`} />
            <span className="text-sm text-slate-900 dark:text-white">
              معلم رئيسي
              <span className="text-[11px] text-slate-500 dark:text-white/45 mr-2">يظهر على الخط الزمني ويُشترط اكتماله قبل تأكيد الافتتاح</span>
            </span>
          </button>
        </div>

        <div className="sm:col-span-2">
          <FieldLabel>ملاحظات</FieldLabel>
          <textarea value={form.notes} onChange={setInput("notes")} rows={3} className={`${inputCls} resize-y`} placeholder="ملاحظات اختيارية" />
        </div>
      </form>
    </ModalShell>
  );
}
