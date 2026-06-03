"use client";

import { Sun, Moon } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import useAdminTheme from "@/hooks/useAdminTheme";

/**
 * Floating theme toggle — mobile only.
 *
 * Desktop hides it entirely (`lg:hidden`) because the sidebar
 * already exposes the same toggle, and an extra fixed button in
 * the top-left corner was redundant. Mobile keeps it because the
 * sidebar is a bottom-nav strip there and doesn't carry the
 * toggle text option.
 *
 * Same useAdminTheme hook drives every entry point (sidebar
 * button + this floating button + login), so the choice stays in
 * sync regardless of which surface fires the toggle.
 */
export default function AdminThemeToggle() {
  const { isDark, toggleTheme } = useAdminTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${ws.iconButton} fixed top-4 left-4 z-[60] w-10 h-10 shadow-lg lg:hidden`}
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
