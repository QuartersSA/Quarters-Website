"use client";

import React, { useMemo, useState } from "react";
import { Send, Wallet, RefreshCw, Info } from "lucide-react";
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
      <div className="w-9 h-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
        <Wallet className="w-5 h-5 text-amber-200" />
      </div>
      <div>
        <div className="font-bold text-white tracking-tight">مسير الرواتب</div>
        <div className="text-xs text-white/50">إرسال إلى المحاسبة</div>
      </div>
    </div>
  );
}

function HRPayrollDesktopHeader() {
  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className={ws.iconBox}>
        <Wallet className="w-6 h-6 text-amber-200" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          مسير الرواتب
        </h1>
        <p className="text-white/50 text-sm mt-0.5">
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
          <Info className="w-5 h-5 text-sky-200" />
        </div>
        <div className="text-sm text-white/75 leading-relaxed">
          هذه الصفحة تعرض مسير الرواتب للشهر المُختار حسب بيانات HR
          الحالية (الراتب، البدلات، البونص، الخصميات، السلف، تاريخ
          المباشرة، الإيقاف). اضغط{" "}
          <span className="text-white/90 font-semibold">
            «إرسال إلى المحاسبة»
          </span>{" "}
          لإنشاء أو تحديث المسير على{" "}
          <span className="text-white/90 font-semibold">
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
      <div className={`${ws.glass} ${ws.card} p-6 text-white/60`}>
        جاري التحميل…
      </div>
    );
  } else if (!employeeId) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-white/70`}>
        الرجاء تسجيل الدخول.
      </div>
    );
  } else if (!isAdmin) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-white/70`}>
        هذه الصفحة متاحة لمسؤولي HR فقط.
      </div>
    );
  } else {
    body = (
      <>
        <HRPayrollInfoCard />

        {/* Filters + send action */}
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="min-w-[200px]">
              <div className="text-xs text-white/55 mb-1">الشهر</div>
              <GlassSelect
                value={month}
                onChange={setMonth}
                options={monthOptions}
                placeholder="اختر الشهر"
                buttonClassName="text-sm py-2.5 px-3"
              />
            </div>

            <div className="flex-1" />

            {isClosed ? (
              <div className="text-xs text-amber-300/90 font-semibold">
                هذا الشهر مُقفّل — لا يمكن إعادة الإرسال.
              </div>
            ) : null}

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
