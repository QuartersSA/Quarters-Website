import { useState, useMemo } from "react";
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  ClipboardList,
  LogOut,
  FileText,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Menu,
  X,
  BarChart3,
  Truck,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import AppSectionSwitcher from "@/components/AppSectionSwitcher";

export function Sidebar({ onLogout, activePage = "dashboard" }) {
  const [isInventorySummaryOpen, setIsInventorySummaryOpen] = useState(
    activePage === "low-stock" ||
      activePage === "items-summary" ||
      activePage === "variance",
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Sidebar mounts on every admin page navigation (it's rendered per-page,
  // not in the layout). Previously this used useState(true) + useEffect to
  // hydrate `canManageEmployees` from localStorage, which causes two
  // renders per mount and runs localStorage.getItem + JSON.parse every
  // time. Lazy `useState` initializer collapses it to a single render and
  // a single read.
  const [canManageEmployees] = useState(() => {
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
  });

  const pageTitle = useMemo(() => {
    const titles = {
      dashboard: "لوحة التحكم",
      branches: "الفروع",
      items: "الأصناف",
      operations: "عمليات المخزون",
      employees: "الموظفين",
      "low-stock": "منخفض الكمية",
      "items-summary": "ملخص الأصناف",
      variance: "تقرير الانحراف",
      receipts: "الواردات",
    };

    return titles[activePage] || "أنظمة Quarters";
  }, [activePage]);

  return (
    <>
      {/* Mobile top bar — sticky (in flow) so page content naturally renders
          below it instead of hiding under a fixed overlay. Layout matches
          the design across all admin sections: hamburger | logo+title | switcher */}
      <div
        className={`lg:hidden sticky top-0 left-0 right-0 z-40 ${ws.topBar}`}
        dir="rtl"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`${ws.iconButton}`}
            aria-label={isMobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <AppSectionSwitcher
            active="inventory"
            className="scale-90 origin-left"
          />

          <div className="flex items-center gap-2 min-w-0">
            <div className="text-white text-sm font-bold tracking-tight whitespace-nowrap">
              {pageTitle}
            </div>
            <img
              src="https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/"
              alt="Quarters"
              className="h-8 w-auto bg-white rounded-xl p-1 shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed right-0 top-0 h-[100svh] w-72 lg:w-72 p-6 overflow-y-auto z-50 transition-transform duration-300 ${ws.glass} ${ws.card} rounded-l-[28px] lg:rounded-none border-l border-white/10 ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "translate-x-full lg:translate-x-0"
        }`}
        dir="rtl"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <img
            src="https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/"
            alt="Quarters Coffee Bar"
            className="h-16 w-auto mx-auto bg-white rounded-2xl p-2 mb-3"
          />
          <h1 className="text-white font-bold text-lg tracking-tight">
            لوحة الإدارة
          </h1>
          <p className="text-white/55 text-xs">أنظمة Quarters</p>

          {/* Section switcher (Workspace / الجرد / المحاسبة) */}
          <div className="mt-4 flex justify-center">
            <AppSectionSwitcher active="inventory" className="scale-95" />
          </div>
        </div>

        <nav className="space-y-2">
          <a
            href="/admin"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors border ${
              activePage === "dashboard"
                ? "bg-white/10 text-white border-white/20"
                : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className={activePage === "dashboard" ? "font-semibold" : ""}>
              لوحة التحكم
            </span>
          </a>

          <a
            href="/admin/branches"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors border ${
              activePage === "branches"
                ? "bg-white/10 text-white border-white/20"
                : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span className={activePage === "branches" ? "font-semibold" : ""}>
              الفروع
            </span>
          </a>

          <a
            href="/admin/items"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors border ${
              activePage === "items"
                ? "bg-white/10 text-white border-white/20"
                : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
            }`}
          >
            <Package className="w-5 h-5" />
            <span className={activePage === "items" ? "font-semibold" : ""}>
              إدارة الأصناف
            </span>
          </a>

          <a
            href="/admin/operations"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors border ${
              activePage === "operations"
                ? "bg-white/10 text-white border-white/20"
                : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span
              className={activePage === "operations" ? "font-semibold" : ""}
            >
              عمليات المخزون
            </span>
          </a>

          <a
            href="/admin/receipts"
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors border ${
              activePage === "receipts"
                ? "bg-white/10 text-white border-white/20"
                : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
            }`}
          >
            <Truck className="w-5 h-5" />
            <span className={activePage === "receipts" ? "font-semibold" : ""}>
              الواردات
            </span>
          </a>

          <div>
            <button
              onClick={() => setIsInventorySummaryOpen(!isInventorySummaryOpen)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-white/70 hover:text-white hover:bg-white/[0.06] rounded-2xl transition-colors border border-transparent"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" />
                <span>ملخص جرد الأصناف</span>
              </div>
              {isInventorySummaryOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isInventorySummaryOpen && (
              <div className="mr-4 mt-2 space-y-1 border-r border-white/10 pr-3">
                <a
                  href="/admin/low-stock"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-2xl transition-colors text-sm border ${
                    activePage === "low-stock"
                      ? "bg-white/10 text-white border-white/20"
                      : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  <span
                    className={
                      activePage === "low-stock" ? "font-semibold" : ""
                    }
                  >
                    الأصناف منخفضة الكمية
                  </span>
                </a>

                <a
                  href="/admin/items-summary"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-2xl transition-colors text-sm border ${
                    activePage === "items-summary"
                      ? "bg-white/10 text-white border-white/20"
                      : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span
                    className={
                      activePage === "items-summary" ? "font-semibold" : ""
                    }
                  >
                    ملخص الأصناف
                  </span>
                </a>

                <a
                  href="/admin/variance"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-2xl transition-colors text-sm border ${
                    activePage === "variance"
                      ? "bg-white/10 text-white border-white/20"
                      : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span
                    className={
                      activePage === "variance" ? "font-semibold" : ""
                    }
                  >
                    تقرير الانحراف
                  </span>
                </a>
              </div>
            )}
          </div>

          {canManageEmployees ? (
            <a
              href="/admin/employees"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors border ${
                activePage === "employees"
                  ? "bg-white/10 text-white border-white/20"
                  : "text-white/70 hover:text-white hover:bg-white/[0.06] border-transparent"
              }`}
            >
              <Users className="w-5 h-5" />
              <span
                className={activePage === "employees" ? "font-semibold" : ""}
              >
                الموظفين
              </span>
            </a>
          ) : null}
        </nav>

        <button
          onClick={onLogout}
          className={`mt-8 w-full flex items-center justify-center gap-2 px-4 py-3 ${ws.btnDanger}`}
        >
          <LogOut className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </aside>

      {/* Spacer for mobile topbar so content doesn't sit behind it */}
      <div className="lg:hidden h-[64px]" />
    </>
  );
}
