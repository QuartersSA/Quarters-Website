"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Save,
  X,
  Contact,
  ListTree,
  Percent,
  HandCoins,
  Plus,
  Link as LinkIcon,
  Pencil,
  Unlink,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { buildExpenseAccountOptions } from "@/components/Accounting/PurchaseInvoiceModal";
import {
  useAccountingBeneficiaries,
  useCreateAccountingBeneficiary,
  useUpdateAccountingBeneficiary,
} from "@/hooks/useAccountingBeneficiaries";
import BeneficiaryModal from "@/components/Accounting/BeneficiaryModal";

function formatIban(iban) {
  if (!iban) return "";
  return String(iban).replace(/(.{4})/g, "$1 ").trim();
}

const COUNTRIES = [
  { value: "", label: "اختياري" },
  { value: "SA", label: "المملكة العربية السعودية" },
  { value: "AE", label: "الإمارات العربية المتحدة" },
  { value: "BH", label: "البحرين" },
  { value: "KW", label: "الكويت" },
  { value: "OM", label: "عُمان" },
  { value: "QA", label: "قطر" },
  { value: "EG", label: "مصر" },
  { value: "JO", label: "الأردن" },
  { value: "LB", label: "لبنان" },
  { value: "TR", label: "تركيا" },
  { value: "OTHER", label: "أخرى" },
];

const TAX_RATE_OPTIONS = [
  { value: "0", label: "غير خاضع للضريبة (0.00%)" },
  { value: "15", label: "ضريبة القيمة المضافة على الإيرادات (15.00%)" },
];

/**
 * Linked-beneficiaries panel.
 *
 * Lives at the bottom of ContactModal in edit mode. Shows every
 * beneficiary currently linked to this contact, lets the operator:
 *   - create a fresh beneficiary pre-linked to the contact
 *   - link an existing unattached beneficiary via a dropdown
 *   - edit a linked beneficiary inline
 *   - unlink (sets contact_id=null on the beneficiary; does not
 *     delete the bank record)
 */
