"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import useUpload from "@/utils/useUpload";
import { useSaveBranchProjectContract } from "@/hooks/useBranchProjects";
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  buildInstallments,
  installmentStatus,
  todayRiyadh,
} from "@/utils/branchProjectMath";
import { FieldLabel, ModalShell, formatMoney, moneyValue } from "./shared";

// نافذة إضافة/تعديل عقد مقاول أو مورد داخل مشروع تأسيس فرع.
// العقد = التزام مقسّم إلى دفعات؛ السداد يكون لاحقاً عبر فواتير المشتريات
// المرتبطة بالدفعات. الدفعات المرتبطة بفاتورة تُعرض بقفل ولا تُحذف.

const inputCls = `${ws.input} px-3 py-2 text-sm`;
const MAX_INSTALLMENTS = 60;

let rowKeyCounter = 0;
function rowKey() {
  rowKeyCounter += 1;
  return `inst-${rowKeyCounter}`;
}

function numberOrNull(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function moneyInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return (Math.round(n * 100) / 100).toFixed(2);
}

function kindsList() {
  return Array.isArray(CONTRACT_KINDS) && CONTRACT_KINDS.length ? CONTRACT_KINDS : Object.keys(CONTRACT_KIND_LABELS || {});
}

function buildInitial(contract) {
  return {
    title: contract?.title || "",
    kind: contract?.kind && kindsList().includes(contract.kind) ? contract.kind : "contractor",
    party_name: contract?.party_name || "",
    party_contact_id: contract?.party_contact_id != null ? String(contract.party_contact_id) : "",
    phase_id: contract?.phase_id != null ? String(contract.phase_id) : "",
    agreed_amount: contract?.agreed_amount != null ? moneyInput(contract.agreed_amount) : "",
    vat_included: contract ? contract.vat_included !== false : true,
    start_date: contract?.start_date || "",
    end_date: contract?.end_date || "",
    status: contract?.status || "active",
    attachment_url: contract?.attachment_url || "",
    attachment_name: contract?.attachment_name || "",
    notes: contract?.notes || "",
  };
}

function rowFromInstallment(inst, index) {
  return {
    key: rowKey(),
    id: inst?.id ?? null,
    seq: Number(inst?.seq) || index + 1,
    label: inst?.label || `الدفعة ${index + 1}`,
    due_date: inst?.due_date || "",
    amount: inst?.amount != null ? moneyInput(inst.amount) : "",
    notes: inst?.notes || "",
    invoice_id: inst?.invoice_id ?? null,
    invoice_number: inst?.invoice_number || null,
    locked: inst?.invoice_id != null && inst?.invoice_id !== "",
    _status: inst?.invoice_id != null ? installmentStatus(inst, todayRiyadh()) : null,
  };
}

function initialRows(contract) {
  const list = Array.isArray(contract?.installments) ? contract.installments : [];
  return list.map((inst, i) => rowFromInstallment(inst, i));
}

function resequence(rows) {
  return rows.map((row, i) => ({ ...row, seq: i + 1 }));
}

