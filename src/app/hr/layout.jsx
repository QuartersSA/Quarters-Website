"use client";

import React from "react";
import { ws } from "@/components/Workspace/ui";
import useAdminTheme from "@/hooks/useAdminTheme";
import AdminThemeToggle from "@/components/Admin/AdminThemeToggle";

export default function HRLayout({ children }) {
  React.useEffect(() => {
    try {
      localStorage.setItem("adminMode", "hr");
      localStorage.removeItem("workspaceUser");
    } catch {
      // ignore
    }
  }, []);

  // HR shares the admin theme. useAdminTheme drives the `dark` class
  // on document.documentElement directly, and root.tsx ships an
  // anti-FOUC inline script that sets it on first paint — no need
  // for a redundant wrapper-level class (which used to flash dark
  // for a tick on light-saved users while useState's default value
  // disagreed with the stored preference).
  useAdminTheme();

  const Background = (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Light-mode orbs — match the admin dashboard's look so every
          section feels like one product family. */}
      <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-emerald-500/10 blur-[90px] dark:hidden" />
      <div className="absolute -bottom-56 -left-56 w-[620px] h-[620px] rounded-full bg-sky-500/10 blur-[110px] dark:hidden" />
      {/* Dark-mode orbs — keep the original section flavor (amber). */}
      <div className="hidden dark:block absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-amber-500/10 blur-[90px]" />
      <div className="hidden dark:block absolute -bottom-56 -left-56 w-[620px] h-[620px] rounded-full bg-sky-500/10 blur-[110px]" />
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
