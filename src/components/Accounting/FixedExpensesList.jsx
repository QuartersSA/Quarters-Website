import { Pencil, Trash2, Anchor } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { formatMoney } from "@/utils/payrollFormatters";

function formatStartMonth(value) {
  if (!value) return "—";
  const s = String(value);
  // Accept either YYYY-MM-DD (from DB) or YYYY-MM
  return s.slice(0, 7);
}

export function FixedExpensesList({ items, onEdit, onDelete, isLoading, error }) {
  if (isLoading) {
    return (
      <div className={`${ws.glassSoft} ${ws.card} p-6 text-center`}>
        <div className="text-white/60">جاري التحميل…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${ws.glassSoft} ${ws.card} p-6 text-center`}>
        <div className="text-red-300">{error}</div>
      </div>
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return (
      <div className={`${ws.glassSoft} ${ws.card} p-6 text-center`}>
        <div className="text-white/60">لا يوجد مصروفات ثابتة بعد.</div>
        <div className="text-white/40 text-xs mt-1">
          أضف مصروف ثابت من النموذج أعلاه ليظهر تلقائياً في رفع المصروفات لكل شهر.
        </div>
      </div>
    );
  }

  return (
    <div className={`${ws.glass} ${ws.card} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <Anchor className="w-4 h-4 text-emerald-200" />
        <div className="font-bold text-white tracking-tight">المصروفات الثابتة الحالية</div>
        <span className="text-xs text-white/50">({items.length})</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/70 text-[11px]">
              <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">النوع</th>
              <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">اسم المصروف</th>
              <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">المبلغ الافتراضي</th>
              <th className="text-right font-semibold py-2 px-2 whitespace-nowrap">شهر البداية</th>
              <th className="py-2 px-1" style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => {
              const inactive = !f.is_active;
              return (
                <tr
                  key={f.id}
                  className={`border-t border-white/10 hover:bg-white/[0.04] ${
                    inactive ? "opacity-50" : ""
                  }`}
                >
                  <td className="py-2.5 px-2 text-white/70 whitespace-nowrap">
                    {f.expense_type_name || "—"}
                  </td>
                  <td className="py-2.5 px-2 font-semibold text-white whitespace-nowrap">
                    {f.expense_name || "—"}
                    {inactive && (
                      <span className="mr-2 text-[10px] text-white/40 font-normal">
                        (غير نشط)
                      </span>
                    )}
                  </td>
                  <td
                    className="py-2.5 px-2 text-white/80 whitespace-nowrap text-right"
                    dir="ltr"
                  >
                    {formatMoney(f.default_amount)}
                  </td>
                  <td className="py-2.5 px-2 text-white/60 whitespace-nowrap" dir="ltr">
                    {formatStartMonth(f.start_month)}
                  </td>
                  <td className="py-2.5 px-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit?.(f)}
                        className="w-7 h-7 rounded-md inline-flex items-center justify-center bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20"
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "إلغاء تنشيط هذا المصروف الثابت؟ لن يظهر في الأشهر القادمة. (المصروفات المؤكدة سابقاً ستبقى)",
                            )
                          ) {
                            onDelete?.(f.id);
                          }
                        }}
                        className="w-7 h-7 rounded-md inline-flex items-center justify-center bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20"
                        title="إلغاء التنشيط"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
