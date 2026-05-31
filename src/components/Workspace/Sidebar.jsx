"use client";

import { useMemo } from "react";
import {
  Home,
  Inbox,
  CheckSquare,
  FileText,
  Users,
} from "lucide-react";
import { SidebarShell } from "@/components/Sidebar/SidebarShell";

const PAGE_TITLES = {
  home: "الرئيسية",
  inbox: "الوارد",
  tasks: "المهام",
  templates: "قوالب",
  team: "الفريق",
};

const NAV_CONFIG = [
  { kind: "row", key: "home", href: "/workspace", icon: Home, label: "الرئيسية" },
  { kind: "row", key: "inbox", href: "/workspace/inbox", icon: Inbox, label: "الوارد" },
  { kind: "row", key: "tasks", href: "/workspace/tasks", icon: CheckSquare, label: "المهام" },
  { kind: "row", key: "templates", href: "/workspace/templates", icon: FileText, label: "قوالب" },
  { kind: "row", key: "team", href: "/workspace/team", icon: Users, label: "الفريق" },
];

function defaultLogout() {
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
}

export default function WorkspaceSidebar({ active = "home" }) {
  const paletteRoutes = useMemo(
    () =>
      NAV_CONFIG.filter((e) => e.kind === "row").map((e) => ({
        href: e.href,
        label: e.label,
        icon: e.icon,
        keywords: e.label,
      })),
    [],
  );

  return (
    <SidebarShell
      section="workspace"
      brand={{ title: "مساحة العمل", subtitle: "أنظمة Quarters" }}
      navConfig={NAV_CONFIG}
      activeKey={active}
      pageTitleMap={PAGE_TITLES}
      paletteRoutes={paletteRoutes}
      onLogout={defaultLogout}
    />
  );
}
