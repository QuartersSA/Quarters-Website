"use client";

import React from "react";
import { Building2 } from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/uiPurchases";
import ProjectsListPanel from "@/components/Accounting/BranchProjects/ProjectsListPanel";

/**
 * تأسيس الفروع — قائمة المشاريع.
 *
 * كل مشروع يتابع إنشاء فرع جديد من توقيع العقد حتى الافتتاح:
 * الأقسام، الخط الزمني، والتكاليف. تفاصيل المشروع في
 * /accounting/branch-projects/:id.
 */

const PAGE_TITLE = "تأسيس الفروع";
const PAGE_DESCRIPTION =
  "متابعة إنشاء الفروع الجديدة من توقيع العقد حتى الافتتاح: الأقسام، الخط الزمني، والتكاليف";

function MobileHeader() {
  return (
    <div className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}>
      <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center">
        <Building2 className="w-5 h-5 text-[#0e7a5f] dark:text-emerald-200" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900 dark:text-white tracking-tight">{PAGE_TITLE}</div>
        <div className="text-xs text-slate-500 dark:text-white/50 truncate">قائمة المشاريع</div>
      </div>
    </div>
  );
}

function DesktopHeader() {
  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className={ws.iconBox}>
        <Building2 className="w-6 h-6 text-[#0e7a5f] dark:text-emerald-200" />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{PAGE_TITLE}</h1>
        <p className="text-slate-500 dark:text-white/50 text-sm mt-0.5">{PAGE_DESCRIPTION}</p>
      </div>
    </div>
  );
}

export default function BranchProjectsPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";
  const canManageAccounting = user?.can_manage_accounting !== false;

  let body = null;
  if (!ready) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>جاري التحميل…</div>
    );
  } else if (!employeeId) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>الرجاء تسجيل الدخول.</div>
    );
  } else if (!isAdmin || !canManageAccounting) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
        هذا القسم متاح فقط لمستخدمي المحاسبة.
      </div>
    );
  } else {
    body = <ProjectsListPanel employeeId={employeeId} isAdmin={isAdmin} />;
  }

  return (
    <div
      className="min-h-[100svh] pb-24 lg:pb-0 bg-[#f6f8f7] text-[#1a2332] dark:bg-transparent dark:text-white"
      dir="rtl"
    >
      <AccountingSidebar active="branch-projects" />
      <MobileHeader />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <DesktopHeader />
          {body}
        </div>
      </main>
    </div>
  );
}
