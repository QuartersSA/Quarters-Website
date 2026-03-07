"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, ArrowLeft, DollarSign } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import HRSidebar from "@/components/HR/Sidebar";

function readAdminUser() {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("adminUser");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function HRHomePage() {
  // ✅ allow full HR OR deductions-only to enter the HR section
  const { isAuthenticated, logout, checked, reason } = useAdminAuth({
    requiredAnyPermissions: ["can_access_hr", "can_manage_deductions"],
    redirect: false,
  });

  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAdminUser(readAdminUser());
  }, []);

  const hasFullHr = useMemo(() => {
    const raw = adminUser?.can_access_hr;
    if (raw === undefined || raw === null) {
      return !!adminUser?.can_manage_employees;
    }
    return !!raw;
  }, [adminUser]);

  const hasDeductionsOnly = useMemo(() => {
    const deductions = !!adminUser?.can_manage_deductions;
    return deductions && !hasFullHr;
  }, [adminUser, hasFullHr]);

  // ✅ deductions-only accounts should see ONLY the deductions page
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!checked || !isAuthenticated) return;
    if (hasDeductionsOnly) {
      window.location.replace("/hr/deductions");
    }
  }, [checked, isAuthenticated, hasDeductionsOnly]);

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
      reason === "missing_permission" ? "لا تملك صلاحية HR" : "غير مسجل دخول";

    const body =
      reason === "missing_permission"
        ? "لازم تفعيل صلاحية HR أو صلاحية (الخصميات) لحسابك من إدارة الموظفين (الإدارة)، وبعدها سجل خروج/دخول."
        : "سجل دخول كمدير عشان تقدر تفتح قسم HR.";

    return (
      <div
        className="min-h-[100svh] flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className={`${ws.glass} ${ws.card} p-6 max-w-lg w-full`}>
          <div className="text-white font-bold text-lg mb-2">{title}</div>
          <div className="text-white/60 text-sm leading-relaxed">{body}</div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <a
              href="/admin/login"
              className={`${ws.btnPrimary} px-4 py-2 justify-center`}
            >
              تسجيل الدخول
            </a>
            <a
              href="/admin/employees"
              className={`${ws.btnNeutral} px-4 py-2 justify-center`}
            >
              إدارة الموظفين (الإدارة)
            </a>
          </div>
        </div>
      </div>
    );
  }

  // while redirecting, show a tiny message (prevents flash)
  if (hasDeductionsOnly) {
    return (
      <div className="min-h-[100svh]" dir="rtl">
        <HRSidebar onLogout={logout} active="deductions" />
        <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
          <div className={`${ws.glass} ${ws.card} p-6`}>
            <div className="text-white font-bold">
              جاري تحويلك إلى الخصميات…
            </div>
            <div className="text-white/60 text-sm mt-1">
              هذا الحساب لديه صلاحية (الخصميات) فقط.
            </div>
            <a
              href="/hr/deductions"
              className={`${ws.btnPrimary} mt-4 inline-flex px-4 py-2 justify-center`}
            >
              فتح صفحة الخصميات
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ✅ full HR dashboard (only for can_access_hr)
  return (
    <div className="min-h-[100svh]" dir="rtl">
      <HRSidebar onLogout={logout} active="dashboard" />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mb-8 mt-6 lg:mt-0">
          <h1 className={`text-3xl sm:text-4xl ${ws.title} mb-2`}>HR</h1>
          <p className={ws.muted}>
            إدارة الموارد البشرية (الموظفين والصلاحيات)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href="/hr/employees"
            className={`group ${ws.glass} ${ws.card} p-5 border border-white/10 hover:bg-white/[0.06] transition-colors`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`${ws.iconBox} !bg-amber-500/10`}>
                <Users className="w-6 h-6 text-amber-200" />
              </div>
              <ArrowLeft className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
            </div>
            <div className="mt-4 text-white font-bold text-lg tracking-tight">
              الموظفين
            </div>
            <div className="text-white/55 text-sm mt-1">
              إضافة الموظفين وتعديل صلاحياتهم
            </div>
          </a>

          <a
            href="/hr/deductions"
            className={`group ${ws.glass} ${ws.card} p-5 border border-white/10 hover:bg-white/[0.06] transition-colors`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`${ws.iconBox} !bg-amber-500/10`}>
                <DollarSign className="w-6 h-6 text-amber-200" />
              </div>
              <ArrowLeft className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
            </div>
            <div className="mt-4 text-white font-bold text-lg tracking-tight">
              الخصميات
            </div>
            <div className="text-white/55 text-sm mt-1">
              تسجيل خصميات ومخالفات الموظفين
            </div>
          </a>

          <div
            className={`${ws.glass} ${ws.card} p-5 border border-white/10 bg-white/[0.02]`}
          >
            <div className="text-white font-bold text-lg tracking-tight">
              قريبًا
            </div>
            <div className="text-white/55 text-sm mt-1">
              (الحضور والانصراف، الإجازات، التقارير)
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
