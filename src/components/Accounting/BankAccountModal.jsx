"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X, Building2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

export const ACCOUNT_TYPE_OPTIONS = [
  { value: "bank", label: "بنك" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "petty_cash", label: "مصروفات نثرية" },
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

function moneyInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return (Math.round(number * 100) / 100).toFixed(2);
}

export default function BankAccountModal({
  open,
  account,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!account;
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("bank");
  const [currency, setCurrency] = useState("SAR");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bookBalance, setBookBalance] = useState("0.00");
  const [statementBalance, setStatementBalance] = useState("0.00");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(account?.name || "");
    setAccountType(account?.account_type || "bank");
    setCurrency(account?.currency || "SAR");
    setBankName(account?.bank_name || "");
    setIban(account?.iban || "");
    setAccountNumber(account?.account_number || "");
    setBookBalance(moneyInput(account?.book_balance) || "0.00");
    setStatementBalance(moneyInput(account?.statement_balance) || "0.00");
    setNotes(account?.notes || "");
  }, [open, account]);

  const typeHelp = useMemo(() => {
    if (accountType === "credit_card") {
      return "استخدمه لحسابات البطاقات البنكية أو بطاقات الأعمال.";
    }
    if (accountType === "petty_cash") {
      return "مصروفات نثرية تعني صندوق أو كاش صغير للمصاريف البسيطة اليومية.";
    }
    return "استخدمه للحسابات البنكية الجارية أو حسابات التشغيل.";
  }, [accountType]);

  const canSubmit = !isSubmitting && !!name.trim() && !!currency;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      account_type: accountType,
      currency,
      bank_name: bankName.trim() || null,
      iban: iban.trim() || null,
      account_number: accountNumber.trim() || null,
      book_balance: bookBalance === "" ? 0 : Number(bookBalance),
      statement_balance:
        statementBalance === "" ? 0 : Number(statementBalance),
      notes: notes.trim() || null,
    };
    if (isEditing) payload.id = account.id;
    onSubmit(payload);
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
        className={`${ws.glass} ${ws.card} w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}
      >
        <div className={`px-5 py-4 border-b ${ws.divider} flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10 text-indigo-700 dark:text-indigo-200`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? "تعديل حساب" : "إنشاء حساب بنك"}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                حساب يُستخدم لاحقاً في مدفوعات وفواتير المشتريات.
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                اسم الحساب <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="مثال: HSBC Business xxx101"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                النوع <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <GlassSelect
                value={accountType}
                onChange={setAccountType}
                options={ACCOUNT_TYPE_OPTIONS}
                placeholder="مطلوب"
                buttonClassName="text-sm py-2.5 px-3"
              />
              <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                {typeHelp}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                العملة <span className="text-rose-700 dark:text-rose-300">*</span>
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
                اسم البنك
              </div>
              <input
                type="text"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="اختياري"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                الآيبان
              </div>
              <input
                type="text"
                value={iban}
                onChange={(event) => setIban(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="SA..."
                dir="ltr"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                رقم الحساب / آخر الأرقام
              </div>
              <input
                type="text"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="اختياري"
                dir="ltr"
              />
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                رصيد الدفتر
              </div>
              <input
                type="number"
                value={bookBalance}
                onChange={(event) => setBookBalance(event.target.value)}
                className={`${ws.input} px-3 py-2.5 text-right`}
                step="0.01"
                dir="ltr"
              />
              <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                الرصيد المسجل داخل النظام من العمليات والمدفوعات.
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                رصيد كشف الحساب
              </div>
              <input
                type="number"
                value={statementBalance}
                onChange={(event) => setStatementBalance(event.target.value)}
                className={`${ws.input} px-3 py-2.5 text-right`}
                step="0.01"
                dir="ltr"
              />
              <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                الرصيد الظاهر في كشف البنك أو البطاقة عند المطابقة.
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              ملاحظات
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${ws.input} px-3 py-2.5 min-h-[76px] resize-none`}
              placeholder="اختياري"
            />
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
