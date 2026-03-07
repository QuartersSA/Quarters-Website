"use client";

import { useEffect } from "react";
import { ArrowLeft, Gift } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function HRBonusesPage() {
  // Bonuses are now managed from Accounting -> Payroll only
  const { isAuthenticated, checked, reason } = useAdminAuth({
    requiredAnyPermissions: ["can_manage_accounting"],
    redirect: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!checked) return;
    if (isAuthenticated) {
      window.location.replace("/accounting/payroll");
    }
  }, [checked, isAuthenticated]);

  if (!checked) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className={`${ws.glass} ${ws.card} p-6 max-w-lg w-full`}>
          <div className="text-white font-bold text-lg mb-2">
            جاري التحقق من الصلاحيات…
          </div>
          <div className="text-white/60 text-sm leading-relaxed">لحظات.</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const title =
      reason === "not_logged_in" ? "غير مسجل دخول" : "تم نقل صفحة البونص";

    const body =
      reason === "not_logged_in"
        ? "سجل دخول كمدير ثم افتح المحاسبة > مسير الرواتب لإضافة البونص."
        : "إضافة البونص أصبحت داخل المحاسبة (مسير الرواتب) فقط. تحتاج صلاحية المحاسبة (can_manage_accounting).";

    return (
      <div
        className="min-h-[100svh] flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className={`${ws.glass} ${ws.card} p-6 max-w-lg w-full`}>
          <div className="flex items-center gap-3">
            <div className={`${ws.iconBox} w-10 h-10`}>
              <Gift className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="text-white font-bold text-lg">{title}</div>
          </div>
          <div className="text-white/60 text-sm leading-relaxed mt-3">
            {body}
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <a
              href="/accounting/payroll"
              className={`${ws.btnPrimary} px-4 py-2 justify-center`}
            >
              <ArrowLeft className="w-4 h-4" />
              فتح مسير الرواتب
            </a>
            <a
              href="/admin/login"
              className={`${ws.btnNeutral} px-4 py-2 justify-center`}
            >
              تسجيل الدخول
            </a>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated, the useEffect will redirect.
  return null;
}
