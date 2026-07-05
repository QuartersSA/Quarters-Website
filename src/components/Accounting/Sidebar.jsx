"use client";

import { useMemo } from "react";
import {
  Calculator,
  Wallet,
  LayoutDashboard,
  Leaf,
  ClipboardList,
  Banknote,
  Receipt,
  HandCoins,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { SidebarShell } from "@/components/Sidebar/SidebarShell";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";

const PAGE_TITLES = {
  dashboard: "لوحة المحاسبة",
  "green-bean": "حاسبة البن الأخضر",
  "green-bean-orders": "توريد البن الأخضر",
  "shift-close": "تقفيلة الشفت",
  "cash-calculator": "حاسبة الكاش",
  payroll: "مسير الرواتب",
  loans: "السلف والقروض",
  expenses: "المصروفات",
  purchases: "المشتريات",
  waste: "الهدر",
};

const NAV_CONFIG = [
  { kind: "row", key: "dashboard", href: "/accounting", icon: LayoutDashboard, label: "لوحة المحاسبة" },
  { kind: "row", key: "green-bean", href: "/accounting/green-bean-calculator", icon: Leaf, label: "حاسبة البن الأخضر" },
  { kind: "row", key: "green-bean-orders", href: "/accounting/green-bean-orders", icon: ClipboardList, label: "توريد البن الأخضر" },
  { kind: "row", key: "shift-close", href: "/accounting/shift-close", icon: Calculator, label: "تقفيلة الشفت" },
  { kind: "row", key: "cash-calculator", href: "/accounting/cash-calculator", icon: Banknote, label: "حاسبة الكاش" },
  { kind: "row", key: "payroll", href: "/accounting/payroll", icon: Wallet, label: "مسير الرواتب" },
  { kind: "row", key: "loans", href: "/accounting/loans", icon: HandCoins, label: "السلف والقروض" },
  { kind: "row", key: "expenses", href: "/accounting/expenses", icon: Receipt, label: "المصروفات" },
  { kind: "row", key: "purchases", href: "/accounting/purchases", icon: ShoppingCart, label: "المشتريات" },
  { kind: "row", key: "waste", href: "/accounting/waste", icon: Trash2, label: "الهدر" },
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

export default function AccountingSidebar({ active = "dashboard" }) {
  const { user } = useWorkspaceUser();

  // قسم المشتريات فقط: بدون can_manage_accounting الشريط يعرض
  // المشتريات وحدها — بقية الصفحات محجوبة أصلاً في طبقة المحاسبة.
  const navConfig = useMemo(() => {
    const purchasesOnly =
      user?.role === "Admin" &&
      user?.can_manage_accounting === false &&
      !!user?.can_manage_purchases;
    if (!purchasesOnly) return NAV_CONFIG;
    return NAV_CONFIG.filter((entry) => entry.key === "purchases");
  }, [user]);

  const paletteRoutes = useMemo(
    () =>
      navConfig.filter((e) => e.kind === "row").map((e) => ({
        href: e.href,
        label: e.label,
        icon: e.icon,
        keywords: e.label,
      })),
    [navConfig],
  );

  return (
    <SidebarShell
      section="accounting"
      brand={{ title: "المحاسبة", subtitle: "أنظمة Quarters" }}
      navConfig={navConfig}
      activeKey={active}
      pageTitleMap={PAGE_TITLES}
      paletteRoutes={paletteRoutes}
      onLogout={defaultLogout}
    />
  );
}
