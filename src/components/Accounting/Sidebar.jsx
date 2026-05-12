"use client";

import React from "react";
import {
  Calculator,
  LogOut,
  Wallet,
  LayoutDashboard,
  Leaf,
  ClipboardList,
  Banknote,
  Receipt,
} from "lucide-react";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import AppSectionSwitcher from "@/components/AppSectionSwitcher";

const BRAND_LOGO_URL =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/resize/80x80/-/format/png/";

function initials(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return "Q";
  const parts = cleaned.split(" ").filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  const raw = `${first}${second}`.trim();
  return raw ? raw.toUpperCase() : "Q";
}

export default function AccountingSidebar({ active = "dashboard" }) {
  const { user } = useWorkspaceUser();

  const logout = () => {
    try {
      localStorage.removeItem("workspaceUser");
      const adminAuth = localStorage.getItem("adminAuth");
      if (adminAuth) {
        localStorage.setItem("adminMode", "inventory");
        window.location.href = "/admin";
        return;
      }
    } catch {
      // ignore
    }

    window.location.href = "/";
  };

  const navItems = [
    {
      key: "dashboard",
      href: "/accounting",
      label: "لوحة المحاسبة",
      Icon: LayoutDashboard,
    },
    {
      key: "green-bean",
      href: "/accounting/green-bean-calculator",
      label: "حاسبة البن الأخضر",
      Icon: Leaf,
    },
    {
      key: "green-bean-orders",
      href: "/accounting/green-bean-orders",
      label: "توريد البن الأخضر",
      Icon: ClipboardList,
    },
    {
      key: "shift-close",
      href: "/accounting/shift-close",
      label: "تقفيلة الشفت",
      Icon: Calculator,
    },
    {
      key: "cash-calculator",
      href: "/accounting/cash-calculator",
      label: "حاسبة الكاش",
      Icon: Banknote,
    },
    {
      key: "payroll",
      href: "/accounting/payroll",
      label: "مسير الرواتب",
      Icon: Wallet,
    },
    {
      key: "expenses",
      href: "/accounting/expenses",
      label: "المصروفات",
      Icon: Receipt,
    },
  ];

  const mobileGridClass =
    navItems.length <= 3
      ? `grid-cols-${navItems.length}`
      : navItems.length <= 4
        ? "grid-cols-4"
        : navItems.length <= 6
          ? "grid-cols-3"
          : "grid-cols-4";

  const bottomSafeAreaStyle = {
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
  };

  const userName = user?.name || "";
  const userRole = user?.role || "";
  const avatarText = initials(userName);

  const shellClass = `${ws.glass}`;

  const pillBase =
    "rounded-2xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25";

  return (
    <>
      {/* Mobile top bar — carries the cross-section switcher so users on
          phones can jump between Workspace / Inventory / Accounting / HR. */}
      <div
        className={`lg:hidden fixed top-0 left-0 right-0 z-40 ${ws.glass} border-b border-white/10`}
        dir="rtl"
      >
        <div className="px-3 py-2 flex justify-start">
          <AppSectionSwitcher
            active="accounting"
            className="scale-95 origin-right"
          />
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed right-0 top-0 h-screen w-72 ${shellClass} border-l border-white/10`}
        dir="rtl"
      >
        <div className="flex flex-col w-full">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
                <img
                  src={BRAND_LOGO_URL}
                  alt="Logo"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white truncate tracking-tight">
                  المحاسبة
                </div>
                <div className="text-xs text-white/55 truncate">
                  أنظمة Quarters
                </div>
              </div>
            </div>

            {/* NEW: small switcher between main sections (doesn't take much space) */}
            <div className="mt-4">
              <AppSectionSwitcher active="accounting" />
            </div>

            {userName ? (
              <div className={`mt-5 ${ws.glassSoft} ${ws.card} p-3`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
                    {avatarText}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate tracking-tight">
                      {userName}
                    </div>
                    <div className="text-xs text-white/55 truncate">
                      {userRole || "موظف"}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <nav className="p-4 space-y-2 flex-1">
            {navItems.map(({ key, href, label, Icon }) => {
              const isActive = active === key;

              const itemClass = isActive
                ? "bg-white/10 text-white border-white/20"
                : "bg-white/[0.02] text-white/75 border-white/10 hover:bg-white/[0.06]";

              const iconClass = isActive ? "text-emerald-200" : "text-white/70";

              return (
                <a
                  key={key}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3 ${pillBase} ${itemClass}`}
                >
                  <div className="w-9 h-9 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
                    <Icon className={`w-5 h-5 ${iconClass}`} />
                  </div>
                  <span className="font-semibold">{label}</span>
                </a>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              type="button"
              onClick={logout}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl ${ws.btnNeutral}`}
            >
              <LogOut className="w-5 h-5" />
              خروج
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className={`lg:hidden fixed left-0 right-0 bottom-0 z-40 ${shellClass} border-t border-white/10`}
        dir="rtl"
        style={bottomSafeAreaStyle}
      >
        <div className={`px-3 pt-2 grid ${mobileGridClass} gap-2`}>
          {navItems.map(({ key, href, label, Icon }) => {
            const isActive = active === key;

            const itemClass = isActive
              ? "bg-white/10 text-white border-white/20"
              : "bg-white/[0.03] text-white/70 border-white/10";

            const iconClass = isActive ? "text-emerald-200" : "text-white/70";

            return (
              <a
                key={key}
                href={href}
                className={`flex flex-col items-center justify-center gap-1 py-2 ${pillBase} ${itemClass}`}
              >
                <Icon className={`w-5 h-5 ${iconClass}`} />
                <span className="text-xs font-semibold">{label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
}
