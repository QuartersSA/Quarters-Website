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
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Search,
  Globe,
  PanelRightClose,
  PanelRightOpen,
  ZoomOut,
} from "lucide-react";
import AppSectionSwitcher from "@/components/AppSectionSwitcher";
import { CommandPalette } from "./CommandPalette";

/**
 * Wafeq-style sidebar shell, shared across all five admin sections
 * (Workspace / Inventory / Accounting / HR / Marketing).
 *
 * Props:
 *   section       — key passed to AppSectionSwitcher's `active`:
 *                   "workspace" | "inventory" | "accounting" | "hr" | "marketing"
 *   brand         — { title, subtitle?, logoUrl? }
 *   navConfig     — array of nav entries, each either:
 *                     { kind: "row", key, href, icon, label }
 *                     { kind: "group", key, label, icon, items: [{ href, icon, label, activeKey }] }
 *   activeKey     — string matching one of the row keys OR a group's
 *                   item.activeKey to highlight the row + open the popover.
 *   pageTitleMap  — { activeKey → title } for the mobile top bar.
 *   paletteRoutes — array passed straight into CommandPalette.
 *   paletteDataSources — array passed straight into CommandPalette.
 *   onLogout      — callback when the logout row is clicked.
 *
 * Behaviour mirrors the original admin design exactly: Ctrl+K opens
 * the palette, Ctrl+B toggles the collapse rail, the collapse state
 * is persisted in localStorage and re-applied to <body> via a
 * `data-admin-sidebar` attribute so pages whose <main> uses lg:mr-72
 * re-flow when the rail shrinks to w-16.
 */

const DEFAULT_LOGO =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/";

// Both keys are intentionally global (not per-section) so toggling the
// rail in one area keeps it collapsed when the user jumps to another.
const COLLAPSE_KEY = "adminSidebarCollapsed";
const COLLAPSE_EVENT = "adminSidebarCollapseChange";

