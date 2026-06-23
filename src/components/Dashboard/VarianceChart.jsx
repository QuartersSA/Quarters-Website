import { TrendingUp } from "lucide-react";
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

export function VarianceChart({
  varianceBranchId,
  setVarianceBranchId,
  varianceItemId,
  setVarianceItemId,
  varianceFrom,
  setVarianceFrom,
  varianceTo,
  setVarianceTo,
  branches,
  activeItems,
  varianceLoading,
  varianceError,
  varianceChartData,
  varianceHasData,
  varianceHasOpening,
}) {
  const { isDark } = useAdminTheme();
  // Recharts axes/grid/legend render as inline SVG outside the
  // Tailwind class cascade, so colors must be picked per-theme here.
  const gridStroke = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.10)";
  const axisStroke = isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)";
  const legendColor = isDark ? "rgba(255,255,255,0.7)" : "rgb(51, 65, 85)";
  const tooltipBg = isDark ? "rgba(15, 23, 42, 0.96)" : "rgba(255, 255, 255, 0.98)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.12)";
  const tooltipLabel = isDark ? "rgba(255,255,255,0.55)" : "rgb(71, 85, 105)";
  const tooltipText = isDark ? "#fff" : "rgb(15, 23, 42)";

  const varianceTooltipFormatter = (value, name) => {
    if (name === "delta") {
      return [value, "الفرق (فعلي - مفترض)"];
    }
    if (name === "expected") {
      return [value, "المفترض"];
    }
    if (name === "actual") {
      return [value, "الفعلي"];
    }
    return [value, name];
  };

  const varianceTooltipLabelFormatter = (label, payload) => {
    const first = payload && payload.length ? payload[0] : null;
    const full = first && first.payload ? first.payload.fullLabel : label;
    return full;
  };

  const wrapperClass = `${ws.glass} ${ws.card} overflow-hidden mb-8`;

  const branchOptions = [
    { value: "", label: "اختر الفرع" },
    ...(branches || []).map((b) => ({ value: String(b.id), label: b.name })),
  ];

  const itemOptions = [
    { value: "", label: "اختر الصنف" },
    ...activeItems.map((it) => ({ value: String(it.id), label: it.name })),
  ];

  const needsDates =
    !!varianceBranchId && !!varianceItemId && (!varianceFrom || !varianceTo);

  let chartBody = null;

  if (!varianceBranchId || !varianceItemId) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        اختر الفرع والصنف لعرض المفترض مقابل الفعلي
      </div>
    );
  } else if (needsDates) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        اختر التاريخ (من / إلى) لعرض البيانات
      </div>
    );
  } else if (varianceLoading) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        جاري تحميل البيانات…
      </div>
    );
  } else if (varianceError) {
    chartBody = (
      <div className="text-center text-red-700 dark:text-red-200 py-10">
        حدث خطأ أثناء تحميل بيانات المفترض مقابل الفعلي
      </div>
    );
  } else if (!varianceHasData) {
    chartBody = (
      <div className="text-center text-slate-600 dark:text-white/55 py-10">
        لا توجد بيانات جرد لهذا الصنف خلال الفترة المحددة
      </div>
    );
  } else {
    chartBody = (
      <>
        {!varianceHasOpening ? (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl text-amber-700 dark:text-amber-100">
            لم يتم العثور على مخزون افتتاحي قبل تواريخ الجرد المعروضة. سجّل مخزون
            افتتاحي للفرع حتى تكون نتيجة "المفترض" دقيقة.
          </div>
        ) : null}

        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={varianceChartData}
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
                formatter={varianceTooltipFormatter}
                labelFormatter={varianceTooltipLabelFormatter}
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

              <Line
                type="monotone"
                dataKey="expected"
                name="المفترض"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="الفعلي"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="delta"
                name="الفرق"
                stroke="#fb7185"
                strokeWidth={2}
                dot={false}
                connectNulls
                strokeDasharray="6 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-slate-500 dark:text-white/40 mt-3">
          الفرق = الفعلي − المفترض (المخزون الافتتاحي + مجموع الوارد حتى تاريخ
          الجرد)
        </p>
      </>
    );
  }

  return (
    <div className={wrapperClass} dir="rtl">
      <div className={`p-6 border-b ${ws.divider}`}>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            المفترض مقابل الفعلي (افتتاحي + وارد + جرد)
          </h2>
          <p className="text-slate-500 dark:text-white/45 text-sm mt-1">
            المفترض ≈ المخزون الافتتاحي + الوارد • الفرق = الفعلي − المفترض
          </p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          <GlassSelect
            value={varianceBranchId}
            onChange={setVarianceBranchId}
            options={branchOptions}
            buttonClassName="px-3 py-2"
          />

          <GlassSelect
            value={varianceItemId}
            onChange={setVarianceItemId}
            options={itemOptions}
            buttonClassName="px-3 py-2"
            searchable
            searchPlaceholder="ابحث عن صنف..."
            noResultsLabel="لا يوجد صنف مطابق"
          />

          <div className="w-full">
            <label className="block text-xs text-slate-500 dark:text-white/45 mb-1">من</label>
            <GlassDatePicker
              value={varianceFrom}
              onChange={setVarianceFrom}
              placeholder="اختر التاريخ"
              buttonClassName="px-3 py-2"
            />
          </div>

          <div className="w-full">
            <label className="block text-xs text-slate-500 dark:text-white/45 mb-1">إلى</label>
            <GlassDatePicker
              value={varianceTo}
              onChange={setVarianceTo}
              placeholder="اختر التاريخ"
              buttonClassName="px-3 py-2"
            />
          </div>
        </div>

        {chartBody}
      </div>
    </div>
  );
}
