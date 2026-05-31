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
} from "lucide-react";
import AppSectionSwitcher from "@/components/AppSectionSwitcher";
import { CommandPalette } from "./CommandPalette";

/**
 * Admin sidebar — Wafeq-inspired layout.
 *
 *   ┌─────────────────────────────┐
 *   │ [logo] Quarters Coffee Bar │  brand chip (static)
 *   │ [section switcher (icons)] │  jump to Workspace/Accounting/HR/…
 *   │ [🔍 search…]      Ctrl+K   │  opens CommandPalette
 *   │ ─────────────────────────── │
 *   │ • Dashboard                 │  nav rows (active = violet tint)
 *   │ • Branches                  │
 *   │ • Items                     │
 *   │ • Operations                │
 *   │ • Receipts                  │
 *   │ ▾ ملخص جرد الأصناف           │  collapsible group
 *   │     └ low stock              │
 *   │     └ items summary          │
 *   │     └ variance               │
 *   │     └ stock value            │
 *   │ • Employees (if allowed)    │
 *   │ ─────────────────────────── │
 *   │ 🌐 English                   │  language toggle
 *   │ 🚪 تسجيل الخروج               │  logout
 *   └─────────────────────────────┘
 *
 * Active state mirrors Wafeq's violet accent (bg-brand-50 / text-brand-700)
 * on a clean light surface. Dark-mode tokens kick in via the existing
 * `dark:` Tailwind class applied at the admin layout root.
 */

const QUARTERS_LOGO =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/";

function NavRow({
  href,
  icon: Icon,
  label,
  active,
  level = 0,
  onClick,
}) {
  const baseSize = level === 0 ? "px-3 py-2.5" : "px-3 py-2 mr-3 text-sm";
  const iconSize = level === 0 ? "w-5 h-5" : "w-4 h-4";

  const activeCls =
    "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100";
  const inactiveCls =
    "text-slate-700 hover:bg-slate-100 hover:text-slate-900 " +
    "dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white";

  return (
    <a
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 ${baseSize} rounded-xl transition-colors ${
        active ? activeCls : inactiveCls
      }`}
    >
      <Icon
        className={`shrink-0 ${iconSize} ${
          active ? "text-brand-600 dark:text-brand-200" : ""
        }`}
      />
      <span className={`flex-1 ${active ? "font-semibold" : ""}`}>{label}</span>
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
 * Behaviour:
 *   - Click parent → opens; sets `groupActive` styling if any child is current.
 *   - Click outside / Esc / scroll the underlying page → closes.
 *   - Position is recomputed on every open so the panel always anchors
 *     to the row even after the page scrolls or the sidebar reflows.
 *   - Falls back to inline expansion on viewports < lg (sidebar is a
 *     slide-out drawer there; a flyout would overflow the drawer width).
 */
function NavGroup({ icon: Icon, label, items, closeMobile }) {
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
  // inline expansion (mobile/tablet) without remounting the component.
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
    // Sidebar is fixed right (w-72 = 288px). The flyout sits in the
    // content area to the LEFT of the sidebar's left edge.
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

  // Re-anchor on scroll/resize so the popover sticks to its row.
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

  // Outside-click + Escape to close.
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
    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100"
    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white";

  const chevronOpenCls = open
    ? "rotate-90"
    : ""; // ChevronLeft points → ; rotate so it points down/up when open.

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors ${triggerCls}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="flex items-center gap-3">
          <Icon
            className={`w-5 h-5 shrink-0 ${
              groupActive ? "text-brand-600 dark:text-brand-200" : ""
            }`}
          />
          <span className={groupActive ? "font-semibold" : ""}>{label}</span>
        </div>
        <ChevronLeft
          className={`w-4 h-4 text-slate-400 dark:text-white/40 transition-transform ${chevronOpenCls}`}
        />
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
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100"
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
                            ? "text-brand-600 dark:text-brand-200"
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
              ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-100"
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
                      ? "text-brand-600 dark:text-brand-200"
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

export function Sidebar({ onLogout, activePage = "dashboard" }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Lazy-init both reads — runs once at mount instead of triggering a
  // post-mount re-render via useEffect.
  const [{ canManageEmployees }] = useState(readAdminUserFlags);
  const [lang] = useState(readLang);

  const closeMobile = useCallback(() => setIsMobileMenuOpen(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Global Cmd/Ctrl+K → open the palette. Mounted at sidebar level so
  // every admin page picks it up automatically.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // English / العربية toggle — flips a localStorage flag and reloads so
  // any consumer that reads `adminLang` on mount picks up the new value.
  // No-op visual change today (admin pages aren't translated yet), but
  // the storage key + custom event are in place for future i18n.
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

  return (
    <>
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
        className={`fixed right-0 top-0 h-[100svh] w-72 lg:w-72 z-50 flex flex-col transition-transform duration-300 bg-white border-l border-slate-200 dark:bg-[#0f1a35] dark:border-white/10 ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "translate-x-full lg:translate-x-0"
        }`}
        dir="rtl"
      >
        {/* Brand chip */}
        <div className="px-5 pt-6 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 dark:bg-white dark:border-white/30 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={QUARTERS_LOGO}
                alt="Quarters"
                className="w-8 h-8 object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-slate-900 dark:text-white font-bold text-sm tracking-tight truncate">
                Quarters Coffee Bar
              </div>
              <div className="text-slate-500 dark:text-white/55 text-xs truncate">
                لوحة الإدارة
              </div>
            </div>
          </div>

          {/* Section switcher (Workspace / Inventory / Accounting / HR / Marketing) */}
          <div className="mt-4 flex justify-center">
            <AppSectionSwitcher active="inventory" className="scale-95" />
          </div>

          {/* Command-palette trigger */}
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
        </div>

        {/* Nav — scrollable middle zone */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <NavRow
            href="/admin"
            icon={LayoutDashboard}
            label="لوحة التحكم"
            active={activePage === "dashboard"}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/branches"
            icon={Building2}
            label="الفروع"
            active={activePage === "branches"}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/items"
            icon={Package}
            label="إدارة الأصناف"
            active={activePage === "items"}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/operations"
            icon={ClipboardList}
            label="عمليات المخزون"
            active={activePage === "operations"}
            onClick={closeMobile}
          />
          <NavRow
            href="/admin/receipts"
            icon={Truck}
            label="الواردات"
            active={activePage === "receipts"}
            onClick={closeMobile}
          />

          {/* ملخص جرد الأصناف — flyout popover on desktop, inline on mobile. */}
          <div className="pt-1">
            <NavGroup
              icon={FileText}
              label="ملخص جرد الأصناف"
              closeMobile={closeMobile}
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
              onClick={closeMobile}
            />
          ) : null}
        </nav>

        {/* Footer — language toggle + logout */}
        <div className="border-t border-slate-100 dark:border-white/[0.06] p-3 space-y-1">
          <button
            type="button"
            onClick={toggleLang}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white transition-colors"
            aria-label="تبديل اللغة"
          >
            <Globe className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">
              {lang === "ar" ? "English" : "العربية"}
            </span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="flex-1 text-sm font-semibold text-right">
              تسجيل الخروج
            </span>
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
