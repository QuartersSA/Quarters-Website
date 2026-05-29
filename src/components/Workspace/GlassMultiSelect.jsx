import React, { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => (v == null ? "" : String(v))).filter((v) => v !== "");
}

/**
 * GlassMultiSelect
 * - Same glass theme as GlassSelect
 * - Supports selecting multiple values (string[])
 */
export default function GlassMultiSelect({
  values,
  onChange,
  options,
  placeholder = "اختر…",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  dir = "rtl",
  maxLabelItems = 2,
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

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

  const selectedValues = useMemo(() => {
    return new Set(normalizeStringArray(values));
  }, [values]);

  const selectedLabels = useMemo(() => {
    const labels = [];
    normalizedOptions.forEach((o) => {
      if (o.isGroupLabel) return;
      if (selectedValues.has(o.value)) {
        labels.push(o.label);
      }
    });
    return labels;
  }, [normalizedOptions, selectedValues]);

  const label = useMemo(() => {
    if (selectedLabels.length === 0) return placeholder;
    const shown = selectedLabels.slice(0, maxLabelItems);
    const rest = selectedLabels.length - shown.length;
    const summary = shown.join("، ");
    if (rest > 0) {
      return `${summary} (+${rest})`;
    }
    return summary;
  }, [maxLabelItems, placeholder, selectedLabels]);

  const setValues = (next) => {
    onChange?.(next);
  };

  const toggle = (v) => {
    if (disabled) return;

    const next = new Set(selectedValues);
    if (next.has(v)) {
      next.delete(v);
    } else {
      next.add(v);
    }

    setValues(Array.from(next));
  };

  const clearAll = () => {
    if (disabled) return;
    setValues([]);

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

  const showClear = selectedLabels.length > 0 && !disabled;

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
          className={`min-w-0 truncate ${selectedLabels.length ? "text-slate-900 dark:text-slate-900 dark:dark:text-white" : "text-slate-500 dark:text-slate-500 dark:dark:text-white/45"}`}
        >
          {label}
        </span>

        <span className="flex items-center gap-2 flex-shrink-0">
          {showClear ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAll();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  clearAll();
                }
              }}
              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-200 dark:dark:hover:bg-white/10 text-slate-600 dark:text-slate-600 dark:dark:text-white/60"
              aria-label="مسح"
              title="مسح"
            >
              <X className="w-4 h-4" />
            </span>
          ) : null}
          <ChevronDown
            className={`w-4 h-4 ${open ? "text-slate-900 dark:text-slate-900 dark:dark:text-white" : "text-slate-600 dark:text-slate-600 dark:dark:text-white/60"}`}
          />
        </span>
      </button>

      <GlassPopover
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        className={`border border-slate-200 dark:border-slate-200 dark:dark:border-white/15 ${menuClassName}`}
      >
        <div className="max-h-[50vh] overflow-auto">
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-200 dark:dark:border-white/10 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-600 dark:dark:text-white/55">
              اختيار متعدد
            </div>
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled || selectedLabels.length === 0}
              className="text-xs text-slate-700 dark:text-slate-700 dark:dark:text-white/70 hover:text-slate-900 dark:hover:text-slate-900 dark:dark:hover:text-white disabled:opacity-40"
            >
              مسح الكل
            </button>
          </div>

          {normalizedOptions.map((o) => {
            if (o.isGroupLabel) {
              return (
                <div
                  key={`group-${o.value}-${o.label}`}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-500 dark:dark:text-white/45 border-t border-slate-200 dark:border-slate-200 dark:dark:border-white/10 first:border-t-0"
                  role="presentation"
                >
                  {o.label}
                </div>
              );
            }

            const active = selectedValues.has(o.value);
            const rowBase = `w-full flex items-center justify-between gap-3 px-4 py-3 ${textAlignClass} transition-colors`;

            const rowClass = o.disabled
              ? "text-slate-400 dark:text-slate-400 dark:dark:text-white/30 cursor-not-allowed"
              : active
                ? "bg-slate-200 dark:bg-slate-200 dark:dark:bg-white/10 text-slate-900 dark:text-slate-900 dark:dark:text-white"
                : "text-slate-800 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-slate-100 dark:dark:hover:bg-white/[0.06]";

            return (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => toggle(o.value)}
                className={`${rowBase} ${rowClass}`}
                role="option"
                aria-selected={active}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {active ? (
                  <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200 flex-shrink-0" />
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
