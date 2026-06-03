import { BarChart3 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import useAdminTheme from "@/hooks/useAdminTheme";

export function ItemHistoryChart({
  selectedItemId,
  selectedItemName,
  selectedBranchId,
  setSelectedItemId,
  setSelectedBranchId,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  activeItems,
  branches,
  isHistoryLoading,
  historyError,
  chartData,
  branchSeries,
  chartHasData,
}) {
  const { isDark } = useAdminTheme();
  // Recharts axes/grid/legend ignore Tailwind dark: classes; resolve per-theme.
  const gridStroke = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.10)";
  const axisStroke = isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)";
  const legendColor = isDark ? "rgba(255,255,255,0.7)" : "rgb(51, 65, 85)";
  const tooltipBg = isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.98)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.12)";
  const tooltipLabel = isDark ? "rgba(255,255,255,0.55)" : "rgb(71, 85, 105)";
  const tooltipText = isDark ? "#fff" : "rgb(15, 23, 42)";

  const historyTitle = selectedItemName
    ? `تحليل الجرد للصنف: ${selectedItemName}`
    : "تحليل الجرد حسب الصنف";

  const historySubtitle =
    dateFrom && dateTo ? `من ${dateFrom} إلى ${dateTo}` : "";

  const tooltipLabelFormatter = (label, payload) => {
    const first = payload && payload.length ? payload[0] : null;
    const full = first && first.payload ? first.payload.fullLabel : label;
    return full;
  };

  const tooltipFormatter = (value, name) => {
    return [value, name];
  };

  const wrapperClass = `${ws.glass} ${ws.card} overflow-hidden mb-8`;

  const itemOptions = [
    { value: "", label: "اختر الصنف" },
    ...activeItems.map((it) => ({ value: String(it.id), label: it.name })),
  ];

  const branchOptions = [
    { value: "", label: "كل الفروع (خط لكل فرع)" },
    ...(branches || []).map((b) => ({ value: String(b.id), label: b.name })),
  ];

  const needsDates = !!selectedItemId && (!dateFrom || !dateTo);

  let chartBody = null;
  if (!selectedItemId) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        اختر الصنف لعرض الرسم البياني
      </div>
    );
  } else if (needsDates) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        اختر التاريخ (من / إلى) لعرض البيانات
      </div>
    );
  } else if (isHistoryLoading) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        جاري تحميل البيانات...
      </div>
    );
  } else if (historyError) {
    chartBody = (
      <div className="text-center text-red-700 dark:text-red-200 py-10">
        حدث خطأ أثناء تحميل بيانات الرسم البياني
      </div>
    );
  } else if (!chartHasData) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        لا توجد بيانات لهذا الصنف خلال الفترة المحددة
      </div>
    );
  } else {
    chartBody = (
      <>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 10, left: 0, bottom: 60 }}
            >
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="shortLabel"
                angle={-25}
                textAnchor="end"
                height={70}
                tick={{ fill: axisStroke, fontSize: 12 }}
                axisLine={{ stroke: axisStroke }}
                tickLine={{ stroke: axisStroke }}
              />
              <YAxis
                tick={{ fill: axisStroke, fontSize: 12 }}
                axisLine={{ stroke: axisStroke }}
                tickLine={{ stroke: axisStroke }}
              />
              <Tooltip
                formatter={tooltipFormatter}
                labelFormatter={tooltipLabelFormatter}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: 12,
                  color: tooltipText,
                }}
                labelStyle={{ color: tooltipLabel }}
              />

              <Legend
                wrapperStyle={{ color: legendColor }}
                formatter={(value) => (
                  <span style={{ color: legendColor }}>{value}</span>
                )}
              />

              {branchSeries.map((s) => (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {!selectedBranchId ? (
          <p className="text-xs text-slate-500 dark:text-white/40 mt-3">
            ملاحظة: عند اختيار "كل الفروع"، يتم عرض خط منفصل لكل فرع (ألوان
            مختلفة).
          </p>
        ) : null}
      </>
    );
  }

  return (
    <div className={wrapperClass} dir="rtl">
      <div className={`p-6 border-b ${ws.divider}`}>
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
              <div className={`${ws.iconBox} w-10 h-10 text-sky-700 dark:text-sky-200`}>
                <BarChart3 className="w-5 h-5" />
              </div>
              {historyTitle}
            </h2>
            {historySubtitle ? (
              <p className="text-slate-500 dark:text-white/45 text-sm mt-1">{historySubtitle}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-auto">
            <GlassSelect
              value={selectedItemId}
              onChange={setSelectedItemId}
              options={itemOptions}
              buttonClassName="px-3 py-2"
            />

            <GlassSelect
              value={selectedBranchId}
              onChange={setSelectedBranchId}
              options={branchOptions}
              buttonClassName="px-3 py-2"
            />

            <div className="w-full">
              <label className="block text-xs text-slate-500 dark:text-white/45 mb-1">من</label>
              <GlassDatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="اختر التاريخ"
                buttonClassName="px-3 py-2"
              />
            </div>

            <div className="w-full">
              <label className="block text-xs text-slate-500 dark:text-white/45 mb-1">إلى</label>
              <GlassDatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder="اختر التاريخ"
                buttonClassName="px-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">{chartBody}</div>
    </div>
  );
}
