import { BarChart3, Calendar } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { VarianceExportMenu } from "./VarianceExportMenu";

const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return String(value).slice(0, 10);
  }
}

function getDeltaClass(delta) {
  const n = Number(delta) || 0;
  if (n < -0.001) return "text-red-700 dark:text-red-700 dark:text-red-200";
  if (n > 0.001) return "text-emerald-700 dark:text-emerald-700 dark:text-emerald-200";
  return "text-slate-600 dark:text-slate-600 dark:text-white/55";
}

function getDeltaPercent(delta, expected) {
  const d = Number(delta) || 0;
  const e = Number(expected) || 0;
  if (e === 0) return null;
  return (d / e) * 100;
}

export function VarianceTable({
  rows,
  isLoading,
  hasFilters,
  // When hasFilters is false, this tells the user which specific filter is
  // still empty — previously the message said "حدد كل الفلاتر" without
  // indicating which ones were already filled vs missing.
  filterStatus,
  onExportExcel,
  onExportPDF,
}) {
  const f = filterStatus || {};
  return (
    <div className={sectionCard}>
      <div
        className={`p-5 sm:p-6 border-b ${ws.divider} flex items-center justify-between gap-3`}
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
          <div className={`${ws.iconBox} w-10 h-10 text-amber-700 dark:text-amber-700 dark:text-amber-200`}>
            <BarChart3 className="w-5 h-5" />
          </div>
          سجل الانحرافات
        </h2>

        <VarianceExportMenu
          onExportExcel={onExportExcel}
          onExportPDF={onExportPDF}
        />
      </div>

      {!hasFilters ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-500 dark:text-white/50">
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">اختر الفرع والصنف والفترة لعرض الانحرافات</p>
          {/* Per-filter status so user sees what's left */}
          <div className="mt-4 inline-flex flex-col gap-1.5 items-start text-sm">
            <span className={f.branch ? "text-emerald-700 dark:text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-600 dark:text-white/55"}>
              {f.branch ? "✓" : "○"} الفرع
            </span>
            <span className={f.item ? "text-emerald-700 dark:text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-600 dark:text-white/55"}>
              {f.item ? "✓" : "○"} الصنف
            </span>
            <span className={f.from ? "text-emerald-700 dark:text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-600 dark:text-white/55"}>
              {f.from ? "✓" : "○"} من تاريخ
            </span>
            <span className={f.to ? "text-emerald-700 dark:text-emerald-700 dark:text-emerald-300" : "text-slate-600 dark:text-slate-600 dark:text-white/55"}>
              {f.to ? "✓" : "○"} إلى تاريخ
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-white/40 mt-4">
            المعادلة: المتوقع = آخر افتتاحي + الواردات بعده
          </p>
        </div>
      ) : isLoading ? (
        <div className="p-12 text-center text-slate-600 dark:text-slate-600 dark:text-white/55">
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-amber-400/60 border-t-transparent rounded-full animate-spin" />
            <span>جاري التحميل…</span>
          </div>
        </div>
      ) : !Array.isArray(rows) || rows.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-500 dark:text-white/50">
          <p className="text-lg mb-2">لا توجد بيانات في هذه الفترة</p>
          <p className="text-sm">جرّب تعديل الفلاتر أو توسيع الفترة الزمنية</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04]">
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  التاريخ
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  رقم الجرد
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  المتوقع
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الفعلي
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الفرق منذ الافتتاحي
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الفرق منذ الجرد السابق
                </th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-white/55">
                  النسبة
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const delta = Number(r.delta_quantity) || 0;
                const deltaPrev = r.delta_since_previous;
                const expected = Number(r.expected_quantity) || 0;
                const pct = getDeltaPercent(delta, expected);

                return (
                  <tr
                    key={`${r.operation_id}-${r.item_id}`}
                    className="border-t border-slate-100 dark:border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-700 dark:text-white/75 text-sm whitespace-nowrap" dir="ltr">
                      {formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm font-mono">
                      {r.inventory_number || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-900 dark:text-white text-sm font-semibold" dir="ltr">
                      {formatNumber(r.expected_quantity)}
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-900 dark:text-white text-sm font-semibold" dir="ltr">
                      {formatNumber(r.actual_quantity)}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-bold ${getDeltaClass(delta)}`}
                      dir="ltr"
                    >
                      {delta > 0 ? "+" : ""}
                      {formatNumber(r.delta_quantity)}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm font-bold ${getDeltaClass(deltaPrev)}`}
                      dir="ltr"
                    >
                      {deltaPrev === null || deltaPrev === undefined
                        ? "—"
                        : `${Number(deltaPrev) > 0 ? "+" : ""}${formatNumber(deltaPrev)}`}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${getDeltaClass(delta)}`}
                      dir="ltr"
                    >
                      {pct === null
                        ? "—"
                        : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
