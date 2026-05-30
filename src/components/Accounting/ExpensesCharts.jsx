"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Bar,
  BarChart,
} from "recharts";
import { TrendingUp, PieChart as PieIcon, BarChart3 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";

/**
 * Three views on the month's expenses:
 *   - Line: 12-month total trend (confirmed vs pending stacked)
 *   - Pie:  current-month distribution by expense type
 *   - Bar:  current-month per-type amount sorted by size
 *
 * Driven by /api/accounting/expenses/trend so the component owns its
 * own fetch — drop-in anywhere with just `month` (YYYY-MM string).
 */

const PIE_COLORS = [
  "#34d399", // emerald
  "#60a5fa", // sky
  "#f472b6", // pink
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#fb7185", // rose
  "#f87171", // red
  "#22d3ee", // cyan
  "#facc15", // yellow
  "#c084fc", // purple
  "#4ade80", // green
  "#fdba74", // orange
];

function shortMonth(label) {
  // YYYY-MM → "MM/YY" for compact X-axis ticks
  if (!label || typeof label !== "string") return label;
  const [y, m] = label.split("-");
  if (!y || !m) return label;
  return `${m}/${y.slice(2)}`;
}

function TooltipBox({ active, payload, labelFormatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="text-xs px-3 py-2 rounded-xl"
      style={{
        background: "rgba(15, 23, 42, 0.96)",
        border: "1px solid rgba(255,255,255,0.15)",
        color: "#fff",
        minWidth: 140,
      }}
      dir="rtl"
    >
      {payload[0]?.payload?.month || payload[0]?.name ? (
        <div className="text-slate-600 dark:text-white/55 mb-1">
          {labelFormatter
            ? labelFormatter(payload[0].payload?.month || payload[0].name)
            : payload[0].payload?.month || payload[0].name}
        </div>
      ) : null}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-slate-700 dark:text-white/70">{p.name}:</span>
          <span className="text-slate-900 dark:text-white font-bold" dir="ltr">
            {formatMoney(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ExpensesCharts({ month }) {
  const trendQuery = useQuery({
    queryKey: ["accounting-expenses-trend", month, 12],
    enabled: !!month,
    queryFn: async () => {
      const params = new URLSearchParams({
        months: "12",
        ...(month ? { currentMonth: month } : {}),
      });
      const r = await adminFetch(`/api/accounting/expenses/trend?${params}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || "فشل تحميل البيانات");
      }
      return r.json();
    },
    staleTime: 60_000,
  });

  const months = trendQuery.data?.months || [];
  const byType = trendQuery.data?.by_type || [];

  const trendData = useMemo(
    () =>
      months.map((m) => ({
        month: m.month,
        confirmed: Number(m.confirmed) || 0,
        pending: Number(m.pending) || 0,
        total: Number(m.total) || 0,
      })),
    [months],
  );

  const pieData = useMemo(
    () =>
      byType.map((t) => ({
        name: t.type_name,
        value: Number(t.total) || 0,
      })),
    [byType],
  );

  const barData = useMemo(
    () =>
      byType
        .slice() // already DESC by total
        .map((t) => ({
          name: t.type_name,
          total: Number(t.total) || 0,
          confirmed: Number(t.confirmed) || 0,
        })),
    [byType],
  );

  const hasTrend = trendData.some((d) => d.total > 0);
  const hasByType = pieData.length > 0;

  if (trendQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-5`}>
        <div className="h-64 flex items-center justify-center text-slate-600 dark:text-white/55">
          جاري تحميل الرسوم البيانية…
        </div>
      </div>
    );
  }

  if (trendQuery.isError) {
    return (
      <div className={`${ws.glass} ${ws.card} p-5 text-red-700 dark:text-red-200 text-sm`}>
        {trendQuery.error?.message || "تعذّر تحميل البيانات"}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" dir="rtl">
      {/* Trend line — spans 2 cols on lg */}
      <div className={`${ws.glass} ${ws.card} p-5 lg:col-span-2`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`${ws.iconBox} w-9 h-9 text-emerald-700 dark:text-emerald-200`}>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-bold text-sm">آخر 12 شهر</div>
            <div className="text-slate-600 dark:text-white/55 text-xs">
              مؤكد + بانتظار التأكيد
            </div>
          </div>
        </div>
        {hasTrend ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={trendData}
              margin={{ top: 6, right: 12, left: 0, bottom: 6 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="month"
                tickFormatter={shortMonth}
                stroke="rgba(255,255,255,0.55)"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.55)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : v
                }
              />
              <Tooltip
                content={
                  <TooltipBox labelFormatter={(m) => monthLabel(m)} />
                }
              />
              <Legend
                wrapperStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="confirmed"
                name="مؤكد"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="pending"
                name="بانتظار"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="الإجمالي"
                stroke="#60a5fa"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-600 dark:text-white/55 text-sm">
            لا توجد بيانات بعد
          </div>
        )}
      </div>

      {/* Pie by type */}
      <div className={`${ws.glass} ${ws.card} p-5`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`${ws.iconBox} w-9 h-9 text-sky-700 dark:text-sky-200`}>
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-bold text-sm">توزيع الشهر</div>
            <div className="text-slate-600 dark:text-white/55 text-xs">
              {monthLabel(month) || "—"}
            </div>
          </div>
        </div>
        {hasByType ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={40}
                paddingAngle={2}
                isAnimationActive={false}
              >
                {pieData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={PIE_COLORS[idx % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
              <Legend
                wrapperStyle={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 11,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-600 dark:text-white/55 text-sm">
            لا توجد مصروفات لهذا الشهر
          </div>
        )}
      </div>

      {/* Bar by type — spans full width below */}
      <div className={`${ws.glass} ${ws.card} p-5 lg:col-span-3`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`${ws.iconBox} w-9 h-9 text-pink-700 dark:text-pink-200`}>
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-bold text-sm">حسب النوع</div>
            <div className="text-slate-600 dark:text-white/55 text-xs">
              {monthLabel(month) || "—"}
            </div>
          </div>
        </div>
        {hasByType ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={barData}
              margin={{ top: 6, right: 12, left: 0, bottom: 6 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.55)"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={50}
              />
              <YAxis
                stroke="rgba(255,255,255,0.55)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : v
                }
              />
              <Tooltip content={<TooltipBox />} />
              <Legend
                wrapperStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
              />
              <Bar
                dataKey="total"
                name="الإجمالي"
                fill="#60a5fa"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="confirmed"
                name="مؤكد"
                fill="#34d399"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-600 dark:text-white/55 text-sm">
            لا توجد مصروفات لهذا الشهر
          </div>
        )}
      </div>
    </div>
  );
}
