"use client";

import React, { useMemo, useState } from "react";
import { Send, Wallet, RefreshCw, Info, Lock, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import HRSidebar from "@/components/HR/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { buildRecentMonthOptions, monthLabel } from "@/utils/payrollFormatters";
import { usePayrollData } from "@/hooks/usePayrollData";
import { usePayrollRebuild } from "@/hooks/usePayrollMutations";
import { HRPayrollTable } from "@/components/HR/HRPayrollTable";

function HRPayrollMobileHeader() {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center">
        <Wallet className="w-5 h-5 text-amber-700 dark:text-amber-200" />
      </div>
      <div>
        <div className="font-bold text-slate-900 dark:text-white tracking-tight">مسير الرواتب</div>
        <div className="text-xs text-slate-500 dark:text-white/50">إرسال إلى المحاسبة</div>
      </div>
    </div>
  );
}

function HRPayrollDesktopHeader() {
  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className={ws.iconBox}>
        <Wallet className="w-6 h-6 text-amber-700 dark:text-amber-200" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          مسير الرواتب
        </h1>
        <p className="text-slate-500 dark:text-white/50 text-sm mt-0.5">
          عرض المسير الحالي ثم إرساله إلى قسم المحاسبة بضغطة زر.
        </p>
      </div>
    </div>
  );
}

function HRPayrollInfoCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-700 dark:text-sky-200" />
        </div>
        <div className="text-sm text-slate-700 dark:text-white/75 leading-relaxed">
          هذه الصفحة تعرض مسير الرواتب للشهر المُختار حسب بيانات HR
          الحالية (الراتب، البدلات، البونص، الخصميات، السلف، تاريخ
          المباشرة، الإيقاف). اضغط{" "}
          <span className="text-slate-900 dark:text-white/90 font-semibold">
            «إرسال إلى المحاسبة»
          </span>{" "}
          لإنشاء أو تحديث المسير على{" "}
          <span className="text-slate-900 dark:text-white/90 font-semibold">
            /accounting/payroll
          </span>
          ، حيث يتولّى المحاسب تأكيد الدفع وتقفيل الشهر.
        </div>
      </div>
    </div>
  );
}

export default function HRPayrollPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const [month, setMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);
  const monthHint = month ? monthLabel(month) : "";

  const payrollQuery = usePayrollData(month, employeeId, isAdmin);
  const rebuildMutation = usePayrollRebuild();

  const entries = Array.isArray(payrollQuery.data?.entries)
    ? payrollQuery.data.entries
    : [];
  const run = payrollQuery.data?.run || null;
  const isClosed = !!run?.is_closed;
  const closedAtText = run?.closed_at
    ? String(run.closed_at).slice(0, 10)
    : "";
  const closedByName = run?.closed_by_employee_name
    ? String(run.closed_by_employee_name)
    : "";

  const handleSend = () => {
    if (!month) {
      toast.error("اختر الشهر أولاً");
      return;
    }
    if (isClosed) {
      toast.error("هذا الشهر مُقفّل من المحاسبة. افتحه أولاً.");
      return;
    }
    const ok = window.confirm(
      `سيتم إنشاء/تحديث مسير الرواتب لشهر ${monthHint} في قسم المحاسبة.\nستُحفظ حالة الدفع الحالية (إن وُجدت) كما هي.\nمتابعة؟`,
    );
    if (!ok) return;
    rebuildMutation.mutate(
      { month },
      {
        onSuccess: () => {
          payrollQuery.refetch();
        },
      },
    );
  };

  let body = null;
  if (!ready) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>
        جاري التحميل…
      </div>
    );
  } else if (!employeeId) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
        الرجاء تسجيل الدخول.
      </div>
    );
  } else if (!isAdmin) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
        هذه الصفحة متاحة لمسؤولي HR فقط.
      </div>
    );
  } else {
    body = (
      <>
        <HRPayrollInfoCard />

        {/* Red banner: month is already closed by accounting. Shows
            BEFORE the admin clicks send so they don't waste a click,
            and explains who closed it + when (when the API exposes
            it). */}
        {isClosed ? (
          <div
            className="rounded-3xl border border-red-500/40 bg-red-500/10 p-4"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5 text-red-700 dark:text-red-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-red-700 dark:text-red-200 font-bold tracking-tight">
                    الشهر مُقفّل من قِبَل قسم المحاسبة
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-200">
                    <Lock className="w-3 h-3" />
                    مُقفل
                  </span>
                </div>
                <div className="text-sm text-red-800 dark:text-red-100/80 mt-1 leading-relaxed">
                  لا يمكن إعادة إرسال مسير الرواتب لشهر {monthHint} ما
                  دام مُقفّلاً. على المحاسبة فتح الشهر أولاً من زر
                  «إلغاء التقفيل» في صفحة{" "}
                  <span className="font-semibold">
                    /accounting/payroll
                  </span>{" "}
                  ثم إعادة المحاولة من هنا.
                  {closedByName || closedAtText ? (
                    <div className="text-xs text-red-700 dark:text-red-200/70 mt-1.5">
                      {closedByName ? `أقفله: ${closedByName}` : ""}
                      {closedByName && closedAtText ? " — " : ""}
                      {closedAtText ? `بتاريخ ${closedAtText}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Filters + send action */}
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="min-w-[200px]">
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">الشهر</div>
              <GlassSelect
                value={month}
                onChange={setMonth}
                options={monthOptions}
                placeholder="اختر الشهر"
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={() => payrollQuery.refetch()}
              disabled={payrollQuery.isFetching}
              className={`${ws.btnNeutral} px-4 py-2 disabled:opacity-50`}
              title="إعادة تحميل البيانات"
            >
              <RefreshCw
                className={`w-4 h-4 ${payrollQuery.isFetching ? "animate-spin" : ""}`}
              />
              تحديث
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={rebuildMutation.isPending || isClosed}
              className={`${ws.btnPrimary} px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed`}
              title={
                isClosed
                  ? "الشهر مُقفّل من المحاسبة — فُك التقفيل أولاً"
                  : ""
              }
            >
              <Send className="w-4 h-4" />
              {rebuildMutation.isPending
                ? "جاري الإرسال…"
                : "إرسال إلى المحاسبة"}
            </button>
          </div>
        </div>

        <HRPayrollTable
          entries={entries}
          isLoading={payrollQuery.isLoading}
        />
      </>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <HRSidebar active="payroll" />

      <HRPayrollMobileHeader />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <HRPayrollDesktopHeader />
          {body}
        </div>
      </main>
    </div>
  );
}
