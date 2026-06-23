"use client";

import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  ClipboardList,
  FileText,
  TrendingDown,
  BarChart3,
  Truck,
  Banknote,
} from "lucide-react";
import { SidebarShell } from "@/components/Sidebar/SidebarShell";
import { queryKeys } from "../../utils/queryKeys.js";

const PALETTE_ROUTES = [
  { href: "/admin", label: "لوحة التحكم", sub: "Dashboard", icon: LayoutDashboard, keywords: "dashboard home" },
  { href: "/admin/branches", label: "الفروع", sub: "Branches", icon: Building2, keywords: "branches" },
  { href: "/admin/items", label: "إدارة الأصناف", sub: "Items", icon: Package, keywords: "items products" },
  { href: "/admin/operations", label: "عمليات المخزون", sub: "Operations", icon: ClipboardList, keywords: "operations inventory" },
  { href: "/admin/receipts", label: "الواردات", sub: "Receipts", icon: Truck, keywords: "receipts purchases" },
  { href: "/admin/low-stock", label: "الأصناف منخفضة الكمية", sub: "Low stock", icon: TrendingDown, keywords: "low stock" },
  { href: "/admin/items-summary", label: "ملخص الأصناف", sub: "Items summary", icon: FileText, keywords: "summary" },
  { href: "/admin/variance", label: "تقرير الانحراف", sub: "Variance", icon: BarChart3, keywords: "variance" },
  { href: "/admin/stock-value", label: "قيمة المخزون", sub: "Stock value", icon: Banknote, keywords: "value worth" },
  { href: "/admin/employees", label: "الموظفين", sub: "Employees", icon: Users, keywords: "employees staff" },
];

const PALETTE_DATA_SOURCES = [
  {
    queryKey: queryKeys.branches(),
    url: "/api/branches",
    staleTime: 30 * 60 * 1000,
    kind: "branch",
    subLabel: "فرع",
    icon: Building2,
    hrefBase: "/admin/branches",
  },
  {
    queryKey: queryKeys.items(),
    url: "/api/items",
    staleTime: 5 * 60 * 1000,
    kind: "item",
    subLabel: "صنف",
    icon: Package,
    hrefBase: "/admin/items",
  },
];

const PAGE_TITLES = {
  dashboard: "لوحة التحكم",
  branches: "الفروع",
  items: "الأصناف",
  operations: "عمليات المخزون",
  employees: "الموظفين",
  "low-stock": "منخفض الكمية",
  "items-summary": "ملخص الأصناف",
  variance: "تقرير الانحراف",
  receipts: "الواردات",
  "stock-value": "قيمة المخزون",
};

function readCanManageEmployees() {
  if (typeof window === "undefined") return true;
  try {
    const auth = localStorage.getItem("adminAuth");
    const raw = localStorage.getItem("adminUser");
    if (!auth || !raw) return true;
    const u = JSON.parse(raw);
    const flag = u?.can_manage_employees;
    return flag === undefined || flag === null ? true : !!flag;
  } catch {
    return true;
  }
}

export function Sidebar({ onLogout, activePage = "dashboard" }) {
  const canManageEmployees = readCanManageEmployees();

  const navConfig = [
    { kind: "row", key: "dashboard", href: "/admin", icon: LayoutDashboard, label: "لوحة التحكم" },
    { kind: "row", key: "branches", href: "/admin/branches", icon: Building2, label: "الفروع" },
    { kind: "row", key: "items", href: "/admin/items", icon: Package, label: "إدارة الأصناف" },
    { kind: "row", key: "operations", href: "/admin/operations", icon: ClipboardList, label: "عمليات المخزون" },
    { kind: "row", key: "receipts", href: "/admin/receipts", icon: Truck, label: "الواردات" },
    {
      kind: "group",
      key: "items-summary-group",
      label: "ملخص جرد الأصناف",
      icon: FileText,
      items: [
        { href: "/admin/low-stock", icon: TrendingDown, label: "الأصناف منخفضة الكمية", activeKey: "low-stock" },
        { href: "/admin/items-summary", icon: FileText, label: "ملخص الأصناف", activeKey: "items-summary" },
        { href: "/admin/variance", icon: BarChart3, label: "تقرير الانحراف", activeKey: "variance" },
        { href: "/admin/stock-value", icon: Banknote, label: "قيمة المخزون", activeKey: "stock-value" },
      ],
    },
    ...(canManageEmployees
      ? [{ kind: "row", key: "employees", href: "/admin/employees", icon: Users, label: "الموظفين" }]
      : []),
  ];

  return (
    <SidebarShell
      section="inventory"
      brand={{ title: "Quarters Coffee Bar", subtitle: "لوحة الإدارة" }}
      navConfig={navConfig}
      activeKey={activePage}
      pageTitleMap={PAGE_TITLES}
      paletteRoutes={PALETTE_ROUTES}
      paletteDataSources={PALETTE_DATA_SOURCES}
      onLogout={onLogout}
    />
  );
}

export default Sidebar;
