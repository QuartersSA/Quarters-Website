"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  X,
  LayoutDashboard,
  Building2,
  Package,
  ClipboardList,
  Truck,
  FileText,
  TrendingDown,
  BarChart3,
  Banknote,
  Users,
  ArrowLeft,
} from "lucide-react";
import { adminFetch } from "@/utils/apiAuth";
import { ws } from "@/components/Workspace/ui";

/**
 * Global command palette for the admin inventory area.
 *
 * Opens on Cmd/Ctrl+K (handled in the parent Sidebar) or via the sidebar
 * search button. Fuzzy-matches three sources:
 *   • static admin route registry (dashboard / branches / items / ...)
 *   • cached branches list  (queryKey: ["branches"])
 *   • cached items list     (queryKey: ["items"])
 *
 * Selecting a result navigates via `window.location.href` so React Query
 * + auth state pick up cleanly on the new page.
 */

const ADMIN_ROUTES = [
  {
    href: "/admin",
    label: "لوحة التحكم",
    sub: "Dashboard",
    icon: LayoutDashboard,
    keywords: "dashboard home لوحة التحكم",
  },
  {
    href: "/admin/branches",
    label: "الفروع",
    sub: "Branches",
    icon: Building2,
    keywords: "branches فروع",
  },
  {
    href: "/admin/items",
    label: "إدارة الأصناف",
    sub: "Items",
    icon: Package,
    keywords: "items products أصناف",
  },
  {
    href: "/admin/operations",
    label: "عمليات المخزون",
    sub: "Operations",
    icon: ClipboardList,
    keywords: "operations جرد inventory",
  },
  {
    href: "/admin/receipts",
    label: "الواردات",
    sub: "Receipts",
    icon: Truck,
    keywords: "receipts وارد purchases",
  },
  {
    href: "/admin/low-stock",
    label: "الأصناف منخفضة الكمية",
    sub: "Low stock",
    icon: TrendingDown,
    keywords: "low stock منخفض شح",
  },
  {
    href: "/admin/items-summary",
    label: "ملخص الأصناف",
    sub: "Items summary",
    icon: FileText,
    keywords: "summary ملخص",
  },
  {
    href: "/admin/variance",
    label: "تقرير الانحراف",
    sub: "Variance",
    icon: BarChart3,
    keywords: "variance انحراف",
  },
  {
    href: "/admin/stock-value",
    label: "قيمة المخزون",
    sub: "Stock value",
    icon: Banknote,
    keywords: "value قيمة worth",
  },
  {
    href: "/admin/employees",
    label: "الموظفين",
    sub: "Employees",
    icon: Users,
    keywords: "employees موظفين staff",
  },
];

function matches(query, candidate) {
  if (!query) return true;
  const q = String(query).trim().toLowerCase();
  if (!q) return true;
  const c = String(candidate || "").toLowerCase();
  return c.includes(q);
}

export function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  // Reuse the same React Query keys the dashboard hooks set, so cached
  // data shows up instantly. `enabled: open` defers the fetch until the
  // user opens the palette for the first time.
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await adminFetch("/api/branches");
      if (!res.ok) throw new Error("branches");
      return res.json();
    },
    enabled: open,
    staleTime: 30 * 60 * 1000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await adminFetch("/api/items");
      if (!res.ok) throw new Error("items");
      return res.json();
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const results = useMemo(() => {
    const out = [];

    // 1. Static route registry — checked first so navigation results
    //    always sit at the top.
    for (const r of ADMIN_ROUTES) {
      if (matches(query, r.label) || matches(query, r.keywords)) {
        out.push({
          kind: "page",
          href: r.href,
          label: r.label,
          sub: r.sub,
          icon: r.icon,
        });
      }
    }

    // 2. Branches — cap the slice so even an empty query stays snappy.
    const branchList = Array.isArray(branches) ? branches : [];
    let branchMatches = 0;
    for (const b of branchList) {
      if (branchMatches >= 25) break;
      if (matches(query, b?.name)) {
        out.push({
          kind: "branch",
          href: "/admin/branches",
          label: b.name,
          sub: "فرع",
          icon: Building2,
        });
        branchMatches += 1;
      }
    }

    // 3. Items — same idea.
    const itemList = Array.isArray(items) ? items : [];
    let itemMatches = 0;
    for (const it of itemList) {
      if (itemMatches >= 25) break;
      if (matches(query, it?.name)) {
        out.push({
          kind: "item",
          href: "/admin/items",
          label: it.name,
          sub: "صنف",
          icon: Package,
        });
        itemMatches += 1;
      }
    }

    return out.slice(0, 50);
  }, [query, branches, items]);

  // Reset highlight whenever the palette re-opens or the result set shifts.
  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
  }, [open, query]);

  // Keyboard nav: ↑↓ to move, Enter to open, Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const r = results[activeIdx];
        if (r) {
          e.preventDefault();
          window.location.href = r.href;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeIdx, results, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] p-4 bg-slate-900/30 dark:bg-black/60 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="بحث سريع"
    >
      <div
        className={`w-full max-w-xl ${ws.popover} rounded-3xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/60 dark:border-white/10">
          <Search className="w-5 h-5 text-slate-400 dark:text-white/40 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن صفحة، فرع، أو صنف…"
            className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 text-sm"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white shrink-0"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-500 dark:text-white/55 text-sm">
              لا توجد نتائج
            </div>
          ) : (
            results.map((r, i) => {
              const Icon = r.icon || Package;
              const isActive = i === activeIdx;
              return (
                <button
                  type="button"
                  key={`${r.kind}-${r.label}-${i}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => {
                    window.location.href = r.href;
                  }}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-right transition-colors ${
                    isActive
                      ? "bg-brand-50 dark:bg-brand-500/15"
                      : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? "text-brand-600 dark:text-brand-200"
                        : "text-slate-500 dark:text-white/55"
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm truncate ${
                      isActive
                        ? "text-brand-700 dark:text-brand-100 font-semibold"
                        : "text-slate-700 dark:text-white/80"
                    }`}
                  >
                    {r.label}
                  </span>
                  {r.sub ? (
                    <span className="text-xs text-slate-400 dark:text-white/35 shrink-0">
                      {r.sub}
                    </span>
                  ) : null}
                  {isActive ? (
                    <ArrowLeft className="w-3.5 h-3.5 text-brand-500 dark:text-brand-300 shrink-0" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {/* Footer key hints */}
        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-xs text-slate-400 dark:text-white/40">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 font-mono text-[10px]">
              ↑↓
            </kbd>
            تنقل
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 font-mono text-[10px]">
              Enter
            </kbd>
            فتح
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70 font-mono text-[10px]">
              Esc
            </kbd>
            إغلاق
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
