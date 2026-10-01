"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  HandCoins,
  Loader2,
  Paperclip,
  Receipt,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import useUpload from "@/utils/useUpload";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { FREQUENCY_LABELS } from "@/utils/leaseMath";

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return `${moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} SAR`;
}

function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

// سداد دفعة عقد إيجار: مبلغ (افتراضياً شامل الضريبة) + تاريخ + بنك +
// إيصال + ملاحظة. الخادم ينشئ فاتورة مشتريات مدفوعة تحت حساب
// «إيجارات» ويعلّم الدفعة مسددة.
export default function LeasePayModal({
  payment,
  bankAccounts = [],
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const [paidDate, setPaidDate] = useState(() => todayRiyadh());
  const [bankAccountId, setBankAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const receiptInputRef = useRef(null);
  const [upload] = useUpload();

  useEffect(() => {
    if (!payment) return;
    setPaidDate(todayRiyadh());
    setBankAccountId(
      payment.bank_account_id ? String(payment.bank_account_id) : "",
    );
    setNotes("");
    setReceiptUrl("");
    setReceiptName("");
    setReceiptUploading(false);
    // تُعاد التهيئة عند فتح دفعة أخرى فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id]);

  const bankOptions = useMemo(
    () => [
      { value: "", label: "بدون تحديد حساب" },
      ...bankAccounts
        .filter((account) => account.is_active !== false)
        .map((account) => ({
          value: String(account.id),
          label: account.bank_name
            ? `${account.name} — ${account.bank_name}`
            : account.name,
        })),
    ],
    [bankAccounts],
  );

  const handleReceiptPicked = async (fileArg) => {
    if (!fileArg) return;
    setReceiptUploading(true);
    try {
      const result = await upload({ file: fileArg, unoptimized: true });
      if (result?.error) {
        toast.error(`فشل رفع الإيصال: ${result.error}`);
        return;
      }
      setReceiptUrl(result.url || "");
      setReceiptName(fileArg.name || "");
    } catch (error) {
      toast.error(`فشل رفع الإيصال: ${error?.message || "خطأ غير معروف"}`);
    } finally {
      setReceiptUploading(false);
      if (receiptInputRef.current) receiptInputRef.current.value = "";
    }
  };

  if (!payment || typeof document === "undefined") return null;

  // السداد كامل قيمة الدفعة شامل الضريبة فقط (لا سداد جزئي) — المبلغ للعرض.
  const paymentValue = moneyValue(payment.amount_incl);
  const valid = paymentValue >= 0.01 && /^\d{4}-\d{2}-\d{2}$/.test(paidDate);
  const period =
    payment.period_start && payment.period_end
      ? `${payment.period_start} → ${payment.period_end}`
      : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!valid || isSubmitting) return;
    onSubmit({
      id: payment.id,
      paid_date: paidDate,
      paid_amount: Math.round(paymentValue * 100) / 100,
      bank_account_id: bankAccountId ? Number(bankAccountId) : null,
      receipt_url: receiptUrl || null,
      notes: notes.trim() || null,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[92svh] overflow-y-auto overflow-x-hidden min-w-0`}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`${ws.iconBox} w-10 h-10 text-[#0e7a5f] dark:text-emerald-200`}
            >
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white">
                سداد دفعة إيجار
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                الدفعة #{payment.seq}
                {payment.contract_number ? (
                  <>
                    {" "}
                    · عقد{" "}
                    <span dir="ltr" className="font-mono">
                      {payment.contract_number}
                    </span>
                  </>
                ) : null}
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

        {/* سياق الدفعة: المؤجر، الموقع، الفترة، الاستحقاق */}
        <div className={`${ws.glassSoft} ${ws.card} p-3 mb-4 space-y-1.5 text-xs`}>
          {payment.display_name ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-white/45">العقد</span>
              <span className="font-bold text-slate-900 dark:text-white truncate">
                {payment.display_name}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-white/45">المؤجر</span>
            <span className="font-semibold text-slate-800 dark:text-white/85 truncate">
              {payment.lessor_name || "—"}
            </span>
          </div>
          {payment.location ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-white/45">الموقع</span>
              <span className="text-slate-700 dark:text-white/70 truncate">
                {payment.location}
              </span>
            </div>
          ) : null}
          {period ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-white/45">الفترة</span>
              <span className="font-mono text-slate-700 dark:text-white/70" dir="ltr">
                {period}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 dark:text-white/45">تاريخ الاستحقاق</span>
            <span className="font-mono text-slate-700 dark:text-white/70" dir="ltr">
              {payment.due_date || "—"}
            </span>
          </div>
          {payment.payment_frequency ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-white/45">التكرار</span>
              <span className="text-slate-700 dark:text-white/70">
                {FREQUENCY_LABELS[payment.payment_frequency] || payment.payment_frequency}
              </span>
            </div>
          ) : null}
        </div>

        <div className={`${ws.glassSoft} ${ws.card} p-3 mb-4 grid grid-cols-3 gap-2 text-center`}>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">قبل الضريبة</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums" dir="ltr">
              {formatMoney(payment.amount_excl)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">
              الضريبة {moneyValue(payment.vat_rate)}%
            </div>
            <div className="text-sm font-bold text-slate-700 dark:text-white/75 mt-0.5 tabular-nums" dir="ltr">
              {formatMoney(payment.vat_amount)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">شامل الضريبة</div>
            <div className="text-sm font-bold text-[#0e7a5f] dark:text-emerald-200 mt-0.5 tabular-nums" dir="ltr">
              {formatMoney(payment.amount_incl)}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[10px] border border-sky-200 dark:border-sky-400/25 bg-sky-50/70 dark:bg-sky-400/[0.06] px-3 py-2 mb-4 text-[11px] text-sky-800 dark:text-sky-200 leading-relaxed">
          <Receipt className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            تُسجَّل الدفعة كمسددة في «سداد المستحق» وتُتابع من النظام (التاريخ،
            الحساب البنكي، الإيصال) — بلا إنشاء فاتورة مشتريات.
          </span>
        </div>
        {payment.reserved_total !== undefined && payment.reserved_total !== null && !payment.setaside_exempt ? (
          <div
            className={`flex items-center justify-between gap-2 rounded-[10px] border px-3 py-2 mb-4 text-[11px] ${
              moneyValue(payment.reserved_total) + 0.005 >= moneyValue(payment.amount_incl)
                ? "border-[#c9e2d8] dark:border-emerald-400/25 bg-[#e7f2ee]/70 dark:bg-emerald-400/[0.06] text-[#0e7a5f] dark:text-emerald-200"
                : "border-amber-200 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-400/[0.06] text-amber-800 dark:text-amber-200"
            }`}
          >
            <span>المتجمع في حساب الاستقطاع لهذه الدفعة</span>
            <span className="font-bold tabular-nums" dir="ltr">
              {formatMoney(payment.reserved_total)} / {formatMoney(payment.amount_incl)}
            </span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="text-xs text-slate-600 dark:text-white/55 mb-1">المبلغ المسدد</div>
          <div
            className={`${ws.input} px-3 py-2.5 text-right font-bold tabular-nums text-slate-900 dark:text-white bg-slate-50 dark:bg-white/[0.04]`}
            dir="ltr"
          >
            {formatMoney(paymentValue)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
            كامل قيمة الدفعة شامل الضريبة — لا يُدعم السداد الجزئي؛ لتقسيمها عدّل جدول الدفعات من تفاصيل العقد.
          </div>

          <div className="text-xs text-slate-600 dark:text-white/55 mb-1 mt-3">
            تاريخ السداد <span className="text-rose-700 dark:text-rose-300">*</span>
          </div>
          <input
            type="date"
            value={paidDate}
            onChange={(event) => setPaidDate(event.target.value)}
            className={`${ws.input} px-3 py-2.5`}
            dir="ltr"
          />

          <div className="text-xs text-slate-600 dark:text-white/55 mb-1 mt-3">
            الحساب البنكي المدفوع منه
          </div>
          <GlassSelect
            value={bankAccountId}
            onChange={setBankAccountId}
            options={bankOptions}
            placeholder="بدون تحديد حساب"
            buttonClassName="text-sm py-2.5 px-3"
          />

          <div className="text-xs text-slate-600 dark:text-white/55 mb-1 mt-3">
            إيصال السداد{" "}
            <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
          </div>
          {receiptUrl ? (
            <div
              className={`${ws.glassSoft} ${ws.card} px-3 py-2 flex items-center justify-between gap-2`}
            >
              <div className="flex items-center gap-2 min-w-0 text-xs text-slate-700 dark:text-white/70">
                <Paperclip className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate" dir="ltr">
                  {receiptName || "إيصال مرفق"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${ws.btnNeutral} px-2.5 py-1.5 text-[11px]`}
                >
                  <ExternalLink className="w-3 h-3" />
                  فتح
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptUrl("");
                    setReceiptName("");
                  }}
                  className={`${ws.iconButton} w-7 h-7 hover:text-red-700 dark:hover:text-red-200`}
                  title="إزالة الإيصال"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={receiptUploading}
              onClick={() => receiptInputRef.current?.click()}
              className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50`}
            >
              {receiptUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Paperclip className="w-3.5 h-3.5" />
              )}
              {receiptUploading ? "جاري الرفع…" : "إرفاق إيصال السداد"}
            </button>
          )}
          <input
            ref={receiptInputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) => handleReceiptPicked(event?.target?.files?.[0])}
            className="hidden"
          />

          <div className="text-xs text-slate-600 dark:text-white/55 mb-1 mt-3">
            ملاحظة{" "}
            <span className="text-slate-400 dark:text-white/35">(اختياري)</span>
          </div>
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="مثال: تحويل بنكي — دفعة النصف الأول"
            className={`${ws.input} px-3 py-2`}
          />

          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={!valid || isSubmitting || receiptUploading}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              تسجيل السداد
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-3 py-2 text-xs mr-auto`}
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
