import { Banknote, Package, Layers, AlertCircle } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { StockValueExportMenu } from "./StockValueExportMenu";

const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtQty(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function fmtPct(value, total) {
  const v = Number(value);
  const t = Number(total);
  if (!Number.isFinite(v) || !Number.isFinite(t) || t <= 0) return null;
  const pct = (v / t) * 100;
  if (pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

// Currency column is the headline metric — kept right-aligned and bold
// emerald to match the stat card colour. Missing-cost rows get an amber
// hint instead of "0" so the user knows the row needs attention.
export function StockValueTable({
  items,
  totalValue,
  isLoading,
  onExportExcel,
  onExportPDF,
}) {
  return (
    <div className={sectionCard}>
      <div
        className={`p-5 sm:p-6 border-b ${ws.divider} flex items-center justify-between gap-3 flex-wrap`}
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
          <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}>
            <Banknote className="w-5 h-5" />
          </div>
          قيمة الأصناف
        </h2>
        <StockValueExportMenu
          onExportExcel={onExportExcel}
          onExportPDF={onExportPDF}
        />
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-600 dark:text-white/55">
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
            <span>جاري التحميل…</span>
          </div>
        </div>
      ) : !Array.isArray(items) || items.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-white/50">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">لا توجد أصناف</p>
          <p className="text-sm">جرّب تعديل البحث أو الفلاتر</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-white/[0.04]">
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55 w-16">
                  #
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55">
                  الصنف
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55">
                  الفئة
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55">
                  الكمية
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55">
                  الوحدة
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55">
                  سعر التكلفة
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55">
                  القيمة الإجمالية
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-white/55">
                  النسبة
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const qty = Number(it.total_quantity) || 0;
                // effective_cost = direct i.cost OR fallback to latest
                // green-bean order price. matches the dashboard's logic
                // so the totals agree across screens.
                const effCost =
                  it.effective_cost == null
                    ? null
                    : Number(it.effective_cost);
                const directCost =
                  it.cost == null ? null : Number(it.cost);
                const usedFallback =
                  directCost == null &&
                  effCost != null &&
                  Number.isFinite(effCost);
                const value =
                  it.total_value == null ? null : Number(it.total_value);
                const missingCost = effCost == null || !Number.isFinite(effCost);
                const pctText = fmtPct(value, totalValue);

                return (
                  <tr
                    key={it.id}
                    className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-500 dark:text-white/45 text-sm">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-emerald-700 dark:text-emerald-200" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-900 dark:text-white font-semibold truncate">
                            {it.name}
                          </p>
                          {it.name_en ? (
                            <p className="text-slate-500 dark:text-white/40 text-xs truncate">
                              {it.name_en}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-white/75 text-sm">
                      {it.category_name ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Layers className="w-3 h-3 text-slate-500 dark:text-white/40" />
                          {it.category_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold" dir="ltr">
                      {fmtQty(qty)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-white/55 text-sm">
                      {it.unit || "—"}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        missingCost
                          ? "text-amber-700 dark:text-amber-300/80 text-xs"
                          : "text-white/80"
                      }`}
                      dir="ltr"
                    >
                      {missingCost ? (
                        <span className="inline-flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          غير محدد
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5"
                          title={
                            usedFallback
                              ? "السعر من آخر طلب بن أخضر (i.cost = NULL)"
                              : "سعر تكلفة الصنف المسجّل"
                          }
                        >
                          {fmtMoney(effCost)} ر.س
                          {usedFallback ? (
                            <span className="text-[10px] text-sky-700 dark:text-sky-200/80 bg-sky-400/10 border border-sky-400/20 rounded px-1 py-0.5">
                              بن
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 font-extrabold ${
                        missingCost ? "text-slate-400 dark:text-white/30" : "text-emerald-700 dark:text-emerald-200"
                      }`}
                      dir="ltr"
                    >
                      {missingCost ? "—" : `${fmtMoney(value)} ر.س`}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-white/55 text-sm" dir="ltr">
                      {missingCost || !pctText ? "—" : pctText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 dark:bg-white/[0.06] border-t-2 border-slate-200 dark:border-white/10">
                <td
                  colSpan={6}
                  className="px-4 py-4 text-white/80 font-bold text-left"
                >
                  الإجمالي ({items.length} صنف)
                </td>
                <td
                  className="px-4 py-4 text-emerald-700 dark:text-emerald-200 font-extrabold text-lg"
                  dir="ltr"
                >
                  {fmtMoney(totalValue)} ر.س
                </td>
                <td className="px-4 py-4 text-slate-500 dark:text-white/40 text-sm" dir="ltr">
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
