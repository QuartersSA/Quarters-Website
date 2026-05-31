"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  ClipboardList,
  LogOut,
  FileText,
  ChevronLeft,
  TrendingDown,
  Menu,
  X,
  BarChart3,
  Truck,
  Banknote,
  Search,
  Globe,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import AppSectionSwitcher from "@/components/AppSectionSwitcher";
import { CommandPalette } from "./CommandPalette";

/**
 * Admin sidebar — Wafeq-inspired layout.
 *
 * Expanded (default):
 *   ┌─────────────────────────────┐
 *   │ [⇥]  Quarters Coffee Bar   │  collapse toggle + brand chip
 *   │ [section switcher (icons)] │  jump to Workspace/Accounting/HR/…
 *   │ [🔍 search…]      Ctrl+K   │  opens CommandPalette
 *   │ ─────────────────────────── │
 *   │ • Dashboard                 │  nav rows (active = brand-50 tint)
 *   │ • Branches                  │
 *   │ • …                         │
 *   │ ▾ ملخص جرد الأصناف           │  flyout group
 *   │ • Employees                 │
 *   │ ─────────────────────────── │
 *   │ 🌐 English                   │  language toggle
 *   │ 🚪 تسجيل الخروج               │  logout
 *   └─────────────────────────────┘
 *
 * Collapsed (Ctrl+B or the panel-toggle button):
 *   The aside shrinks to w-16, every row turns icon-only, the brand
 *   chip drops the label, the search button becomes a single icon, the
 *   section switcher hides, and the bottom row shows "En" + a logout
 *   icon. Page <main> elements that opt in (lg:mr-72) re-sync via
 *   `body[data-admin-sidebar="collapsed"]` → margin-right: 4rem.
 *
 * Active state mirrors Wafeq's accent (bg-brand-50 / text-brand-700)
 * in light mode; dark mode uses a neutral white-on-translucent tint.
 */

const QUARTERS_LOGO =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/";

// localStorage key + custom event name kept here so the matching
// listener in CommandPalette / future components can import them too
// if needed. Inlined as constants because the surface is tiny.
const COLLAPSE_KEY = "adminSidebarCollapsed";
const COLLAPSE_EVENT = "adminSidebarCollapseChange";

function NavRow({
  href,
  icon: Icon,
  label,
  active,
  level = 0,
  collapsed = false,
  onClick,
}) {
  const baseSize = collapsed
    ? "px-0 py-2.5 justify-center"
    : level === 0
      ? "px-3 py-2.5"
      : "px-3 py-2 mr-3 text-sm";
  const iconSize = level === 0 ? "w-5 h-5" : "w-4 h-4";

  const activeCls =
    "bg-brand-50 text-brand-700 dark:bg-white/10 dark:text-white";
  const inactiveCls =
    "text-slate-700 hover:bg-slate-100 hover:text-slate-900 " +
    "dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white";

  return (
    <a
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`flex items-center gap-3 ${baseSize} rounded-xl transition-colors ${
        active ? activeCls : inactiveCls
      }`}
    >
      <Icon
        className={`shrink-0 ${iconSize} ${
          active ? "text-brand-600 dark:text-white" : ""
        }`}
      />
      {collapsed ? null : (
        <span className={`flex-1 ${active ? "font-semibold" : ""}`}>
          {label}
        </span>
      )}
    </a>
  );
}

/**
 * Collapsible nav group rendered as a Wafeq-style flyout popover.
 *
 * Clicking the parent row positions a panel next to the sidebar (to the
 * LEFT in RTL, since the aside is pinned to the viewport's right edge)
 * containing the sub-items. The previous inline expand-in-place pattern
 * pushed everything below it downward and felt cramped at desktop
 * widths; the popover lets the eye scan the whole hierarchy at once.
 *
 * When the parent sidebar is collapsed (icon-only mode), the trigger
 * is icon-only too and the popover anchors right next to the icon.
 */
