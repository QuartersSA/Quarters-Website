"use client";

import { useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Wallet,
  Clock,
} from "lucide-react";
import { SidebarShell } from "@/components/Sidebar/SidebarShell";

const PAGE_TITLES = {
  dashboard: "لوحة HR",
  employees: "الموظفين",
  deductions: "الخصميات",
  overtime: "الأوفر تايم",
  payroll: "مسير الرواتب",
};

const FULL_NAV = [
  { kind: "row", key: "dashboard", href: "/hr", icon: LayoutDashboard, label: "لوحة HR" },
  { kind: "row", key: "employees", href: "/hr/employees", icon: Users, label: "الموظفين" },
  { kind: "row", key: "deductions", href: "/hr/deductions", icon: DollarSign, label: "الخصميات" },
  { kind: "row", key: "overtime", href: "/hr/overtime", icon: Clock, label: "الأوفر تايم" },
  { kind: "row", key: "payroll", href: "/hr/payroll", icon: Wallet, label: "مسير الرواتب" },
];

const DEDUCTIONS_ONLY_NAV = [
  { kind: "row", key: "deductions", href: "/hr/deductions", icon: DollarSign, label: "الخصميات" },
];

// Fallback logout for HR pages that render the sidebar without
// passing an `onLogout` (e.g. overtime, payroll). Without it the
// footer's "تسجيل الخروج" button got onClick={undefined} and did
// nothing. Mirrors useAdminAuth.logout — clears the admin session
// keys + token, then returns to the admin login.
function defaultHrLogout() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("adminAuth");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminMode");
    localStorage.removeItem("workspaceUser");
    localStorage.removeItem("adminToken");
  } catch {
    // ignore storage failures — still redirect below
  }
  window.location.href = "/admin/login";
}

function readHasFullHr() {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem("adminUser");
    if (!raw) return true;
    const u = JSON.parse(raw);
    if (u?.can_access_hr === undefined || u?.can_access_hr === null) {
      return !!u?.can_manage_employees;
    }
    return !!u?.can_access_hr;
  } catch {
    return true;
  }
}

export default function HRSidebar({ onLogout, active = "dashboard" }) {
  const hasFullHr = readHasFullHr();
  const navConfig = hasFullHr ? FULL_NAV : DEDUCTIONS_ONLY_NAV;

  const paletteRoutes = useMemo(
    () =>
      navConfig
        .filter((e) => e.kind === "row")
        .map((e) => ({
          href: e.href,
          label: e.label,
          icon: e.icon,
          keywords: e.label,
        })),
    [navConfig],
  );

  return (
    <SidebarShell
      section="hr"
      brand={{ title: "HR", subtitle: "أنظمة Quarters" }}
      navConfig={navConfig}
      activeKey={active}
      pageTitleMap={PAGE_TITLES}
      paletteRoutes={paletteRoutes}
      onLogout={onLogout || defaultHrLogout}
    />
  );
}
