"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Save, X, Contact, Percent } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

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
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

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
      setNotes(contact.notes || "");
      setIsActive(contact.is_active !== false);
    } else {
      setName("");
      setCountry("");
      setVatRegistered(false);
      setVatNumber("");
      setDefaultTaxRate("0");
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
