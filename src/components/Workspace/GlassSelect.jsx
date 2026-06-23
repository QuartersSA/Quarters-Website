import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";

/**
 * GlassSelect
 * - Custom dropdown to avoid native <select> menu styling (which breaks dark/glass theme)
 * - Uses a portal popover so the menu isn't clipped by overflow containers (tables/cards)
 * - Keeps data behavior the same: value is a string, onChange(newValue) is called
 */
export default function GlassSelect({
  value,
  onChange,
  options,
  placeholder = "اختر…",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  dir = "rtl", // rtl | ltr (needed in a few bilingual screens)
  searchable = false,
  searchPlaceholder = "ابحث…",
  noResultsLabel = "لا توجد نتائج",
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const btnRef = useRef(null);
  const searchRef = useRef(null);

  const normalizedOptions = useMemo(() => {
    const list = Array.isArray(options) ? options : [];
    return list.map((o) => {
      const isGroupLabel = !!o.isGroupLabel;
      return {
        value: String(o.value ?? ""),
        label: String(o.label ?? ""),
        disabled: isGroupLabel ? true : !!o.disabled,
        isGroupLabel,
      };
    });
  }, [options]);

  const selected = useMemo(() => {
    const v = value == null ? "" : String(value);
    return (
      normalizedOptions.find((o) => !o.isGroupLabel && o.value === v) || null
    );
  }, [normalizedOptions, value]);

  const label = selected?.label || placeholder;

  const filteredOptions = useMemo(() => {
    if (!searchable) return normalizedOptions;

    const q = searchTerm.trim().toLowerCase();
    if (!q) return normalizedOptions;

    return normalizedOptions.filter((o) => {
      if (o.isGroupLabel) return false;
      return (
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
      );
    });
  }, [normalizedOptions, searchable, searchTerm]);

  useEffect(() => {
    if (!open) {
      setSearchTerm("");
      return;
    }

    if (searchable) {
      const timer = window.setTimeout(() => {
        searchRef.current?.focus?.();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, searchable]);

  const selectValue = (v) => {
    if (disabled) {
      return;
    }
    setOpen(false);
    onChange?.(v);

    // return focus to button for nicer keyboard UX
    try {
      btnRef.current?.focus?.();
    } catch {
      // ignore
    }
  };

  const textAlignClass = dir === "ltr" ? "text-left" : "text-right";

  const btnBase = `${ws.select} px-4 py-3 flex items-center justify-between gap-3 ${textAlignClass}`;
  const btnDisabled = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <div className={className} dir={dir}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className={`${btnBase} ${btnDisabled} ${buttonClassName}`}
        aria-expanded={open}
      >
        <span
          className={`min-w-0 truncate ${selected ? "text-slate-900 dark:text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-500 dark:text-white/45"}`}
        >
          {label}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 ${open ? "text-slate-900 dark:text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-600 dark:text-white/60"}`}
        />
      </button>

      <GlassPopover
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        className={`border border-slate-200 dark:border-slate-200 dark:border-white/15 ${menuClassName}`}
      >
        <div className="max-h-[50vh] overflow-auto">
          {searchable ? (
            <div className="sticky top-0 z-10 p-2 bg-white/95 dark:bg-slate-950/95 border-b border-slate-200 dark:border-white/10 backdrop-blur">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-white/45 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={`${ws.input} w-full pr-9 pl-3 py-2 text-sm`}
                  dir={dir}
                />
              </div>
            </div>
          ) : null}

          {filteredOptions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-white/45">
              {noResultsLabel}
            </div>
          ) : null}

          {filteredOptions.map((o) => {
            if (o.isGroupLabel) {
              return (
                <div
                  key={`group-${o.value}-${o.label}`}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-500 dark:text-white/45 border-t border-slate-200 dark:border-slate-200 dark:border-white/10 first:border-t-0"
                  role="presentation"
                >
                  {o.label}
                </div>
              );
            }

            const active = selected?.value === o.value;
            const rowBase = `w-full flex items-center justify-between gap-3 px-4 py-3 ${textAlignClass} transition-colors`;

            const rowClass = o.disabled
              ? "text-slate-400 dark:text-slate-400 dark:text-white/30 cursor-not-allowed"
              : active
                ? "bg-slate-200 dark:bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-slate-900 dark:text-white"
                : "text-slate-800 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06]";

            return (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => selectValue(o.value)}
                className={`${rowBase} ${rowClass}`}
                role="option"
                aria-selected={active}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {active ? (
                  <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200 flex-shrink-0" />
                ) : (
                  <span className="w-4 h-4 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </GlassPopover>
    </div>
  );
}
