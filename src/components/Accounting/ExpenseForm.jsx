import { useState, useEffect, useMemo } from "react";
import { Plus, Tag, Save, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { buildRecentMonthOptions } from "@/utils/payrollFormatters";
import { currentRiyadhMonthKey } from "@/utils/dateUtils";

export function ExpenseForm({
  types,
  onSubmit,
  isSubmitting,
  onCreateType,
  editingExpense,
  onCancelEdit,
  // Optional: prefill form's month (e.g. when opened from QuickAddSheet so
  // the new expense lands in the same month the user is currently viewing).
  // Falls back to current calendar month when omitted.
  defaultMonth,
}) {
  const [typeId, setTypeId] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [amount, setAmount] = useState("");
  const [formMonth, setFormMonth] = useState("");
  const [showNewType, setShowNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);

  // Default the month at mount when not editing. Prefer caller-supplied
  // `defaultMonth` (e.g. page's currently-viewed month) over wall-clock
  // current month — keeps the new row in the same month the user is on.
  // Previously this effect depended on `formMonth` too, which meant
  // clearing the form (formMonth becoming "") after editing would re-fire
  // it and overwrite a user-picked-then-cleared month. The mount-only
  // effect avoids that loop.
  useEffect(() => {
    if (editingExpense) return;
    if (defaultMonth) {
      setFormMonth(defaultMonth);
      return;
    }
    setFormMonth(currentRiyadhMonthKey());
    // We deliberately only run this once on mount; subsequent month
    // changes are user-driven via the GlassSelect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load editing expense into form whenever the editing target changes.
  useEffect(() => {
    if (editingExpense) {
      setTypeId(String(editingExpense.expense_type_id || ""));
      setExpenseName(editingExpense.expense_name || "");
      setAmount(String(editingExpense.amount || ""));
      const em = editingExpense.expense_month
        ? String(editingExpense.expense_month).slice(0, 7)
        : "";
      setFormMonth(em);
    }
  }, [editingExpense]);

  const typeOptions = [
    { value: "", label: "اختر نوع المصروف" },
    ...(types || []).map((t) => ({ value: String(t.id), label: t.name })),
  ];

  const isEditing = !!editingExpense;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!typeId || !expenseName.trim() || !amount || !formMonth) return;
    onSubmit({
      ...(isEditing ? { id: editingExpense.id } : {}),
      expense_type_id: Number(typeId),
      expense_name: expenseName.trim(),
      amount: Number(amount),
      month: formMonth,
    });
    if (!isEditing) {
      setExpenseName("");
      setAmount("");
    }
  };

  const handleCancel = () => {
    setTypeId("");
    setExpenseName("");
    setAmount("");
    setShowNewType(false);
    setNewTypeName("");
    if (onCancelEdit) onCancelEdit();
  };

  const handleCreateType = (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    onCreateType({ name: newTypeName.trim() });
    setNewTypeName("");
    setShowNewType(false);
  };

  const canSubmit =
    typeId && expenseName.trim() && amount && Number(amount) > 0 && formMonth;

  return (
    <div className="space-y-4">
      {isEditing && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/20">
          <span className="text-amber-700 dark:text-amber-200 text-xs font-semibold">
            ✏️ تعديل المصروف:
          </span>
          <span className="text-slate-900 dark:text-white text-xs font-bold">
            {editingExpense.expense_name}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* الشهر */}
          <div>
            <label className="block text-xs text-slate-600 dark:text-white/60 font-semibold mb-1.5">
              الشهر
            </label>
            <GlassSelect
              value={formMonth}
              onChange={setFormMonth}
              options={monthOptions}
              placeholder="اختر الشهر"
              buttonClassName="text-sm py-2.5 px-3"
              disabled={isEditing}
            />
          </div>

          {/* نوع المصروف */}
          <div>
            <label className="block text-xs text-slate-600 dark:text-white/60 font-semibold mb-1.5">
              نوع المصروف
            </label>
            <GlassSelect
              value={typeId}
              onChange={setTypeId}
              options={typeOptions}
              placeholder="اختر نوع المصروف"
              buttonClassName="text-sm py-2.5 px-3"
            />
          </div>

          {/* اسم المصروف */}
          <div>
            <label className="block text-xs text-slate-600 dark:text-white/60 font-semibold mb-1.5">
              اسم المصروف
            </label>
            <input
              type="text"
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="مثال: كهرباء فرع الندى"
              className={`${ws.input} text-sm py-2.5 px-3 rounded-2xl`}
            />
          </div>

          {/* المبلغ */}
          <div>
            <label className="block text-xs text-slate-600 dark:text-white/60 font-semibold mb-1.5">
              المبلغ (ريال)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              dir="ltr"
              className={`${ws.input} text-sm py-2.5 px-3 rounded-2xl text-right`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className={`${isEditing ? ws.btnPrimary : ws.btnPrimary} px-5 py-2.5 rounded-2xl`}
          >
            {isEditing ? (
              <Save className="w-4 h-4" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span className="font-semibold">
              {isSubmitting
                ? isEditing
                  ? "جاري الحفظ..."
                  : "جاري الإضافة..."
                : isEditing
                  ? "حفظ التعديل"
                  : "إضافة مصروف"}
            </span>
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              className={`${ws.btnNeutral} px-4 py-2.5 rounded-2xl`}
            >
              <X className="w-4 h-4" />
              <span className="font-semibold">إلغاء</span>
            </button>
          )}

          {!isEditing && (
            <button
              type="button"
              onClick={() => setShowNewType(!showNewType)}
              className={`${ws.btnNeutral} px-4 py-2.5 rounded-2xl`}
            >
              <Tag className="w-4 h-4" />
              <span className="font-semibold">نوع جديد</span>
            </button>
          )}
        </div>
      </form>

      {showNewType && !isEditing && (
        <form onSubmit={handleCreateType} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-slate-600 dark:text-white/60 font-semibold mb-1.5">
              اسم النوع الجديد
            </label>
            <input
              type="text"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="مثال: تأمين"
              className={`${ws.input} text-sm py-2.5 px-3 rounded-2xl`}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!newTypeName.trim()}
            className={`${ws.btnPrimary} px-4 py-2.5 rounded-2xl`}
          >
            <Plus className="w-4 h-4" />
            <span className="font-semibold">إضافة</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewType(false);
              setNewTypeName("");
            }}
            className={`${ws.btnNeutral} px-4 py-2.5 rounded-2xl`}
          >
            إلغاء
          </button>
        </form>
      )}
    </div>
  );
}
