import { useEffect, useMemo, useState } from "react";
import { Banknote, Save, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { buildRecentMonthOptions } from "@/utils/payrollFormatters";

export function FixedExpenseForm({
  types,
  onSubmit,
  isSubmitting,
  editingFixed,
  onCancelEdit,
}) {
  const [typeId, setTypeId] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [startMonth, setStartMonth] = useState("");

  const isEditing = !!editingFixed;

  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);

  useEffect(() => {
    if (editingFixed) {
      setTypeId(String(editingFixed.expense_type_id || ""));
      setExpenseName(editingFixed.expense_name || "");
      setDefaultAmount(String(editingFixed.default_amount || ""));
      const sm = editingFixed.start_month
        ? String(editingFixed.start_month).slice(0, 7)
        : "";
      setStartMonth(sm);
    } else {
      setTypeId("");
      setExpenseName("");
      setDefaultAmount("");
      setStartMonth("");
    }
  }, [editingFixed]);

  const typeOptions = [
    { value: "", label: "اختر نوع المصروف" },
    ...(Array.isArray(types) ? types : []).map((t) => ({
      value: String(t.id),
      label: t.name,
    })),
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!typeId || !expenseName.trim() || !defaultAmount) return;

    onSubmit({
      ...(isEditing ? { id: editingFixed.id } : {}),
      expense_type_id: Number(typeId),
      expense_name: expenseName.trim(),
      default_amount: Number(defaultAmount),
      start_month: startMonth || null,
    });

    if (!isEditing) {
      setTypeId("");
      setExpenseName("");
      setDefaultAmount("");
      setStartMonth("");
    }
  };

  const handleCancel = () => {
    setTypeId("");
    setExpenseName("");
    setDefaultAmount("");
    setStartMonth("");
    if (onCancelEdit) onCancelEdit();
  };

  return (
    <div className={`${ws.glass} ${ws.card} p-5`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Banknote className="w-5 h-5 text-emerald-200" />
        </div>
        <div>
          <div className="font-bold text-white tracking-tight">
            {isEditing ? "تعديل مصروف ثابت" : "إضافة مصروف ثابت"}
          </div>
          <div className="text-xs text-white/50 mt-0.5">
            يُسجَّل مرة واحدة ويظهر تلقائياً في رفع المصروفات لكل شهر للتأكيد.
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <div>
          <div className="text-xs text-white/55 mb-1">النوع</div>
          <GlassSelect
            value={typeId}
            onChange={setTypeId}
            options={typeOptions}
          />
        </div>

        <div>
          <div className="text-xs text-white/55 mb-1">اسم المصروف</div>
          <input
            type="text"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            className={`${ws.input} px-3 py-2 w-full`}
            placeholder="مثال: إيجار المكتب"
          />
        </div>

        <div>
          <div className="text-xs text-white/55 mb-1">المبلغ الافتراضي</div>
          <input
            type="number"
            value={defaultAmount}
            onChange={(e) => setDefaultAmount(e.target.value)}
            className={`${ws.input} px-3 py-2 w-full text-right`}
            placeholder="0.00"
            step="0.01"
            min="0"
            dir="ltr"
          />
        </div>

        <div>
          <div className="text-xs text-white/55 mb-1">
            شهر البداية{" "}
            <span className="text-white/35">(اختياري)</span>
          </div>
          <GlassSelect
            value={startMonth}
            onChange={setStartMonth}
            options={monthOptions}
            placeholder="بدون شهر بداية"
            buttonClassName="text-sm py-2.5 px-3"
          />
          <div className="text-[11px] text-white/35 mt-1">
            إذا تُرك فارغاً يطبَّق على كل الأشهر السابقة واللاحقة.
          </div>
        </div>

        <div className="md:col-span-2 flex items-center gap-2 mt-2">
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !typeId ||
              !expenseName.trim() ||
              !defaultAmount
            }
            className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2`}
          >
            <Save className="w-4 h-4" />
            {isEditing ? "حفظ التعديلات" : "إضافة"}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleCancel}
              className={`${ws.btnNeutral} px-4 py-2`}
            >
              <X className="w-4 h-4" />
              إلغاء
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
