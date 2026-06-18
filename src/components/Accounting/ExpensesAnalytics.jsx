"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Layers,
  Trophy,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";
import useAdminTheme from "@/hooks/useAdminTheme";

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* Theme-aware bar fills — cycled across the by-category list. Mirrors the
 * PIE_COLORS hues in ExpensesCharts so the two read as one palette. */
const BAR_COLORS = [
  "#34d399", // emerald
  "#60a5fa", // sky
  "#f472b6", // pink
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#facc15", // yellow
  "#c084fc", // purple
  "#fdba74", // orange
];

/**
 * Analytics block that complements ExpensesCharts:
 *   - Month-over-month card (this month vs previous month total, with
 *     delta + % — green when spending is DOWN, red when UP). Pulls the
 *     trend endpoint via react-query (shared cache key with the charts).
 *   - By-category breakdown: per-type total + % of month, sorted bars.
 *   - Top categories compact list.
 *
 * Computes the category split client-side from the passed `expenses`
 * (current month) so it stays in sync with the live list / mutations
 * without an extra fetch.
 */
export default function ExpensesAnalytics({ month, expenses }) {
  const { isDark } = useAdminTheme();

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
        throw new Error(d?.error || "فشل تحميل الاتجاه");
      }
      return r.json();
    },
    staleTime: 60_000,
  });

  const list = Array.isArray(expenses) ? expenses : [];

  const monthTotal = useMemo(
    () => list.reduce((s, e) => s + safeNum(e.amount), 0),
    [list],
  );

  // Per-category split for the current month.
  const categories = useMemo(() => {
    const byType = {};
    for (const e of list) {
      const name = e.expense_type_name || "أخرى";
      if (!byType[name]) byType[name] = { name, total: 0, count: 0 };
      byType[name].total += safeNum(e.amount);
      byType[name].count += 1;
    }
    return Object.values(byType).sort((a, b) => b.total - a.total);
  }, [list]);

  // Previous-month total for the MoM comparison. Find the selected month
  // in the trend series and read the one before it.
  const prevMonthTotal = useMemo(() => {
    const months = trendQuery.data?.months || [];
    if (!month || months.length < 2) return null;
    const idx = months.findIndex((m) => m.month === month);
    if (idx > 0) return safeNum(months[idx - 1]?.total);
    if (idx === -1) return safeNum(months[months.length - 2]?.total);
    return null; // selected month is the first in the window
  }, [trendQuery.data, month]);

  const delta = prevMonthTotal === null ? null : monthTotal - prevMonthTotal;
  const pct =
    prevMonthTotal === null || prevMonthTotal === 0
      ? null
      : ((monthTotal - prevMonthTotal) / prevMonthTotal) * 100;

  // Spending DOWN (delta < 0) is good → emerald. UP → red.
  const down = delta !== null && delta < 0;
  const up = delta !== null && delta > 0;
  const deltaColor = down
    ? "text-emerald-700 dark:text-emerald-300"
    : up
      ? "text-red-700 dark:text-red-300"
      : "text-slate-500 dark:text-white/45";
  const DeltaIcon = down ? ArrowDownRight : up ? ArrowUpRight : Minus;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" dir="rtl">
      {/* Month-over-month */}
      <div className={`${ws.glass} ${ws.card} p-5`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`${ws.iconBox} w-9 h-9 text-sky-700 dark:text-sky-200`}>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-bold text-sm">
              مقارنة شهرية
            </div>
            <div className="text-slate-600 dark:text-white/55 text-xs">
              {monthLabel(month) || "—"} مقابل الشهر السابق
            </div>
          </div>
        </div>

        <div
          className="text-slate-900 dark:text-white font-extrabold text-2xl"
          dir="ltr"
        >
          {formatMoney(monthTotal)}
        </div>

        {trendQuery.isLoading ? (
          <div className="text-xs text-slate-500 dark:text-white/45 mt-2">
            جاري التحميل…
          </div>
        ) : delta === null ? (
          <div className="text-xs text-slate-500 dark:text-white/45 mt-2">
            لا يوجد شهر سابق للمقارنة —
          </div>
        ) : (
          <div className="mt-3">
            <div className={`inline-flex items-center gap-1.5 text-sm font-bold ${deltaColor}`}>
              <DeltaIcon className="w-4 h-4" />
              <span dir="ltr">
                {delta > 0 ? "+" : ""}
                {formatMoney(delta)}
                {pct !== null ? ` (${pct > 0 ? "+" : ""}${Math.round(pct)}%)` : ""}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-white/45 mt-1.5">
              الشهر السابق:{" "}
              <span className="text-slate-700 dark:text-white/70 font-semibold" dir="ltr">
                {formatMoney(prevMonthTotal)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-white/35 mt-1">
              {down
                ? "انخفض الإنفاق عن الشهر السابق"
                : up
                  ? "ارتفع الإنفاق عن الشهر السابق"
                  : "لا تغيير عن الشهر السابق"}
            </div>
          </div>
        )}
      </div>

      {/* By-category breakdown — spans 2 cols on lg */}
      <div className={`${ws.glass} ${ws.card} p-5 lg:col-span-2`}>
        <div className="flex items-center gap-2 mb-4">
          <div className={`${ws.iconBox} w-9 h-9 text-emerald-700 dark:text-emerald-200`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-slate-900 dark:text-white font-bold text-sm">
              التوزيع حسب التصنيف
            </div>
            <div className="text-slate-600 dark:text-white/55 text-xs">
              {monthLabel(month) || "—"} — {categories.length} تصنيف
            </div>
          </div>
        </div>

        {categories.length === 0 ? (
          <div className="text-slate-500 dark:text-white/45 text-xs text-center py-6">
            لا توجد مصروفات لهذا الشهر
          </div>
        ) : (
          <div className="space-y-2.5">
            {categories.map((c, idx) => {
              const p = monthTotal > 0 ? (c.total / monthTotal) * 100 : 0;
              const color = BAR_COLORS[idx % BAR_COLORS.length];
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-slate-900 dark:text-white font-semibold truncate">
                        {c.name}
                      </span>
                      <span className="text-slate-400 dark:text-white/35 text-[10px] shrink-0">
                        {c.count} مصروف
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-800 dark:text-white/80 font-bold" dir="ltr">
                        {formatMoney(c.total)}
                      </span>
                      <span className="text-slate-400 dark:text-white/40 text-[10px]" dir="ltr">
                        {Math.round(p)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-white/[0.05] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(p, 1.5)}%`,
                        background: color,
                        opacity: isDark ? 0.8 : 1,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top categories compact — full width strip */}
      {categories.length > 0 && (
        <div className={`${ws.glassSoft} ${ws.card} p-4 lg:col-span-3`}>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-300" />
            <span className="text-slate-800 dark:text-white/85 font-bold text-xs">
              أعلى التصنيفات
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 5).map((c, idx) => (
              <div
                key={c.name}
                className={`${ws.chip} gap-2`}
              >
                <span className="text-slate-400 dark:text-white/35 text-[10px]">
                  {idx + 1}.
                </span>
                <span className="text-slate-800 dark:text-white/80">{c.name}</span>
                <span className="text-emerald-700 dark:text-emerald-200 font-bold" dir="ltr">
                  {formatMoney(c.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