export default function ContractModal({ open, project, phases, contract, contacts = [], onClose }) {
  const isEditing = !!contract?.id;
  const saveMut = useSaveBranchProjectContract();
  const [upload, { loading: uploading }] = useUpload();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(() => buildInitial(contract));
  const [rows, setRows] = useState(() => initialRows(contract));
  const [gen, setGen] = useState({ count: "3", firstDue: "", every: "month", days: "30" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(buildInitial(contract));
    setRows(initialRows(contract));
    setGen({
      count: contract?.installments?.length ? String(contract.installments.length) : "3",
      firstDue: contract?.start_date || project?.contract_signed_date || todayRiyadh(),
      every: "month",
      days: "30",
    });
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract?.id]);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setInput = (key) => (event) => set(key)(event.target.value);

  const phaseOptions = useMemo(() => {
    const list = Array.isArray(phases) ? [...phases] : [];
    list.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return [{ value: "", label: "بلا قسم" }, ...list.map((p) => ({ value: String(p.id), label: p.name }))];
  }, [phases]);

  const contactOptions = useMemo(() => {
    const list = (Array.isArray(contacts) ? contacts : [])
      .filter((c) => c && c.is_active !== false)
      .map((c) => ({ value: String(c.id), label: c.name || `#${c.id}` }));
    list.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    // الجهة المحفوظة قد تكون معطّلة — تبقى ظاهرة حتى لا تضيع القيمة.
    if (form.party_contact_id && !list.some((o) => o.value === form.party_contact_id)) {
      const current = (contacts || []).find((c) => String(c?.id) === form.party_contact_id);
      list.unshift({ value: form.party_contact_id, label: current?.name || form.party_name || `#${form.party_contact_id}` });
    }
    return [{ value: "", label: "بدون جهة اتصال (اسم حر)" }, ...list];
  }, [contacts, form.party_contact_id, form.party_name]);

  const statusOptions = useMemo(
    () =>
      (Array.isArray(CONTRACT_STATUSES) ? CONTRACT_STATUSES : Object.keys(CONTRACT_STATUS_LABELS || {})).map((value) => ({
        value,
        label: CONTRACT_STATUS_LABELS?.[value] || value,
      })),
    [],
  );

  const everyOptions = useMemo(
    () => [
      { value: "month", label: "شهرياً" },
      { value: "days", label: "كل N يوم" },
    ],
    [],
  );

  function handleContactChange(value) {
    const contact = (contacts || []).find((c) => String(c?.id) === String(value));
    setForm((prev) => ({
      ...prev,
      party_contact_id: value || "",
      party_name: contact?.name ? contact.name : prev.party_name,
    }));
  }

  const agreed = moneyValue(form.agreed_amount);
  const rowsSum = useMemo(() => rows.reduce((s, r) => s + moneyValue(r.amount), 0), [rows]);
  const sumDiff = Math.round((rowsSum - agreed) * 100) / 100;
  const lockedCount = rows.filter((r) => r.locked).length;

  function handleGenerate() {
    const count = Math.min(Math.max(Math.trunc(Number(gen.count)) || 0, 1), MAX_INSTALLMENTS);
    const locked = rows.filter((r) => r.locked);
    const lockedSum = locked.reduce((s, r) => s + moneyValue(r.amount), 0);
    const freeTotal = Math.max(agreed - lockedSum, 0);
    const freeCount = Math.max(count - locked.length, 0);
    if (freeCount === 0) {
      toast.warning("كل الدفعات المطلوبة مرتبطة بفواتير بالفعل — زد العدد لإضافة دفعات جديدة.");
      return;
    }
    const generated = buildInstallments({
      count: freeCount,
      total: freeTotal,
      firstDue: gen.firstDue || null,
      every: gen.every === "days" ? "days" : "month",
      days: Number(gen.days) || 30,
    });
    const next = [
      ...locked,
      ...generated.map((inst, i) => ({
        key: rowKey(),
        id: null,
        seq: locked.length + i + 1,
        label: `الدفعة ${locked.length + i + 1}`,
        due_date: inst.due_date || "",
        amount: moneyInput(inst.amount),
        notes: "",
        invoice_id: null,
        invoice_number: null,
        locked: false,
        _status: null,
      })),
    ];
    setRows(resequence(next));
    setErrors((prev) => ({ ...prev, installments: undefined }));
  }

  function updateRow(key, patch) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key) {
    setRows((prev) => resequence(prev.filter((row) => row.key !== key || row.locked)));
  }

  function addRow() {
    if (rows.length >= MAX_INSTALLMENTS) return;
    setRows((prev) => {
      return resequence([
        ...prev,
        {
          key: rowKey(),
          id: null,
          seq: prev.length + 1,
          label: `الدفعة ${prev.length + 1}`,
          due_date: "",
          amount: moneyInput(Math.max(agreed - prev.reduce((s, r) => s + moneyValue(r.amount), 0), 0)),
          notes: "",
          invoice_id: null,
          invoice_number: null,
          locked: false,
          _status: null,
        },
      ]);
    });
  }

  async function handleFilePicked(file) {
    if (!file) return;
    const isPdf = /pdf$/i.test(file.type || "") || /\.pdf$/i.test(file.name || "");
    const isImage = /^image\//i.test(file.type || "");
    if (!isPdf && !isImage) {
      toast.error("المرفق يجب أن يكون PDF أو صورة.");
      return;
    }
    const result = await upload({ file, unoptimized: isPdf });
    if (result?.error || !result?.url) {
      toast.error(`فشل رفع المرفق: ${result?.error || "خطأ غير معروف"}`);
      return;
    }
    setForm((prev) => ({ ...prev, attachment_url: result.url, attachment_name: file.name || "" }));
  }

  function validate() {
    const next = {};
    if (!form.title.trim()) next.title = "عنوان العقد مطلوب";
    if (!form.party_name.trim()) next.party_name = "اسم الطرف (المقاول/المورد) مطلوب";
    const amount = numberOrNull(form.agreed_amount);
    if (amount === null || amount < 0) next.agreed_amount = "المبلغ المتفق عليه رقم غير صالح";
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      next.end_date = "النهاية يجب أن تكون بعد البداية أو تساويها";
    }
    if (rows.length > MAX_INSTALLMENTS) next.installments = `الحد الأقصى ${MAX_INSTALLMENTS} دفعة`;
    for (const row of rows) {
      const a = numberOrNull(row.amount);
      if (a === null || a < 0) {
        next.installments = `مبلغ الدفعة ${row.seq} غير صالح`;
        break;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    if (!project?.id || saveMut.isPending || uploading) return;
    if (!validate()) return;
    const payload = {
      project_id: project.id,
      ...(isEditing ? { id: contract.id } : {}),
      title: form.title.trim(),
      kind: form.kind,
      party_name: form.party_name.trim(),
      party_contact_id: form.party_contact_id ? Number(form.party_contact_id) : null,
      phase_id: form.phase_id ? Number(form.phase_id) : null,
      agreed_amount: numberOrNull(form.agreed_amount) ?? 0,
      vat_included: !!form.vat_included,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: isEditing ? form.status : "active",
      attachment_url: form.attachment_url || null,
      attachment_name: form.attachment_url ? form.attachment_name || null : null,
      notes: form.notes,
      installments: rows.map((row, i) => ({
        ...(row.id ? { id: row.id } : {}),
        seq: i + 1,
        label: (row.label || "").trim() || `الدفعة ${i + 1}`,
        due_date: row.due_date || null,
        amount: numberOrNull(row.amount) ?? 0,
        notes: row.notes || "",
      })),
    };
    saveMut.mutate(payload, { onSuccess: () => onClose?.() });
  }

  const errorText = (key) =>
    errors[key] ? <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">{errors[key]}</div> : null;

  const busy = saveMut.isPending || uploading;

  return (
    <ModalShell
      open={open}
      title={isEditing ? "تعديل العقد" : "عقد جديد"}
      description={project?.name ? `المشروع: ${project.name} — السداد يكون عبر فواتير المشتريات المرتبطة بالدفعات` : undefined}
      onClose={busy ? () => {} : onClose}
      width="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={`${ws.btnNeutral} px-4 py-2 text-sm disabled:opacity-50`}>
            إلغاء
          </button>
          <button type="submit" form="branch-contract-form" disabled={busy} className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}>
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? "حفظ التعديلات" : "إضافة العقد"}
          </button>
        </>
      }
    >
      <form id="branch-contract-form" onSubmit={handleSubmit} className="space-y-4">
        {/* البيانات الأساسية */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <FieldLabel>عنوان العقد *</FieldLabel>
            <input type="text" value={form.title} onChange={setInput("title")} className={inputCls} placeholder="مثال: عقد مقاول الصبغ" />
            {errorText("title")}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>النوع</FieldLabel>
            <div className={`${ws.segWrap} flex-wrap`}>
              {kindsList().map((kind) => {
                const active = form.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => set("kind")(kind)}
                    className={`${ws.segBtn} text-xs !px-3 !py-1.5 ${active ? ws.segActive : ws.segInactive}`}
                  >
                    {CONTRACT_KIND_LABELS?.[kind] || kind}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel hint="اختياري">جهة الاتصال</FieldLabel>
            <GlassSelect
              value={form.party_contact_id}
              onChange={handleContactChange}
              options={contactOptions}
              placeholder="اختر مورداً أو مقاولاً…"
              searchable
              searchPlaceholder="ابحث بالاسم…"
              buttonClassName="text-sm py-2 px-3"
            />
          </div>
          <div>
            <FieldLabel>اسم الطرف (المقاول / المورد) *</FieldLabel>
            <input type="text" value={form.party_name} onChange={setInput("party_name")} className={inputCls} placeholder="مثال: مؤسسة الألوان للمقاولات" />
            {errorText("party_name")}
          </div>

          <div>
            <FieldLabel>القسم</FieldLabel>
            <GlassSelect value={form.phase_id} onChange={set("phase_id")} options={phaseOptions} placeholder="بلا قسم" buttonClassName="text-sm py-2 px-3" />
          </div>
          <div>
            <FieldLabel>المبلغ المتفق عليه *</FieldLabel>
            <div className="flex items-stretch gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.agreed_amount}
                onChange={setInput("agreed_amount")}
                className={`${inputCls} tabular-nums`}
                placeholder="0.00"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => set("vat_included")(!form.vat_included)}
                className={`${ws.chip} shrink-0 whitespace-nowrap ${form.vat_included ? "!bg-[#e7f2ee] !text-[#0e7a5f] !border-[#c9e2d8] dark:!bg-emerald-400/15 dark:!text-emerald-200 dark:!border-emerald-400/25" : ""}`}
                title="هل المبلغ شامل ضريبة القيمة المضافة؟"
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${form.vat_included ? "bg-[#0e7a5f] border-[#0e7a5f] dark:bg-emerald-400 dark:border-emerald-400" : "border-slate-300 dark:border-white/25"}`}>
                  {form.vat_included ? <span className="w-1.5 h-1.5 rounded-sm bg-white dark:bg-[#132044]" /> : null}
                </span>
                شامل الضريبة
              </button>
            </div>
            {errorText("agreed_amount")}
          </div>

          <div>
            <FieldLabel hint="اختياري">تاريخ البداية</FieldLabel>
            <GlassDatePicker value={form.start_date} onChange={(v) => set("start_date")(v || "")} placeholder="اختر التاريخ" allowClear />
          </div>
          <div>
            <FieldLabel hint="اختياري">تاريخ النهاية</FieldLabel>
            <GlassDatePicker value={form.end_date} onChange={(v) => set("end_date")(v || "")} placeholder="اختر التاريخ" allowClear />
            {errorText("end_date")}
          </div>

          {isEditing ? (
            <div>
              <FieldLabel>الحالة</FieldLabel>
              <GlassSelect value={form.status} onChange={set("status")} options={statusOptions} placeholder="الحالة" buttonClassName="text-sm py-2 px-3" />
            </div>
          ) : null}

          <div className={isEditing ? "" : "sm:col-span-2"}>
            <FieldLabel hint="PDF أو صورة">المرفق (نسخة العقد)</FieldLabel>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleFilePicked(file);
                e.target.value = "";
              }}
            />
            {form.attachment_url ? (
              <div className={`${ws.innerCard} px-3 py-2 flex items-center gap-2 text-xs`}>
                <Paperclip className="w-3.5 h-3.5 shrink-0 text-[#0e7a5f] dark:text-emerald-200" />
                <span className="min-w-0 flex-1 truncate text-slate-900 dark:text-white">{form.attachment_name || "مرفق العقد"}</span>
                <a href={form.attachment_url} target="_blank" rel="noreferrer" className={`${ws.iconButton} w-8 h-8`} title="فتح المرفق">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, attachment_url: "", attachment_name: "" }))}
                  className={`${ws.iconButton} w-8 h-8 text-rose-600 dark:text-rose-300`}
                  title="إزالة المرفق"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-60`}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "جاري الرفع…" : "رفع نسخة العقد"}
              </button>
            )}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel hint="اختياري">ملاحظات</FieldLabel>
            <textarea value={form.notes} onChange={setInput("notes")} rows={2} className={`${inputCls} resize-y`} placeholder="نطاق العمل، شروط الدفع، ضمانات…" />
          </div>
        </div>

        {/* مولّد الدفعات */}
        <div className={`${ws.innerCard} p-3 space-y-3`}>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-200" />
            <div className="text-xs font-bold text-slate-900 dark:text-white">مولّد الدفعات</div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">
              يوزّع المبلغ المتفق عليه بالتساوي (الأخيرة تحمل فرق التقريب)
              {lockedCount > 0 ? ` — الدفعات المرتبطة بفواتير (${lockedCount}) تبقى كما هي` : ""}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <div>
              <FieldLabel>عدد الدفعات</FieldLabel>
              <input
                type="number"
                min="1"
                max={MAX_INSTALLMENTS}
                step="1"
                value={gen.count}
                onChange={(e) => setGen((prev) => ({ ...prev, count: e.target.value }))}
                className={`${inputCls} tabular-nums`}
                dir="ltr"
              />
            </div>
            <div>
              <FieldLabel>أول استحقاق</FieldLabel>
              <GlassDatePicker value={gen.firstDue} onChange={(v) => setGen((prev) => ({ ...prev, firstDue: v || "" }))} placeholder="اختر التاريخ" allowClear />
            </div>
            <div>
              <FieldLabel>التكرار</FieldLabel>
              <GlassSelect value={gen.every} onChange={(v) => setGen((prev) => ({ ...prev, every: v }))} options={everyOptions} placeholder="التكرار" buttonClassName="text-sm py-2 px-3" />
            </div>
            <div className="flex items-end gap-2">
              {gen.every === "days" ? (
                <div className="flex-1 min-w-0">
                  <FieldLabel>كل كم يوم</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={gen.days}
                    onChange={(e) => setGen((prev) => ({ ...prev, days: e.target.value }))}
                    className={`${inputCls} tabular-nums`}
                    dir="ltr"
                  />
                </div>
              ) : null}
              <button type="button" onClick={handleGenerate} className={`${ws.btnPrimary} px-3 py-2 text-xs shrink-0`} title="توليد جدول الدفعات">
                <Sparkles className="w-3.5 h-3.5" />
                توليد
              </button>
            </div>
          </div>
        </div>

        {/* جدول الدفعات */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              الدفعات <span className="text-slate-500 dark:text-white/45 font-normal tabular-nums" dir="ltr">({rows.length})</span>
            </div>
            <button type="button" onClick={addRow} disabled={rows.length >= MAX_INSTALLMENTS} className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs disabled:opacity-50`}>
              <Plus className="w-3.5 h-3.5" />
              دفعة
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="text-[11px] text-slate-500 dark:text-white/45 py-3 text-center border border-dashed border-[#e2e7e4] dark:border-white/10 rounded-[10px]">
              لا دفعات بعد — استخدم المولّد أو أضف دفعة يدوياً. يمكن حفظ العقد بلا دفعات.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="min-w-[620px] space-y-1.5">
                <div className="grid grid-cols-[36px_minmax(140px,1.3fr)_minmax(150px,1fr)_120px_36px] gap-2 px-1 text-[11px] font-bold text-slate-500 dark:text-white/45">
                  <div>#</div>
                  <div>الوصف</div>
                  <div>الاستحقاق</div>
                  <div className="text-left">المبلغ</div>
                  <div />
                </div>
                {rows.map((row) => (
                  <div key={row.key} className="grid grid-cols-[36px_minmax(140px,1.3fr)_minmax(150px,1fr)_120px_36px] gap-2 items-center px-1">
                    <div className="text-xs font-bold tabular-nums text-slate-700 dark:text-white/70 inline-flex items-center gap-1" dir="ltr">
                      {row.locked ? <Lock className="w-3 h-3 text-slate-400 dark:text-white/35" /> : null}
                      {row.seq}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) => updateRow(row.key, { label: e.target.value })}
                        className={`${ws.input} px-2.5 py-1.5 text-xs`}
                        placeholder={`الدفعة ${row.seq}`}
                      />
                      {row.locked ? (
                        <div className="text-[10px] text-slate-500 dark:text-white/45 mt-0.5">
                          مرتبطة بفاتورة <span className="font-mono" dir="ltr">{row.invoice_number || `#${row.invoice_id}`}</span> — لا تُحذف
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <GlassDatePicker value={row.due_date} onChange={(v) => updateRow(row.key, { due_date: v || "" })} placeholder="بلا تاريخ" allowClear buttonClassName="text-xs py-1.5 px-2.5" />
                    </div>
                    <div>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                        className={`${ws.input} px-2.5 py-1.5 text-xs tabular-nums text-left`}
                        placeholder="0.00"
                        dir="ltr"
                      />
                    </div>
                    <div className="flex justify-end">
                      {row.locked ? (
                        <span className={`${ws.iconButton} w-8 h-8 opacity-50 cursor-not-allowed`} title="دفعة مرتبطة بفاتورة — فك الربط أولاً">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <button type="button" onClick={() => removeRow(row.key)} className={`${ws.iconButton} w-8 h-8 text-rose-600 dark:text-rose-300`} title="حذف الدفعة">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {errorText("installments")}

          {/* مجموع الدفعات مقابل المتفق عليه */}
          <div
            className={`rounded-[10px] border px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs ${
              rows.length > 0 && Math.abs(sumDiff) > 0.005
                ? "bg-amber-50 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/25 text-amber-800 dark:text-amber-100"
                : "bg-[#fafbfa] dark:bg-white/[0.03] border-[#e2e7e4] dark:border-white/10 text-slate-700 dark:text-white/70"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {rows.length > 0 && Math.abs(sumDiff) > 0.005 ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : null}
              مجموع الدفعات مقابل المتفق عليه
            </span>
            <span className="tabular-nums font-semibold" dir="ltr">
              {formatMoney(rowsSum, false)} / {formatMoney(agreed, false)}
              {rows.length > 0 && Math.abs(sumDiff) > 0.005 ? ` (${sumDiff > 0 ? "+" : "−"}${formatMoney(Math.abs(sumDiff), false)})` : ""}
            </span>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