function NavGroup({ icon: Icon, label, items, closeMobile, collapsed = false }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  const groupActive = items.some((it) => it.active);

  // Track viewport size so we switch between flyout (desktop) and
  // inline expansion (mobile/tablet) without remounting.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const computePos = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // Sidebar pinned right; flyout sits to the LEFT of its left edge.
    const right = window.innerWidth - rect.left + 8;
    return {
      top: Math.max(8, rect.top),
      right: Math.max(8, right),
    };
  }, []);

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    if (isDesktop) {
      setPos(computePos());
    }
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !isDesktop) return;
    function reposition() {
      const next = computePos();
      if (next) setPos(next);
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, isDesktop, computePos]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (buttonRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerCls = groupActive
    ? "bg-brand-50 text-brand-700 dark:bg-white/10 dark:text-white"
    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white";

  const triggerSize = collapsed
    ? "px-0 py-2.5 justify-center"
    : "px-3 py-2.5";

  const chevronOpenCls = open ? "rotate-90" : "";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        className={`w-full flex items-center gap-3 ${
          collapsed ? "" : "justify-between"
        } ${triggerSize} rounded-xl transition-colors ${triggerCls}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className={`flex items-center gap-3 ${collapsed ? "" : ""}`}>
          <Icon
            className={`w-5 h-5 shrink-0 ${
              groupActive ? "text-brand-600 dark:text-white" : ""
            }`}
          />
          {collapsed ? null : (
            <span className={groupActive ? "font-semibold" : ""}>{label}</span>
          )}
        </div>
        {collapsed ? null : (
          <ChevronLeft
            className={`w-4 h-4 text-slate-400 dark:text-white/40 transition-transform ${chevronOpenCls}`}
          />
        )}
      </button>

      {/* Desktop: portal-rendered flyout next to the row. */}
      {open && isDesktop && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="menu"
              dir="rtl"
              className="fixed z-[60] w-64 bg-white dark:bg-[#0f1a35] border border-slate-200 dark:border-white/10 rounded-2xl shadow-[0_8px_24px_-4px_rgba(15,23,42,0.15),0_32px_72px_-16px_rgba(15,23,42,0.22)] dark:shadow-[0_20px_70px_rgba(0,0,0,0.55)] py-2"
              style={{ top: pos.top, right: pos.right }}
            >
              <div className="px-4 pb-2 mb-1 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/55 font-semibold">
                  {label}
                </div>
              </div>
              <div className="px-2 py-1 space-y-0.5">
                {items.map((it) => {
                  const ChildIcon = it.icon;
                  const itemCls = it.active
                    ? "bg-brand-50 text-brand-700 dark:bg-white/10 dark:text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white";
                  return (
                    <a
                      key={it.href}
                      href={it.href}
                      onClick={() => {
                        closeMobile?.();
                        setOpen(false);
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${itemCls}`}
                    >
                      <ChildIcon
                        className={`w-4 h-4 shrink-0 ${
                          it.active
                            ? "text-brand-600 dark:text-white"
                            : "text-slate-500 dark:text-white/55"
                        }`}
                      />
                      <span
                        className={`flex-1 ${it.active ? "font-semibold" : ""}`}
                      >
                        {it.label}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}

      {/* Mobile / tablet fallback: inline expansion under the trigger. */}
      {open && !isDesktop ? (
        <div className="mt-1 space-y-0.5 border-r border-slate-200 dark:border-white/10 mr-5 pr-1">
          {items.map((it) => {
            const ChildIcon = it.icon;
            const itemCls = it.active
              ? "bg-brand-50 text-brand-700 dark:bg-white/10 dark:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white";
            return (
              <a
                key={it.href}
                href={it.href}
                onClick={() => {
                  closeMobile?.();
                  setOpen(false);
                }}
                className={`flex items-center gap-3 px-3 py-2 mr-3 rounded-xl text-sm transition-colors ${itemCls}`}
              >
                <ChildIcon
                  className={`w-4 h-4 shrink-0 ${
                    it.active
                      ? "text-brand-600 dark:text-white"
                      : "text-slate-500 dark:text-white/55"
                  }`}
                />
                <span className={`flex-1 ${it.active ? "font-semibold" : ""}`}>
                  {it.label}
                </span>
              </a>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function readAdminUserFlags() {
  if (typeof window === "undefined") {
    return { canManageEmployees: true };
  }
  try {
    const auth = localStorage.getItem("adminAuth");
    const raw = localStorage.getItem("adminUser");
    if (!auth || !raw) return { canManageEmployees: true };
    const u = JSON.parse(raw);
    const flag = u?.can_manage_employees;
    return {
      canManageEmployees:
        flag === undefined || flag === null ? true : !!flag,
    };
  } catch {
    return { canManageEmployees: true };
  }
}

function readLang() {
  if (typeof window === "undefined") return "ar";
  try {
    return localStorage.getItem("adminLang") || "ar";
  } catch {
    return "ar";
  }
}

function readCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar({ onLogout, activePage = "dashboard" }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  // Lazy-init both reads — runs once at mount instead of triggering a
  // post-mount re-render via useEffect.
  const [{ canManageEmployees }] = useState(readAdminUserFlags);
  const [lang] = useState(readLang);

  const closeMobile = useCallback(() => setIsMobileMenuOpen(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Persist collapse state + reflect to <body> so admin pages whose
  // <main> opts in (lg:mr-72) can re-sync via the CSS rule injected
  // below. Also fires a custom event in case other components want
  // to react without polling localStorage.
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, isCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") {
      document.body.dataset.adminSidebar = isCollapsed
        ? "collapsed"
        : "expanded";
    }
    try {
      window.dispatchEvent(
        new CustomEvent(COLLAPSE_EVENT, { detail: isCollapsed }),
      );
    } catch {
      // ignore
    }
  }, [isCollapsed]);

  // Global Cmd/Ctrl+K → toggle palette. Mounted at sidebar level so
  // every admin page picks it up automatically.
  // Cmd/Ctrl+B → toggle sidebar collapse (matches VSCode + Wafeq).
  useEffect(() => {
    function onKey(e) {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && k === "b") {
        e.preventDefault();
        setIsCollapsed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleLang = useCallback(() => {
    try {
      const next = lang === "ar" ? "en" : "ar";
      localStorage.setItem("adminLang", next);
      window.dispatchEvent(
        new CustomEvent("adminLangChange", { detail: next }),
      );
      window.location.reload();
    } catch {
      // ignore
    }
  }, [lang]);

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
      "stock-value": "قيمة المخزون",
    };
    return titles[activePage] || "أنظمة Quarters";
  }, [activePage]);

  const asideWidth = isCollapsed ? "lg:w-16" : "lg:w-72";
  const navPadX = isCollapsed ? "px-2" : "px-3";
  const footerPadX = isCollapsed ? "p-2" : "p-3";

  return (
    <>
      {/* Page-margin sync: admin pages set `lg:mr-72` on <main>; when the
          sidebar collapses we override that to `mr-16` via a body data
          attribute. Stays scoped to lg+ so the mobile slide-out drawer
          isn't touched. */}
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            @media (min-width: 1024px) {
              body[data-admin-sidebar] main {
                transition: margin-right 200ms ease;
              }
              body[data-admin-sidebar="collapsed"] main.lg\\:mr-72,
              body[data-admin-sidebar="collapsed"] main[class*="lg:mr-72"] {
                margin-right: 4rem !important;
              }
            }
          `,
        }}
      />

      {/* Mobile top bar */}
      <div
        className="lg:hidden sticky top-0 left-0 right-0 z-40 bg-white/85 supports-[backdrop-filter]:bg-white/70 dark:bg-[#132044]/70 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10"
        dir="rtl"
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-white/[0.03] dark:text-white dark:border-white/10 dark:hover:bg-white/[0.06] transition-colors"
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
            <div className="text-slate-900 dark:text-white text-sm font-bold tracking-tight whitespace-nowrap">
              {pageTitle}
            </div>
            <img
              src={QUARTERS_LOGO}
              alt="Quarters"
              className="h-8 w-auto bg-white rounded-xl p-1 shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-40"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed right-0 top-0 h-[100svh] w-72 ${asideWidth} z-50 flex flex-col bg-white border-l border-slate-200 dark:bg-[#0f1a35] dark:border-white/10 transition-[transform,width] duration-300 ease-out ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "translate-x-full lg:translate-x-0"
        }`}
        dir="rtl"
      >
        {/* Top zone: collapse toggle + brand chip */}
        <div
          className={`pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.06] ${
            isCollapsed ? "px-2" : "px-5"
          }`}
        >
          {/* Collapse toggle — desktop only */}
          <div
            className={`hidden lg:flex ${isCollapsed ? "justify-center" : "justify-end"} mb-3`}
          >
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              title={isCollapsed ? "توسيع القائمة (Ctrl+B)" : "تصغير القائمة (Ctrl+B)"}
              aria-label={isCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/55 dark:hover:text-white transition-colors"
            >
              {isCollapsed ? (
                <PanelRightOpen className="w-5 h-5" />
              ) : (
                <PanelRightClose className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Brand chip */}
          <div
            className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}
          >
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 dark:bg-white dark:border-white/30 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={QUARTERS_LOGO}
                alt="Quarters"
                className="w-8 h-8 object-contain"
              />
            </div>
            {isCollapsed ? null : (
              <div className="min-w-0">
                <div className="text-slate-900 dark:text-white font-bold text-sm tracking-tight truncate">
                  Quarters Coffee Bar
                </div>
                <div className="text-slate-500 dark:text-white/55 text-xs truncate">
                  لوحة الإدارة
                </div>
              </div>
            )}
          </div>

          {/* Section switcher (Workspace / Inventory / Accounting / HR / Marketing) */}
          {isCollapsed ? null : (
            <div className="mt-4 flex justify-center">
              <AppSectionSwitcher active="inventory" className="scale-95" />
            </div>
          )}

          {/* Command-palette trigger */}
          {isCollapsed ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={openPalette}
                title="بحث (Ctrl+K)"
                aria-label="بحث (Ctrl+K)"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:border-white/10 dark:text-white/60 transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPalette}
              className="mt-4 w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:border-white/10 dark:text-white/50 transition-colors"
              aria-label="بحث (Ctrl+K)"
            >
              <span className="flex items-center gap-2 text-sm">
                <Search className="w-4 h-4" />
                <span>الذهاب إلى صفحة…</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white border border-slate-200 text-slate-500 dark:bg-white/10 dark:border-white/10 dark:text-white/60">
                Ctrl + K
              </kbd>
            </button>
          )}
        </div>

        {/* Nav — scrollable middle zone */}
        <nav className={`flex-1 overflow-y-auto ${navPadX} py-4 space-y-0.5`}>
          <NavRow
            href="/admin"
            icon={LayoutDashboard}
            label="لوحة التحكم"
            active={activePage === "dashboard"}
            collapsed={isCollapsed}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/branches"
            icon={Building2}
            label="الفروع"
            active={activePage === "branches"}
            collapsed={isCollapsed}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/items"
            icon={Package}
            label="إدارة الأصناف"
            active={activePage === "items"}
            collapsed={isCollapsed}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/operations"
            icon={ClipboardList}
            label="عمليات المخزون"
            active={activePage === "operations"}
            collapsed={isCollapsed}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/receipts"
            icon={Truck}
            label="الواردات"
            active={activePage === "receipts"}
            collapsed={isCollapsed}
            onClick={closeMobile}
          />

          {/* ملخص جرد الأصناف — flyout popover on desktop, inline on mobile. */}
          <div className="pt-1">
            <NavGroup
              icon={FileText}
              label="ملخص جرد الأصناف"
              closeMobile={closeMobile}
              collapsed={isCollapsed}
              items={[
                {
                  href: "/admin/low-stock",
                  icon: TrendingDown,
                  label: "الأصناف منخفضة الكمية",
                  active: activePage === "low-stock",
                },
                {
                  href: "/admin/items-summary",
                  icon: FileText,
                  label: "ملخص الأصناف",
                  active: activePage === "items-summary",
                },
                {
                  href: "/admin/variance",
                  icon: BarChart3,
                  label: "تقرير الانحراف",
                  active: activePage === "variance",
                },
                {
                  href: "/admin/stock-value",
                  icon: Banknote,
                  label: "قيمة المخزون",
                  active: activePage === "stock-value",
                },
              ]}
            />
          </div>

          {canManageEmployees ? (
            <NavRow
              href="/admin/employees"
              icon={Users}
              label="الموظفين"
              active={activePage === "employees"}
              collapsed={isCollapsed}
              onClick={closeMobile}
            />
          ) : null}
        </nav>

        {/* Footer — language toggle + logout */}
        <div
          className={`border-t border-slate-100 dark:border-white/[0.06] ${footerPadX} space-y-1`}
        >
          <button
            type="button"
            onClick={toggleLang}
            title={lang === "ar" ? "English" : "العربية"}
            aria-label="تبديل اللغة"
            className={`w-full flex items-center gap-3 ${
              isCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
            } rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white transition-colors`}
          >
            {isCollapsed ? (
              <span className="text-xs font-semibold tracking-wide">
                {lang === "ar" ? "En" : "ع"}
              </span>
            ) : (
              <>
                <Globe className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-sm font-medium">
                  {lang === "ar" ? "English" : "العربية"}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className={`w-full flex items-center gap-3 ${
              isCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
            } rounded-xl text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 transition-colors`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isCollapsed ? null : (
              <span className="flex-1 text-sm font-semibold text-right">
                تسجيل الخروج
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Spacer so page content sits below the mobile top bar */}
      <div className="lg:hidden h-[64px]" />

      {/* Global command palette */}
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </>
  );
}
