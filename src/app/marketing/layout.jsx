"use client";

import React from "react";
import { ws } from "@/components/Workspace/ui";
import useAdminTheme from "@/hooks/useAdminTheme";
import AdminThemeToggle from "@/components/Admin/AdminThemeToggle";

export default function MarketingLayout({ children }) {
  // Marketing rides the same theme hook as admin / HR / accounting.
  useAdminTheme();

  // Two-orb light background — same pair the admin dashboard uses
  // so the marketing pages feel like one product family. Hidden in
  // dark mode (each marketing page's own bg paints there).
  const Background = (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-[90px] dark:hidden" />
      <div className="absolute -bottom-56 -left-56 w-[620px] h-[620px] rounded-full bg-sky-500/10 blur-[110px] dark:hidden" />
    </div>
  );

  return (
    <div className={`min-h-[100svh] ${ws.appBg}`} dir="rtl">
      {Background}
      <AdminThemeToggle />
      <div className="relative">{children}</div>
    </div>
  );
}
