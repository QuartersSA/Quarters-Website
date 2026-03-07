"use client";

import React from "react";
import {
  Home,
  Inbox,
  CheckSquare,
  FileText,
  Users,
  LogOut,
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

export default function WorkspaceSidebar({ active = "inbox" }) {
  const { user } = useWorkspaceUser();

  const logout = () => {
    try {
      localStorage.removeItem("workspaceUser");
      // If admin is logged in, go back to admin dashboard.
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
    { key: "home", href: "/workspace", label: "الرئيسية", Icon: Home },
    { key: "inbox", href: "/workspace/inbox", label: "الوارد", Icon: Inbox },
    {
      key: "tasks",
      href: "/workspace/tasks",
      label: "المهام",
      Icon: CheckSquare,
    },
    {
      key: "templates",
      href: "/workspace/templates",
      label: "قوالب",
      Icon: FileText,
    },
    { key: "team", href: "/workspace/team", label: "الفريق", Icon: Users },
  ];

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
                  مساحة العمل
                </div>
                <div className="text-xs text-white/55 truncate">
                  أنظمة Quarters
                </div>
              </div>
            </div>

            {/* NEW: small switcher between main sections */}
            <div className="mt-4">
              <AppSectionSwitcher active="workspace" />
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
        <div className="px-3 pt-2 grid grid-cols-5 gap-1">
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
