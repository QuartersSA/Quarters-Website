"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  Paperclip,
  Plus,
  Save,
  ScrollText,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import useUpload from "@/utils/useUpload";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { useAnalyzeLeaseContract } from "@/hooks/useLeaseContracts";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  DEFAULT_VAT_RATE,
  FREQUENCY_LABELS,
  LEASE_FREQUENCIES,
  addDays,
  compareDateKeys,
  contractStatus,
  generateSchedule,
  installmentAmounts,
  installmentWithFixed,
  splitFixedCharges,
  isDateKey,
  round2,
} from "@/utils/leaseMath";

// حد ملف التحليل الذكي (يُرسل base64 داخل JSON) — الأكبر يُرفع فقط.
const MAX_SMART_FILE_BYTES = 3 * 1024 * 1024;
const ANALYZABLE_MEDIA_RE = /^(application\/pdf|image\/(jpeg|png|webp))$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function intOrNull(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Math.trunc(Number(raw));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

let rowKeySeq = 0;
function newCustomRow(overrides = {}) {
  rowKeySeq += 1;
  return {
    key: `row-${Date.now()}-${rowKeySeq}`,
    due_date: "",
    amount: "",
    description: "",
    status: "pending",
    ...overrides,
  };
}

function newFixedRow(overrides = {}) {
  rowKeySeq += 1;
  return { key: `fixed-${Date.now()}-${rowKeySeq}`, label: "", amount: "", taxable: false, ...overrides };
}

function statusPillClass(status) {
  if (status === "active")
    return "bg-[#e7f2ee] dark:bg-emerald-400/10 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25";
  if (status === "notice")
    return "bg-amber-100 dark:bg-amber-400/10 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-400/25";
  if (status === "upcoming")
    return "bg-sky-100 dark:bg-sky-400/10 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-400/25";
  if (status === "ended")
    return "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10";
  return "bg-rose-100 dark:bg-rose-400/10 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-400/25";
}

function SectionTitle({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white tracking-tight">
      {Icon ? <Icon className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-300" /> : null}
      {children}
    </div>
  );
}

function FieldLabel({ children, required, hint }) {
  return (
    <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
      {children}
      {required ? <span className="text-rose-700 dark:text-rose-300"> *</span> : null}
      {hint ? (
        <span className="text-slate-400 dark:text-white/35"> ({hint})</span>
      ) : null}
    </div>
  );
}

// نافذة إضافة/تعديل عقد إيجار: رفع العقد وتحليله ذكياً لملء الفراغات،
// ثم النموذج مع معاينة حية لجدول الدفعات بنفس معادلات الخادم.
export default function LeaseContractModal({
  open,
  contract,
  contacts = [],
  branches = [],
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!contract?.id;

  const [contractNumber, setContractNumber] = useState("");
  const [contactId, setContactId] = useState("");
  const [lessorName, setLessorName] = useState("");
  const [lessorVat, setLessorVat] = useState("");
  const [location, setLocation] = useState("");
  const [contractType, setContractType] = useState("branch");
  const [displayName, setDisplayName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [noticeDays, setNoticeDays] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [amount, setAmount] = useState("");
  const [includesVat, setIncludesVat] = useState(false);
  const [vatRate, setVatRate] = useState(String(DEFAULT_VAT_RATE));
  const [firstDueDate, setFirstDueDate] = useState("");
  const [customRows, setCustomRows] = useState([]);
  // المبالغ الثابتة لكل دفعة (قبل الضريبة): {key, label, amount}
  const [fixedRows, setFixedRows] = useState([]);
  const [notes, setNotes] = useState("");
  const [terminated, setTerminated] = useState(false);
  const [regenerate, setRegenerate] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [analysisJson, setAnalysisJson] = useState(null);

  // ملف التحليل (يبقى في الذاكرة حتى يضغط المستخدم «تحليل ذكي» مجدداً).
  const [analysisFile, setAnalysisFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanSummary, setScanSummary] = useState(null); // {filled:[], warning?, smart?}
  const fileInputRef = useRef(null);
  // الحقول التي عبّأها التحليل — تُستبدل بتحليل لاحق، أما ما كتبه
  // المستخدم فلا يُلمس أبداً.
  const autoFilledRef = useRef(new Set());
  // الحقول ذات القيم الافتراضية التي لمسها المستخدم (التكرار، الضريبة…).
  const touchedRef = useRef(new Set());

  const [upload] = useUpload();
  const analyzeMut = useAnalyzeLeaseContract();

  // تهيئة النموذج عند الفتح (جديد أو تعديل).
  useEffect(() => {
    if (!open) return;
    autoFilledRef.current = new Set();
    touchedRef.current = new Set();
    setScanSummary(null);
    setAnalysisFile(null);
    setUploading(false);
    setScanBusy(false);
    setRegenerate(false);
    if (contract?.id) {
      setContractNumber(contract.contract_number || "");
      setDisplayName(contract.display_name || "");
      setContactId(contract.lessor_contact_id ? String(contract.lessor_contact_id) : "");
      setLessorName(contract.lessor_name || "");
      setLessorVat(contract.lessor_vat_number || "");
      setLocation(contract.location || "");
      setContractType(
        CONTRACT_TYPES.includes(contract.contract_type) ? contract.contract_type : "branch",
      );
      setBranchId(contract.branch_id ? String(contract.branch_id) : "");
      setStartDate(contract.start_date || "");
      setEndDate(contract.end_date || "");
      setNoticeDays(
        contract.notice_period_days === null || contract.notice_period_days === undefined
          ? ""
          : String(contract.notice_period_days),
      );
      setNoticeText(contract.notice_period_text || "");
      const freq = LEASE_FREQUENCIES.includes(contract.payment_frequency)
        ? contract.payment_frequency
        : "monthly";
      setFrequency(freq);
      // المخزَّن قبل الضريبة؛ إن أُدخل شاملًا يُعرض كما كتبه المستخدم.
      const storedExcl = moneyValue(contract.installment_amount);
      const storedRate = moneyValue(contract.vat_rate ?? DEFAULT_VAT_RATE);
      const enteredIncl = contract.amount_includes_vat === true;
      setAmount(
        storedExcl > 0
          ? (enteredIncl
              ? Math.round(storedExcl * (1 + storedRate / 100) * 100) / 100
              : storedExcl
            ).toFixed(2)
          : "",
      );
      // الدفعات المخصصة تُحمَّل قبل الضريبة دائمًا → المفتاح مطفأ.
      setIncludesVat(enteredIncl && freq !== "custom");
      setVatRate(String(storedRate));
      setFirstDueDate(contract.first_due_date || "");
      const storedFixed = Array.isArray(contract.fixed_charges) ? contract.fixed_charges : [];
      setFixedRows(
        storedFixed.length
          ? storedFixed.map((c) =>
              newFixedRow({
                label: c.label || "",
                amount: moneyValue(c.amount).toFixed(2),
                taxable: c.taxable === true,
              }),
            )
          : moneyValue(contract.fixed_amount) > 0
            ? [newFixedRow({ label: "مبالغ ثابتة", amount: moneyValue(contract.fixed_amount).toFixed(2) })]
            : [],
      );
      const payments = Array.isArray(contract.payments) ? contract.payments : [];
      setCustomRows(
        freq === "custom"
          ? payments
              .filter((p) => p.status !== "cancelled")
              .map((p) =>
                newCustomRow({
                  due_date: p.due_date || "",
                  amount: Math.max(moneyValue(p.amount_excl) - moneyValue(p.fixed_excl), 0).toFixed(2),
                  description: p.notes || "",
                  status: p.status || "pending",
                }),
              )
          : [],
      );
      setNotes(contract.notes || "");
      setTerminated(contract.status === "terminated");
      setAttachmentUrl(contract.attachment_url || "");
      setAttachmentName(contract.attachment_name || "");
      setAnalysisJson(contract.analysis_json || null);
    } else {
      setContractNumber("");
      setDisplayName("");
      setContactId("");
      setLessorName("");
      setLessorVat("");
      setLocation("");
      setContractType("branch");
      setBranchId("");
      setStartDate("");
      setEndDate("");
      setNoticeDays("");
      setNoticeText("");
      setFrequency("monthly");
      setAmount("");
      setIncludesVat(false);
      setVatRate(String(DEFAULT_VAT_RATE));
      setFirstDueDate("");
      setCustomRows([]);
      setFixedRows([]);
      setNotes("");
      setTerminated(false);
      setAttachmentUrl("");
      setAttachmentName("");
      setAnalysisJson(null);
    }
    // تُعاد التهيئة عند الفتح أو تبديل العقد فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract?.id]);

  // ---------- الخيارات ----------

  const contactOptions = useMemo(
    () => [
      { value: "", label: "بدون ربط بجهة اتصال" },
      ...contacts
        .filter((c) => c.is_active !== false || String(c.id) === contactId)
        .map((c) => ({
          value: String(c.id),
          label: c.vat_number ? `${c.name} — ${c.vat_number}` : c.name,
        })),
    ],
    [contacts, contactId],
  );

  const branchOptions = useMemo(
    () => [
      { value: "", label: "بدون فرع" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  const handleContactChange = (value) => {
    setContactId(value);
    autoFilledRef.current.delete("contact");
    const contact = contacts.find((c) => String(c.id) === String(value));
    if (contact) {
      setLessorName(contact.name || "");
      setLessorVat(contact.vat_number || "");
      autoFilledRef.current.delete("lessor");
      autoFilledRef.current.delete("vat");
    }
  };

  const touch = (field) => {
    touchedRef.current.add(field);
    autoFilledRef.current.delete(field);
  };

  // ---------- المعاينة الحية ----------

  const vatRateValue = Math.min(Math.max(moneyValue(vatRate), 0), 100);
  const fixedSplit = useMemo(
    () => splitFixedCharges(fixedRows.map((row) => ({ amount: moneyValue(row.amount), taxable: row.taxable }))),
    [fixedRows],
  );
  const fixedTotal = fixedSplit.total;

  const previewRows = useMemo(() => {
    if (frequency === "custom") {
      return customRows
        .filter((row) => isDateKey(row.due_date) && moneyValue(row.amount) > 0)
        .slice()
        .sort((a, b) => compareDateKeys(a.due_date, b.due_date))
        .map((row, index) => ({
          seq: index + 1,
          due_date: row.due_date,
          period_start: null,
          period_end: null,
          description: row.description || "",
          status: row.status || "pending",
          ...installmentWithFixed({
            amount: row.amount,
            fixedAmount: fixedSplit.exempt,
            fixedTaxableAmount: fixedSplit.taxable,
            vatRate: vatRateValue,
            amountIncludesVat: includesVat,
          }),
        }));
    }
    return generateSchedule({
      startDate,
      endDate,
      frequency,
      amount,
      fixedAmount: fixedSplit.exempt,
      fixedTaxableAmount: fixedSplit.taxable,
      vatRate: vatRateValue,
      amountIncludesVat: includesVat,
      firstDueDate: isDateKey(firstDueDate) ? firstDueDate : null,
    });
  }, [
    frequency,
    customRows,
    fixedSplit,
    startDate,
    endDate,
    amount,
    vatRateValue,
    includesVat,
    firstDueDate,
  ]);

  const totals = useMemo(() => {
    let excl = 0;
    let vat = 0;
    let incl = 0;
    for (const row of previewRows) {
      excl += moneyValue(row.amount_excl);
      vat += moneyValue(row.vat_amount);
      incl += moneyValue(row.amount_incl);
    }
    return { excl: round2(excl), vat: round2(vat), incl: round2(incl) };
  }, [previewRows]);

  const installment = useMemo(
    () =>
      installmentWithFixed({
        amount,
        fixedAmount: fixedSplit.exempt,
        fixedTaxableAmount: fixedSplit.taxable,
        vatRate: vatRateValue,
        amountIncludesVat: includesVat,
      }),
    [amount, fixedSplit, vatRateValue, includesVat],
  );

  const today = useMemo(() => todayRiyadh(), []);
  const computedStatus = contractStatus({
    status: terminated ? "terminated" : "active",
    startDate,
    endDate,
    noticePeriodDays: intOrNull(noticeDays),
    today,
  });
  const noticeStartsOn =
    isDateKey(endDate) && intOrNull(noticeDays) > 0
      ? addDays(endDate, -intOrNull(noticeDays))
      : null;

  // الدفعات المخصصة: مقارنة (الاستحقاق، المبلغ قبل الضريبة) لغير الملغاة.
  const customRowsChanged = useMemo(() => {
    if (!isEditing || frequency !== "custom") return false;
    const saved = (Array.isArray(contract?.payments) ? contract.payments : [])
      .filter((p) => p.status !== "cancelled")
      .map((p) => `${p.due_date}|${Math.max(moneyValue(p.amount_excl) - moneyValue(p.fixed_excl), 0).toFixed(2)}`)
      .sort();
    const current = customRows
      .filter((row) => row.due_date || moneyValue(row.amount) > 0)
      .map((row) => {
        const money = installmentAmounts({
          amount: moneyValue(row.amount),
          vatRate: vatRateValue,
          amountIncludesVat: includesVat,
        });
        return `${row.due_date}|${money.amount_excl.toFixed(2)}`;
      })
      .sort();
    return saved.join(",") !== current.join(",");
  }, [isEditing, frequency, contract, customRows, vatRateValue, includesVat]);

  // هل تغيّرت إعدادات الجدول عن العقد المحفوظ؟ (تلميح إعادة التوليد)
  const scheduleChanged =
    isEditing &&
    (startDate !== (contract.start_date || "") ||
      endDate !== (contract.end_date || "") ||
      frequency !== (contract.payment_frequency || "monthly") ||
      (frequency !== "custom" &&
        Math.abs(installment.rent_excl - moneyValue(contract.installment_amount)) > 0.005) ||
      Math.abs(fixedTotal - moneyValue(contract.fixed_amount)) > 0.005 ||
      Math.abs(vatRateValue - moneyValue(contract.vat_rate ?? DEFAULT_VAT_RATE)) > 0.005 ||
      (firstDueDate || "") !== (contract.first_due_date || "") ||
      (frequency === "custom" && customRowsChanged));

  // ---------- التحقق ----------

  const errors = useMemo(() => {
    const list = [];
    if (!lessorName.trim()) list.push("اسم المؤجر مطلوب.");
    if (!isDateKey(startDate)) list.push("تاريخ البداية مطلوب.");
    if (!isDateKey(endDate)) list.push("تاريخ الانتهاء مطلوب.");
    if (isDateKey(startDate) && isDateKey(endDate) && compareDateKeys(endDate, startDate) < 0)
      list.push("تاريخ الانتهاء قبل تاريخ البداية.");
    if (!(vatRateValue >= 0 && vatRateValue <= 100)) list.push("نسبة الضريبة بين 0 و100.");
    if (frequency === "custom") {
      if (previewRows.length === 0)
        list.push("أضف دفعة واحدة على الأقل بتاريخ استحقاق ومبلغ أكبر من صفر.");
    } else {
      if (!(installment.rent_excl > 0)) list.push("قيمة الدفعة مطلوبة.");
      else if (isDateKey(startDate) && isDateKey(endDate) && previewRows.length === 0)
        list.push("لا تنتج أي دفعة — تحقق من أول استحقاق (يجب ألا يتجاوز نهاية العقد).");
    }
    return list;
  }, [
    lessorName,
    startDate,
    endDate,
    vatRateValue,
    frequency,
    previewRows.length,
    installment.rent_excl,
  ]);

  const canSubmit = errors.length === 0 && !isSubmitting && !uploading && !scanBusy;

  const handleSubmit = (event) => {
    event?.preventDefault?.();
    if (!canSubmit) return;
    const payload = {
      contract_number: contractNumber.trim() || null,
      display_name: displayName.trim() || null,
      lessor_name: lessorName.trim(),
      lessor_contact_id: contactId ? Number(contactId) : null,
      lessor_vat_number: lessorVat.trim() || null,
      location: location.trim() || null,
      contract_type: contractType,
      branch_id: branchId ? Number(branchId) : null,
      start_date: startDate,
      end_date: endDate,
      notice_period_days: intOrNull(noticeDays),
      notice_period_text: noticeText.trim() || null,
      payment_frequency: frequency,
      installment_amount: frequency === "custom" ? 0 : moneyValue(amount),
      vat_rate: vatRateValue,
      amount_includes_vat: !!includesVat,
      fixed_charges: fixedRows
        .filter((row) => moneyValue(row.amount) > 0 || row.label.trim())
        .map((row) => ({
          label: row.label.trim() || "مبلغ ثابت",
          amount: moneyValue(row.amount),
          taxable: row.taxable === true,
        })),
      first_due_date:
        frequency === "custom" ? null : isDateKey(firstDueDate) ? firstDueDate : null,
      notes: notes.trim() || null,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      analysis_json: analysisJson || null,
      status: terminated ? "terminated" : "active",
    };
    if (frequency === "custom") {
      // المسددة لا تُرسل — الخادم يبقيها كما هي عند إعادة التوليد.
      payload.payments = previewRows
        .filter((row) => row.status !== "paid")
        .map((row) => ({
          due_date: row.due_date,
          amount_excl: row.rent_excl ?? row.amount_excl,
          vat_rate: row.vat_rate,
          description: row.description || null,
        }));
    }
    if (isEditing) {
      payload.id = contract.id;
      payload.expected_updated_at = contract.updated_at || null;
      payload.regenerate_schedule = !!regenerate;
    }
    onSubmit(payload);
  };

  // ---------- الرفع والتحليل ----------

  const applyAnalysis = (analysis) => {
    const owned = autoFilledRef.current;
    const touched = touchedRef.current;
    const canFill = (field, isEmpty) => isEmpty || owned.has(field);
    const canFillDefault = (field) => !touched.has(field) || owned.has(field);
    const filled = [];

    if (analysis.contract_number && canFill("number", !contractNumber.trim())) {
      setContractNumber(String(analysis.contract_number));
      owned.add("number");
      filled.push("رقم العقد");
    }

    const matched = analysis.lessor_contact_id
      ? contacts.find((c) => Number(c.id) === Number(analysis.lessor_contact_id))
      : null;
    if (matched && canFill("contact", !contactId)) {
      setContactId(String(matched.id));
      setLessorName(matched.name || analysis.lessor_name || "");
      setLessorVat(matched.vat_number || analysis.lessor_vat_number || "");
      owned.add("contact");
      owned.add("lessor");
      owned.add("vat");
      filled.push("المؤجر (جهة اتصال مسجلة)");
    } else {
      if (analysis.lessor_name && canFill("lessor", !lessorName.trim())) {
        setLessorName(String(analysis.lessor_name));
        owned.add("lessor");
        filled.push("اسم المؤجر");
      }
      if (analysis.lessor_vat_number && canFill("vat", !lessorVat.trim())) {
        setLessorVat(String(analysis.lessor_vat_number));
        owned.add("vat");
        filled.push("الرقم الضريبي");
      }
    }

    if (CONTRACT_TYPES.includes(analysis.contract_type) && canFillDefault("contractType")) {
      setContractType(analysis.contract_type);
      owned.add("contractType");
      filled.push(`نوع العقد (${CONTRACT_TYPE_LABELS[analysis.contract_type]})`);
    }
    if (analysis.location && canFill("location", !location.trim())) {
      setLocation(String(analysis.location));
      owned.add("location");
      filled.push("الموقع");
    }
    if (ISO_DATE.test(analysis.start_date || "") && canFill("start", !startDate)) {
      setStartDate(analysis.start_date);
      owned.add("start");
      filled.push("تاريخ البداية");
    }
    if (ISO_DATE.test(analysis.end_date || "") && canFill("end", !endDate)) {
      setEndDate(analysis.end_date);
      owned.add("end");
      filled.push("تاريخ الانتهاء");
    }
    const days = intOrNull(analysis.notice_period_days);
    if (days !== null && days > 0 && canFill("noticeDays", !noticeDays)) {
      setNoticeDays(String(days));
      owned.add("noticeDays");
      filled.push("فترة الإشعار");
    }
    if (analysis.notice_period_text && canFill("noticeText", !noticeText.trim())) {
      setNoticeText(String(analysis.notice_period_text));
      owned.add("noticeText");
    }

    const freq = LEASE_FREQUENCIES.includes(analysis.payment_frequency)
      ? analysis.payment_frequency
      : null;
    const payments = Array.isArray(analysis.payments)
      ? analysis.payments.filter(
          (p) => ISO_DATE.test(p?.due_date || "") && moneyValue(p?.amount) > 0,
        )
      : [];
    if (freq && canFillDefault("frequency")) {
      setFrequency(freq);
      owned.add("frequency");
      filled.push(`التكرار (${FREQUENCY_LABELS[freq]})`);
    }
    if (
      moneyValue(analysis.installment_amount) > 0 &&
      canFill("amount", !moneyValue(amount))
    ) {
      setAmount(moneyValue(analysis.installment_amount).toFixed(2));
      owned.add("amount");
      filled.push("قيمة الدفعة");
    }
    if (
      analysis.vat_rate !== null &&
      analysis.vat_rate !== undefined &&
      Number.isFinite(Number(analysis.vat_rate)) &&
      canFillDefault("vatRate")
    ) {
      setVatRate(String(moneyValue(analysis.vat_rate)));
      owned.add("vatRate");
    }
    // التحليل يعيد قيمة الدفعة قبل الضريبة دائمًا؛ لذا لا يُفعَّل مفتاح
    // «شامل الضريبة» منه (وإلا خُصمت الضريبة مرتين).
    if (
      moneyValue(analysis.installment_amount) > 0 &&
      owned.has("amount") &&
      canFillDefault("includesVat")
    ) {
      setIncludesVat(false);
      owned.add("includesVat");
    }
    const analysedFixed = Array.isArray(analysis.fixed_charges)
      ? analysis.fixed_charges.filter((c) => moneyValue(c?.amount) > 0)
      : [];
    const fixedEmpty = fixedRows.every((row) => !row.label.trim() && !moneyValue(row.amount));
    if (analysedFixed.length > 0 && canFill("fixed", fixedEmpty)) {
      setFixedRows(
        analysedFixed.map((c) =>
          newFixedRow({
            label: c.label || "مبلغ ثابت",
            amount: moneyValue(c.amount).toFixed(2),
            taxable: c.taxable === true,
          }),
        ),
      );
      owned.add("fixed");
      filled.push(`المبالغ الثابتة (${analysedFixed.length})`);
    }
    if (ISO_DATE.test(analysis.first_due_date || "") && canFill("firstDue", !firstDueDate)) {
      setFirstDueDate(analysis.first_due_date);
      owned.add("firstDue");
      filled.push("أول استحقاق");
    }
    const rowsEmpty = customRows.every(
      (row) => !row.due_date && !moneyValue(row.amount),
    );
    if (payments.length > 0 && (freq === "custom" || !freq) && canFill("customRows", rowsEmpty)) {
      setCustomRows(
        payments.map((p) =>
          newCustomRow({
            due_date: p.due_date,
            amount: moneyValue(p.amount).toFixed(2),
            description: p.description || "",
          }),
        ),
      );
      owned.add("customRows");
      if (!freq) {
        setFrequency("custom");
        owned.add("frequency");
      }
      filled.push(`جدول الدفعات (${payments.length})`);
    }

    setAnalysisJson(analysis);

    const notesParts = [];
    if (analysis.operator_note) notesParts.push(String(analysis.operator_note));
    if (!matched && (analysis.lessor_name || analysis.lessor_vat_number)) {
      notesParts.push(
        "ما لقيت مؤجراً مطابقاً في جهات الاتصال — يمكنك ربطه لاحقاً من قائمة «جهة اتصال مسجلة».",
      );
    }
    if (moneyValue(analysis.total_contract_value) > 0) {
      notesParts.push(
        `إجمالي العقد حسب المستند: ${formatMoney(analysis.total_contract_value)} — قارنه بإجمالي المعاينة.`,
      );
    }
    setScanSummary({
      filled,
      smart: true,
      warning: notesParts.length ? notesParts.join(" • ") : null,
    });
  };

  const runAnalysis = async (fileArg) => {
    const file = fileArg || analysisFile;
    if (!file) return;
    const mediaType =
      file.type || (/\.pdf$/i.test(file.name || "") ? "application/pdf" : "");
    if (!ANALYZABLE_MEDIA_RE.test(mediaType)) {
      setScanSummary({
        filled: [],
        warning: "صيغة الملف غير مدعومة للتحليل (PDF / JPG / PNG / WebP) — تم إرفاقه فقط.",
      });
      return;
    }
    let scanFile = file;
    if (mediaType.startsWith("image/") && file.size > MAX_SMART_FILE_BYTES) {
      try {
        const { compressImage } = await import("@/utils/compressImage");
        scanFile = await compressImage(file);
      } catch {
        // نبقي الأصل؛ فحص الحجم أدناه يقرر
      }
    }
    if (scanFile.size > MAX_SMART_FILE_BYTES) {
      setScanSummary({
        filled: [],
        warning: "الملف أكبر من 3MB — تم إرفاقه دون تحليل. صغّره أو أدخل البيانات يدوياً.",
      });
      return;
    }
    setScanBusy(true);
    setScanSummary({ filled: [], warning: "جاري التحليل الذكي للعقد… ثوانٍ معدودة." });
    try {
      const analysis = await analyzeMut.mutateAsync({
        file_base64: await fileToBase64(scanFile),
        media_type: scanFile.type || mediaType,
      });
      if (!analysis) {
        setScanSummary({ filled: [], warning: "لم يُرجع التحليل أي بيانات — عبّئ الحقول يدوياً." });
        return;
      }
      applyAnalysis(analysis);
    } catch (error) {
      setScanSummary({
        filled: [],
        warning: `التحليل الذكي فشل: ${error?.message || "خطأ غير معروف"} — تم إرفاق الملف، عبّئ الحقول يدوياً.`,
      });
    } finally {
      setScanBusy(false);
    }
  };

  const handleFilePicked = async (fileArg) => {
    if (!fileArg) return;
    setAnalysisFile(fileArg);
    setUploading(true);
    try {
      const result = await upload({ file: fileArg, unoptimized: true });
      if (result?.error) {
        setScanSummary({ filled: [], warning: `فشل رفع الملف: ${result.error}` });
        return;
      }
      setAttachmentUrl(result.url || "");
      setAttachmentName(fileArg.name || "");
    } catch (error) {
      // upload() يرمي خطأً للملفات الأكبر من الحد.
      setScanSummary({
        filled: [],
        warning: `فشل رفع الملف: ${error?.message || "خطأ غير معروف"}`,
      });
      return;
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    // عقد جديد: نحلل مباشرة بعد الرفع؛ في التعديل يقرر المستخدم بالزر.
    if (!isEditing) await runAnalysis(fileArg);
  };

  // ---------- دفعات مخصصة ----------

  const updateCustomRow = (key, patch) => {
    autoFilledRef.current.delete("customRows");
    setCustomRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };
  const removeCustomRow = (key) => {
    autoFilledRef.current.delete("customRows");
    setCustomRows((rows) => rows.filter((row) => row.key !== key));
  };
  const addCustomRow = () => {
    autoFilledRef.current.delete("customRows");
    setCustomRows((rows) => {
      const last = rows[rows.length - 1];
      return [
        ...rows,
        newCustomRow({
          due_date: "",
          amount: last?.amount || "",
        }),
      ];
    });
  };

  if (!open || typeof document === "undefined") return null;

  const analysisEligible =
    !!analysisFile &&
    ANALYZABLE_MEDIA_RE.test(
      analysisFile.type ||
        (/\.pdf$/i.test(analysisFile.name || "") ? "application/pdf" : ""),
    );

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-5xl rounded-t-3xl sm:rounded-3xl max-h-[94svh] flex flex-col overflow-hidden`}
      >
        {/* الرأس */}
        <div
          className={`px-4 sm:px-6 py-3 flex items-center gap-3 border-b ${ws.divider} shrink-0`}
        >
          <div className={`${ws.iconBox} w-9 h-9 text-[#0e7a5f] dark:text-emerald-200 shrink-0`}>
            <ScrollText className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
              {isEditing ? "تعديل عقد إيجار" : "عقد إيجار جديد"}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/45 truncate">
              جدول الدفعات يُولَّد تلقائياً من المدة والتكرار — راجع المعاينة قبل الحفظ.
            </div>
          </div>
          <span
            className={`hidden sm:inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold shrink-0 ${statusPillClass(computedStatus)}`}
          >
            {CONTRACT_STATUS_LABELS[computedStatus] || computedStatus}
          </span>
          <button
            type="submit"
            form="lease-contract-form"
            disabled={!canSubmit}
            className={`${ws.btnPrimary} px-4 py-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEditing ? "حفظ التعديلات" : "حفظ العقد"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9 shrink-0`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/*"
          onChange={(event) => handleFilePicked(event?.target?.files?.[0])}
          className="hidden"
        />

        {/* الجسم */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          {/* grid-cols-1 صراحةً: العمود الضمني (auto) يتمدد بعرض أطول سطر ويتجاوز
              الشاشة على الجوال. */}
          <form
            id="lease-contract-form"
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start w-full max-w-full min-w-0"
          >
            <div className="space-y-4 min-w-0">
              {/* رفع العقد وتحليله */}
              <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
                <SectionTitle icon={Sparkles}>رفع العقد وتحليله ذكياً</SectionTitle>
                <div className="text-[11px] text-slate-500 dark:text-white/45 leading-relaxed">
                  ارفع نسخة العقد (PDF أو صورة). الملفات حتى 3MB تُحلَّل وتُعبَّأ
                  الحقول الفارغة تلقائياً: رقم العقد، المؤجر، الموقع، المدة، فترة
                  الإشعار، والدفعات — ما كتبته بنفسك لا يُستبدل.
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={uploading || scanBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50`}
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {uploading ? "جاري الرفع…" : attachmentUrl ? "استبدال الملف" : "رفع ملف العقد"}
                  </button>
                  <button
                    type="button"
                    disabled={!analysisEligible || uploading || scanBusy}
                    onClick={() => runAnalysis()}
                    className={`${ws.btnPrimary} px-3 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={
                      analysisEligible
                        ? "تحليل الملف المرفوع وتعبئة الحقول الفارغة"
                        : "ارفع ملف PDF أو صورة أولاً"
                    }
                  >
                    {scanBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {scanBusy ? "جاري التحليل…" : "تحليل ذكي"}
                  </button>
                  {attachmentUrl ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-white/70 min-w-0">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[220px]" dir="ltr">
                        {attachmentName || "ملف مرفق"}
                      </span>
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0e7a5f] dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        فتح
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachmentUrl("");
                          setAttachmentName("");
                          setAnalysisFile(null);
                        }}
                        className="text-slate-400 hover:text-red-600 dark:text-white/40 dark:hover:text-red-300"
                        title="إزالة المرفق"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {scanSummary ? (
                  <div className={`${ws.glassSoft} ${ws.card} p-3 space-y-1.5`}>
                    {scanSummary.filled.length > 0 ? (
                      <div className="flex items-center gap-2 flex-wrap text-xs text-[#0b3d31] dark:text-emerald-200">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span>تحليل ذكي — تمت تعبئة:</span>
                        {scanSummary.filled.map((label) => (
                          <span
                            key={label}
                            className={`${ws.pill} bg-[#e7f2ee] dark:bg-emerald-400/10 text-[#0e7a5f] dark:text-emerald-200 border-[#c9e2d8] dark:border-emerald-400/25`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {scanSummary.warning ? (
                      <div className="text-xs text-amber-700 dark:text-amber-200 leading-relaxed">
                        {scanSummary.warning}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* بيانات العقد */}
              <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
                <SectionTitle icon={ScrollText}>بيانات العقد</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>رقم العقد</FieldLabel>
                    <input
                      type="text"
                      value={contractNumber}
                      onChange={(event) => {
                        setContractNumber(event.target.value);
                        autoFilledRef.current.delete("number");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      placeholder="مثال: C-2026-01"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <FieldLabel hint="اسم مختصر يظهر في الجداول بجانب النوع — مثل اسم الفرع">
                      الاسم المعرِّف
                    </FieldLabel>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      placeholder="مثال: فرع العزيزية"
                    />
                  </div>
                  <div>
                    <FieldLabel hint="اختياري">جهة اتصال مسجلة</FieldLabel>
                    <GlassSelect
                      value={contactId}
                      onChange={handleContactChange}
                      options={contactOptions}
                      placeholder="بدون ربط بجهة اتصال"
                      searchable
                      searchPlaceholder="ابحث بالاسم أو الرقم الضريبي…"
                      buttonClassName="text-sm py-2 px-3"
                    />
                  </div>
                  <div>
                    <FieldLabel required>اسم المؤجر</FieldLabel>
                    <input
                      type="text"
                      value={lessorName}
                      onChange={(event) => {
                        setLessorName(event.target.value);
                        autoFilledRef.current.delete("lessor");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      placeholder="اسم المالك أو الشركة المؤجرة"
                    />
                  </div>
                  <div>
                    <FieldLabel>الرقم الضريبي للمؤجر</FieldLabel>
                    <input
                      type="text"
                      value={lessorVat}
                      onChange={(event) => {
                        setLessorVat(event.target.value);
                        autoFilledRef.current.delete("vat");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm font-mono`}
                      placeholder="3xxxxxxxxxxxxx3"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <FieldLabel>نوع العقد</FieldLabel>
                    <div className={`${ws.segWrap} flex-wrap`}>
                      {CONTRACT_TYPES.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setContractType(key);
                            touch("contractType");
                          }}
                          className={`${ws.segBtn} text-xs px-3 py-1.5 ${
                            contractType === key ? ws.segActive : ws.segInactive
                          }`}
                        >
                          {CONTRACT_TYPE_LABELS[key]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>الموقع</FieldLabel>
                    <input
                      type="text"
                      value={location}
                      onChange={(event) => {
                        setLocation(event.target.value);
                        autoFilledRef.current.delete("location");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      placeholder="المدينة — الحي — وصف العين المؤجرة"
                    />
                  </div>
                  <div>
                    <FieldLabel>الفرع</FieldLabel>
                    <GlassSelect
                      value={branchId}
                      onChange={setBranchId}
                      options={branchOptions}
                      placeholder="بدون فرع"
                      buttonClassName="text-sm py-2 px-3"
                    />
                  </div>
                </div>
              </div>

              {/* المدة والإشعار */}
              <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
                <SectionTitle icon={CalendarClock}>المدة وفترة الإشعار</SectionTitle>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel required>تاريخ البداية</FieldLabel>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        setStartDate(event.target.value);
                        autoFilledRef.current.delete("start");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <FieldLabel required>تاريخ الانتهاء</FieldLabel>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => {
                        setEndDate(event.target.value);
                        autoFilledRef.current.delete("end");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <FieldLabel hint="أيام قبل الانتهاء">فترة الإشعار</FieldLabel>
                    <input
                      type="number"
                      value={noticeDays}
                      min="0"
                      step="1"
                      onChange={(event) => {
                        setNoticeDays(event.target.value);
                        autoFilledRef.current.delete("noticeDays");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      placeholder="مثال: 90"
                      dir="ltr"
                    />
                    {noticeStartsOn ? (
                      <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                        تبدأ فترة الإشعار في{" "}
                        <span dir="ltr" className="font-mono">
                          {noticeStartsOn}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <FieldLabel hint="نص من العقد">صيغة الإشعار</FieldLabel>
                    <input
                      type="text"
                      value={noticeText}
                      onChange={(event) => {
                        setNoticeText(event.target.value);
                        autoFilledRef.current.delete("noticeText");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm`}
                      placeholder="مثال: إشعار كتابي قبل 90 يوماً من الانتهاء"
                    />
                  </div>
                </div>
              </div>

              {/* الدفعات */}
              <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
                <SectionTitle icon={CalendarClock}>الدفعات</SectionTitle>
                <div>
                  <FieldLabel>التكرار</FieldLabel>
                  <div className={`${ws.segWrap} flex-wrap`}>
                    {LEASE_FREQUENCIES.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setFrequency(key);
                          touch("frequency");
                        }}
                        className={`${ws.segBtn} text-xs px-3 py-1.5 ${
                          frequency === key ? ws.segActive : ws.segInactive
                        }`}
                      >
                        {FREQUENCY_LABELS[key]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  {frequency !== "custom" ? (
                    <div>
                      <FieldLabel required>قيمة الدفعة</FieldLabel>
                      <input
                        type="number"
                        value={amount}
                        min="0"
                        step="0.01"
                        onChange={(event) => {
                          setAmount(event.target.value);
                          autoFilledRef.current.delete("amount");
                        }}
                        className={`${ws.input} px-3 py-2 text-sm text-right`}
                        placeholder="0.00"
                        dir="ltr"
                      />
                    </div>
                  ) : null}
                  <div>
                    <FieldLabel>نسبة الضريبة %</FieldLabel>
                    <input
                      type="number"
                      value={vatRate}
                      min="0"
                      max="100"
                      step="0.01"
                      onChange={(event) => {
                        setVatRate(event.target.value);
                        touch("vatRate");
                      }}
                      className={`${ws.input} px-3 py-2 text-sm text-right`}
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75">
                      <input
                        type="checkbox"
                        checked={includesVat}
                        onChange={(event) => {
                          setIncludesVat(event.target.checked);
                          touch("includesVat");
                        }}
                        className="accent-[#0e7a5f]"
                      />
                      المبلغ شامل الضريبة
                    </label>
                  </div>
                </div>

                <div className={`${ws.glassSoft} ${ws.card} p-3 space-y-2`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <FieldLabel hint="رسوم خدمات، صيانة، حراسة… تُضاف إلى كل دفعة بعد الضريبة (الضريبة على الأجرة فقط) ما لم تُعلَّم «خاضع»">
                      المبالغ الثابتة لكل دفعة
                    </FieldLabel>
                    <button
                      type="button"
                      onClick={() => {
                        autoFilledRef.current.delete("fixed");
                        setFixedRows((rows) => [...rows, newFixedRow()]);
                      }}
                      className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة مبلغ ثابت
                    </button>
                  </div>
                  {fixedRows.length === 0 ? (
                    <div className="text-[11px] text-slate-500 dark:text-white/45">
                      لا مبالغ ثابتة — الدفعة = الأجرة فقط.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fixedRows.map((row) => (
                        <div key={row.key} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <input
                            type="text"
                            value={row.label}
                            onChange={(event) => {
                              autoFilledRef.current.delete("fixed");
                              const value = event.target.value;
                              setFixedRows((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, label: value } : r)),
                              );
                            }}
                            className={`${ws.input} px-3 py-2 text-sm flex-1 min-w-[10rem]`}
                            placeholder="مثال: رسوم خدمات"
                          />
                          <input
                            type="number"
                            value={row.amount}
                            min="0"
                            step="0.01"
                            onChange={(event) => {
                              autoFilledRef.current.delete("fixed");
                              const value = event.target.value;
                              setFixedRows((rows) =>
                                rows.map((r) => (r.key === row.key ? { ...r, amount: value } : r)),
                              );
                            }}
                            className={`${ws.input} px-3 py-2 text-sm text-right w-32`}
                            placeholder="0.00"
                            dir="ltr"
                          />
                          <label
                            className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-white/60 whitespace-nowrap cursor-pointer select-none"
                            title="تُطبَّق ضريبة القيمة المضافة على هذا المبلغ"
                          >
                            <input
                              type="checkbox"
                              checked={row.taxable === true}
                              onChange={(event) => {
                                autoFilledRef.current.delete("fixed");
                                const checked = event.target.checked;
                                setFixedRows((rows) =>
                                  rows.map((r) => (r.key === row.key ? { ...r, taxable: checked } : r)),
                                );
                              }}
                              className="accent-[#0e7a5f]"
                            />
                            خاضع
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              autoFilledRef.current.delete("fixed");
                              setFixedRows((rows) => rows.filter((r) => r.key !== row.key));
                            }}
                            className={ws.iconButton}
                            title="حذف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#e2e7e4] dark:border-white/10">
                        <span className="text-slate-500 dark:text-white/45">
                          مجموع المبالغ الثابتة لكل دفعة
                          {fixedSplit.taxable > 0 ? ` (منها ${formatMoney(fixedSplit.taxable)} خاضع للضريبة)` : " (معفاة من الضريبة)"}
                        </span>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
                          {formatMoney(fixedTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {frequency !== "custom" ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel hint="افتراضياً تاريخ البداية">أول استحقاق</FieldLabel>
                      <input
                        type="date"
                        value={firstDueDate}
                        onChange={(event) => {
                          setFirstDueDate(event.target.value);
                          touch("firstDue");
                        }}
                        className={`${ws.input} px-3 py-2 text-sm`}
                        dir="ltr"
                      />
                    </div>
                    <div className={`${ws.glassSoft} ${ws.card} p-3 text-xs space-y-1`}>
                      {fixedTotal > 0 ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-white/45">الأجرة</span>
                            <span className="tabular-nums text-slate-800 dark:text-white/85" dir="ltr">
                              {formatMoney(installment.rent_excl)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-white/45">
                              مبالغ ثابتة{installment.fixed_exempt_excl > 0 ? " (بلا ضريبة)" : ""}
                            </span>
                            <span className="tabular-nums text-slate-800 dark:text-white/85" dir="ltr">
                              {formatMoney(installment.fixed_excl)}
                            </span>
                          </div>
                        </>
                      ) : null}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-white/45">قبل الضريبة</span>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
                          {formatMoney(installment.amount_excl)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-white/45">
                          الضريبة {vatRateValue}%
                        </span>
                        <span className="tabular-nums" dir="ltr">
                          {formatMoney(installment.vat_amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-white/45">شامل الضريبة</span>
                        <span className="font-bold tabular-nums text-[#0e7a5f] dark:text-emerald-200" dir="ltr">
                          {formatMoney(installment.amount_incl)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[11px] text-slate-500 dark:text-white/45">
                      أدخل كل دفعة بتاريخها ومبلغها{" "}
                      {includesVat ? "(شامل الضريبة)" : "(قبل الضريبة)"} — تُرتَّب
                      تلقائياً حسب التاريخ.
                      {isEditing
                        ? " الدفعات المسددة تبقى كما هي في الخادم حتى لو حُذفت هنا."
                        : ""}
                    </div>
                    {customRows.length === 0 ? (
                      <div className={`${ws.glassSoft} ${ws.card} p-3 text-xs text-slate-500 dark:text-white/45 text-center`}>
                        لا دفعات بعد — أضف الدفعة الأولى.
                      </div>
                    ) : null}
                    {customRows.map((row, index) => (
                      <div
                        key={row.key}
                        className={`grid grid-cols-[auto_1fr_1fr_auto] sm:grid-cols-[auto_150px_130px_1fr_auto] gap-2 items-center ${
                          row.status === "paid" ? "opacity-70" : ""
                        }`}
                      >
                        <span className="text-[11px] text-slate-400 dark:text-white/35 w-5 text-center">
                          {index + 1}
                        </span>
                        <input
                          type="date"
                          value={row.due_date}
                          disabled={row.status === "paid"}
                          onChange={(event) =>
                            updateCustomRow(row.key, { due_date: event.target.value })
                          }
                          className={`${ws.input} px-2 py-1.5 text-xs`}
                          dir="ltr"
                        />
                        <input
                          type="number"
                          value={row.amount}
                          min="0"
                          step="0.01"
                          disabled={row.status === "paid"}
                          onChange={(event) =>
                            updateCustomRow(row.key, { amount: event.target.value })
                          }
                          className={`${ws.input} px-2 py-1.5 text-xs text-right`}
                          placeholder="0.00"
                          dir="ltr"
                        />
                        <input
                          type="text"
                          value={row.description}
                          onChange={(event) =>
                            updateCustomRow(row.key, { description: event.target.value })
                          }
                          className={`${ws.input} px-2 py-1.5 text-xs col-span-4 sm:col-span-1`}
                          placeholder={
                            row.status === "paid" ? "مسددة" : "وصف (اختياري)"
                          }
                        />
                        <button
                          type="button"
                          disabled={row.status === "paid"}
                          onClick={() => removeCustomRow(row.key)}
                          className={`${ws.iconButton} w-8 h-8 hover:text-red-700 dark:hover:text-red-200 disabled:opacity-40 col-start-4 sm:col-start-auto row-start-1 sm:row-start-auto`}
                          title="حذف الدفعة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCustomRow}
                      className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      إضافة دفعة
                    </button>
                  </div>
                )}
              </div>

              {/* ملاحظات + خيارات التعديل */}
              <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
                <div>
                  <FieldLabel>ملاحظات</FieldLabel>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    className={`${ws.input} px-3 py-2 text-sm resize-y`}
                    placeholder="شروط خاصة، بيانات التواصل مع المؤجر، ملاحظات التجديد…"
                  />
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75">
                      <input
                        type="checkbox"
                        checked={regenerate}
                        onChange={(event) => setRegenerate(event.target.checked)}
                        className="accent-[#0e7a5f] mt-1"
                      />
                      <span>
                        إعادة توليد جدول الدفعات (تبقى المسددة كما هي)
                        <span className="block text-[11px] text-slate-500 dark:text-white/45">
                          تُحذف الدفعات المعلّقة/الملغاة وتُستبدل بالجدول الظاهر في
                          المعاينة؛ الدفعات المسددة لا تُمس.
                        </span>
                      </span>
                    </label>
                    {scheduleChanged && !regenerate ? (
                      <div className="text-[11px] text-amber-700 dark:text-amber-200">
                        غيّرت إعدادات الدفعات — فعّل «إعادة توليد الجدول» ليتحدّث جدول
                        الدفعات، وإلا يُحفظ رأس العقد فقط.
                      </div>
                    ) : null}
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-rose-700 dark:text-rose-300">
                      <input
                        type="checkbox"
                        checked={terminated}
                        onChange={(event) => setTerminated(event.target.checked)}
                        className="accent-[#b5443c]"
                      />
                      إنهاء العقد (مُنهى قبل موعده)
                    </label>
                  </div>
                ) : null}
              </div>
            </div>

            {/* المعاينة الحية */}
            <aside className="space-y-3 lg:sticky lg:top-0 min-w-0">
              <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
                <SectionTitle icon={CalendarClock}>معاينة جدول الدفعات</SectionTitle>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`${ws.glassSoft} ${ws.card} p-2.5`}>
                    <div className="text-slate-500 dark:text-white/45">عدد الدفعات</div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums" dir="ltr">
                      {previewRows.length}
                    </div>
                  </div>
                  <div className={`${ws.glassSoft} ${ws.card} p-2.5`}>
                    <div className="text-slate-500 dark:text-white/45">إجمالي شامل الضريبة</div>
                    <div className="font-bold text-[#0e7a5f] dark:text-emerald-200 mt-0.5 tabular-nums" dir="ltr">
                      {formatMoney(totals.incl)}
                    </div>
                  </div>
                  <div className={`${ws.glassSoft} ${ws.card} p-2.5`}>
                    <div className="text-slate-500 dark:text-white/45">قبل الضريبة</div>
                    <div className="font-semibold text-slate-800 dark:text-white/85 mt-0.5 tabular-nums" dir="ltr">
                      {formatMoney(totals.excl)}
                    </div>
                  </div>
                  <div className={`${ws.glassSoft} ${ws.card} p-2.5`}>
                    <div className="text-slate-500 dark:text-white/45">الضريبة</div>
                    <div className="font-semibold text-slate-800 dark:text-white/85 mt-0.5 tabular-nums" dir="ltr">
                      {formatMoney(totals.vat)}
                    </div>
                  </div>
                </div>

                {previewRows.length === 0 ? (
                  <div className="text-xs text-slate-500 dark:text-white/45 text-center py-4">
                    أكمل المدة والتكرار وقيمة الدفعة لعرض الجدول.
                  </div>
                ) : (
                  <div className="max-h-[46vh] overflow-y-auto rounded-[10px] border border-[#e2e7e4] dark:border-white/10">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[#fafbfa] dark:bg-white/[0.03] text-slate-500 dark:text-white/50 sticky top-0">
                        <tr>
                          <th className="text-right font-semibold px-2 py-1.5">#</th>
                          <th className="text-right font-semibold px-2 py-1.5">الاستحقاق</th>
                          <th className="text-right font-semibold px-2 py-1.5">الفترة</th>
                          <th className="text-left font-semibold px-2 py-1.5">شامل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {previewRows.map((row) => (
                          <tr key={row.seq} className={row.status === "paid" ? "opacity-60" : ""}>
                            <td className="px-2 py-1.5 text-slate-500 dark:text-white/45">
                              {row.seq}
                            </td>
                            <td className="px-2 py-1.5 font-mono text-slate-800 dark:text-white/85" dir="ltr">
                              {row.due_date}
                            </td>
                            <td className="px-2 py-1.5 font-mono text-slate-500 dark:text-white/45 whitespace-nowrap" dir="ltr">
                              {row.period_start && row.period_end
                                ? `${row.period_start} → ${row.period_end}`
                                : row.description || "—"}
                            </td>
                            <td className="px-2 py-1.5 text-left font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
                              {formatMoney(row.amount_incl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {previewRows.length >= 240 ? (
                  <div className="text-[11px] text-amber-700 dark:text-amber-200">
                    وصل الجدول إلى الحد الأقصى (240 دفعة) — راجع المدة والتكرار.
                  </div>
                ) : null}
              </div>

              {errors.length > 0 ? (
                <div className="rounded-[10px] border border-rose-200 dark:border-rose-400/25 bg-rose-50/70 dark:bg-rose-400/[0.06] p-3 text-[11px] text-rose-800 dark:text-rose-200 space-y-1">
                  {errors.map((message) => (
                    <div key={message}>• {message}</div>
                  ))}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className={`${ws.btnPrimary} w-full justify-center px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isEditing ? "حفظ التعديلات" : "حفظ العقد"}
              </button>
            </aside>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
