"use client";

import React from "react";
import { ws } from "@/components/Workspace/ui";

export default function HRLayout({ children }) {
  React.useEffect(() => {
    try {
      localStorage.setItem("adminMode", "hr");
      localStorage.removeItem("workspaceUser");
    } catch {
      // ignore
    }
  }, []);

  // Force dark for HR — only the admin section exposes the toggle.
  // Without this, navigating from admin-light to /hr would inherit
  // the light class on documentElement and break the design.
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const Background = (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-amber-500/10 blur-[90px]" />
      <div className="absolute -bottom-56 -left-56 w-[620px] h-[620px] rounded-full bg-sky-500/10 blur-[110px]" />
    </div>
  );

  // Force dark styling for HR (design request — only the admin
  // section exposes a light-mode toggle).
  return (
    <div className={`dark min-h-[100svh] ${ws.appBg}`} dir="rtl">
      {Background}
      <div className="relative">{children}</div>
    </div>
  );
}
