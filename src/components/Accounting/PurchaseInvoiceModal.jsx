"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, FileText, Save, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

export const PURCHASE_INVOICE_STATUS_OPTIONS = [
  { value: "new", label: "جديد" },
  { value: "pending_payment", label: "بانتظار الدفع" },
  { value: "partial_paid", label: "مدفوع جزئي" },
  { value: "paid", label: "مدفوع" },
  { value: "overdue", label: "متأخر" },
];

const WORKFLOW_OPTIONS = [
  { value: "new", label: "جديد" },
  { value: "pending_payment", label: "بانتظار الدفع" },
];

const CURRENCY_OPTIONS = [
  { value: "SAR", label: "ريال سعودي - SAR" },
  { value: "USD", label: "دولار أمريكي - USD" },
  { value: "EUR", label: "يورو - EUR" },
  { value: "AED", label: "درهم إماراتي - AED" },
  { value: "KWD", label: "دينار كويتي - KWD" },
  { value: "BHD", label: "دينار بحريني - BHD" },
  { value: "QAR", label: "ريال قطري - QAR" },
  { value: "OMR", label: "ريال عماني - OMR" },
];

function todayRiyadh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function moneyInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return (Math.round(number * 100) / 100).toFixed(2);
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function computedStatus({ workflowStatus, totalAmount, paidAmount, dueDate }) {
  const total = moneyValue(totalAmount);
  const paid = moneyValue(paidAmount);
  const balance = Math.max(total - paid, 0);
  if (total > 0 && paid >= total) return "paid";
  if (dueDate && dueDate < todayRiyadh() && balance > 0) return "overdue";
  if (paid > 0) return "partial_paid";
  if (workflowStatus === "new") return "new";
  return "pending_payment";
}

export function purchaseInvoiceStatusLabel(value) {
  return (
    PURCHASE_INVOICE_STATUS_OPTIONS.find((option) => option.value === value)
      ?.label || "جديد"
  );
}

export function purchaseInvoiceStatusClass(value) {
  if (value === "paid") {
    return "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-500/25";
  }
  if (value === "partial_paid") {
    return "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-500/25";
  }
  if (value === "overdue") {
    return "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-500/25";
  }
  if (value === "pending_payment") {
    return "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-500/25";
  }
  return "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-200 dark:border-sky-500/25";
}

