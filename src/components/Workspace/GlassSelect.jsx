import React, { useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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

  const selected = useMemo(() => {
    const v = value == null ? "" : String(value);
    return (
      normalizedOptions.find((o) => !o.isGroupLabel && o.value === v) || null
    );
  }, [normalizedOptions, value]);

  const label = selected?.label || placeholder;

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
          className={`min-w-0 truncate ${selected ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-white/45"}`}
        >
          {label}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 ${open ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-white/60"}`}
        />
      </button>

      <GlassPopover
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        className={`border border-slate-200 dark:border-white/15 ${menuClassName}`}
      >
        <div className="max-h-[50vh] overflow-auto">
          {normalizedOptions.map((o) => {
            if (o.isGroupLabel) {
              return (
                <div
                  key={`group-${o.value}-${o.label}`}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-white/45 border-t border-slate-200 dark:border-white/10 first:border-t-0"
                  role="presentation"
                >
                  {o.label}
                </div>
              );
            }

            const active = selected?.value === o.value;
            const rowBase = `w-full flex items-center justify-between gap-3 px-4 py-3 ${textAlignClass} transition-colors`;

            const rowClass = o.disabled
              ? "text-slate-400 dark:text-white/30 cursor-not-allowed"
              : active
                ? "bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white"
                : "text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.06]";

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
                  <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-200 flex-shrink-0" />
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
