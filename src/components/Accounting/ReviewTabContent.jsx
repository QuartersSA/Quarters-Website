"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardCheck,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Trophy,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";
import ExpensesCharts from "@/components/Accounting/ExpensesCharts";
import { ExpenseTable } from "@/components/Accounting/ExpenseTable";

const STATUS_CHIPS = [
  { value: "all", label: "الكل", icon: Filter },
  { value: "confirmed", label: "المؤكدة", icon: CheckCircle2 },
  { value: "pending", label: "بانتظار", icon: Clock },
];

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Polished review tab — replaces the old big "filter expenses" card +
 * raw stats grid with:
 *   - KPI hero (4 stats + MoM delta against the previous month from
 *     /api/accounting/expenses/trend)
 *   - Top categories list (computed client-side from `expenses`)
 *   - Existing charts component
 *   - Status filter chips above the review table
 */
export default function ReviewTabContent({
  month,
  monthHint,
  expenses,
  pendingFixed,
  expensesQuery,
  statusFilter,
  onStatusFilterChange,
  onConfirm,
  onDelete,
  onEdit,
  onConfirmFixed,
}) {
  // Trend pull used solely to compute the previous-month total for the
  // MoM delta on the hero row. Cached for 60s and shared with the
  // ExpensesCharts component's cache.
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

  const stats = useMemo(() => {
    const totalCount = expenses.length;
    const confirmedCount = expenses.filter((e) => e.is_confirmed).length;
    const pendingCount = totalCount - confirmedCount;
    const totalAmount = expenses.reduce((s, e) => s + safeNum(e.amount), 0);
    const confirmedAmount = expenses
      .filter((e) => e.is_confirmed)
      .reduce(
        (s, e) =>
          s +
          safeNum(
            e.confirmed_amount !== null && e.confirmed_amount !== undefined
              ? e.confirmed_amount
              : e.amount,
          ),
        0,
      );
    const pendingAmount = totalAmount - confirmedAmount;

    const byType = {};
    for (const e of expenses) {
      const name = e.expense_type_name || "أخرى";
      if (!byType[name]) byType[name] = { name, total: 0, count: 0 };
      byType[name].total += safeNum(e.amount);
      byType[name].count += 1;
    }
    const topTypes = Object.values(byType)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      totalCount,
      confirmedCount,
      pendingCount,
      totalAmount,
      confirmedAmount,
      pendingAmount,
      topTypes,
    };
  }, [expenses]);

  // Previous-month total for MoM comparison.
  const prevMonthTotal = useMemo(() => {
    const months = trendQuery.data?.months || [];
    if (months.length < 2 || !month) return null;
    const idx = months.findIndex((m) => m.month === month);
    if (idx > 0) {
      return safeNum(months[idx - 1]?.total);
    }
    // Fallback: second-to-last in the series.
    return safeNum(months[months.length - 2]?.total);
  }, [trendQuery.data, month]);

  const momDelta = useMemo(() => {
    if (prevMonthTotal === null) return null;
    return stats.totalAmount - prevMonthTotal;
  }, [stats.totalAmount, prevMonthTotal]);

  const momPct = useMemo(() => {
    if (prevMonthTotal === null || prevMonthTotal === 0) return null;
    return ((stats.totalAmount - prevMonthTotal) / prevMonthTotal) * 100;
  }, [stats.totalAmount, prevMonthTotal]);

  const filteredExpenses = useMemo(() => {
    if (statusFilter === "confirmed") {
      return expenses.filter((e) => !!e.is_confirmed);
    }
    if (statusFilter === "pending") {
      return expenses.filter((e) => !e.is_confirmed);
    }
    return expenses;
  }, [expenses, statusFilter]);

  if (!month) {
    return (
      <div className={`${ws.glassSoft} ${ws.card} p-8 text-center`}>
        <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-400 dark:text-white/30" />
        <div className="text-slate-600 dark:text-white/60 text-sm">
          اختر الشهر من القائمة في الأعلى لعرض المراجعة
        </div>
      </div>
    );
  }

  const confirmationPct =
    stats.totalCount > 0
      ? Math.round((stats.confirmedCount / stats.totalCount) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Hero KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <HeroStat
          label="إجمالي المصروفات"
          value={formatMoney(stats.totalAmount)}
          sub={`${stats.totalCount} مصروف`}
          icon={Banknote}
          accent="emerald"
          momDelta={momDelta}
          momPct={momPct}
        />
        <HeroStat
          label="تم التأكيد"
          value={formatMoney(stats.confirmedAmount)}
          sub={`${stats.confirmedCount} / ${stats.totalCount}`}
          icon={CheckCircle2}
          accent="emerald"
        />
        <HeroStat
          label="بانتظار التأكيد"
          value={formatMoney(stats.pendingAmount)}
          sub={`${stats.pendingCount} مصروف`}
          icon={Clock}
          accent="amber"
        />
        <HeroStat
          label="نسبة التأكيد"
          value={`${confirmationPct}%`}
          sub={
            <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-1.5 mt-2">
              <div
                className="bg-emerald-400 h-1.5 rounded-full transition-all"
                style={{ width: `${confirmationPct}%` }}
              />
            </div>
          }
          icon={TrendingUp}
          accent="sky"
        />
      </div>

      {/* Top categories + charts side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top categories */}
        <div className={`${ws.glass} ${ws.card} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`${ws.iconBox} w-9 h-9 text-amber-700 dark:text-amber-200`}>
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-slate-900 dark:text-white font-bold text-sm">
                أعلى التصنيفات
              </div>
              <div className="text-slate-600 dark:text-white/55 text-xs">
                ترتيب حسب الإجمالي
              </div>
            </div>
          </div>
          {stats.topTypes.length === 0 ? (
            <div className="text-slate-500 dark:text-white/45 text-xs text-center py-6">
              لا توجد بيانات
            </div>
          ) : (
            <div className="space-y-2">
              {stats.topTypes.map((t, idx) => {
                const pct =
                  stats.totalAmount > 0
                    ? (t.total / stats.totalAmount) * 100
                    : 0;
                return (
                  <div key={t.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-slate-500 dark:text-white/40 text-[10px]">
                          {idx + 1}.
                        </span>
                        <span className="text-slate-900 dark:text-white font-semibold truncate">
                          {t.name}
                        </span>
                      </div>
                      <div className="text-slate-800 dark:text-white/80 font-bold" dir="ltr">
                        {formatMoney(t.total)}
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-400/70 to-sky-400/70 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-white/35 mt-0.5">
                      {Math.round(pct)}% — {t.count} مصروف
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Charts spans 2 cols on lg, full on small */}
        <div className="lg:col-span-2">
          <ExpensesCharts month={month} />
        </div>
      </div>

      {/* Review table with status filter chips */}
      <div className={`${ws.glassSoft} ${ws.card} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={ws.iconBox}>
              <ClipboardCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                سجل المصروفات
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                {monthHint} — {filteredExpenses.length} من{" "}
                {stats.totalCount}
              </div>
            </div>
          </div>

          {/* Status filter chips */}
          <div
            className={`inline-flex items-center gap-1 p-1 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]`}
          >
            {STATUS_CHIPS.map((chip) => {
              const Icon = chip.icon;
              const active = statusFilter === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => onStatusFilterChange(chip.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors ${
                    active
                      ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20"
                      : "text-slate-600 dark:text-white/55 hover:text-slate-800 dark:hover:text-white/80 border border-transparent"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {expensesQuery.isLoading ? (
          <div className="text-center py-8 text-slate-600 dark:text-white/60 text-sm">
            جاري التحميل…
          </div>
        ) : expensesQuery.error ? (
          <div className="text-center py-8 text-red-700 dark:text-red-300 text-sm">
            {String(expensesQuery.error.message)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ExpenseTable
              expenses={filteredExpenses}
              pendingFixed={pendingFixed}
              month={month}
              onConfirm={onConfirm}
              onDelete={onDelete}
              onEdit={onEdit}
              onConfirmFixed={onConfirmFixed}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

const ACCENT = {
  emerald: { text: "text-emerald-700 dark:text-emerald-200", icon: "text-emerald-700 dark:text-emerald-200" },
  amber: { text: "text-amber-700 dark:text-amber-200", icon: "text-amber-700 dark:text-amber-200" },
  sky: { text: "text-sky-700 dark:text-sky-200", icon: "text-sky-700 dark:text-sky-200" },
  white: { text: "text-slate-900 dark:text-white", icon: "text-slate-700 dark:text-white/70" },
};

function HeroStat({
  label,
  value,
  sub,
  icon: Icon,
  accent = "white",
  momDelta,
  momPct,
}) {
  const a = ACCENT[accent] || ACCENT.white;
  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-600 dark:text-white/55">{label}</div>
          <div className={`font-extrabold mt-1 text-xl ${a.text}`} dir="ltr">
            {value}
          </div>
        </div>
        {Icon ? (
          <div className={`${ws.iconBox} w-8 h-8 ${a.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
        ) : null}
      </div>
      {momDelta !== null && momDelta !== undefined ? (
        <div className="flex items-center gap-1 text-[10px] mt-1.5">
          {momDelta > 0 ? (
            <ArrowUpRight className="w-3 h-3 text-red-700 dark:text-red-300" />
          ) : momDelta < 0 ? (
            <ArrowDownRight className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
          ) : (
            <Minus className="w-3 h-3 text-slate-500 dark:text-white/40" />
          )}
          <span
            className={
              momDelta > 0
                ? "text-red-700 dark:text-red-300"
                : momDelta < 0
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-slate-500 dark:text-white/40"
            }
            dir="ltr"
          >
            {momDelta > 0 ? "+" : ""}
            {formatMoney(momDelta)}
            {momPct !== null && momPct !== undefined
              ? ` (${momPct > 0 ? "+" : ""}${Math.round(momPct)}%)`
              : ""}
          </span>
          <span className="text-slate-400 dark:text-white/35">عن الشهر السابق</span>
        </div>
      ) : sub && typeof sub === "string" ? (
        <div className="text-xs text-slate-500 dark:text-white/40 mt-1">{sub}</div>
      ) : sub ? (
        <>{sub}</>
      ) : null}
    </div>
  );
}
