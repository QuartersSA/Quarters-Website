"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { useSaveBranchProjectInvoice } from "@/hooks/useBranchProjects";
import { ESTABLISHMENT_ACCOUNTS, DEFAULT_PHASE_TEMPLATE, todayRiyadh } from "@/utils/branchProjectMath";
import { ModalShell, FieldLabel, formatMoney } from "./shared";

// نافذة فاتورة مصروف تأسيس (مؤقتة حتى ربط فواتير المشتريات).

const inputCls = `${ws.input} px-3 py-2 text-sm`;
const DEFAULT_ACCOUNT = "5399";

function numberOrNull(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// الحساب الافتراضي للقسم: من القالب إن طابق الاسم.
function inferAccountForPhase(project, phaseId) {
  if (!phaseId) return DEFAULT_ACCOUNT;
  const phase = (project?.phases || []).find((p) => String(p?.id) === String(phaseId));
  if (!phase) return DEFAULT_ACCOUNT;
  if (phase.default_account_code) return String(phase.default_account_code);
  const template = Array.isArray(DEFAULT_PHASE_TEMPLATE) ? DEFAULT_PHASE_TEMPLATE : [];
  const match = template.find((t) => t?.name && phase.name && String(t.name).trim() === String(phase.name).trim());
  if (match?.default_account_code) return String(match.default_account_code);
  const byColor = template.find((t) => t?.color && phase.color && t.color === phase.color);
  if (byColor?.default_account_code) return String(byColor.default_account_code);
  return DEFAULT_ACCOUNT;
}

function buildInitial(invoice, project, defaultPhaseId) {
  const phaseId =
    invoice?.phase_id != null ? String(invoice.phase_id) : defaultPhaseId != null ? String(defaultPhaseId) : "";
  return {
    invoice_number: invoice?.invoice_number || "",
    invoice_date: invoice?.invoice_date || todayRiyadh(),
    due_date: invoice?.due_date || "",
    supplier_name: invoice?.supplier_name || "",
    phase_id: phaseId,
    expense_account_code: invoice?.expense_account_code
      ? String(invoice.expense_account_code)
      : inferAccountForPhase(project, phaseId),
    total_amount: invoice?.total_amount != null ? String(invoice.total_amount) : "",
    paid_amount: invoice?.paid_amount != null ? String(invoice.paid_amount) : "0",
  };
}

export default function ExpenseModal({ open, project, invoice, defaultPhaseId, onClose }) {
  const isEditing = !!invoice?.id;
  const saveMut = useSaveBranchProjectInvoice();
  const [form, setForm] = useState(() => buildInitial(invoice, project, defaultPhaseId));
  const [errors, setErrors] = useState({});
  const [accountTouched, setAccountTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(buildInitial(invoice, project, defaultPhaseId));
      setErrors({});
      setAccountTouched(!!invoice?.expense_account_code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id, defaultPhaseId]);

  const phaseOptions = useMemo(() => {
    const phases = Array.isArray(project?.phases) ? [...project.phases] : [];
    phases.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return [{ value: "", label: "بلا قسم" }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))];
  }, [project?.phases]);

  const accountOptions = useMemo(
    () =>
      (Array.isArray(ESTABLISHMENT_ACCOUNTS) ? ESTABLISHMENT_ACCOUNTS : []).map((a) => ({
        value: String(a.code),
        label: `${a.code} — ${a.name}`,
      })),
    [],
  );

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setInput = (key) => (event) => set(key)(event.target.value);

  function handlePhaseChange(value) {
    setForm((prev) => ({
      ...prev,
      phase_id: value,
      expense_account_code: accountTouched ? prev.expense_account_code : inferAccountForPhase(project, value),
    }));
  }

  function validate() {
    const next = {};
    if (!form.invoice_number.trim()) next.invoice_number = "رقم الفاتورة مطلوب";
    if (!form.invoice_date) next.invoice_date = "تاريخ الفاتورة مطلوب";
    if (!form.supplier_name.trim()) next.supplier_name = "اسم المورد مطلوب";
    if (!form.expense_account_code) next.expense_account_code = "اختر الحساب";
    const total = numberOrNull(form.total_amount);
    if (total === null || total <= 0) next.total_amount = "الإجمالي يجب أن يكون أكبر من صفر";
    const paid = numberOrNull(form.paid_amount) ?? 0;
    if (paid < 0) next.paid_amount = "المسدد لا يكون سالباً";
    else if (total !== null && paid > total) next.paid_amount = "المسدد أكبر من الإجمالي";
    if (form.due_date && form.invoice_date && form.due_date < form.invoice_date) {
      next.due_date = "الاستحقاق قبل تاريخ الفاتورة";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    if (!project?.id || saveMut.isPending) return;
    if (!validate()) return;
    const payload = {
      project_id: project.id,
      ...(isEditing ? { id: invoice.id } : {}),
      invoice_number: form.invoice_number.trim(),
      invoice_date: form.invoice_date,
      due_date: form.due_date || null,
      supplier_name: form.supplier_name.trim(),
      phase_id: form.phase_id ? Number(form.phase_id) : null,
      expense_account_code: form.expense_account_code,
      total_amount: numberOrNull(form.total_amount) ?? 0,
      paid_amount: numberOrNull(form.paid_amount) ?? 0,
    };
    saveMut.mutate(payload, { onSuccess: () => onClose?.() });
  }

  const total = numberOrNull(form.total_amount) ?? 0;
  const paid = numberOrNull(form.paid_amount) ?? 0;
  const remaining = Math.max(0, total - paid);

  const errorText = (key) =>
    errors[key] ? <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">{errors[key]}</div> : null;

  return (
    <ModalShell
      open={open}
      title={isEditing ? "تعديل الفاتورة" : "فاتورة جديدة"}
      description="مؤقتاً تُسجَّل الفواتير هنا؛ عند ربط الخلفية تُنشأ من فواتير المشتريات مباشرة"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${ws.btnNeutral} px-4 py-2 text-sm`}>
            إلغاء
          </button>
          <button
            type="submit"
            form="branch-expense-form"
            disabled={saveMut.isPending}
            className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? "حفظ التعديلات" : "إضافة الفاتورة"}
          </button>
        </>
      }
    >
      <form id="branch-expense-form" onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>رقم الفاتورة *</FieldLabel>
          <input type="text" value={form.invoice_number} onChange={setInput("invoice_number")} className={inputCls} placeholder="INV-0001" dir="ltr" />
          {errorText("invoice_number")}
        </div>
        <div>
          <FieldLabel>المورد *</FieldLabel>
          <input type="text" value={form.supplier_name} onChange={setInput("supplier_name")} className={inputCls} placeholder="اسم المورد" />
          {errorText("supplier_name")}
        </div>

        <div>
          <FieldLabel>تاريخ الفاتورة *</FieldLabel>
          <GlassDatePicker value={form.invoice_date} onChange={(v) => set("invoice_date")(v || "")} placeholder="اختر التاريخ" allowClear={false} />
          {errorText("invoice_date")}
        </div>
        <div>
          <FieldLabel hint="اختياري">تاريخ الاستحقاق</FieldLabel>
          <GlassDatePicker value={form.due_date} onChange={(v) => set("due_date")(v || "")} placeholder="بدون استحقاق" allowClear />
          {errorText("due_date")}
        </div>

        <div>
          <FieldLabel>القسم</FieldLabel>
          <GlassSelect value={form.phase_id} onChange={handlePhaseChange} options={phaseOptions} placeholder="بلا قسم" buttonClassName="text-sm py-2 px-3" />
        </div>
        <div>
          <FieldLabel>حساب المصروف *</FieldLabel>
          <GlassSelect
            value={form.expense_account_code}
            onChange={(v) => {
              setAccountTouched(true);
              set("expense_account_code")(v);
            }}
            options={accountOptions}
            placeholder="اختر الحساب"
            buttonClassName="text-sm py-2 px-3"
            menuWidth={320}
          />
          {errorText("expense_account_code")}
        </div>

        <div>
          <FieldLabel hint="SAR">الإجمالي *</FieldLabel>
          <input type="number" min="0" step="0.01" value={form.total_amount} onChange={setInput("total_amount")} className={inputCls} placeholder="0.00" dir="ltr" />
          {errorText("total_amount")}
        </div>
        <div>
          <FieldLabel hint="SAR">المسدد</FieldLabel>
          <input type="number" min="0" step="0.01" value={form.paid_amount} onChange={setInput("paid_amount")} className={inputCls} placeholder="0.00" dir="ltr" />
          {errorText("paid_amount")}
        </div>

        <div className={`sm:col-span-2 ${ws.innerCard} px-3 py-2 text-xs flex items-center justify-between gap-3 flex-wrap`}>
          <span className="text-slate-500 dark:text-white/50">المتبقي بعد السداد</span>
          <span className={`font-bold tabular-nums ${remaining > 0 ? "text-amber-700 dark:text-amber-200" : "text-[#0e7a5f] dark:text-emerald-200"}`} dir="ltr">
            {formatMoney(remaining)}
          </span>
        </div>
      </form>
    </ModalShell>
  );
}
