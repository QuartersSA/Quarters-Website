import { Layers } from "lucide-react";
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
import GlassMultiSelect from "@/components/Workspace/GlassMultiSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import useAdminTheme from "@/hooks/useAdminTheme";

const SERIES = [
  { dataKey: "inventory", name: "الجرد", color: "#38bdf8" },
  { dataKey: "opening", name: "المخزون الافتتاحي", color: "#a78bfa" },
  { dataKey: "receipt", name: "الوارد", color: "#34d399" },
  { dataKey: "transferIn", name: "تحويل وارد", color: "#fbbf24" },
  { dataKey: "transferOut", name: "تحويل صادر", color: "#fb7185" },
];

const TOOLTIP_NAME_MAP = {
  inventory: "الجرد",
  opening: "المخزون الافتتاحي",
  receipt: "الوارد",
  transferIn: "تحويل وارد",
  transferOut: "تحويل صادر",
};

export function ItemAnalysisChart({
  analysisItemId,
  setAnalysisItemId,
  analysisBranchIds,
  setAnalysisBranchIds,
  analysisFrom,
  setAnalysisFrom,
  analysisTo,
  setAnalysisTo,
  activeItems,
  branches,
  isAnalysisLoading,
  analysisError,
  analysisChartData,
  analysisHasData,
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

  const selectedItemObj = activeItems.find(
    (it) => String(it.id) === analysisItemId,
  );
  const selectedItemName = selectedItemObj ? selectedItemObj.name : "";

  const title = selectedItemName
    ? `تحليل المخزون للصنف: ${selectedItemName}`
    : "تحليل المخزون للصنف";

  const subtitle =
    analysisFrom && analysisTo ? `من ${analysisFrom} إلى ${analysisTo}` : "";

  const tooltipFormatter = (value, name) => {
    const label = TOOLTIP_NAME_MAP[name] || name;
    return [value, label];
  };

  const tooltipLabelFormatter = (label, payload) => {
    const first = payload && payload.length ? payload[0] : null;
    const full = first && first.payload ? first.payload.fullLabel : label;
    return full;
  };

  const legendFormatter = (value) => {
    const label = TOOLTIP_NAME_MAP[value] || value;
    return <span style={{ color: legendColor }}>{label}</span>;
  };

  const wrapperClass = `${ws.glass} ${ws.card} overflow-hidden mb-8`;

  const itemOptions = [
    { value: "", label: "اختر الصنف" },
    ...activeItems.map((it) => ({ value: String(it.id), label: it.name })),
  ];

  const branchOptions = (branches || []).map((b) => ({
    value: String(b.id),
    label: b.name,
  }));

  const needsBranch =
    !!analysisItemId && (!analysisBranchIds || analysisBranchIds.length === 0);
  const needsDates =
    !!analysisItemId &&
    analysisBranchIds &&
    analysisBranchIds.length > 0 &&
    (!analysisFrom || !analysisTo);

  let chartBody = null;

  if (!analysisItemId) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        اختر الصنف لعرض تحليل المخزون
      </div>
    );
  } else if (needsBranch) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        اختر الفرع لعرض البيانات
      </div>
    );
  } else if (needsDates) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        اختر التاريخ (من / إلى) لعرض البيانات
      </div>
    );
  } else if (isAnalysisLoading) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        جاري تحميل البيانات...
      </div>
    );
  } else if (analysisError) {
    chartBody = (
      <div className="text-center text-red-700 dark:text-red-200 py-10">
        حدث خطأ أثناء تحميل بيانات التحليل
      </div>
    );
  } else if (!analysisHasData) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        لا توجد بيانات لهذا الصنف خلال الفترة المحددة
      </div>
    );
  } else {
    // Check which series actually have data
    const activeSeries = SERIES.filter((s) =>
      analysisChartData.some((d) => d[s.dataKey] != null),
    );

    chartBody = (
      <>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analysisChartData}
              margin={{ top: 8, right: 10, left: 0, bottom: 60 }}
            >
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
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
                formatter={legendFormatter}
              />

              {activeSeries.map((s) => (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.dataKey}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3">
          {activeSeries.map((s) => (
            <div key={s.dataKey} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-slate-500 dark:text-white/50">{s.name}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-white/40 mt-3">
          الخطوط تمثل كميات الجرد والوارد والمخزون الافتتاحي والتحويلات عبر
          الفترة المحددة
        </p>
      </>
    );
  }

  return (
    <div className={wrapperClass} dir="rtl">
      <div className={`p-6 border-b ${ws.divider}`}>
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
              <div className={`${ws.iconBox} w-10 h-10 text-violet-700 dark:text-violet-200`}>
                <Layers className="w-5 h-5" />
              </div>
              {title}
            </h2>
            {subtitle ? (
              <p className="text-slate-500 dark:text-white/45 text-sm mt-1">{subtitle}</p>
            ) : null}
            <p className="text-slate-500 dark:text-white/45 text-sm mt-0.5">
              الجرد • الوارد • المخزون الافتتاحي • التحويلات
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full xl:w-auto">
            <GlassSelect
              value={analysisItemId}
              onChange={setAnalysisItemId}
              options={itemOptions}
              buttonClassName="px-3 py-2"
            />

            <GlassMultiSelect
              values={analysisBranchIds}
              onChange={setAnalysisBranchIds}
              options={branchOptions}
              placeholder="اختر الفروع"
              buttonClassName="px-3 py-2"
            />

            <div className="w-full">
              <label className="block text-xs text-slate-500 dark:text-white/45 mb-1">من</label>
              <GlassDatePicker
                value={analysisFrom}
                onChange={setAnalysisFrom}
                placeholder="اختر التاريخ"
                buttonClassName="px-3 py-2"
              />
            </div>

            <div className="w-full">
              <label className="block text-xs text-slate-500 dark:text-white/45 mb-1">إلى</label>
              <GlassDatePicker
                value={analysisTo}
                onChange={setAnalysisTo}
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
