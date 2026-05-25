"use client";

import React from "react";
import {
  ArrowLeft,
  Calculator,
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Leaf,
  Banknote,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";
import { formatRunCreatedAt } from "@/utils/payrollCalculations";

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-ca-gregory-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function diffLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0)
    return { label: "متطابق", tone: "neutral" };
  if (n < 0) return { label: "عجز", tone: "bad" };
  return { label: "زيادة", tone: "good" };
}

function pillClassForTone(tone) {
  if (tone === "good") {
    return `${ws.pill} bg-emerald-400/15 text-emerald-200 border-emerald-400/25`;
  }
  if (tone === "bad") {
    return `${ws.pill} bg-red-500/15 text-red-200 border-red-500/25`;
  }
  return `${ws.pill} bg-white/[0.06] text-white/70 border-white/10`;
}

function toISODate(d) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function AccountingDashboardPage() {
  const { ready, isAuthenticated, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const from7Days = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  })();

  const shiftClosingsQuery = useQuery({
    queryKey: ["accountingDashboard", "shiftClosings", from7Days],
    enabled: ready && isAuthenticated && isAdmin,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (from7Days) qs.set("from", from7Days);

      const res = await adminFetch(
        `/api/accounting/shift-closings?${qs.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/shift-closings, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });

  const payrollRunsQuery = useQuery({
    queryKey: ["accountingDashboard", "payrollRuns"],
    enabled: ready && isAuthenticated && isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/accounting/payroll");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/payroll, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });

  const closings = Array.isArray(shiftClosingsQuery.data?.closings)
    ? shiftClosingsQuery.data.closings
    : [];
  const latestClosing = closings.length > 0 ? closings[0] : null;

  const latestClosingCashDiff = latestClosing
    ? Number(latestClosing.cash_diff)
    : NaN;
  const latestClosingCardDiff = latestClosing
    ? Number(latestClosing.card_diff)
    : NaN;
  const latestClosingTotalDiff = latestClosing
    ? Number(latestClosing.total_diff)
    : NaN;

  const totalDiffMeta = diffLabel(latestClosingTotalDiff);

  const latestClosingBranchName = latestClosing?.branch_name
    ? String(latestClosing.branch_name)
    : "—";
  const latestClosingShiftDateText = latestClosing?.shift_date
    ? String(latestClosing.shift_date)
    : "—";
  const latestClosingShiftLabelText = latestClosing?.shift_label
    ? ` (${String(latestClosing.shift_label)})`
    : "";

  const shiftClosingsErrorText = shiftClosingsQuery.error
    ? String(shiftClosingsQuery.error?.message || "فشل تحميل التقفيلات")
    : "";

  const runs = Array.isArray(payrollRunsQuery.data?.runs)
    ? payrollRunsQuery.data.runs
    : [];
  const latestRun = runs.length > 0 ? runs[0] : null;

  const latestRunMonth = latestRun?.payroll_month
    ? String(latestRun.payroll_month).slice(0, 7)
    : "";
  const latestRunMonthText = latestRunMonth || "—";

  const latestRunCreatedAtText = latestRun?.created_at
    ? formatRunCreatedAt(latestRun.created_at)
    : "";

  const latestRunCreatedByName = latestRun?.created_by_employee_name
    ? String(latestRun.created_by_employee_name)
    : "—";

  const payrollRunsErrorText = payrollRunsQuery.error
    ? String(payrollRunsQuery.error?.message || "فشل تحميل المسيرات")
    : "";

  const accessDenied = ready && isAuthenticated && !isAdmin;
  const topBarClass = ws.topBar;

  if (accessDenied) {
    return (
      <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
        <AccountingSidebar active="dashboard" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[900px] space-y-4">
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/80`}>
              هذه الصفحة خاصة بالمحاسبة.
              <div className="mt-3">
                <a
                  href="/"
                  className={`${ws.btnNeutral} px-4 py-2 inline-flex`}
                >
                  رجوع
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const cards = [
    {
      href: "/accounting/green-bean-calculator",
      title: "حاسبة البن الأخضر",
      subtitle: "حساب تكلفة الخيشة + التحميص + الهدر وسعر الكيلو النهائي",
      Icon: Leaf,
    },
    {
      href: "/accounting/shift-close",
      title: "تقفيلة الشفت",
      subtitle: "عرض السجل والفرق بين الفعلي وفودكس",
      Icon: Calculator,
    },
    {
      href: "/accounting/cash-calculator",
      title: "حاسبة الكاش",
      subtitle: "حساب وتخزين فئات الكاش حسب الفرع والشهر",
      Icon: Banknote,
    },
    {
      href: "/accounting/payroll",
      title: "مسير الرواتب",
      subtitle: "إرسال المسير وتجميع الخصميات والمكافآت",
      Icon: Wallet,
    },
  ];

  let shiftHighlightsBody = null;
  if (shiftClosingsQuery.isLoading) {
    shiftHighlightsBody = <div className="text-white/60">جاري التحميل…</div>;
  } else if (shiftClosingsQuery.error) {
    shiftHighlightsBody = (
      <div className="text-red-300">{shiftClosingsErrorText}</div>
    );
  } else if (!latestClosing) {
    shiftHighlightsBody = (
      <div className="text-white/60">لا يوجد سجلات بعد.</div>
    );
  } else {
    const totalDiffText = formatMoney(latestClosingTotalDiff);
    const cashDiffText = formatMoney(latestClosingCashDiff);
    const cardDiffText = formatMoney(latestClosingCardDiff);

    shiftHighlightsBody = (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-white/80">
            <span className="font-semibold text-white">
              {latestClosingBranchName}
            </span>
            <span className="text-white/40"> — </span>
            <span>{latestClosingShiftDateText}</span>
            {latestClosingShiftLabelText ? (
              <span className="text-white/55">
                {latestClosingShiftLabelText}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white font-extrabold">{totalDiffText}</span>
            <span className={pillClassForTone(totalDiffMeta.tone)}>
              {totalDiffMeta.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/50">فرق الكاش</div>
            <div className="text-white font-bold mt-1">{cashDiffText}</div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/50">فرق الشبكة</div>
            <div className="text-white font-bold mt-1">{cardDiffText}</div>
          </div>
          <div className={`${ws.glass} ${ws.card} p-3`}>
            <div className="text-xs text-white/50">الإجمالي</div>
            <div className="text-white font-extrabold mt-1">
              {totalDiffText}
            </div>
          </div>
        </div>
      </div>
    );
  }

  let payrollHighlightsBody = null;
  if (payrollRunsQuery.isLoading) {
    payrollHighlightsBody = <div className="text-white/60">جاري التحميل…</div>;
  } else if (payrollRunsQuery.error) {
    payrollHighlightsBody = (
      <div className="text-red-300">{payrollRunsErrorText}</div>
    );
  } else if (!latestRun) {
    payrollHighlightsBody = (
      <div className="text-white/60">لا يوجد مسير رواتب بعد.</div>
    );
  } else {
    payrollHighlightsBody = (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-white/80">
            <span className="text-white/40">الشهر: </span>
            <span className="font-semibold text-white">
              {latestRunMonthText}
            </span>
          </div>
          <div className="text-xs text-white/50">{latestRunCreatedAtText}</div>
        </div>

        <div className={`${ws.glass} ${ws.card} p-3`}>
          <div className="text-xs text-white/50">آخر من أنشأه</div>
          <div className="text-white font-bold mt-1">
            {latestRunCreatedByName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="dashboard" />

      {/* Mobile top bar */}
      <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <LayoutDashboard className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white tracking-tight truncate">
                المحاسبة
              </div>
              <div className="text-xs text-white/50 truncate">
                لوحة المحاسبة
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1200px] space-y-5">
          {/* Desktop header */}
          <div className="hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={ws.iconBox}>
                <LayoutDashboard className="w-5 h-5 text-emerald-200" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white tracking-tight">
                  المحاسبة
                </div>
                <div className="text-white/55 mt-1">لوحة المحاسبة</div>
              </div>
            </div>
          </div>

          {/* Main grid (same idea as HR dashboard) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => {
              const Icon = c.Icon;
              const arrowClass =
                "w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors";

              return (
                <a
                  key={c.href}
                  href={c.href}
                  className={`group ${ws.glass} ${ws.card} p-5 border border-white/10 hover:bg-white/[0.06] transition-colors`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={`${ws.iconBox} !bg-emerald-500/10`}>
                      <Icon className="w-6 h-6 text-emerald-200" />
                    </div>
                    <ArrowLeft className={arrowClass} />
                  </div>
                  <div className="mt-4 text-white font-bold text-lg tracking-tight">
                    {c.title}
                  </div>
                  <div className="text-white/55 text-sm mt-1">{c.subtitle}</div>
                </a>
              );
            })}

            <div
              className={`${ws.glass} ${ws.card} p-5 border border-white/10 bg-white/[0.02]`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`${ws.iconBox} !bg-emerald-500/10`}>
                  <TrendingUp className="w-6 h-6 text-emerald-200" />
                </div>
              </div>
              <div className="mt-4 text-white font-bold text-lg tracking-tight">
                قريبًا
              </div>
              <div className="text-white/55 text-sm mt-1">
                (تقارير شهرية، ومقارنة الفروع، وتصدير)
              </div>
            </div>
          </div>

          {/* Quick highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${ws.glassSoft} ${ws.card} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-bold tracking-tight">
                    آخر تقفيلة (آخر 7 أيام)
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    نظرة سريعة على آخر سجل
                  </div>
                </div>
                <a
                  href="/accounting/shift-close"
                  className={`${ws.btnNeutral} px-3 py-2 text-sm`}
                >
                  فتح السجل
                </a>
              </div>

              <div className="mt-4">{shiftHighlightsBody}</div>
            </div>

            <div className={`${ws.glassSoft} ${ws.card} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-white font-bold tracking-tight">
                    آخر مسير رواتب
                  </div>
                  <div className="text-xs text-white/50 mt-1">
                    آخر 24 شهر (حسب الموجود)
                  </div>
                </div>
                <a
                  href="/accounting/payroll"
                  className={`${ws.btnNeutral} px-3 py-2 text-sm`}
                >
                  فتح الرواتب
                </a>
              </div>

              <div className="mt-4">{payrollHighlightsBody}</div>
            </div>
          </div>

          {!ready ? (
            <div className={`${ws.glassSoft} ${ws.card} p-6 text-white/70`}>
              جاري التحميل…
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
