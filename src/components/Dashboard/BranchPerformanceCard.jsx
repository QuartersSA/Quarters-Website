import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ws } from "@/components/Workspace/ui";

function getBranchHealthColor(lowStock, outOfStock, tracked) {
  if (tracked === 0)
    return { dot: "bg-gray-400", label: "لا بيانات", color: "text-slate-500 dark:text-white/40" };
  const ratio = (lowStock + outOfStock * 2) / Math.max(tracked, 1);
  if (ratio === 0)
    return { dot: "bg-emerald-400", label: "ممتاز", color: "text-emerald-700 dark:text-emerald-200" };
  if (ratio < 0.15)
    return { dot: "bg-emerald-400", label: "جيد", color: "text-emerald-700 dark:text-emerald-200" };
  if (ratio < 0.3)
    return {
      dot: "bg-amber-400",
      label: "تحتاج متابعة",
      color: "text-amber-700 dark:text-amber-200",
    };
  return { dot: "bg-red-400", label: "حالة حرجة", color: "text-red-700 dark:text-red-200" };
}

export function BranchPerformanceCard({ branchPerformance, weekComparison }) {
  if (!branchPerformance || branchPerformance.length === 0) return null;

  const chartData = branchPerformance.map((b) => ({
    name: b.name,
    عمليات_الشهر: b.ops_this_month,
    منخفض: b.low_stock_count,
  }));

  const COLORS = [
    "#34d399",
    "#38bdf8",
    "#a78bfa",
    "#fbbf24",
    "#f87171",
    "#2dd4bf",
  ];

  const changeIcon =
    weekComparison?.changePercent >= 0 ? (
      <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-700 dark:text-red-300" />
    );

  const changeColor =
    weekComparison?.changePercent >= 0 ? "text-emerald-700 dark:text-emerald-200" : "text-red-700 dark:text-red-200";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
      {/* Week comparison card */}
      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`${ws.iconBox} text-sky-700 dark:text-sky-200`}>
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              مقارنة أسبوعية
            </h3>
            <p className="text-slate-500 dark:text-white/45 text-sm">
              عدد العمليات هذا الأسبوع مقارنة بالأسبوع الماضي
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className={`${ws.glassSoft} rounded-2xl p-4 text-center`}>
            <p className="text-slate-500 dark:text-white/50 text-xs mb-1">هذا الأسبوع</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {weekComparison?.thisWeek || 0}
            </p>
          </div>
          <div className={`${ws.glassSoft} rounded-2xl p-4 text-center`}>
            <p className="text-slate-500 dark:text-white/50 text-xs mb-1">الأسبوع الماضي</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {weekComparison?.lastWeek || 0}
            </p>
          </div>
          <div className={`${ws.glassSoft} rounded-2xl p-4 text-center`}>
            <p className="text-slate-500 dark:text-white/50 text-xs mb-1">التغيير</p>
            <div className="flex items-center justify-center gap-1.5">
              {changeIcon}
              <p className={`text-2xl font-bold ${changeColor}`}>
                {weekComparison?.changePercent || 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Branch ops chart */}
        {chartData.length > 0 && (
          <div className="h-[200px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(19,32,68,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "white",
                    fontSize: "13px",
                  }}
                />
                <Bar
                  dataKey="عمليات_الشهر"
                  radius={[0, 8, 8, 0]}
                  maxBarSize={24}
                >
                  {chartData.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={COLORS[idx % COLORS.length]}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Branch health status */}
      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-200`}>
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              حالة الفروع
            </h3>
            <p className="text-slate-500 dark:text-white/45 text-sm">
              نظرة سريعة على حالة المخزون في كل فرع
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {branchPerformance.map((branch) => {
            const health = getBranchHealthColor(
              branch.low_stock_count,
              branch.out_of_stock_count,
              branch.tracked_items,
            );
            const completionRate = branch.completion_rate || 0;

            return (
              <div
                key={branch.id}
                className={`${ws.glassSoft} rounded-2xl p-4`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${health.dot}`} />
                    <div>
                      <p className="text-slate-900 dark:text-white font-semibold">{branch.name}</p>
                      <p className="text-slate-500 dark:text-white/40 text-xs">
                        {branch.location || ""}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold ${health.color}`}>
                    {health.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-white/50 mt-2">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                    اكتمال {completionRate}%
                  </span>
                  <span>عمليات الشهر: {branch.ops_this_month}</span>
                  {branch.low_stock_count > 0 && (
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {branch.low_stock_count} منخفض
                    </span>
                  )}
                </div>

                {/* Mini progress bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400/60"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
