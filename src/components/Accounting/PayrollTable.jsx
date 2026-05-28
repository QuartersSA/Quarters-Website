import { useState, useEffect } from "react";
import { Check, X, MessageSquare, Pencil, Ban } from "lucide-react";
import { formatMoney } from "@/utils/payrollFormatters";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "اختر" },
  { value: "cash", label: "كاش" },
  { value: "transfer", label: "تحويل" },
];

const METHOD_LABELS = { cash: "كاش", transfer: "تحويل" };

function PaymentRow({ entry, onSave, isClosed }) {
  const savedPaid = !!entry.is_paid;

  const [isPaid, setIsPaid] = useState(savedPaid);
  const [paidAmount, setPaidAmount] = useState(
    entry.paid_amount !== null && entry.paid_amount !== undefined
      ? String(entry.paid_amount)
      : "",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    entry.payment_method || "",
  );
  const [paymentNote, setPaymentNote] = useState(entry.payment_note || "");
  const [showNote, setShowNote] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // If already saved as paid, fields are locked unless editing.
  // Suspended employees also lock — there's no salary to pay.
  const isLocked =
    !!entry.is_suspended || (savedPaid && !isEditing && !dirty);

  const netSalary = Number(entry.net_salary || 0);
  const currentPaidAmount = paidAmount !== "" ? Number(paidAmount) : null;
  const amountDiffers =
    currentPaidAmount !== null &&
    Math.abs(currentPaidAmount - netSalary) >= 0.01;

  useEffect(() => {
    setIsPaid(!!entry.is_paid);
    setPaidAmount(
      entry.paid_amount !== null && entry.paid_amount !== undefined
        ? String(entry.paid_amount)
        : "",
    );
    setPaymentMethod(entry.payment_method || "");
    setPaymentNote(entry.payment_note || "");
    setShowNote(false);
    setDirty(false);
    setIsEditing(false);
  }, [
    entry.is_paid,
    entry.paid_amount,
    entry.payment_method,
    entry.payment_note,
  ]);

  const handleTogglePaid = () => {
    if (isClosed || isLocked) return;
    const newPaid = !isPaid;
    setIsPaid(newPaid);
    if (newPaid && !paidAmount) {
      setPaidAmount(String(netSalary));
    }
    if (!newPaid) {
      setPaidAmount("");
      setPaymentMethod("");
      setPaymentNote("");
      setShowNote(false);
    }
    setDirty(true);
  };

  const handleAmountChange = (val) => {
    setPaidAmount(val);
    setDirty(true);
  };

  const handleMethodChange = (val) => {
    setPaymentMethod(val);
    setDirty(true);
  };

  const handleNoteChange = (val) => {
    setPaymentNote(val);
    setDirty(true);
  };

  const handleSave = () => {
    onSave({
      entry_id: entry.id,
      is_paid: isPaid,
      paid_amount: isPaid && paidAmount !== "" ? Number(paidAmount) : null,
      payment_method: isPaid && paymentMethod ? paymentMethod : null,
      payment_note: isPaid && paymentNote ? paymentNote : null,
    });
    setDirty(false);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Reset to saved values
    setIsPaid(!!entry.is_paid);
    setPaidAmount(
      entry.paid_amount !== null && entry.paid_amount !== undefined
        ? String(entry.paid_amount)
        : "",
    );
    setPaymentMethod(entry.payment_method || "");
    setPaymentNote(entry.payment_note || "");
    setShowNote(false);
    setDirty(false);
    setIsEditing(false);
  };

  const employeeName = entry.employee_name || "—";
  const branchName = entry.branch_name || "—";
  const isSuspended = !!entry.is_suspended;
  const baseSalary = formatMoney(entry.base_salary);
  const otherAllowances = formatMoney(entry.other_allowances);
  const totalSalary = formatMoney(entry.total_salary);
  const totalBonuses = formatMoney(entry.total_bonuses);
  const totalDeductions = formatMoney(entry.total_deductions);
  const loanDeduction = formatMoney(entry.loan_deduction);
  const hasLoan = Number(entry.loan_deduction || 0) > 0;
  const totalOvertime = formatMoney(entry.total_overtime);
  const hasOvertime = Number(entry.total_overtime || 0) > 0;
  const overtimeDays = Number(entry.overtime_days || 0);
  const formattedNet = formatMoney(entry.net_salary);

  return (
    <>
      <tr
        className={`border-t border-white/10 hover:bg-white/[0.04] ${isSuspended ? "opacity-70" : ""}`}
      >
        <td
          className="py-2 px-1.5 font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ maxWidth: 160 }}
        >
          <div className="flex items-center gap-1.5">
            <span className="truncate">{employeeName}</span>
            {isSuspended ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/15 border border-amber-400/30 text-amber-200 shrink-0"
                title="موظف موقوف هذا الشهر"
              >
                <Ban className="w-3 h-3" />
                موقوف
              </span>
            ) : null}
          </div>
        </td>
        <td
          className="py-2 px-1.5 text-white/70 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ maxWidth: 110 }}
        >
          {branchName}
        </td>
        <td
          className="py-2 px-1.5 text-white/50 whitespace-nowrap text-right"
          dir="ltr"
        >
          {baseSalary}
        </td>
        <td
          className="py-2 px-1.5 text-white/50 whitespace-nowrap text-right"
          dir="ltr"
        >
          {otherAllowances}
        </td>
        <td
          className="py-2 px-1.5 text-white/70 whitespace-nowrap text-right"
          dir="ltr"
        >
          {totalSalary}
        </td>
        <td
          className="py-2 px-1.5 text-emerald-200 whitespace-nowrap text-right"
          dir="ltr"
        >
          {totalBonuses}
        </td>
        <td
          className={`py-2 px-1.5 whitespace-nowrap text-right ${
            hasOvertime ? "text-sky-200" : "text-white/30"
          }`}
          dir="ltr"
          title={hasOvertime ? `${overtimeDays} يوم` : ""}
        >
          {hasOvertime ? totalOvertime : "—"}
        </td>
        <td
          className="py-2 px-1.5 text-red-300/80 whitespace-nowrap text-right"
          dir="ltr"
        >
          {totalDeductions}
        </td>
        <td
          className={`py-2 px-1.5 whitespace-nowrap text-right ${
            hasLoan ? "text-amber-300/90" : "text-white/30"
          }`}
          dir="ltr"
          title={hasLoan ? "قسط شهري لقرض / سلفة نشطة" : ""}
        >
          {hasLoan ? loanDeduction : "—"}
        </td>
        <td
          className="py-2 px-1.5 text-emerald-200 font-bold whitespace-nowrap text-right"
          dir="ltr"
        >
          {formattedNet}
        </td>

        {/* طريقة الدفع */}
        <td className="py-2 px-1.5">
          {isPaid ? (
            isLocked ? (
              <span className="text-white/70 text-xs">
                {METHOD_LABELS[paymentMethod] || "—"}
              </span>
            ) : (
              <GlassSelect
                value={paymentMethod}
                onChange={handleMethodChange}
                options={PAYMENT_METHOD_OPTIONS}
                placeholder="اختر"
                disabled={isClosed}
                buttonClassName="text-xs py-1 px-2 !rounded-lg"
              />
            )
          ) : (
            <span className="text-white/30 text-xs">—</span>
          )}
        </td>

        {/* المبلغ المدفوع */}
        <td className="py-2 px-1.5">
          {isPaid ? (
            isLocked ? (
              <span className="text-white/70 text-xs" dir="ltr">
                {formatMoney(paidAmount)}
              </span>
            ) : (
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={isClosed}
                className={`${ws.input} text-xs py-1 px-1 rounded-lg w-[50px] text-right ${
                  amountDiffers
                    ? "border-amber-400/50 ring-1 ring-amber-400/20"
                    : ""
                }`}
                dir="ltr"
                placeholder={String(netSalary)}
                step="0.01"
              />
            )
          ) : (
            <span className="text-white/30 text-xs">—</span>
          )}
        </td>

        {/* تم الدفع */}
        <td className="py-2 px-1 text-center">
          <button
            type="button"
            onClick={handleTogglePaid}
            disabled={isClosed || isLocked}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all mx-auto ${
              isPaid
                ? "bg-emerald-400/20 border border-emerald-400/40 text-emerald-300"
                : "bg-white/[0.04] border border-white/10 text-white/30 hover:bg-white/[0.08]"
            } ${isClosed || isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {isPaid ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </button>
        </td>

        {/* أزرار */}
        <td className="py-2 px-1">
          <div className="flex items-center gap-1">
            {/* زر الملاحظة */}
            {isPaid && (
              <button
                type="button"
                onClick={() => setShowNote(!showNote)}
                disabled={isClosed}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                  paymentNote || amountDiffers
                    ? "bg-amber-400/15 border border-amber-400/30 text-amber-300"
                    : "bg-white/[0.04] border border-white/10 text-white/40 hover:bg-white/[0.08]"
                }`}
                title="ملاحظة"
              >
                <MessageSquare className="w-3 h-3" />
              </button>
            )}

            {/* زر تعديل — يظهر فقط لو محفوظ ومقفل */}
            {isLocked && !isClosed && (
              <button
                type="button"
                onClick={handleEdit}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all bg-white/[0.04] border border-white/10 text-white/40 hover:bg-white/[0.08] hover:text-white/70"
                title="تعديل"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {/* زر إلغاء — يظهر لو في وضع التعديل */}
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20"
                title="إلغاء"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* زر حفظ */}
            {dirty && (
              <button
                type="button"
                onClick={handleSave}
                className={`${ws.btnPrimary} text-xs px-2 py-0.5 rounded-lg`}
              >
                حفظ
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* صف الملاحظة */}
      {showNote && isPaid && (
        <tr className="border-t border-white/5">
          <td colSpan={14} className="py-2 px-2">
            <div className="flex items-start gap-2 mr-2">
              {amountDiffers && (
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  <div
                    className="w-2 h-2 rounded-full bg-amber-400"
                    style={{
                      animation: "payrollPulse 2s ease-in-out infinite",
                    }}
                  />
                  <span className="text-amber-300 text-xs font-semibold whitespace-nowrap">
                    المبلغ مختلف عن المعتمد
                  </span>
                </div>
              )}
              {isLocked ? (
                <span className="text-white/60 text-xs py-1.5 flex-1">
                  {paymentNote || "—"}
                </span>
              ) : (
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  disabled={isClosed}
                  placeholder={
                    amountDiffers
                      ? "يرجى إدخال سبب الاختلاف..."
                      : "ملاحظة (اختياري)..."
                  }
                  className={`${ws.input} text-xs py-1.5 px-3 rounded-xl flex-1 ${
                    amountDiffers && !paymentNote
                      ? "border-amber-400/40 placeholder:text-amber-300/50"
                      : ""
                  }`}
                />
              )}
              {dirty && (
                <button
                  type="button"
                  onClick={handleSave}
                  className={`${ws.btnPrimary} text-xs px-3 py-1.5 rounded-xl shrink-0`}
                >
                  حفظ
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function PayrollTable({ entries, onPaymentSave, isClosed }) {
  if (entries.length === 0) {
    return <div className="text-white/60">لا يوجد بيانات.</div>;
  }

  return (
    <>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/70 text-[11px]">
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              الموظف
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              الفرع
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              الأساسي
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              البدلات
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              الإجمالي
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              البونص
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              أوفر تايم
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              الخصم
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              السلف
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              الصافي
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              الطريقة
            </th>
            <th className="text-right font-semibold py-2 px-1.5 whitespace-nowrap">
              المدفوع
            </th>
            <th className="text-center font-semibold py-2 px-1 whitespace-nowrap">
              ✓
            </th>
            <th className="py-2 px-1" style={{ width: 70 }}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <PaymentRow
              key={e.id}
              entry={e}
              onSave={onPaymentSave}
              isClosed={isClosed}
            />
          ))}
        </tbody>
      </table>
      <style jsx global>{`
        @keyframes payrollPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
