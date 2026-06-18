"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Trash2,
  Filter,
  ChevronDown,
  Building2,
  User,
  Clock,
  StickyNote,
  RotateCcw,
  Layers,
  Boxes,
  Coins,
  Receipt,
  Trophy,
} from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { adminFetch } from "@/utils/apiAuth";
import { formatMoney } from "@/utils/payrollFormatters";

/* Map a picked Riyadh calendar date (YYYY-MM-DD) to the UTC instant
 * bounds of that day. Riyadh is a fixed UTC+03:00 (no DST), so the
 * day runs from `YYYY-MM-DDT00:00:00+03:00` to `…T23:59:59.999+03:00`.
 * Without this the date-only string compared against the TIMESTAMPTZ
 * created_at as UTC midnight, so "today" excluded every Riyadh-day
 * entry (and the day appeared to shift). Returns an ISO UTC instant.
 */
function riyadhDayStartUTC(dateStr) {
  if (!dateStr) return null;
  const d = String(dateStr).slice(0, 10);
  const t = new Date(`${d}T00:00:00+03:00`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
function riyadhDayEndUTC(dateStr) {
  if (!dateStr) return null;
  const d = String(dateStr).slice(0, 10);
  const t = new Date(`${d}T23:59:59.999+03:00`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/* Riyadh-local timestamp. Avoid toLocaleString("ar-SA") — it scrambles in RTL. */
function fmtDateTime(value) {
  if (!value) return "—";
  try {
    const p = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Riyadh",
    }).formatToParts(new Date(value));
    const g = (t) => p.find((x) => x.type === t)?.value || "";
    let h = g("hour");
    if (h === "24") h = "00";
    return `${g("year")}/${g("month")}/${g("day")} ${h}:${g("minute")}`;
  } catch {
    return String(value);
  }
}

/* ── Reason key → Arabic label ── */
const REASON_LABELS = {
  expiry: "تاريخ صلاحية",
  customer_return: "إرجاع من العميل",
  order_error: "خطأ في الطلب",
  not_sellable: "غير صالح للبيع",
  unspecified: "غير محدد",
};

/* Per-reason pill colour (light/dark pairs, ws.pill base). */
const REASON_BADGE = {
  expiry:
    "bg-amber-50 text-amber-700 border-amber-200 " +
    "dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/25",
  customer_return:
    "bg-sky-50 text-sky-700 border-sky-200 " +
    "dark:bg-sky-400/15 dark:text-sky-200 dark:border-sky-400/25",
  order_error:
    "bg-rose-50 text-rose-700 border-rose-200 " +
    "dark:bg-rose-400/15 dark:text-rose-200 dark:border-rose-400/25",
  not_sellable:
    "bg-slate-100 text-slate-700 border-slate-200 " +
    "dark:bg-white/[0.06] dark:text-white/70 dark:border-white/15",
  unspecified:
    "bg-slate-100 text-slate-600 border-slate-200 " +
    "dark:bg-white/[0.05] dark:text-white/55 dark:border-white/10",
};

/* Bar fill colour per reason (for the breakdown % bars). */
const REASON_BAR = {
  expiry: "bg-amber-400 dark:bg-amber-400/70",
  customer_return: "bg-sky-400 dark:bg-sky-400/70",
  order_error: "bg-rose-400 dark:bg-rose-400/70",
  not_sellable: "bg-slate-400 dark:bg-white/30",
  unspecified: "bg-slate-300 dark:bg-white/20",
};

function ReasonBadge({ reason }) {
  const key = REASON_LABELS[reason] ? reason : "unspecified";
  return (
    <span className={`${ws.pill} ${REASON_BADGE[key]}`}>
      {REASON_LABELS[key]}
    </span>
  );
}

/* ── Mobile Header ── */
function WasteMobileHeader() {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center">
        <Trash2 className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
      </div>
      <div>
        <div className="font-bold text-slate-900 dark:text-white tracking-tight">
          تقرير الهدر
        </div>
        <div className="text-xs text-slate-500 dark:text-white/50">
          عمليات هدر المخزون وتكلفتها
        </div>
      </div>
    </div>
  );
}

/* ── Desktop Header ── */
function WasteDesktopHeader() {
  return (
    <div className="hidden lg:flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={ws.iconBox}>
          <Trash2 className="w-6 h-6 text-emerald-700 dark:text-emerald-200" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            تقرير الهدر
          </h1>
          <p className="text-slate-500 dark:text-white/50 text-sm mt-0.5">
            كل عملية هدر مسجلة مع الأصناف وتكلفتها بسعر التكلفة وقت التسجيل.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotAccountingCard() {
  return (
    <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
      هذا القسم متاح فقط لمستخدمي المحاسبة.
    </div>
  );
}

function LoginCard() {
  return (
    <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
      الرجاء تسجيل الدخول.
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, suffix, emerald }) {
  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/55">
        {Icon ? (
          <Icon className="w-4 h-4 text-slate-400 dark:text-white/40" />
        ) : null}
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          emerald
            ? "text-emerald-700 dark:text-emerald-200"
            : "text-slate-900 dark:text-white"
        }`}
        dir="ltr"
      >
        {value}
        {suffix ? (
          <span className="text-sm font-semibold mr-1">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Breakdown-by-reason card ── */
function ReasonBreakdownCard({ row, grandTotal }) {
  const cost = Number(row.cost || 0);
  const pct = grandTotal > 0 ? (cost / grandTotal) * 100 : 0;
  const key = REASON_LABELS[row.reason] ? row.reason : "unspecified";
  return (
    <div className={`${ws.glass} ${ws.card} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <ReasonBadge reason={row.reason} />
        <div className="text-xs text-slate-500 dark:text-white/45" dir="ltr">
          {Math.round(pct)}%
        </div>
      </div>
      <div>
        <div
          className="text-lg font-bold text-emerald-700 dark:text-emerald-200"
          dir="ltr"
        >
          {formatMoney(cost)} ر.س
        </div>
        <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
          {Number(row.lines || 0)} سطر
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full ${REASON_BAR[key]}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

/* ── Single waste operation card (expandable) ── */
function WasteOperationCard({ op }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(op?.items) ? op.items : [];

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full text-right p-4 flex items-start gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
              <Building2 className="w-4 h-4 text-slate-400 dark:text-white/40" />
              {op.branch_name || "—"}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-white/70">
              <User className="w-4 h-4 text-slate-400 dark:text-white/40" />
              {op.employee_name || "—"}
            </div>
            <div
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50"
              dir="ltr"
            >
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-white/40" />
              {fmtDateTime(op.created_at)}
            </div>
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-white/45">
            عدد الأصناف: {Number(op.items_count || 0)}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-left">
            <div className="text-[11px] text-slate-500 dark:text-white/40">التكلفة</div>
            <div
              className="text-base font-bold text-emerald-700 dark:text-emerald-200"
              dir="ltr"
            >
              {formatMoney(op.total_cost)} ر.س
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-slate-400 dark:text-white/40 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-200/60 dark:border-white/10">
          {op.note ? (
            <div className="mt-3 flex items-start gap-2 text-sm text-slate-700 dark:text-white/75">
              <StickyNote className="w-4 h-4 mt-0.5 text-slate-400 dark:text-white/40 flex-shrink-0" />
              <span>{op.note}</span>
            </div>
          ) : null}

          <div className={`${ws.innerCard} mt-3 overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 dark:text-white/45 border-b border-slate-200 dark:border-white/10">
                    <th className="text-right font-semibold px-3 py-2">الصنف</th>
                    <th className="text-left font-semibold px-3 py-2">الكمية</th>
                    <th className="text-right font-semibold px-3 py-2">السبب</th>
                    <th className="text-right font-semibold px-3 py-2">رقم الفاتورة / ملاحظة</th>
                    <th className="text-left font-semibold px-3 py-2">تكلفة الوحدة</th>
                    <th className="text-left font-semibold px-3 py-2">التكلفة</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-4 text-center text-slate-500 dark:text-white/45"
                      >
                        لا توجد أصناف
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr
                        key={it.id}
                        className="border-b border-slate-200/60 dark:border-white/[0.06] last:border-0"
                      >
                        <td className="px-3 py-2 text-slate-800 dark:text-white/85">
                          {it.item_name || "—"}
                        </td>
                        <td className="px-3 py-2 text-left text-slate-700 dark:text-white/70" dir="ltr">
                          {formatMoney(it.quantity)}
                        </td>
                        <td className="px-3 py-2">
                          <ReasonBadge reason={it.reason} />
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-white/60">
                          {it.note ? it.note : "—"}
                        </td>
                        <td className="px-3 py-2 text-left text-slate-700 dark:text-white/70" dir="ltr">
                          {formatMoney(it.unit_cost)} ر.س
                        </td>
                        <td className="px-3 py-2 text-left font-semibold text-emerald-700 dark:text-emerald-200" dir="ltr">
                          {formatMoney(it.cost)} ر.س
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WastePage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";
  const canManage = isAdmin && user?.can_manage_accounting !== false;

  const [branchFilter, setBranchFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const hasFilters = !!(branchFilter || reasonFilter || from || to);
  const resetFilters = () => {
    setBranchFilter("");
    setReasonFilter("");
    setFrom("");
    setTo("");
  };

  const branchesQuery = useQuery({
    queryKey: ["accounting-waste-branches"],
    enabled: !!employeeId && canManage,
    queryFn: async () => {
      const res = await adminFetch("/api/branches");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل الفروع");
      }
      return Array.isArray(data) ? data : [];
    },
  });
  const branches = branchesQuery.data || [];

  const wasteQuery = useQuery({
    queryKey: [
      "accounting-waste",
      branchFilter || null,
      reasonFilter || null,
      from || null,
      to || null,
    ],
    enabled: !!employeeId && canManage,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (branchFilter) qs.set("branchId", String(branchFilter));
      if (reasonFilter) qs.set("reason", reasonFilter);
      // Send the selected Riyadh calendar days as their full UTC
      // instant range so a same-day filter actually covers the whole
      // Riyadh day (00:00 → 23:59:59.999 local).
      const fromUTC = riyadhDayStartUTC(from);
      const toUTC = riyadhDayEndUTC(to);
      if (fromUTC) qs.set("from", fromUTC);
      if (toUTC) qs.set("to", toUTC);
      const url = qs.toString() ? `/api/waste?${qs.toString()}` : "/api/waste";
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "فشل تحميل تقارير الهدر");
      }
      return data;
    },
  });

  const operations = wasteQuery.data?.operations || [];
  const byReason = wasteQuery.data?.by_reason || [];
  const topItems = wasteQuery.data?.top_items || [];
  const summary = wasteQuery.data?.summary || {
    operations_count: 0,
    items_count: 0,
    total_cost: 0,
  };

  const grandTotal = Number(summary.total_cost || 0);
  const visibleReasons = useMemo(
    () => byReason.filter((r) => Number(r.cost || 0) > 0 || Number(r.lines || 0) > 0),
    [byReason],
  );

  const branchOptions = useMemo(
    () => [
      { value: "", label: "جميع الفروع" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  const reasonOptions = useMemo(
    () => [
      { value: "", label: "كل الأسباب" },
      { value: "expiry", label: REASON_LABELS.expiry },
      { value: "customer_return", label: REASON_LABELS.customer_return },
      { value: "order_error", label: REASON_LABELS.order_error },
      { value: "not_sellable", label: REASON_LABELS.not_sellable },
    ],
    [],
  );

  let body = null;
  if (!ready) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>
        جاري التحميل…
      </div>
    );
  } else if (!employeeId) {
    body = <LoginCard />;
  } else if (!canManage) {
    body = <NotAccountingCard />;
  } else {
    body = (
      <>
        {/* Filters bar */}
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex items-center gap-2 text-slate-600 dark:text-white/55 text-xs lg:mb-2.5">
              <Filter className="w-4 h-4" />
              تصفية
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
                  الفرع
                </label>
                <GlassSelect
                  value={branchFilter}
                  onChange={setBranchFilter}
                  options={branchOptions}
                  buttonClassName="text-sm py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
                  السبب
                </label>
                <GlassSelect
                  value={reasonFilter}
                  onChange={setReasonFilter}
                  options={reasonOptions}
                  buttonClassName="text-sm py-2 px-3"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
                  من
                </label>
                <GlassDatePicker
                  value={from}
                  onChange={setFrom}
                  placeholder="من"
                  allowClear
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
                  إلى
                </label>
                <GlassDatePicker
                  value={to}
                  onChange={setTo}
                  placeholder="إلى"
                  allowClear
                />
              </div>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className={`${ws.btnNeutral} px-4 py-2 justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <RotateCcw className="w-4 h-4" />
              إعادة تعيين
            </button>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={Layers}
            label="عدد عمليات الهدر"
            value={Number(summary.operations_count || 0)}
          />
          <StatCard
            icon={Boxes}
            label="عدد أصناف الهدر"
            value={Number(summary.items_count || 0)}
          />
          <StatCard
            icon={Coins}
            label="إجمالي تكلفة الهدر"
            value={formatMoney(summary.total_cost)}
            suffix="ر.س"
            emerald
          />
        </div>

        {/* Loading / error states gate the data sections */}
        {wasteQuery.isLoading ? (
          <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>
            جاري التحميل…
          </div>
        ) : wasteQuery.isError ? (
          <div className={`${ws.glass} ${ws.card} p-6 text-red-600 dark:text-red-300`}>
            {wasteQuery.error?.message || "حدث خطأ أثناء تحميل البيانات."}
          </div>
        ) : operations.length === 0 ? (
          <div className={`${ws.glass} ${ws.card} p-10 text-center text-slate-500 dark:text-white/50`}>
            لا توجد عمليات هدر
          </div>
        ) : (
          <>
            {/* Breakdown by reason */}
            {visibleReasons.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white/85">
                  <Receipt className="w-4 h-4 text-slate-400 dark:text-white/40" />
                  التوزيع حسب السبب
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {visibleReasons.map((row) => (
                    <ReasonBreakdownCard
                      key={row.reason}
                      row={row}
                      grandTotal={grandTotal}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Top wasted items */}
            {topItems.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white/85">
                  <Trophy className="w-4 h-4 text-slate-400 dark:text-white/40" />
                  أكثر الأصناف هدراً
                </div>
                <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 dark:text-white/45 border-b border-slate-200 dark:border-white/10">
                          <th className="text-right font-semibold px-4 py-2.5 w-10">#</th>
                          <th className="text-right font-semibold px-4 py-2.5">الصنف</th>
                          <th className="text-left font-semibold px-4 py-2.5">الكمية</th>
                          <th className="text-left font-semibold px-4 py-2.5">التكلفة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topItems.slice(0, 10).map((it, idx) => (
                          <tr
                            key={it.item_id ?? idx}
                            className="border-b border-slate-200/60 dark:border-white/[0.06] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                          >
                            <td className="px-4 py-2.5 text-slate-400 dark:text-white/40 font-semibold" dir="ltr">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-2.5 text-slate-800 dark:text-white/85 font-medium">
                              {it.item_name || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-left text-slate-700 dark:text-white/70" dir="ltr">
                              {formatMoney(it.total_quantity)}
                            </td>
                            <td className="px-4 py-2.5 text-left font-semibold text-emerald-700 dark:text-emerald-200" dir="ltr">
                              {formatMoney(it.total_cost)} ر.س
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Operations list */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white/85">
                <Trash2 className="w-4 h-4 text-slate-400 dark:text-white/40" />
                عمليات الهدر
              </div>
              <div className="space-y-3">
                {operations.map((op) => (
                  <WasteOperationCard key={op.id} op={op} />
                ))}
              </div>
            </section>
          </>
        )}
      </>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="waste" />

      <WasteMobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <WasteDesktopHeader />
          {body}
        </div>
      </main>
    </div>
  );
}