function NavRow({
  href,
  icon: Icon,
  label,
  active,
  collapsed = false,
  onClick,
}) {
  const baseSize = collapsed
    ? "px-0 py-2.5 justify-center"
    : "px-3 py-2.5";

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
        className={`shrink-0 w-5 h-5 ${
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

function NavGroup({
  icon: Icon,
  label,
  items,
  closeMobile,
  collapsed = false,
  activeKey,
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  const groupActive = items.some(
    (it) => it.activeKey && activeKey === it.activeKey,
  );

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
    if (isDesktop) setPos(computePos());
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

  const triggerSize = collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5";
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
        <div className="flex items-center gap-3">
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
                  const itemActive = it.activeKey === activeKey;
                  const itemCls = itemActive
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
                          itemActive
                            ? "text-brand-600 dark:text-white"
                            : "text-slate-500 dark:text-white/55"
                        }`}
                      />
                      <span
                        className={`flex-1 ${itemActive ? "font-semibold" : ""}`}
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

      {open && !isDesktop ? (
        <div className="mt-1 space-y-0.5 border-r border-slate-200 dark:border-white/10 mr-5 pr-1">
          {items.map((it) => {
            const ChildIcon = it.icon;
            const itemActive = it.activeKey === activeKey;
            const itemCls = itemActive
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
                    itemActive
                      ? "text-brand-600 dark:text-white"
                      : "text-slate-500 dark:text-white/55"
                  }`}
                />
                <span
                  className={`flex-1 ${itemActive ? "font-semibold" : ""}`}
                >
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

// Zoom levels offered by the footer button. Cycles 100% → 90% → 85% → 80%
// then wraps. 0.9 is the "less cramped than 100% but still fits a 13-inch
// MacBook" sweet spot we land on most often.
const ZOOM_STEPS = [1, 0.9, 0.85, 0.8];
const ZOOM_KEY = "adminZoom";

function readZoom() {
  if (typeof window === "undefined") return 1;
  try {
    const v = parseFloat(localStorage.getItem(ZOOM_KEY) || "1");
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch {
    return 1;
  }
}

export function SidebarShell({
  section,
  brand,
  navConfig,
  activeKey,
  pageTitleMap = {},
  paletteRoutes = [],
  paletteDataSources = [],
  onLogout,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [lang] = useState(readLang);
  const [zoom, setZoom] = useState(readZoom);

  const closeMobile = useCallback(() => setIsMobileMenuOpen(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

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

  // Apply the persisted zoom level to <body>. `zoom` is a real CSS
  // property again as of CSS Zoom Level 1 and is implemented in every
  // current browser (Chromium 125+, WebKit, Firefox 126+). Reset on
  // unmount so non-admin routes (which don't mount this shell) render
  // at 100%.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.style.zoom = String(zoom);
    try {
      localStorage.setItem(ZOOM_KEY, String(zoom));
    } catch {
      // ignore
    }
    return () => {
      document.body.style.zoom = "";
    };
  }, [zoom]);

  const cycleZoom = useCallback(() => {
    setZoom((cur) => {
      const idx = ZOOM_STEPS.indexOf(cur);
      return idx === -1 ? ZOOM_STEPS[1] : ZOOM_STEPS[(idx + 1) % ZOOM_STEPS.length];
    });
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
    return pageTitleMap[activeKey] || brand?.title || "Quarters";
  }, [activeKey, pageTitleMap, brand]);

  const asideWidth = isCollapsed ? "lg:w-16" : "lg:w-72";
  const navPadX = isCollapsed ? "px-2" : "px-3";
  const footerPadX = isCollapsed ? "p-2" : "p-3";

  const logoUrl = brand?.logoUrl || DEFAULT_LOGO;

  return (
    <>
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
            active={section}
            className="scale-90 origin-left"
          />

          <div className="flex items-center gap-2 min-w-0">
            <div className="text-slate-900 dark:text-white text-sm font-bold tracking-tight whitespace-nowrap">
              {pageTitle}
            </div>
            <img
              src={logoUrl}
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
        {/* Top zone: collapse toggle + brand */}
        <div
          className={`pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.06] ${
            isCollapsed ? "px-2" : "px-5"
          }`}
        >
          <div
            className={`hidden lg:flex ${isCollapsed ? "justify-center" : "justify-end"} mb-3`}
          >
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              title={
                isCollapsed ? "توسيع القائمة (Ctrl+B)" : "تصغير القائمة (Ctrl+B)"
              }
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

          <div
            className={`flex items-center gap-3 ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 dark:bg-white dark:border-white/30 flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={logoUrl}
                alt="Quarters"
                className="w-8 h-8 object-contain"
              />
            </div>
            {isCollapsed ? null : (
              <div className="min-w-0">
                <div className="text-slate-900 dark:text-white font-bold text-sm tracking-tight truncate">
                  {brand?.title || "Quarters"}
                </div>
                {brand?.subtitle ? (
                  <div className="text-slate-500 dark:text-white/55 text-xs truncate">
                    {brand.subtitle}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {isCollapsed ? null : (
            <div className="mt-4 flex justify-center">
              <AppSectionSwitcher active={section} className="scale-95" />
            </div>
          )}

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
          {navConfig.map((entry) => {
            if (entry.kind === "group") {
              return (
                <div key={entry.key} className="pt-1">
                  <NavGroup
                    icon={entry.icon}
                    label={entry.label}
                    items={entry.items}
                    closeMobile={closeMobile}
                    collapsed={isCollapsed}
                    activeKey={activeKey}
                  />
                </div>
              );
            }
            return (
              <NavRow
                key={entry.key}
                href={entry.href}
                icon={entry.icon}
                label={entry.label}
                active={activeKey === entry.key}
                collapsed={isCollapsed}
                onClick={closeMobile}
              />
            );
          })}
        </nav>

        {/* Footer */}
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
            onClick={cycleZoom}
            title={`تكبير العرض (${Math.round(zoom * 100)}%)`}
            aria-label="تغيير حجم العرض"
            className={`w-full flex items-center gap-3 ${
              isCollapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"
            } rounded-xl text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white transition-colors`}
          >
            {isCollapsed ? (
              <span className="text-[10px] font-semibold tracking-wide">
                {Math.round(zoom * 100)}%
              </span>
            ) : (
              <>
                <ZoomOut className="w-5 h-5 shrink-0" />
                <span className="flex-1 text-sm font-medium text-right">
                  حجم العرض
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-white/55 shrink-0">
                  {Math.round(zoom * 100)}%
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

      <div className="lg:hidden h-[64px]" />

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        routes={paletteRoutes}
        dataSources={paletteDataSources}
      />
    </>
  );
}

export default SidebarShell;
