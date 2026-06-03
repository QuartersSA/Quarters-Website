import { TrendingDown, TrendingUp, BarChart3, AlertTriangle } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

const statCard = `${ws.glass} ${ws.card} p-6`;

export function VarianceStats({ rows }) {
  const stats = computeStats(rows);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <StatCard
        icon={<BarChart3 className="w-6 h-6" />}
        iconColor="text-sky-700 dark:text-sky-700 dark:text-sky-200"
        label="عدد عمليات الجرد"
        value={stats.count}
      />
      <StatCard
        icon={<TrendingDown className="w-6 h-6" />}
        iconColor="text-red-700 dark:text-red-700 dark:text-red-200"
        label="مجموع الفاقد"
        value={formatNumber(-stats.totalLoss)}
        valueColor={stats.totalLoss > 0 ? "text-red-700 dark:text-red-700 dark:text-red-200" : "text-slate-900 dark:text-slate-900 dark:text-white"}
      />
      <StatCard
        icon={<TrendingUp className="w-6 h-6" />}
        iconColor="text-emerald-700 dark:text-emerald-700 dark:text-emerald-200"
        label="مجموع الزيادة"
        value={formatNumber(stats.totalGain)}
        valueColor={stats.totalGain > 0 ? "text-emerald-700 dark:text-emerald-700 dark:text-emerald-200" : "text-slate-900 dark:text-slate-900 dark:text-white"}
      />
      <StatCard
        icon={<AlertTriangle className="w-6 h-6" />}
        iconColor="text-amber-700 dark:text-amber-700 dark:text-amber-200"
        label="عمليات بفروقات كبيرة"
        value={stats.bigDiffsCount}
        sublabel="(>10% انحراف)"
      />
    </div>
  );
}

function StatCard({ icon, iconColor, label, value, valueColor, sublabel }) {
  return (
    <div className={statCard}>
      <div className="flex items-center justify-between mb-4">
        <div className={`${ws.iconBox} ${iconColor}`}>{icon}</div>
      </div>
      <p className="text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">{label}</p>
      <p
        className={`text-3xl font-bold tracking-tight ${valueColor || "text-slate-900 dark:text-slate-900 dark:text-white"}`}
        dir="ltr"
      >
        {value}
      </p>
      {sublabel ? (
        <p className="text-slate-500 dark:text-slate-500 dark:text-white/40 text-xs mt-1">{sublabel}</p>
      ) : null}
    </div>
  );
}

function computeStats(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let totalLoss = 0;
  let totalGain = 0;
  let bigDiffsCount = 0;

  for (const r of list) {
    // Use the INCREMENTAL delta (since previous count) for summing.
    //
    // `delta_quantity` is cumulative (since opening) — summing it across
    // N counts in a range multiplies the loss N times. For a range with
    // 3 counts at -3 / -7 / -10 (all since opening), the cumulative
    // sum is -20 instead of the true loss of -10.
    //
    // `delta_since_previous` is the per-count change. Summing those
    // gives the correct total change across the range. When it's NULL
    // (the row has no prior count — typically the very first count
    // after opening, or the first count ever for that item/branch),
    // we fall back to `delta_quantity` so the row still contributes
    // its real change.
    const incrementalRaw =
      r.delta_since_previous !== null && r.delta_since_previous !== undefined
        ? r.delta_since_previous
        : r.delta_quantity;
    const delta = Number(incrementalRaw) || 0;

    // For the "big diff %" classification, base the ratio on the same
    // incremental window so a single noisy entry doesn't get amplified
    // by the cumulative `expected_quantity`.
    const expectedRaw =
      r.expected_since_previous !== null &&
      r.expected_since_previous !== undefined
        ? r.expected_since_previous
        : r.expected_quantity;
    const expected = Number(expectedRaw) || 0;

    if (delta < 0) totalLoss += Math.abs(delta);
    if (delta > 0) totalGain += delta;

    if (expected > 0 && Math.abs(delta) / expected > 0.1) {
      bigDiffsCount += 1;
    }
  }

  return {
    count: list.length,
    totalLoss,
    totalGain,
    bigDiffsCount,
  };
}

function formatNumber(n) {
  const num = Number(n) || 0;
  if (num === 0) return "0";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}
