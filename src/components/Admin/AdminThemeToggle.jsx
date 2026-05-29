"use client";

import { Sun, Moon } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import useAdminTheme from "@/hooks/useAdminTheme";

/**
 * Floating theme toggle pinned to the viewport's top-left corner.
 *
 * Lives at the admin layout level so it shows up on every admin
 * page (dashboard + items / branches / employees / operations /
 * receipts / variance / etc.) without each page having to wire its
 * own toggle. Same hook drives the Sidebar button + the admin login
 * floating button, so the choice stays in sync wherever the operator
 * triggers it from.
 */
export default function AdminThemeToggle() {
  const { isDark, toggleTheme } = useAdminTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${ws.iconButton} fixed top-4 left-4 z-[60] w-10 h-10 shadow-lg`}
      title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
      aria-label={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
