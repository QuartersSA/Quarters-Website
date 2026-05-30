"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X, HandCoins, Building } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

const CURRENCIES = [
  { value: "SAR", label: "ريال سعودي (SAR)" },
  { value: "AED", label: "درهم إماراتي (AED)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
  { value: "EUR", label: "يورو (EUR)" },
  { value: "GBP", label: "جنيه إسترليني (GBP)" },
];

/**
 * Add / edit beneficiary modal.
 *
 * Fields match the screenshot supplied by the operator:
 *   - اسم المستفيد *
 *   - جهة الاتصال (optional link to accounting_contacts)
 *   - رقم الآيبان IBAN *  (whitespace stripped, uppercase)
 *   - العملة (default SAR)
 *   - اسم البنك
 *   - رمز السويفت SWIFT
 *
 * Linking to a contact is optional. When linked, the beneficiary
 * surfaces under that contact's payment options on a purchase
 * invoice. Unlinked beneficiaries are standalone payees (e.g. a
 * one-off transfer).
 */
export default function BeneficiaryModal({
  open,
  beneficiary,
  contacts,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!beneficiary;

  const [name, setName] = useState("");
  const [iban, setIban] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [bankName, setBankName] = useState("");
  const [swift, setSwift] = useState("");
  const [contactId, setContactId] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (beneficiary) {
      setName(beneficiary.name || "");
      setIban(beneficiary.iban || "");
      setCurrency(beneficiary.currency || "SAR");
      setBankName(beneficiary.bank_name || "");
      setSwift(beneficiary.swift || "");
      setContactId(
        beneficiary.contact_id ? String(beneficiary.contact_id) : "",
      );
      setNotes(beneficiary.notes || "");
      setIsActive(beneficiary.is_active !== false);
    } else {
      setName("");
      setIban("");
      setCurrency("SAR");
      setBankName("");
      setSwift("");
      setContactId("");
      setNotes("");
      setIsActive(true);
    }
  }, [open, beneficiary]);

  const contactOptions = useMemo(
    () => [
      { value: "", label: "بدون ربط (مستفيد مستقل)" },
      ...(contacts || []).map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    ],
    [contacts],
  );

  const canSubmit = !isSubmitting && !!name.trim() && !!iban.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      iban: iban.replace(/\s+/g, "").toUpperCase(),
      currency: currency || "SAR",
      bank_name: bankName.trim() || null,
      swift: swift.trim() ? swift.trim().toUpperCase() : null,
      contact_id: contactId ? Number(contactId) : null,
      notes: notes.trim() || null,
    };
    if (isEditing) {
      payload.id = beneficiary.id;
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
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? "تعديل مستفيد" : "إضافة مستفيد"}
              </div>
              <div className="text-xs text-slate-600 dark:text-white/55 mt-0.5">
                حساب بنكي يُحوَّل له المبلغ
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              اسم المستفيد <span className="text-rose-700 dark:text-rose-300">*</span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم صاحب الحساب البنكي"
              className={`${ws.input} px-3 py-2`}
            />
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              جهة الاتصال{" "}
              <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
            </div>
            <GlassSelect
              value={contactId}
              onChange={setContactId}
              options={contactOptions}
              placeholder="ابحث/اختر جهة اتصال"
              buttonClassName="text-sm py-2.5 px-3"
            />
            <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
              ربط المستفيد بجهة اتصال يُظهر حسابه عند دفع فواتير تلك الجهة.
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              رقم الآيبان (IBAN){" "}
              <span className="text-rose-700 dark:text-rose-300">*</span>
            </div>
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="SA0000000000000000000000"
              className={`${ws.input} px-3 py-2 font-mono`}
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                العملة
              </div>
              <GlassSelect
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES}
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                رمز السويفت SWIFT
              </div>
              <input
                type="text"
                value={swift}
                onChange={(e) => setSwift(e.target.value)}
                placeholder="مثل: NCBKSAJE"
                className={`${ws.input} px-3 py-2 font-mono`}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              <Building className="w-3 h-3 inline ml-1" />
              اسم البنك
            </div>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="مثل: Saudi National Bank"
              className={`${ws.input} px-3 py-2`}
            />
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              ملاحظات{" "}
              <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
            </div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظة داخلية"
              className={`${ws.input} px-3 py-2`}
            />
          </div>

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
