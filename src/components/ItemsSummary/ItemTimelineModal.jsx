"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Package,
  ClipboardList,
  PackagePlus,
  Hash,
  Download,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import { formatDateTime } from "@/utils/dateUtils";
import { exportToExcelHTML } from "@/utils/exportUtils";
import useAdminTheme from "@/hooks/useAdminTheme";

const TYPE_LABEL = {
  Daily: "جرد يومي",
  Weekly: "جرد أسبوعي",
  Opening: "افتتاحي",
  Transfer: "تحويل",
  Receipt: "وارد",
};

const TYPE_COLOR = {
  Daily: "#34d399",
  Weekly: "#60a5fa",
  Opening: "#fbbf24",
  Transfer: "#f472b6",
  Receipt: "#a78bfa",
};

function typeIcon(type) {
  if (type === "Transfer") return ArrowLeftRight;
  if (type === "Receipt") return PackagePlus;
  return ClipboardList;
}

function describeEvent(ev) {
  if (ev.inventory_type === "Transfer") {
    const dir = ev.transfer_direction === "out" ? "إلى" : "من";
    const other = ev.transfer_branch_name || "—";
    const qty = ev.transfer_quantity != null ? ev.transfer_quantity : Math.abs(ev.delta);
    return `تحويل ${dir} ${other} (${qty})`;
  }
  if (ev.inventory_type === "Receipt") {
    return `استلام بضاعة (${ev.delta})`;
  }
  return TYPE_LABEL[ev.inventory_type] || ev.inventory_type;
}