export default function PurchaseInvoiceModal({
  open,
  invoice,
  contacts = [],
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!invoice;
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [contactId, setContactId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayRiyadh());
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [totalAmount, setTotalAmount] = useState("0.00");
  const [paidAmount, setPaidAmount] = useState("0.00");
  const [workflowStatus, setWorkflowStatus] = useState("new");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setInvoiceNumber(invoice?.invoice_number || "");
    setContactId(invoice?.contact_id ? String(invoice.contact_id) : "");
    setSupplierName(invoice?.supplier_name || "");
    setInvoiceDate(invoice?.invoice_date || todayRiyadh());
    setDueDate(invoice?.due_date || "");
    setCurrency(invoice?.currency || "SAR");
    setTotalAmount(moneyInput(invoice?.total_amount) || "0.00");
    setPaidAmount(moneyInput(invoice?.paid_amount) || "0.00");
    setWorkflowStatus(invoice?.workflow_status || "new");
    setNotes(invoice?.notes || "");
  }, [open, invoice]);

  const contactOptions = useMemo(() => {
    const activeContacts = contacts
      .filter((contact) => contact.is_active !== false)
      .map((contact) => ({
        value: String(contact.id),
        label: contact.name,
      }));
    activeContacts.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    return [{ value: "", label: "بدون جهة اتصال / مورد يدوي" }, ...activeContacts];
  }, [contacts]);

  const status = computedStatus({
    workflowStatus,
    totalAmount,
    paidAmount,
    dueDate,
  });
  const balance = Math.max(moneyValue(totalAmount) - moneyValue(paidAmount), 0);
  const canSubmit =
    !isSubmitting &&
    (!!supplierName.trim() || !!contactId) &&
    moneyValue(totalAmount) > 0 &&
    moneyValue(paidAmount) <= moneyValue(totalAmount);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = {
      invoice_number: invoiceNumber.trim() || undefined,
      contact_id: contactId || null,
      supplier_name: supplierName.trim() || null,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      currency,
      total_amount: moneyValue(totalAmount),
      paid_amount: moneyValue(paidAmount),
      workflow_status: workflowStatus,
      notes: notes.trim() || null,
    };
    if (isEditing) payload.id = invoice.id;
    onSubmit(payload);
  };

  const handleContactChange = (nextContactId) => {
    setContactId(nextContactId);
    if (!nextContactId) return;
    const selected = contacts.find(
      (contact) => String(contact.id) === nextContactId,
    );
    if (selected?.name) {
      setSupplierName(selected.name);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}
      >
        <div className={`px-5 py-4 border-b ${ws.divider} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? "تعديل فاتورة مشتريات" : "إنشاء فاتورة مشتريات"}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                الحالة النهائية تُحسب من المبلغ والمدفوع وتاريخ الاستحقاق.
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className={`${ws.glassSoft} ${ws.card} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
            <div className="flex items-center gap-3">
              <div className={`${ws.iconBox} w-10 h-10 text-sky-700 dark:text-sky-200`}>
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-white/50">
                  الحالة الحالية
                </div>
                <div className="text-sm text-slate-700 dark:text-white/65 mt-1">
                  الرصيد المتبقي:{" "}
                  <span className="font-bold text-slate-900 dark:text-white" dir="ltr">
                    {balance.toFixed(2)} {currency}
                  </span>
                </div>
              </div>
            </div>
            <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${purchaseInvoiceStatusClass(status)}`}>
              {purchaseInvoiceStatusLabel(status)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                رقم الفاتورة
              </div>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="اتركه فارغاً لتوليد رقم تلقائي"
                dir="ltr"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                جهة الاتصال
              </div>
              <GlassSelect
                value={contactId}
                onChange={handleContactChange}
                options={contactOptions}
                placeholder="اختر المورد"
                buttonClassName="text-sm py-2.5 px-3"
                searchable
                searchPlaceholder="ابحث عن المورد..."
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                اسم المورد <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <input
                type="text"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="مثال: Baking up"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                حالة الفاتورة الأساسية
              </div>
              <GlassSelect
                value={workflowStatus}
                onChange={setWorkflowStatus}
                options={WORKFLOW_OPTIONS}
                placeholder="اختر الحالة"
                buttonClassName="text-sm py-2.5 px-3"
              />
              <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                المدفوع، المدفوع جزئياً، والمتأخر تُحسب تلقائياً من الأرقام.
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                تاريخ الفاتورة
              </div>
              <input
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                تاريخ الاستحقاق
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                العملة
              </div>
              <GlassSelect
                value={currency}
                onChange={setCurrency}
                options={CURRENCY_OPTIONS}
                placeholder="اختر العملة"
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                مبلغ الفاتورة <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <input
                type="number"
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
                className={`${ws.input} px-3 py-2.5 text-right`}
                step="0.01"
                min="0"
                dir="ltr"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                المبلغ المدفوع
              </div>
              <input
                type="number"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
                className={`${ws.input} px-3 py-2.5 text-right`}
                step="0.01"
                min="0"
                dir="ltr"
              />
              {moneyValue(paidAmount) > moneyValue(totalAmount) ? (
                <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                  المبلغ المدفوع لا يمكن أن يتجاوز مبلغ الفاتورة.
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                ملاحظات
              </div>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={`${ws.input} px-3 py-2.5 min-h-[86px] resize-none`}
                placeholder="اختياري"
              />
            </div>
          </div>

          <div className={`flex items-center gap-2 pt-3 border-t ${ws.divider}`}>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              حفظ
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-4 py-2`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
