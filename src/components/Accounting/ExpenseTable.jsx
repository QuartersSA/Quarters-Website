import { useState, useEffect } from "react";
import { Check, X, MessageSquare, Pencil, Trash2, Anchor } from "lucide-react";
import { formatMoney } from "@/utils/payrollFormatters";
import { ws } from "@/components/Workspace/ui";

// Row for a fixed-expense template that has not been confirmed yet for the
// current month. User can confirm payment (with optional override amount).
function PendingFixedRow({ pending, month, onConfirmFixed }) {
  const [amount, setAmount] = useState(String(pending.default_amount || ""));
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const handleConfirm = () => {
    onConfirmFixed({
      id: pending.id,
      month,
      confirmed_amount: amount !== "" ? Number(amount) : Number(pending.default_amount),
      confirmed_note: note || null,
    });
  };

  const typeName = pending.expense_type_name || "—";
  const expenseName = pending.expense_name || "—";
  const defaultFormatted = formatMoney(pending.default_amount);

  return (
    <>
      <tr className="border-t border-white/10 hover:bg-white/[0.04] bg-emerald-400/[0.03]">
        <td
          className="py-2.5 px-2 text-white/70 whitespace-nowrap text-sm"
          style={{ maxWidth: 120 }}
        >
          {typeName}
        </td>
        <td
          className="py-2.5 px-2 font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis text-sm"
          style={{ maxWidth: 200 }}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-400/15 border border-emerald-400/30 text-emerald-200 text-[10px] font-bold">
              <Anchor className="w-2.5 h-2.5" />
              ثابت
            </span>
            <span>{expenseName}</span>
          </span>
        </td>
        <td
          className="py-2.5 px-2 text-white/70 whitespace-nowrap text-right text-sm"
          dir="ltr"
        >
          {defaultFormatted}
        </td>
        <td className="py-2.5 px-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${ws.input} text-xs py-1 px-1.5 rounded-lg w-[80px] text-right`}
            dir="ltr"
            placeholder={String(pending.default_amount || 0)}
            step="0.01"
          />
        </td>
        <td className="py-2.5 px-1 text-center">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 text-white/30">
            <X className="w-3.5 h-3.5" />
          </span>
        </td>
        <td className="py-2.5 px-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowNote(!showNote)}
              className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-all ${
                note
                  ? "bg-amber-400/15 border border-amber-400/30 text-amber-300"
                  : "bg-white/[0.04] border border-white/10 text-white/40 hover:bg-white/[0.08]"
              }`}
              title="ملاحظة"
            >
              <MessageSquare className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`${ws.btnPrimary} text-xs px-2 py-0.5 rounded-lg`}
              title="تأكيد الدفع"
            >
              تأكيد الدفع
            </button>
          </div>
        </td>
      </tr>

      {showNote && (
        <tr className="border-t border-white/5">
          <td colSpan={6} className="py-2 px-2">
            <div className="flex items-start gap-2 mr-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ملاحظة (اختياري)..."
                className={`${ws.input} text-xs py-1.5 px-3 rounded-xl flex-1`}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ExpenseRow({ expense, onConfirm, onDelete, onEdit }) {
  const savedConfirmed = !!expense.is_confirmed;

  const [isConfirmed, setIsConfirmed] = useState(savedConfirmed);
  const [confirmedAmount, setConfirmedAmount] = useState(
    expense.confirmed_amount !== null && expense.confirmed_amount !== undefined
      ? String(expense.confirmed_amount)
      : "",
  );
  const [confirmedNote, setConfirmedNote] = useState(
    expense.confirmed_note || "",
  );
  const [showNote, setShowNote] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isEditingConfirm, setIsEditingConfirm] = useState(false);

  const isLocked = savedConfirmed && !isEditingConfirm && !dirty;

  const originalAmount = Number(expense.amount || 0);
  const currentConfirmedAmount =
    confirmedAmount !== "" ? Number(confirmedAmount) : null;
  const amountDiffers =
    currentConfirmedAmount !== null &&
    Math.abs(currentConfirmedAmount - originalAmount) >= 0.01;

  useEffect(() => {
    setIsConfirmed(!!expense.is_confirmed);
    setConfirmedAmount(
      expense.confirmed_amount !== null &&
        expense.confirmed_amount !== undefined
        ? String(expense.confirmed_amount)
        : "",
    );
    setConfirmedNote(expense.confirmed_note || "");
    setShowNote(false);
    setDirty(false);
    setIsEditingConfirm(false);
  }, [expense.is_confirmed, expense.confirmed_amount, expense.confirmed_note]);

  const handleToggleConfirmed = () => {
    if (isLocked) return;
    const newConfirmed = !isConfirmed;
    setIsConfirmed(newConfirmed);
    if (newConfirmed && !confirmedAmount) {
      setConfirmedAmount(String(originalAmount));
    }
    if (!newConfirmed) {
      setConfirmedAmount("");
      setConfirmedNote("");
      setShowNote(false);
    }
    setDirty(true);
  };

  const handleAmountChange = (val) => {
    setConfirmedAmount(val);
    setDirty(true);
  };

  const handleNoteChange = (val) => {
    setConfirmedNote(val);
    setDirty(true);
  };

  const handleSave = () => {
    onConfirm({
      id: expense.id,
      is_confirmed: isConfirmed,
      confirmed_amount:
        isConfirmed && confirmedAmount !== "" ? Number(confirmedAmount) : null,
      confirmed_note: isConfirmed && confirmedNote ? confirmedNote : null,
    });
    setDirty(false);
    setIsEditingConfirm(false);
  };

  const handleEditConfirm = () => {
    setIsEditingConfirm(true);
  };

  const handleCancelEditConfirm = () => {
    setIsConfirmed(!!expense.is_confirmed);
    setConfirmedAmount(
      expense.confirmed_amount !== null &&
        expense.confirmed_amount !== undefined
        ? String(expense.confirmed_amount)
        : "",
    );
    setConfirmedNote(expense.confirmed_note || "");
    setShowNote(false);
    setDirty(false);
    setIsEditingConfirm(false);
  };

  const typeName = expense.expense_type_name || "—";
  const expenseName = expense.expense_name || "—";
  const formattedAmount = formatMoney(expense.amount);

  return (
    <>
      <tr className="border-t border-white/10 hover:bg-white/[0.04]">
        <td
          className="py-2.5 px-2 text-white/70 whitespace-nowrap text-sm"
          style={{ maxWidth: 120 }}
        >
          {typeName}
        </td>
        <td
          className="py-2.5 px-2 font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis text-sm"
          style={{ maxWidth: 200 }}
        >
          {expenseName}
        </td>
        <td
          className="py-2.5 px-2 text-white/70 whitespace-nowrap text-right text-sm"
          dir="ltr"
        >
          {formattedAmount}
        </td>

        {/* المبلغ المؤكد */}
        <td className="py-2.5 px-2">
          {isConfirmed ? (
            isLocked ? (
              <span className="text-white/70 text-xs" dir="ltr">
                {formatMoney(confirmedAmount)}
              </span>
            ) : (
              <input
                type="number"
                value={confirmedAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={`${ws.input} text-xs py-1 px-1.5 rounded-lg w-[80px] text-right ${
                  amountDiffers
                    ? "border-amber-400/50 ring-1 ring-amber-400/20"
                    : ""
                }`}
                dir="ltr"
                placeholder={String(originalAmount)}
                step="0.01"
              />
            )
          ) : (
            <span className="text-white/30 text-xs">—</span>
          )}
        </td>

        {/* تأكيد */}
        <td className="py-2.5 px-1 text-center">
          <button
            type="button"
            onClick={handleToggleConfirmed}
            disabled={isLocked}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all mx-auto ${
              isConfirmed
                ? "bg-emerald-400/20 border border-emerald-400/40 text-emerald-300"
                : "bg-white/[0.04] border border-white/10 text-white/30 hover:bg-white/[0.08]"
            } ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {isConfirmed ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </button>
        </td>

        {/* أزرار */}
        <td className="py-2.5 px-1">
          <div className="flex items-center gap-1">
            {isConfirmed && (
              <button
                type="button"
                onClick={() => setShowNote(!showNote)}
                className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                  confirmedNote || amountDiffers
                    ? "bg-amber-400/15 border border-amber-400/30 text-amber-300"
                    : "bg-white/[0.04] border border-white/10 text-white/40 hover:bg-white/[0.08]"
                }`}
                title="ملاحظة"
              >
                <MessageSquare className="w-3 h-3" />
              </button>
            )}

            {/* Edit button for unconfirmed expenses (edit the expense itself) */}
            {!savedConfirmed && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(expense)}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20"
                title="تعديل المصروف"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {/* Edit confirmation button for already-confirmed expenses */}
            {isLocked && (
              <button
                type="button"
                onClick={handleEditConfirm}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all bg-white/[0.04] border border-white/10 text-white/40 hover:bg-white/[0.08] hover:text-white/70"
                title="تعديل التأكيد"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}

            {isEditingConfirm && (
              <button
                type="button"
                onClick={handleCancelEditConfirm}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20"
                title="إلغاء"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {!savedConfirmed && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("هل تريد حذف هذا المصروف؟")) {
                    onDelete(expense.id);
                  }
                }}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20"
                title="حذف"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}

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

      {showNote && isConfirmed && (
        <tr className="border-t border-white/5">
          <td colSpan={6} className="py-2 px-2">
            <div className="flex items-start gap-2 mr-2">
              {amountDiffers && (
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  <div
                    className="w-2 h-2 rounded-full bg-amber-400"
                    style={{
                      animation: "expensePulse 2s ease-in-out infinite",
                    }}
                  />
                  <span className="text-amber-300 text-xs font-semibold whitespace-nowrap">
                    المبلغ مختلف عن الأصلي
                  </span>
                </div>
              )}
              {isLocked ? (
                <span className="text-white/60 text-xs py-1.5 flex-1">
                  {confirmedNote || "—"}
                </span>
              ) : (
                <input
                  type="text"
                  value={confirmedNote}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  placeholder={
                    amountDiffers
                      ? "يرجى إدخال سبب الاختلاف..."
                      : "ملاحظة (اختياري)..."
                  }
                  className={`${ws.input} text-xs py-1.5 px-3 rounded-xl flex-1 ${
                    amountDiffers && !confirmedNote
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

export function ExpenseTable({
  expenses,
  pendingFixed = [],
  month,
  onConfirm,
  onDelete,
  onEdit,
  onConfirmFixed,
}) {
  const hasAny =
    (Array.isArray(expenses) && expenses.length > 0) ||
    (Array.isArray(pendingFixed) && pendingFixed.length > 0);

  if (!hasAny) {
    return (
      <div className="text-center py-8">
        <div className="text-white/40 text-sm">لا يوجد مصروفات لهذا الشهر</div>
        <div className="text-white/25 text-xs mt-1">
          أضف مصروفات من قسم تسجيل المصروفات أو سجّل مصاريف ثابتة
        </div>
      </div>
    );
  }

  const confirmedCount = expenses.filter((e) => e.is_confirmed).length;
  const totalOriginal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalConfirmed = expenses
    .filter((e) => e.is_confirmed)
    .reduce((s, e) => s + Number(e.confirmed_amount || e.amount || 0), 0);
  const pendingCount = Array.isArray(pendingFixed) ? pendingFixed.length : 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-xs text-white/50">
          تم التأكيد: {confirmedCount} / {expenses.length}
        </span>
        {pendingCount > 0 && (
          <>
            <span className="text-xs text-white/40">|</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-200">
              <Anchor className="w-3 h-3" />
              مصروفات ثابتة بانتظار التأكيد: {pendingCount}
            </span>
          </>
        )}
        <span className="text-xs text-white/40">|</span>
        <span className="text-xs text-white/50">
          إجمالي المصروفات:{" "}
          <span className="text-white/80 font-semibold" dir="ltr">
            {formatMoney(totalOriginal)}
          </span>
        </span>
        {confirmedCount > 0 && (
          <>
            <span className="text-xs text-white/40">|</span>
            <span className="text-xs text-white/50">
              إجمالي المؤكد:{" "}
              <span className="text-emerald-200 font-semibold" dir="ltr">
                {formatMoney(totalConfirmed)}
              </span>
            </span>
          </>
        )}
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/70 text-[11px]">
            <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">
              النوع
            </th>
            <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">
              اسم المصروف
            </th>
            <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">
              المبلغ
            </th>
            <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">
              المبلغ المؤكد
            </th>
            <th className="text-center font-semibold py-2 px-1 whitespace-nowrap">
              ✓
            </th>
            <th className="py-2 px-1" style={{ width: 120 }}></th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(pendingFixed) &&
            pendingFixed.map((p) => (
              <PendingFixedRow
                key={`fixed-${p.id}`}
                pending={p}
                month={month}
                onConfirmFixed={onConfirmFixed}
              />
            ))}
          {expenses.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              onConfirm={onConfirm}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </tbody>
      </table>
      <style jsx global>{`
        @keyframes expensePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
