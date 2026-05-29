import { useCallback, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { arSA, enUS } from "date-fns/locale";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";
import { formatDateForInput, formatRiyadhDateForInput } from "@/utils/dateUtils";

function safeParseISODate(value) {
  if (!value) return null;
  // Handle both YYYY-MM-DD and YYYY-MM-DDTHH:mm formats
  const dateOnly = value.includes("T") ? value.split("T")[0] : value;
  const d = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function extractTime(value) {
  if (!value || !value.includes("T")) return { hour: "", minute: "" };
  const timePart = value.split("T")[1] || "";
  const [h, m] = timePart.split(":");
  return { hour: h || "", minute: m || "" };
}

function buildDateTimeValue(dateStr, hour, minute) {
  if (!dateStr) return "";
  const dateOnly = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const h = String(hour || "0").padStart(2, "0");
  const m = String(minute || "0").padStart(2, "0");
  return `${dateOnly}T${h}:${m}`;
}

export default function GlassDatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
  className = "",
  buttonClassName = "",
  allowClear = true,
  dir = "rtl",
  displayLocale = "ar-SA-u-ca-gregory-nu-latn",
  showTime = false,
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const selected = useMemo(() => safeParseISODate(value), [value]);
  const currentTime = useMemo(() => extractTime(value), [value]);

  const dayPickerLocale = dir === "ltr" ? enUS : arSA;
  const latnLocale = dir === "ltr" ? "en-US" : "ar-SA-u-ca-gregory-nu-latn";

  const displayLabel = useMemo(() => {
    if (!selected) return placeholder;
    try {
      const dateLabel = selected.toLocaleDateString(latnLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      if (showTime && currentTime.hour !== "") {
        const h = String(currentTime.hour).padStart(2, "0");
        const m = String(currentTime.minute).padStart(2, "0");
        return `${dateLabel}  ${h}:${m}`;
      }
      return dateLabel;
    } catch {
      return value;
    }
  }, [placeholder, selected, value, latnLocale, showTime, currentTime]);

  const setValue = useCallback(
    (next) => {
      onChange?.(next);
    },
    [onChange],
  );

  const handleSelect = useCallback(
    (day) => {
      if (!day) {
        setValue("");
        if (!showTime) setOpen(false);
        return;
      }

      const dateStr = formatDateForInput(day);

      if (showTime) {
        // Keep the existing time or default to current hour
        const h =
          currentTime.hour !== "" ? currentTime.hour : new Date().getHours();
        const m = currentTime.minute !== "" ? currentTime.minute : "0";
        setValue(buildDateTimeValue(dateStr, h, m));
        // Don't close — let user pick time
      } else {
        setValue(dateStr);
        setOpen(false);
      }
    },
    [setValue, showTime, currentTime],
  );

  const handleTimeChange = useCallback(
    (type, val) => {
      const dateOnly = value
        ? value.includes("T")
          ? value.split("T")[0]
          : value
        : "";
      if (!dateOnly) return;
      const h = type === "hour" ? val : currentTime.hour || "0";
      const m = type === "minute" ? val : currentTime.minute || "0";
      setValue(buildDateTimeValue(dateOnly, h, m));
    },
    [value, currentTime, setValue],
  );

  const handleTimeDone = useCallback(() => {
    setOpen(false);
  }, []);

  const clear = useCallback(
    (e) => {
      e?.stopPropagation?.();
      setValue("");
      setOpen(false);
    },
    [setValue],
  );

  const buttonTextClass = value ? "text-slate-900 dark:text-slate-900 dark:dark:text-white" : "text-slate-400 dark:text-slate-400 dark:dark:text-white/35";

  // IMPORTANT: react-day-picker v9 changed classNames keys.
  // We extend defaults to avoid layout glitches (like days appearing in a vertical list).
  const defaultClassNames = useMemo(() => getDefaultClassNames(), []);

  const dayPickerClassNames = useMemo(() => {
    // Make calendar fit inside the 320px popover without spilling numbers outside.
    // 7 columns * (32px button + 8px cell padding) = 280px, matching inner container width.
    const navBtn =
      `${ws.iconButton} w-8 h-8 rounded-xl flex items-center justify-center ` +
      "disabled:opacity-40 disabled:cursor-not-allowed";

    return {
      ...defaultClassNames,

      root: `${defaultClassNames.root} select-none`,
      months: `${defaultClassNames.months} flex flex-col`,
      month: `${defaultClassNames.month} space-y-2`,

      month_caption: `${defaultClassNames.month_caption} flex items-center justify-between px-2 py-1`,
      caption_label: `${defaultClassNames.caption_label || ""} text-slate-900 dark:text-white/90 text-sm font-semibold`,

      nav: `${defaultClassNames.nav} flex items-center gap-1`,
      button_previous: `${defaultClassNames.button_previous} ${navBtn}`,
      button_next: `${defaultClassNames.button_next} ${navBtn}`,
      chevron: `${defaultClassNames.chevron} text-slate-700 dark:text-slate-700 dark:dark:text-white/70`,

      month_grid: `${defaultClassNames.month_grid} w-full border-collapse table-fixed`,
      weekdays: `${defaultClassNames.weekdays} `,
      weekday: `${defaultClassNames.weekday} p-1 text-center text-[11px] text-slate-500 dark:text-slate-500 dark:dark:text-white/45 font-semibold`,

      weeks: `${defaultClassNames.weeks} `,
      week: `${defaultClassNames.week} `,

      // In v9: `day` is the cell, and `day_button` is the clickable button.
      day: `${defaultClassNames.day} p-1 text-center`,
      day_button:
        `${defaultClassNames.day_button} h-8 w-8 rounded-xl mx-auto ` +
        "text-slate-800 dark:text-slate-800 dark:dark:text-white/85 hover:bg-slate-100 dark:hover:bg-slate-100 dark:dark:hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-emerald-400/20 flex items-center justify-center",

      today: `${defaultClassNames.today} text-sky-700 dark:text-sky-700 dark:dark:text-sky-200`,
      outside: `${defaultClassNames.outside} text-slate-400 dark:text-slate-400 dark:dark:text-white/25`,
      disabled: `${defaultClassNames.disabled} text-slate-400 dark:text-slate-400 dark:dark:text-white/25 line-through`,
      selected: `${defaultClassNames.selected} bg-emerald-400/20 text-emerald-100 border border-emerald-400/30`,
    };
  }, [defaultClassNames]);

  // Hour options 0-23
  const hourOptions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 24; i++) {
      arr.push(i);
    }
    return arr;
  }, []);

  // Minute options 0, 5, 10, ..., 55
  const minuteOptions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 60; i += 5) {
      arr.push(i);
    }
    return arr;
  }, []);

  return (
    <div className={className} dir={dir}>
      <div className="relative">
        <button
          ref={anchorRef}
          type="button"
          onClick={() => setOpen((s) => !s)}
          className={`${ws.select} flex items-center justify-between gap-3 ${buttonClassName}`}
          aria-expanded={open}
        >
          <span className={`truncate ${buttonTextClass}`}>{displayLabel}</span>

          <div
            className={`${ws.iconBox} w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-50 dark:dark:bg-white/[0.03] flex-shrink-0`}
            aria-hidden="true"
          >
            {showTime ? (
              <Clock className="w-4 h-4 text-slate-700 dark:text-slate-700 dark:dark:text-white/65" />
            ) : (
              <CalendarDays className="w-4 h-4 text-slate-700 dark:text-slate-700 dark:dark:text-white/65" />
            )}
          </div>
        </button>

        {allowClear && value ? (
          <button
            type="button"
            onClick={clear}
            className={`absolute left-2 top-1/2 -translate-y-1/2 ${ws.iconButton} w-9 h-9 rounded-xl flex items-center justify-center`}
            aria-label="مسح التاريخ"
          >
            <X className="w-4 h-4 text-slate-700 dark:text-slate-700 dark:dark:text-white/70" />
          </button>
        ) : null}
      </div>

      <GlassPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        style={{ width: 320 }}
      >
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-white/80">التاريخ</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // Force Riyadh "today" — never trust the runtime's
                  // local TZ. On a UTC server or mis-configured client
                  // `formatDateForInput(new Date())` could return
                  // yesterday's date and silently send the wrong value
                  // to the API.
                  const today = formatRiyadhDateForInput(new Date());
                  if (showTime) {
                    const h =
                      currentTime.hour !== ""
                        ? currentTime.hour
                        : new Date().getHours();
                    const m =
                      currentTime.minute !== "" ? currentTime.minute : "0";
                    setValue(buildDateTimeValue(today, h, m));
                  } else {
                    setValue(today);
                    setOpen(false);
                  }
                }}
                className={`${ws.btnNeutral} px-3 py-2 text-xs justify-center`}
              >
                اليوم
              </button>
              {allowClear ? (
                <button
                  type="button"
                  onClick={clear}
                  className={`${ws.btnDanger} px-3 py-2 text-xs justify-center`}
                >
                  مسح
                </button>
              ) : null}
            </div>
          </div>

          {/* Prevent any tiny overflow from showing outside rounded corners */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-200 dark:dark:border-white/10 bg-slate-50 dark:bg-slate-50 dark:dark:bg-white/[0.02] p-2 overflow-hidden">
            <DayPicker
              mode="single"
              captionLayout="label"
              selected={selected || undefined}
              onSelect={handleSelect}
              showOutsideDays
              fixedWeeks
              locale={dayPickerLocale}
              dir={dir}
              classNames={dayPickerClassNames}
              formatters={{
                // Force Latin digits in the calendar while keeping Arabic month/weekday names.
                formatCaption: (date) => {
                  try {
                    return date.toLocaleDateString(latnLocale, {
                      month: "long",
                      year: "numeric",
                    });
                  } catch {
                    return "";
                  }
                },
                formatDay: (date) => {
                  try {
                    return new Intl.NumberFormat(latnLocale, {
                      useGrouping: false,
                    }).format(date.getDate());
                  } catch {
                    return String(date.getDate());
                  }
                },
              }}
              components={{
                Chevron: (props) => {
                  const className = props?.className || "";

                  if (dir === "rtl") {
                    // Keep arrows visually correct for RTL.
                    if (props.orientation === "left") {
                      return (
                        <ChevronRight
                          className={`${className} w-4 h-4 text-slate-700 dark:text-slate-700 dark:dark:text-white/70`}
                        />
                      );
                    }
                    return (
                      <ChevronLeft
                        className={`${className} w-4 h-4 text-slate-700 dark:text-slate-700 dark:dark:text-white/70`}
                      />
                    );
                  }

                  // Default LTR
                  if (props.orientation === "left") {
                    return (
                      <ChevronLeft
                        className={`${className} w-4 h-4 text-slate-700 dark:text-slate-700 dark:dark:text-white/70`}
                      />
                    );
                  }

                  return (
                    <ChevronRight
                      className={`${className} w-4 h-4 text-slate-700 dark:text-slate-700 dark:dark:text-white/70`}
                    />
                  );
                },
              }}
              // make sure the calendar always renders dark and consistently sized
              styles={{
                month_grid: { width: "100%" },
              }}
            />
          </div>

          {/* Time picker section */}
          {showTime ? (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-200 dark:dark:border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-500 dark:text-slate-500 dark:dark:text-white/50" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-700 dark:dark:text-white/70">
                  الوقت
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-500 dark:text-slate-500 dark:dark:text-white/45 mb-1">
                    الساعة
                  </label>
                  <select
                    value={
                      currentTime.hour !== "" ? Number(currentTime.hour) : ""
                    }
                    onChange={(e) => handleTimeChange("hour", e.target.value)}
                    className={`${ws.input} px-3 py-2.5 text-center text-sm w-full`}
                    style={{ appearance: "none", WebkitAppearance: "none" }}
                  >
                    <option value="" disabled>
                      --
                    </option>
                    {hourOptions.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-slate-500 dark:text-slate-500 dark:dark:text-white/50 text-lg font-bold mt-4">:</span>
                <div className="flex-1">
                  <label className="block text-[11px] text-slate-500 dark:text-slate-500 dark:dark:text-white/45 mb-1">
                    الدقيقة
                  </label>
                  <select
                    value={
                      currentTime.minute !== ""
                        ? Number(currentTime.minute)
                        : ""
                    }
                    onChange={(e) => handleTimeChange("minute", e.target.value)}
                    className={`${ws.input} px-3 py-2.5 text-center text-sm w-full`}
                    style={{ appearance: "none", WebkitAppearance: "none" }}
                  >
                    <option value="" disabled>
                      --
                    </option>
                    {minuteOptions.map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleTimeDone}
                  className={`${ws.btnPrimary} px-4 py-2.5 text-sm justify-center mt-4`}
                >
                  تم
                </button>
              </div>
            </div>
          ) : null}

          <div className="pt-2 text-xs text-slate-500 dark:text-slate-500 dark:dark:text-white/45">
            {showTime
              ? "* اختر التاريخ والوقت"
              : "* اختيار تاريخ بنمط Workspace (بدون واجهة المتصفح البيضاء)"}
          </div>
        </div>
      </GlassPopover>
    </div>
  );
}
