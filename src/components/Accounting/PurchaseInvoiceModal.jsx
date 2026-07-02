"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  ScanLine,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import useUpload from "@/utils/useUpload";

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

// ---------- PDF auto-fill ----------
// Extracts invoice fields from the attached PDF's text layer.
// Heuristic (regex) based — works for digital invoices in Arabic or
// English; scanned-image PDFs have no text layer and are skipped.

// Arabic-Indic digits + separators → Latin so one money regex works.
function normalizeDigits(text) {
  return String(text || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/٫/g, ".") // arabic decimal separator
    .replace(/٬/g, ","); // arabic thousands separator
}

const MONEY_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{2,})/;

function parseMoneyToken(token) {
  const number = Number(String(token).replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

// First money value appearing within `window` chars after a keyword.
function moneyAfterKeyword(text, keywords, window = 60) {
  for (const keyword of keywords) {
    const re = new RegExp(keyword, "gi");
    let match;
    while ((match = re.exec(text)) !== null) {
      const slice = text.slice(match.index + match[0].length, match.index + match[0].length + window);
      const money = slice.match(MONEY_RE);
      if (money) {
        const value = parseMoneyToken(money[1]);
        if (value !== null) return value;
      }
    }
  }
  return null;
}

function detectInvoiceNumber(text) {
  const patterns = [
    /(?:رقم\s*الفاتورة|الفاتورة\s*رقم|فاتورة\s*(?:ضريبية\s*)?(?:رقم|#))\s*[:#]?\s*([A-Za-z0-9\-\/_.]{2,30})/gi,
    /invoice\s*(?:no|number|num|#)?\.?\s*[:#]?\s*([A-Za-z0-9\-\/_.]{2,30})/gi,
    /\b(INV[-\/]?[A-Za-z0-9][A-Za-z0-9\-]{2,24})\b/g,
  ];
  // Every occurrence is a candidate — the first "invoice" mention is
  // often the "TAX INVOICE" title, so single-match scanning misses the
  // real number further down.
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const token = match[1].replace(/[.:،,]+$/, "");
      // "Invoice Date" style false positives
      if (/^(date|no|number|تاريخ)$/i.test(token)) continue;
      if (!/\d/.test(token)) continue;
      return token;
    }
  }
  return null;
}

function detectTotal(text) {
  // Priority: explicit grand-total phrasing first, plain "total" last.
  const value =
    moneyAfterKeyword(text, [
      "الإجمالي\\s*المستحق",
      "الاجمالي\\s*المستحق",
      "المجموع\\s*الكلي",
      "الإجمالي\\s*(?:شامل|مع)\\s*الضريبة",
      "الاجمالي\\s*(?:شامل|مع)\\s*الضريبة",
      "grand\\s*total",
      "total\\s*(?:due|amount)",
      "amount\\s*due",
      "الإجمالي",
      "الاجمالي",
      "المجموع",
      "total",
    ]) ?? null;
  if (value !== null) return value;
  // Fallback: biggest money-looking figure in the document.
  let max = null;
  const re = new RegExp(MONEY_RE.source, "g");
  let match;
  while ((match = re.exec(text)) !== null) {
    const parsed = parseMoneyToken(match[1]);
    // Skip huge integers that are clearly ids (VAT numbers, phones).
    if (parsed === null || parsed > 10000000) continue;
    if (!match[1].includes(".") && !match[1].includes(",") && match[1].length > 6) continue;
    if (max === null || parsed > max) max = parsed;
  }
  return max;
}

function detectTax(text) {
  return moneyAfterKeyword(text, [
    "ضريبة\\s*القيمة\\s*المضافة\\s*(?:\\(?\\s*15\\s*%?\\s*\\)?)?",
    "قيمة\\s*الضريبة",
    "vat\\s*(?:\\(?\\s*15\\s*%?\\s*\\)?)?\\s*(?:amount)?",
    "tax\\s*amount",
  ]);
}

function detectInvoiceDate(text) {
  const match = text.match(
    /(?:تاريخ\s*الفاتورة|invoice\s*date|التاريخ|date)\s*[:#]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  );
  if (!match) return null;
  const raw = match[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split(/[\/\-.]/).map(Number);
  if (parts.length !== 3) return null;
  let [day, month, year] = parts;
  // yyyy/mm/dd came in first position
  if (parts[0] > 1900) {
    [year, month, day] = parts;
  }
  if (year < 100) year += 2000;
  if (!day || !month || !year || month > 12 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Longest active contact whose (ar/en) name appears in the text.
function detectContact(text, contacts) {
  const lower = text.toLowerCase();
  let best = null;
  for (const contact of contacts) {
    if (contact.is_active === false) continue;
    const name = String(contact.name || "").trim();
    if (name.length >= 3 && lower.includes(name.toLowerCase())) {
      if (!best || name.length > String(best.name).length) best = contact;
    }
  }
  return best;
}

export function parseInvoiceText(rawText, contacts = []) {
  const text = normalizeDigits(rawText).replace(/\s+/g, " ");
  const total = detectTotal(text);
  const tax = detectTax(text);
  const contact = detectContact(text, contacts);
  return {
    invoiceNumber: detectInvoiceNumber(text),
    total,
    tax: tax !== null && total !== null && tax >= total ? null : tax,
    invoiceDate: detectInvoiceDate(text),
    contact,
  };
}
// ---------- /PDF auto-fill ----------

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

// Postable expense accounts from شجرة الحسابات, grouped under their
// parent node so the dropdown mirrors the tree structure.
export function buildExpenseAccountOptions(accounts = []) {
  const active = accounts.filter(
    (account) =>
      account.account_type === "expense" &&
      account.is_postable !== false &&
      account.is_active !== false,
  );
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const groups = new Map();
  for (const account of active) {
    const parent = account.parent_id ? byId.get(account.parent_id) : null;
    const key = parent ? String(parent.id) : "orphan";
    if (!groups.has(key)) {
      groups.set(key, {
        code: parent ? String(parent.code) : "",
        label: parent ? `${parent.code} ${parent.name}` : "أخرى",
        children: [],
      });
    }
    groups.get(key).children.push(account);
  }
  const sortedGroups = [...groups.values()].sort((a, b) =>
    a.code.localeCompare(b.code, "en", { numeric: true }),
  );
  const options = [{ value: "", label: "غير مصنّفة" }];
  for (const group of sortedGroups) {
    group.children.sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "en", { numeric: true }),
    );
    options.push({
      value: `group-${group.code || group.label}`,
      label: group.label,
      isGroupLabel: true,
    });
    for (const account of group.children) {
      options.push({
        value: String(account.id),
        label: `${account.code} — ${account.name}`,
      });
    }
  }
  return options;
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
  accounts = [],
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!invoice;
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [contactId, setContactId] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayRiyadh());
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [totalAmount, setTotalAmount] = useState("0.00");
  const [paidAmount, setPaidAmount] = useState("0.00");
  const [taxAmount, setTaxAmount] = useState(0);
  const [workflowStatus, setWorkflowStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanSummary, setScanSummary] = useState(null); // {filled:[], warning?}
  const fileInputRef = useRef(null);
  const [upload, { loading: uploading }] = useUpload();

  useEffect(() => {
    if (!open) return;
    setInvoiceNumber(invoice?.invoice_number || "");
    setContactId(invoice?.contact_id ? String(invoice.contact_id) : "");
    setExpenseAccountId(
      invoice?.expense_account_id ? String(invoice.expense_account_id) : "",
    );
    setSupplierName(invoice?.supplier_name || "");
    setInvoiceDate(invoice?.invoice_date || todayRiyadh());
    setDueDate(invoice?.due_date || "");
    setCurrency(invoice?.currency || "SAR");
    setTotalAmount(moneyInput(invoice?.total_amount) || "0.00");
    setPaidAmount(moneyInput(invoice?.paid_amount) || "0.00");
    setTaxAmount(moneyValue(invoice?.tax_amount));
    setWorkflowStatus(invoice?.workflow_status || "new");
    setNotes(invoice?.notes || "");
    setAttachmentUrl(invoice?.attachment_url || "");
    setAttachmentName("");
    setScanBusy(false);
    setScanSummary(null);
  }, [open, invoice]);

  // Upload the picked file, then (for PDFs) read its text layer and
  // auto-fill whatever fields it can find. User-entered values are
  // never overwritten — only empty/default fields get filled.
  const handleFilePicked = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    setScanSummary(null);

    const result = await upload({ file });
    if (result?.error) {
      setScanSummary({ filled: [], warning: `فشل رفع الملف: ${result.error}` });
      return;
    }
    setAttachmentUrl(result.url || "");
    setAttachmentName(file.name || "");

    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!isPdf) {
      setScanSummary({
        filled: [],
        warning: "تم إرفاق الملف. الفحص التلقائي يعمل مع ملفات PDF فقط.",
      });
      return;
    }

    setScanBusy(true);
    try {
      const { extractTextFromPDF } = await import(
        "@/client-integrations/pdfjs"
      );
      const text = await extractTextFromPDF(file);
      if (!text || text.trim().length < 10) {
        setScanSummary({
          filled: [],
          warning:
            "تم إرفاق الفاتورة لكن ما قدرت أقرأ نصها — غالباً صورة ممسوحة. عبّي الحقول يدوياً.",
        });
        return;
      }

      const parsed = parseInvoiceText(text, contacts);
      const filled = [];

      if (parsed.invoiceNumber && !invoiceNumber.trim()) {
        setInvoiceNumber(parsed.invoiceNumber);
        filled.push("رقم الفاتورة");
      }
      if (parsed.contact && !contactId) {
        setContactId(String(parsed.contact.id));
        if (!supplierName.trim()) setSupplierName(parsed.contact.name);
        filled.push("جهة الاتصال");
      } else if (parsed.contact && !supplierName.trim()) {
        setSupplierName(parsed.contact.name);
        filled.push("اسم المورد");
      }
      if (parsed.total !== null && moneyValue(totalAmount) <= 0) {
        setTotalAmount(parsed.total.toFixed(2));
        filled.push("مبلغ الفاتورة");
      }
      if (parsed.tax !== null) {
        setTaxAmount(parsed.tax);
        filled.push("الضريبة");
      }
      if (parsed.invoiceDate && (!invoice || !invoice.invoice_date)) {
        setInvoiceDate(parsed.invoiceDate);
        filled.push("تاريخ الفاتورة");
      }

      setScanSummary({
        filled,
        warning:
          filled.length === 0
            ? "قرأت الملف لكن ما تعرفت على الحقول — تأكد منها يدوياً."
            : !parsed.contact
              ? "ما لقيت مورداً مطابقاً في جهات الاتصال — اختر الجهة أو اكتب اسم المورد."
              : null,
      });
    } catch (error) {
      console.error("invoice scan failed", error);
      setScanSummary({
        filled: [],
        warning: "تعذّر فحص الملف — تم إرفاقه فقط.",
      });
    } finally {
      setScanBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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

  const accountOptions = useMemo(
    () => buildExpenseAccountOptions(accounts),
    [accounts],
  );

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
    const total = moneyValue(totalAmount);
    const tax = Math.min(Math.max(moneyValue(taxAmount), 0), total);
    const payload = {
      invoice_number: invoiceNumber.trim() || undefined,
      contact_id: contactId || null,
      expense_account_id: expenseAccountId || null,
      supplier_name: supplierName.trim() || null,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      currency,
      subtotal_amount: Math.max(total - tax, 0),
      tax_amount: tax,
      total_amount: total,
      paid_amount: moneyValue(paidAmount),
      workflow_status: workflowStatus,
      notes: notes.trim() || null,
      attachment_url: attachmentUrl || null,
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
          {/* Attach + auto-fill from PDF */}
          <div className={`${ws.glassSoft} ${ws.card} p-4`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`${ws.iconBox} w-10 h-10 shrink-0 text-emerald-700 dark:text-emerald-200`}>
                  <ScanLine className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    إرفاق الفاتورة (PDF)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5">
                    عند الإرفاق يُفحص الملف وتُعبّأ الحقول تلقائياً — راجعها قبل الحفظ.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {attachmentUrl ? (
                  <>
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`${ws.btnNeutral} px-3 py-2 text-xs`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      عرض المرفق
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentUrl("");
                        setAttachmentName("");
                        setScanSummary(null);
                      }}
                      className={`${ws.iconButton} w-9 h-9 hover:text-red-700 dark:hover:text-red-200`}
                      title="إزالة المرفق"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || scanBusy}
                  className={`${ws.btnPrimary} px-3 py-2 text-xs disabled:opacity-50`}
                >
                  {uploading || scanBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                  {uploading
                    ? "جاري الرفع…"
                    : scanBusy
                      ? "جاري الفحص…"
                      : attachmentUrl
                        ? "استبدال الملف"
                        : "اختيار ملف"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFilePicked}
                  className="hidden"
                />
              </div>
            </div>

            {attachmentName ? (
              <div className="text-[11px] text-slate-500 dark:text-white/45 mt-2" dir="ltr">
                {attachmentName}
              </div>
            ) : null}

            {scanSummary ? (
              <div className="mt-3 space-y-1.5">
                {scanSummary.filled.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap text-xs text-emerald-800 dark:text-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>تمت تعبئة:</span>
                    {scanSummary.filled.map((label) => (
                      <span
                        key={label}
                        className={`${ws.pill} bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {scanSummary.warning ? (
                  <div className="text-xs text-amber-700 dark:text-amber-200">
                    {scanSummary.warning}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

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
                حساب المصروف — شجرة الحسابات
              </div>
              <GlassSelect
                value={expenseAccountId}
                onChange={setExpenseAccountId}
                options={accountOptions}
                placeholder="غير مصنّفة"
                buttonClassName="text-sm py-2.5 px-3"
              />
              <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                تصنيف الفاتورة على حساب مصروفات من شجرة الحسابات.
              </div>
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
              {moneyValue(taxAmount) > 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                  منها ضريبة قيمة مضافة:{" "}
                  <span dir="ltr" className="font-bold">
                    {moneyValue(taxAmount).toFixed(2)}
                  </span>{" "}
                  — تظهر في تقرير الضريبة.
                  <button
                    type="button"
                    onClick={() => setTaxAmount(0)}
                    className="mr-1 text-rose-700 dark:text-rose-300 hover:underline"
                  >
                    إزالة
                  </button>
                </div>
              ) : null}
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