export default function ItemTimelineModal({ itemId, branchId, onClose }) {
  const { isDark } = useAdminTheme();
  // Recharts axes/grid/tooltip render outside Tailwind dark: cascade.
  const gridStroke = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.10)";
  const axisStroke = isDark ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.55)";
  const tooltipBg = isDark ? "rgba(15,23,42,0.96)" : "rgba(255, 255, 255, 0.98)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.12)";
  const tooltipText = isDark ? "#fff" : "rgb(15, 23, 42)";

  const enabled = Number.isFinite(itemId) && itemId > 0 && Number.isFinite(branchId) && branchId > 0;

  const timelineQuery = useQuery({
    queryKey: ["item-timeline", itemId, branchId],
    enabled,
    queryFn: async () => {
      const r = await adminFetch(
        `/api/items/${itemId}/timeline?branchId=${branchId}`,
      );
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.error || "فشل تحميل التقرير");
      }
      return r.json();
    },
  });

  const events = timelineQuery.data?.events || [];
  const item = timelineQuery.data?.item;
  const branch = timelineQuery.data?.branch;

  // Format chart data. ts = milliseconds for numeric X axis so points
  // spaced by real time, not by ordinal index.
  const chartData = useMemo(
    () =>
      events.map((ev, idx) => ({
        idx,
        ts: new Date(ev.event_at).getTime(),
        balance: Number(ev.balance) || 0,
        type: ev.inventory_type,
      })),
    [events],
  );

  const latestBalance = events.length > 0 ? events[events.length - 1].balance : 0;
  const minBalance = events.length > 0 ? Math.min(...events.map((e) => e.balance)) : 0;
  const maxBalance = events.length > 0 ? Math.max(...events.map((e) => e.balance)) : 0;

  const handleExport = () => {
    if (!events.length) return;
    const columns = [
      { header: "التاريخ", accessor: (e) => formatDateTime(e.event_at) },
      { header: "النوع", accessor: (e) => TYPE_LABEL[e.inventory_type] || e.inventory_type },
      { header: "رقم العملية", accessor: (e) => e.inventory_number || e.operation_id },
      { header: "الموظف", accessor: (e) => e.employee_name || "—" },
      { header: "التغيير", accessor: (e) => e.delta },
      { header: "الرصيد بعد", accessor: (e) => e.balance },
      { header: "ملاحظة", accessor: (e) => e.note || "" },
    ];
    const filename = `timeline-${item?.name || "item"}-${branch?.name || "branch"}-${
      new Date().toISOString().slice(0, 10)
    }`;
    exportToExcelHTML(events, filename, columns, `تقرير زمني: ${item?.name} — ${branch?.name}`);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl ${ws.glass} ${ws.card} my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 sm:p-6 border-b ${ws.divider} flex items-start justify-between gap-3`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`${ws.iconBox} w-12 h-12 text-emerald-700 dark:text-emerald-200`}>
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                تقرير زمني للصنف
              </h2>
              <div className="text-sm text-slate-600 dark:text-white/55 mt-0.5 truncate">
                {item?.name || "…"} — فرع {branch?.name || "…"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExport}
              disabled={!events.length}
              className={`${ws.btnNeutral} px-3 py-2 text-sm ${
                !events.length ? "opacity-40 cursor-not-allowed" : ""
              }`}
            >
              <Download className="w-4 h-4" />
              <span>تصدير</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={ws.iconButton}
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="الرصيد الحالي" value={latestBalance} accent="emerald" />
            <Stat label="أعلى رصيد" value={maxBalance} accent="sky" />
            <Stat label="أقل رصيد" value={minBalance} accent="amber" />
          </div>

          {/* Chart */}
          <div className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl p-4`}>
            {timelineQuery.isLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-600 dark:text-white/55">
                جاري التحميل…
              </div>
            ) : !events.length ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-600 dark:text-white/55 gap-2">
                <Package className="w-8 h-8 opacity-40" />
                <div>لا توجد عمليات على هذا الصنف في هذا الفرع</div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
                  <CartesianGrid stroke={gridStroke} />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t) => {
                      const d = new Date(t);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                    stroke={axisStroke}
                    tick={{ fontSize: 11, fill: axisStroke }}
                  />
                  <YAxis stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} />
                  <Tooltip
                    contentStyle={{
                      background: tooltipBg,
                      border: `1px solid ${tooltipBorder}`,
                      borderRadius: 12,
                      color: tooltipText,
                    }}
                    labelFormatter={(t) => formatDateTime(new Date(t).toISOString())}
                    formatter={(value) => [`${value}`, "الرصيد"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {chartData.map((p) => (
                    <ReferenceDot
                      key={`${p.idx}`}
                      x={p.ts}
                      y={p.balance}
                      r={4}
                      fill={TYPE_COLOR[p.type] || "#34d399"}
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth={1}
                      isFront
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}

            {/* Legend */}
            {events.length > 0 ? (
              <div className="flex items-center justify-center gap-4 mt-3 flex-wrap text-xs">
                {Object.entries(TYPE_LABEL).map(([k, label]) => (
                  <div key={k} className="flex items-center gap-1.5 text-slate-700 dark:text-white/70">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ background: TYPE_COLOR[k] }}
                    />
                    {label}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Events table */}
          {events.length > 0 ? (
            <div className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden`}>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center gap-2 text-slate-800 dark:text-white/80 text-sm font-semibold">
                <Calendar className="w-4 h-4" />
                سجل العمليات ({events.length})
              </div>
              <div className="max-h-[420px] overflow-y-auto divide-y divide-white/5">
                {events
                  .slice()
                  .reverse()
                  .map((ev, idx) => {
                    const Icon = typeIcon(ev.inventory_type);
                    const isPositive = ev.delta > 0;
                    const isNegative = ev.delta < 0;
                    return (
                      <div
                        key={`${ev.kind}-${ev.operation_id}-${idx}`}
                        className="px-4 py-3 flex items-center gap-3"
                      >
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/10`}
                          style={{
                            background: `${TYPE_COLOR[ev.inventory_type] || "#34d399"}22`,
                          }}
                        >
                          <Icon
                            className="w-4 h-4"
                            style={{ color: TYPE_COLOR[ev.inventory_type] || "#34d399" }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-slate-900 dark:text-white text-sm font-semibold truncate">
                              {describeEvent(ev)}
                            </span>
                            {ev.inventory_number ? (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-white/60 border border-slate-200 dark:border-white/10 flex items-center gap-1"
                                dir="ltr"
                              >
                                <Hash className="w-3 h-3" />
                                {ev.inventory_number}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{formatDateTime(ev.event_at)}</span>
                            {ev.employee_name ? <span>• {ev.employee_name}</span> : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-sm font-bold ${
                              isPositive
                                ? "text-emerald-700 dark:text-emerald-200"
                                : isNegative
                                  ? "text-rose-700 dark:text-rose-200"
                                  : "text-slate-600 dark:text-white/60"
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="inline w-3 h-3 ml-1" />
                            ) : isNegative ? (
                              <TrendingDown className="inline w-3 h-3 ml-1" />
                            ) : null}
                            {isPositive ? "+" : ""}
                            {ev.delta}
                          </span>
                          <div className="text-left">
                            <div className="text-xs text-slate-500 dark:text-white/40">الرصيد</div>
                            <div className="text-base font-bold text-slate-900 dark:text-white">{ev.balance}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = "emerald" }) {
  const accentMap = {
    emerald: "text-emerald-700 dark:text-emerald-200",
    sky: "text-sky-700 dark:text-sky-200",
    amber: "text-amber-700 dark:text-amber-200",
  };
  return (
    <div className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl p-3 sm:p-4`}>
      <div className="text-xs text-slate-600 dark:text-white/55">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold mt-1 ${accentMap[accent]}`}>{value}</div>
    </div>
  );
}
