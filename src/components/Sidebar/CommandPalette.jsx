"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Package, ArrowLeft } from "lucide-react";
import { adminFetch } from "@/utils/apiAuth";
import { ws } from "@/components/Workspace/ui";

/**
 * Generic command palette mounted from every SidebarShell.
 *
 * Opens on Cmd/Ctrl+K (handled by the shell) or via the sidebar's
 * search button. Two configurable result sources:
 *
 *   `routes`        — a static registry of section pages.
 *                     Each entry: { href, label, sub, icon, keywords }.
 *
 *   `dataSources`   — optional dynamic lists fetched via React Query.
 *                     Each entry: { queryKey, url, staleTime, fetcher?,
 *                     hrefBase, subLabel, icon, cap?, nameField? }.
 *                     Defaults: cap = 25, nameField = "name",
 *                     fetcher = adminFetch.
 *
 * Result entries from `routes` always sit before `dataSources` results
 * so navigation hits stay at the top of the list.
 */

function matches(query, candidate) {
  if (!query) return true;
  const q = String(query).trim().toLowerCase();
  if (!q) return true;
  const c = String(candidate || "").toLowerCase();
  return c.includes(q);
}

function DataSourceResults({ ds, query, register }) {
  const fetcher = ds.fetcher || adminFetch;
  const { data = [] } = useQuery({
    queryKey: ds.queryKey,
    queryFn: async () => {
      const res = await fetcher(ds.url);
      if (!res.ok) throw new Error(String(ds.queryKey?.[0] || "list"));
      return res.json();
    },
    enabled: true,
    staleTime: ds.staleTime ?? 5 * 60 * 1000,
  });

  // Push matching rows into the shell's result list via the register
  // callback so a single key+arrow navigation works across sources.
  // Memo by `data + query` so we don't re-register on every parent
  // render.
  useEffect(() => {
    const list = Array.isArray(data) ? data : [];
    const cap = ds.cap ?? 25;
    const nameField = ds.nameField || "name";
    const out = [];
    for (const row of list) {
      if (out.length >= cap) break;
      const name = row?.[nameField];
      if (matches(query, name)) {
        out.push({
          kind: ds.kind || "row",
          href: ds.hrefBase || "#",
          label: String(name),
          sub: ds.subLabel,
          icon: ds.icon || Package,
        });
      }
    }
    register(ds.queryKey?.join("-") || ds.url, out);
  }, [data, query, ds, register]);

  return null;
}

export function CommandPalette({
  open,
  onClose,
  routes = [],
  dataSources = [],
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [dynamicResults, setDynamicResults] = useState({});

  const register = useMemo(
    () => (key, items) => {
      setDynamicResults((prev) => ({ ...prev, [key]: items }));
    },
    [],
  );

  const results = useMemo(() => {
    const out = [];
    for (const r of routes) {
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
    for (const [, list] of Object.entries(dynamicResults)) {
      if (Array.isArray(list)) out.push(...list);
    }
    return out.slice(0, 50);
  }, [query, routes, dynamicResults]);

  // Reset highlight whenever the palette re-opens or results shift.
  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
  }, [open, query]);

  // Reset query when closed so next open starts fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Keyboard nav: ↑↓ move, Enter open, Esc close.
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
      {/* Mount each data source as a sibling so its useQuery hook is
          declared at a stable position in the tree. */}
      {dataSources.map((ds) => (
        <DataSourceResults
          key={ds.queryKey?.join("-") || ds.url}
          ds={ds}
          query={query}
          register={register}
        />
      ))}

      <div
        className={`w-full max-w-xl ${ws.popover} rounded-3xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/60 dark:border-white/10">
          <Search className="w-5 h-5 text-slate-400 dark:text-white/40 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن صفحة…"
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
                      ? "bg-brand-50 dark:bg-white/10"
                      : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? "text-brand-600 dark:text-white"
                        : "text-slate-500 dark:text-white/55"
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm truncate ${
                      isActive
                        ? "text-brand-700 dark:text-white font-semibold"
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
                    <ArrowLeft className="w-3.5 h-3.5 text-brand-500 dark:text-white/60 shrink-0" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

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