function BeneficiariesPanel({ contactId }) {
  const linkedQuery = useAccountingBeneficiaries({
    employeeId: true, // hook gate is `!!employeeId && isAdmin`;
    isAdmin: true,    // both already enforced by parent route
    contactId,
  });
  const unattachedQuery = useAccountingBeneficiaries({
    employeeId: true,
    isAdmin: true,
    contactId: null,
  });

  const linked = linkedQuery.data || [];
  // Filter unattached client-side — endpoint with contact_id=null
  // returns everything; we want only beneficiaries with no link.
  const unattached = (unattachedQuery.data || []).filter(
    (b) => !b.contact_id,
  );

  const createMut = useCreateAccountingBeneficiary();
  const updateMut = useUpdateAccountingBeneficiary();

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [linkValue, setLinkValue] = useState("");

  const unattachedOptions = [
    { value: "", label: "اختر مستفيداً قائماً للربط" },
    ...unattached.map((b) => ({
      value: String(b.id),
      label: `${b.name} — ${b.bank_name || "بدون بنك"}`,
    })),
  ];

  const handleLink = () => {
    const id = Number(linkValue);
    if (!Number.isFinite(id) || id <= 0) return;
    updateMut.mutate(
      { id, contact_id: contactId },
      { onSuccess: () => setLinkValue("") },
    );
  };

  const handleUnlink = (ben) => {
    const ok = window.confirm(
      `فك ربط "${ben.name}" عن هذه الجهة؟ (لا يُحذف المستفيد، يصير مستقلاً)`,
    );
    if (!ok) return;
    updateMut.mutate({ id: ben.id, contact_id: null });
  };

  const handleSubmit = (payload) => {
    if (editing) {
      updateMut.mutate(payload, { onSuccess: () => setEditing(null) });
    } else {
      createMut.mutate(payload, { onSuccess: () => setShowAdd(false) });
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        <h3 className="text-xs font-bold text-slate-700 dark:text-white/75 whitespace-nowrap flex items-center gap-1">
          <HandCoins className="w-3.5 h-3.5" />
          المستفيدون البنكيون
        </h3>
        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>

      {linkedQuery.isLoading ? (
        <div className="text-xs text-slate-500 dark:text-white/50">
          جاري التحميل…
        </div>
      ) : linked.length === 0 ? (
        <div className="text-xs text-slate-500 dark:text-white/50">
          لا يوجد مستفيدون مربوطون بهذه الجهة بعد.
        </div>
      ) : (
        <div className="space-y-2">
          {linked.map((b) => (
            <div
              key={b.id}
              className={`${ws.glassSoft} ${ws.card} px-3 py-2 flex items-center justify-between gap-2`}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {b.name}
                </div>
                <div
                  className="text-[11px] text-slate-500 dark:text-white/45 font-mono truncate"
                  dir="ltr"
                >
                  {formatIban(b.iban)}
                  {b.bank_name ? ` · ${b.bank_name}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(b)}
                  className={`${ws.iconButton} w-8 h-8`}
                  title="تعديل"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleUnlink(b)}
                  className={`${ws.iconButton} w-8 h-8 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-200 dark:hover:border-amber-500/30 hover:text-amber-700 dark:hover:text-amber-200`}
                  title="فك الربط"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action row: link existing OR create new */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <GlassSelect
              value={linkValue}
              onChange={setLinkValue}
              options={unattachedOptions}
              placeholder={
                unattached.length === 0
                  ? "لا يوجد مستفيدون غير مربوطين"
                  : "اختر مستفيداً قائماً للربط"
              }
              disabled={unattached.length === 0}
              buttonClassName="text-sm py-2.5 px-3"
            />
          </div>
          <button
            type="button"
            onClick={handleLink}
            disabled={!linkValue || updateMut.isPending}
            className={`${ws.btnNeutral} px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
            title="ربط مستفيد قائم بهذه الجهة"
          >
            <LinkIcon className="w-4 h-4" />
            ربط
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className={`${ws.btnPrimary} px-3 py-2 shrink-0`}
        >
          <Plus className="w-4 h-4" />
          إنشاء مستفيد جديد
        </button>
      </div>

      <BeneficiaryModal
        open={showAdd || !!editing}
        beneficiary={editing}
        lockedContactId={contactId}
        contacts={[]}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </section>
  );
}

/**
 * "إضافة جهة اتصال" modal — matches the design supplied by the
 * operator. Two stacked sections:
 *
 *   - المنشأة والتسجيل الضريبي  → name + country + VAT status + tax #
 *   - البيانات الافتراضية في المشتريات → default tax rate to suggest
 *                                       when this contact is picked
 *                                       on a purchase invoice
 *
 * Open by passing `open`. Pass an existing contact via `contact` to
 * pre-fill for editing; pass null for a fresh "create" flow.
 */
export default function ContactModal({
  open,
  contact,
  accounts = [],
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!contact;

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [defaultTaxRate, setDefaultTaxRate] = useState("0");
  const [defaultAccountId, setDefaultAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const accountOptions = useMemo(
    () => buildExpenseAccountOptions(accounts),
    [accounts],
  );

  useEffect(() => {
    if (!open) return;
    if (contact) {
      setName(contact.name || "");
      setCountry(contact.country || "");
      setVatRegistered(!!contact.vat_registered);
      setVatNumber(contact.vat_number || "");
      setDefaultTaxRate(
        contact.default_tax_rate !== null &&
          contact.default_tax_rate !== undefined
          ? String(contact.default_tax_rate)
          : "0",
      );
      setDefaultAccountId(
        contact.default_account_id ? String(contact.default_account_id) : "",
      );
      setNotes(contact.notes || "");
      setIsActive(contact.is_active !== false);
    } else {
      setName("");
      setCountry("");
      setVatRegistered(false);
      setVatNumber("");
      setDefaultTaxRate("0");
      setDefaultAccountId("");
      setNotes("");
      setIsActive(true);
    }
  }, [open, contact]);

  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;
    if (!name.trim()) return false;
    if (vatRegistered && !vatNumber.trim()) return false;
    return true;
  }, [isSubmitting, name, vatRegistered, vatNumber]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      country: country || null,
      vat_registered: vatRegistered,
      vat_number: vatRegistered && vatNumber.trim() ? vatNumber.trim() : null,
      default_tax_rate: Number(defaultTaxRate) || 0,
      default_account_id: defaultAccountId || null,
      notes: notes.trim() || null,
    };
    if (isEditing) {
      payload.id = contact.id;
      payload.is_active = isActive;
    }
    onSubmit(payload);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-xl p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}
            >
              <Contact className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? "تعديل جهة اتصال" : "إضافة جهة اتصال"}
              </div>
              <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
                شخص أو منظمة تتعامل معها
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── المنشأة والتسجيل الضريبي ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <h3 className="text-xs font-bold text-slate-700 dark:text-white/75 whitespace-nowrap">
                المنشأة والتسجيل الضريبي{" "}
                <span className="text-rose-700 dark:text-rose-300">
                  مطلوب
                </span>
              </h3>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                اسم المنشأة <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مطلوب"
                className={`${ws.input} px-3 py-2`}
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                البلد
              </div>
              <GlassSelect
                value={country}
                onChange={setCountry}
                options={COUNTRIES}
                placeholder="اختياري"
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                التسجيل في ضريبة القيمة المضافة{" "}
                <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <div className="space-y-2 mt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="vat_registered"
                    checked={!vatRegistered}
                    onChange={() => setVatRegistered(false)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-slate-800 dark:text-white/80">
                    غير مسجل في ضريبة القيمة المضافة
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="vat_registered"
                    checked={vatRegistered}
                    onChange={() => setVatRegistered(true)}
                    className="accent-emerald-500"
                  />
                  <span className="text-sm text-slate-800 dark:text-white/80">
                    جهة الاتصال مسجلة في ضريبة القيمة المضافة في السعودية
                  </span>
                </label>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                رقم التسجيل الضريبي{" "}
                {vatRegistered ? (
                  <span className="text-rose-700 dark:text-rose-300">*</span>
                ) : (
                  <span className="text-slate-400 dark:text-white/35">
                    (اختياري)
                  </span>
                )}
              </div>
              <input
                type="text"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder={vatRegistered ? "مطلوب" : "اختياري"}
                disabled={!vatRegistered}
                className={`${ws.input} px-3 py-2`}
                dir="ltr"
              />
            </div>
          </section>

          {/* ── البيانات الافتراضية في المشتريات ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <h3 className="text-xs font-bold text-slate-700 dark:text-white/75 whitespace-nowrap">
                البيانات الافتراضية في المشتريات
              </h3>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/55 mb-1">
                <Percent className="w-3 h-3" />
                معدل الضريبة الافتراضي عند الشراء
              </div>
              <GlassSelect
                value={defaultTaxRate}
                onChange={setDefaultTaxRate}
                options={TAX_RATE_OPTIONS}
                placeholder="اختر"
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/55 mb-1">
                <ListTree className="w-3 h-3" />
                الحساب الافتراضي — شجرة الحسابات
              </div>
              <GlassSelect
                value={defaultAccountId}
                onChange={setDefaultAccountId}
                options={accountOptions}
                placeholder="غير مصنّفة"
                buttonClassName="text-sm py-2.5 px-3"
                disabled={accountOptions.length <= 1}
              />
              <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                بنود فواتير المشتريات لهذا المورد تُصنَّف على هذا الحساب
                تلقائياً.
              </div>
            </div>
          </section>

          <section>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              ملاحظات <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
            </div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة داخلية للفريق"
              className={`${ws.input} px-3 py-2`}
            />
          </section>

          {/* ── المستفيدون البنكيون لهذه الجهة ── */}
          {isEditing ? (
            <BeneficiariesPanel contactId={contact.id} />
          ) : (
            <div
              className={`${ws.glassSoft} ${ws.card} px-3 py-2 text-xs text-slate-500 dark:text-white/50`}
            >
              لإضافة مستفيدين بنكيين لهذه الجهة، احفظ أولاً ثم افتح
              التعديل.
            </div>
          )}

          {isEditing ? (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-emerald-500"
              />
              <span className="text-sm text-slate-800 dark:text-white/80">
                نشط
              </span>
            </label>
          ) : null}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              {isEditing ? "حفظ التعديلات" : "إضافة"}
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
