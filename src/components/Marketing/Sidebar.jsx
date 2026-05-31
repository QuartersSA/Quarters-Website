"use client";

import { useMemo } from "react";
import {
  Users as UsersIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import { SidebarShell } from "@/components/Sidebar/SidebarShell";

const PAGE_TITLES = {
  bloggers: "البلوقرز",
  menu: "منيو الضيافة",
  settings: "إعدادات",
};

const NAV_CONFIG = [
  { kind: "row", key: "bloggers", href: "/marketing/bloggers", icon: UsersIcon, label: "البلوقرز" },
  { kind: "row", key: "menu", href: "/marketing/menu", icon: MenuIcon, label: "منيو الضيافة" },
  { kind: "row", key: "settings", href: "/marketing/settings", icon: SettingsIcon, label: "إعدادات" },
];

export default function MarketingSidebar({ onLogout, active = "bloggers" }) {
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
      section="marketing"
      brand={{ title: "التسويق", subtitle: "أنظمة Quarters" }}
      navConfig={NAV_CONFIG}
      activeKey={active}
      pageTitleMap={PAGE_TITLES}
      paletteRoutes={paletteRoutes}
      onLogout={onLogout}
    />
  );
}
