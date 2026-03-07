import { Activity, DollarSign, TrendingDown, Package } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { ws } from "@/components/Workspace/ui";

function getScoreColor(score) {
  if (score >= 80)
    return { text: "text-emerald-200", fill: "#34d399", label: "ممتاز 🟢" };
  if (score >= 60)
    return { text: "text-amber-200", fill: "#fbbf24", label: "جيد 🟡" };
  if (score >= 40)
    return {
      text: "text-orange-200",
      fill: "#fb923c",
      label: "يحتاج تحسين 🟠",
    };
  return { text: "text-red-200", fill: "#f87171", label: "حرج 🔴" };
}

function formatCost(val) {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toFixed(0);
}

export function HealthScoreCard({
  healthScore,
  inventoryCost,
  depletionPredictions,
}) {
  const score = healthScore ?? 0;
  const scoreInfo = getScoreColor(score);
  const totalCost = inventoryCost?.totalCost || 0;
  const costByBranch = inventoryCost?.byBranch || [];

  const gaugeData = [{ value: score }, { value: 100 - score }];

  const urgentItems = (depletionPredictions || []).filter(
    (d) => d.days_to_depletion <= 7,
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
      {/* Health Score */}
      <div
        className={`${ws.glass} ${ws.card} p-6 flex flex-col items-center justify-center`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className={`w-5 h-5 ${scoreInfo.text}`} />
          <h3 className="text-lg font-bold text-white tracking-tight">
            صحة المخزون
          </h3>
        </div>

        <div className="relative w-[160px] h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius={55}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={scoreInfo.fill} fillOpacity={0.8} />
                <Cell fill="rgba(255,255,255,0.05)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <p className={`text-4xl font-bold ${scoreInfo.text}`}>{score}</p>
          </div>
        </div>
        <p className={`text-sm font-semibold mt-2 ${scoreInfo.text}`}>
          {scoreInfo.label}
        </p>
        <p className="text-white/40 text-xs mt-1 text-center">
          يعتمد على نسبة الأصناف المتوفرة وانتظام الجرد
        </p>
      </div>

      {/* Inventory Cost */}
      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-200" />
          <h3 className="text-lg font-bold text-white tracking-tight">
            قيمة المخزون
          </h3>
        </div>

        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-white tracking-tight">
            {formatCost(totalCost)}{" "}
            <span className="text-base text-white/50 font-normal">ر.س</span>
          </p>
          <p className="text-white/40 text-xs mt-1">
            إجمالي قيمة المخزون الحالي
          </p>
        </div>

        <div className="space-y-2">
          {costByBranch.map((bc) => (
            <div
              key={bc.branch_id}
              className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"
            >
              <span className="text-white/70 text-sm">{bc.branch_name}</span>
              <span className="text-white font-semibold text-sm">
                {formatCost(bc.total_cost)} ر.س
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Depletion Predictions */}
      <div className={`${ws.glass} ${ws.card} p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5 text-amber-200" />
          <h3 className="text-lg font-bold text-white tracking-tight">
            توقع النفاد
          </h3>
        </div>

        {urgentItems.length === 0 &&
        (depletionPredictions || []).length === 0 ? (
          <div className="text-center py-6">
            <Package className="w-10 h-10 mx-auto mb-2 text-white/15" />
            <p className="text-white/40 text-sm">لا توجد بيانات كافية للتوقع</p>
          </div>
        ) : urgentItems.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-emerald-200 text-sm font-semibold">
              ✅ لا أصناف مهددة بالنفاد قريباً
            </p>
            <p className="text-white/40 text-xs mt-1">
              أقرب نفاد متوقع بعد{" "}
              {depletionPredictions[0]?.days_to_depletion || "—"} يوم
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {urgentItems.slice(0, 6).map((item, i) => {
              const daysColor =
                item.days_to_depletion <= 2
                  ? "text-red-200 bg-red-500/10 border-red-500/20"
                  : item.days_to_depletion <= 5
                    ? "text-amber-200 bg-amber-500/10 border-amber-500/20"
                    : "text-sky-200 bg-sky-500/10 border-sky-500/20";

              return (
                <div key={i} className={`${ws.glassSoft} rounded-xl p-3`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {item.item_name}
                      </p>
                      <p className="text-white/40 text-xs">
                        {item.branch_name} • متبقي: {item.current_qty}{" "}
                        {item.unit}
                      </p>
                    </div>
                    <span className={`${ws.pill} ${daysColor} flex-shrink-0`}>
                      {item.days_to_depletion} يوم
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(depletionPredictions || []).length > 0 &&
          urgentItems.length < (depletionPredictions || []).length && (
            <p className="text-white/30 text-xs mt-3 text-center">
              + {(depletionPredictions || []).length - urgentItems.length} أصناف
              أخرى في فترة أطول
            </p>
          )}
      </div>
    </div>
  );
}
