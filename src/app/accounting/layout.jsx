"use client";

import React from "react";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";

const BRAND_LOGO_URL =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/resize/96x96/-/format/png/";

export default function AccountingLayout({ children }) {
  const { ready, isAuthenticated, user } = useWorkspaceUser();

  React.useEffect(() => {
    if (!ready) return;

    if (!isAuthenticated) {
      const adminAuth = localStorage.getItem("adminAuth");
      window.location.href = adminAuth ? "/admin/login" : "/";
      return;
    }

    // Permission gate for admin accounts. can_manage_purchases grants
    // قسم المشتريات ONLY: its holder lands on /accounting/purchases
    // and every other accounting page bounces there.
    if (user?.role === "Admin" && user?.can_manage_accounting === false) {
      const purchasesOnly = !!user?.can_manage_purchases;
      const path = window.location.pathname;
      if (!purchasesOnly) {
        window.location.href = "/admin";
      } else if (!path.startsWith("/accounting/purchases")) {
        window.location.href = "/accounting/purchases";
      }
    }
  }, [ready, isAuthenticated, user]);

  const Background = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Light-mode orbs — match the admin dashboard exactly. */}
      <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-[90px] dark:hidden" />
      <div className="absolute -bottom-56 -left-56 w-[620px] h-[620px] rounded-full bg-sky-500/10 blur-[110px] dark:hidden" />
      {/* Dark-mode orbs — keep the original 3-orb accounting flavor. */}
      <div className="hidden dark:block absolute -top-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-[90px]" />
      <div className="hidden dark:block absolute top-[30%] left-[-140px] h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-[100px]" />
      <div className="hidden dark:block absolute bottom-[-220px] right-[20%] h-[520px] w-[520px] rounded-full bg-fuchsia-500/8 blur-[110px]" />
      <div className="hidden dark:block absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/35" />
    </div>
  );

  if (!ready || !isAuthenticated) {
    const name = user?.name || "";

    return (
      <div
        className={`relative min-h-[100svh] ${ws.appBg} flex items-center justify-center p-6`}
        dir="rtl"
      >
        {Background}
        <div className="relative w-full max-w-md">
          <div className={`${ws.glass} rounded-3xl p-6`}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-white/10 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
                <img
                  src={BRAND_LOGO_URL}
                  alt="Logo"
                  className="w-10 h-10 object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">
                  المحاسبة
                </div>
                <div className="text-slate-700 dark:text-white/70 text-sm truncate">
                  {name ? `مرحباً ${name}` : "جاري التحميل…"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <div className="text-slate-700 dark:text-white/70 text-sm">نجهّز الصفحة…</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative min-h-[100svh] ${ws.appBg}`} dir="rtl">
      {Background}
      <div className="relative">{children}</div>
    </div>
  );
}
