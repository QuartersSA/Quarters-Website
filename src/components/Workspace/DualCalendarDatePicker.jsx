"use client";

import { useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import GlassSelect from "@/components/Workspace/GlassSelect";
import {
  gregorianToHijri,
  gregorianToHijriParts,
  hijriToGregorian,
  hijriMonthLength,
  hijriMonthName,
  formatHijriLabel,
  todayHijriPartsRiyadh,
} from "@/utils/hijri";

// Drop-in replacement for a single GlassDatePicker that lets the
// operator enter a date in EITHER the Gregorian (ميلادي) or Hijri
// (هجري) calendar. The canonical stored value is always the Gregorian
// ISO date (so expiry alerts / sorting keep working); alongside it we
// persist which calendar was entered + the Hijri "YYYY-MM-DD" string.
//
// Props:
//   gregorianValue : ISO "YYYY-MM-DD" | ""  (canonical source of truth)
//   calendar       : "gregory" | "umalqura"
//   hijriValue     : Hijri "YYYY-MM-DD" | ""
//   onChange(next) : next = { gregorian, calendar, hijri }
//   placeholder, allowClear

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Hijri year range for the selects. Comfortably brackets any iqama /
// health-card expiry an operator would enter.
const HIJRI_YEARS = (() => {
  const arr = [];
  for (let y = 1400; y <= 1480; y += 1) arr.push(y);
  return arr;
})();

export default function DualCalendarDatePicker({
  gregorianValue = "",
  calendar = "gregory",
  hijriValue = "",
  onChange,
  placeholder = "اختر التاريخ",
  allowClear = true,
}) {
  const cal = calendar === "umalqura" ? "umalqura" : "gregory";

  // The three Hijri selects derive from the stored hijriValue when in
  // Hijri mode; if it's missing we fall back to converting the stored
  // Gregorian date, then to today (Riyadh) so the selects never sit
  // blank.
  const hijriParts = useMemo(() => {
    if (hijriValue) {
      const [y, m, d] = String(hijriValue).split("-").map(Number);
      if (y && m && d) return { y, m, d };
    }
    return (
      gregorianToHijriParts(gregorianValue) ||
      todayHijriPartsRiyadh() || { y: 1446, m: 1, d: 1 }
    );
  }, [hijriValue, gregorianValue]);

  const emit = useCallback(
    (next) => {
      onChange?.(next);
    },
    [onChange],
  );

  // Toggle calendar. Keep the same underlying day across the flip:
  // → Hijri: seed selects from the current Gregorian (or today).
  // → Gregorian: keep gregorianValue, refresh its hijri mirror.
  const switchToGregory = useCallback(() => {
    if (cal === "gregory") return;
    emit({
      gregorian: gregorianValue || "",
      calendar: "gregory",
      hijri: gregorianValue ? gregorianToHijri(gregorianValue) : "",
    });
  }, [cal, emit, gregorianValue]);

  const switchToHijri = useCallback(() => {
    if (cal === "umalqura") return;
    const seed =
      gregorianToHijriParts(gregorianValue) ||
      todayHijriPartsRiyadh() || { y: 1446, m: 1, d: 1 };
    const g = hijriToGregorian(seed.y, seed.m, seed.d);
    emit({
      gregorian: g,
      calendar: "umalqura",
      hijri: `${seed.y}-${pad2(seed.m)}-${pad2(seed.d)}`,
    });
  }, [cal, emit, gregorianValue]);

  // Recompute Gregorian + hijri string whenever any Hijri select moves.
  // Day is clamped to the selected month's length so 30→29 month moves
  // never produce an invalid date.
  const onHijriChange = useCallback(
    (partial) => {
      const y = partial.y ?? hijriParts.y;
      const m = partial.m ?? hijriParts.m;
      let d = partial.d ?? hijriParts.d;
      const maxD = hijriMonthLength(y, m);
      if (d > maxD) d = maxD;
      const g = hijriToGregorian(y, m, d);
      emit({
        gregorian: g,
        calendar: "umalqura",
        hijri: `${y}-${pad2(m)}-${pad2(d)}`,
      });
    },
    [emit, hijriParts],
  );

  const clear = useCallback(() => {
    emit({ gregorian: "", calendar: cal, hijri: "" });
  }, [emit, cal]);

  const yearOptions = useMemo(
    () => HIJRI_YEARS.map((y) => ({ value: String(y), label: String(y) })),
    [],
  );
  const monthOptions = useMemo(() => {
    const arr = [];
    for (let m = 1; m <= 12; m += 1) {
      arr.push({ value: String(m), label: hijriMonthName(m) });
    }
    return arr;
  }, []);
  const dayOptions = useMemo(() => {
    const len = hijriMonthLength(hijriParts.y, hijriParts.m);
    const arr = [];
    for (let d = 1; d <= len; d += 1) {
      arr.push({ value: String(d), label: String(d) });
    }
    return arr;
  }, [hijriParts.y, hijriParts.m]);

  const hijriMirror = gregorianValue ? gregorianToHijri(gregorianValue) : "";

  return (
    <div dir="rtl">
      {/* Calendar toggle */}
      <div className={`${ws.segWrap} mb-2`}>
        <button
          type="button"
          onClick={switchToGregory}
          className={`${ws.segBtn} text-xs ${cal === "gregory" ? ws.segActive : ws.segInactive}`}
          aria-pressed={cal === "gregory"}
        >
          ميلادي
        </button>
        <button
          type="button"
          onClick={switchToHijri}
          className={`${ws.segBtn} text-xs ${cal === "umalqura" ? ws.segActive : ws.segInactive}`}
          aria-pressed={cal === "umalqura"}
        >
          هجري
        </button>
      </div>

      {cal === "gregory" ? (
        <div>
          <GlassDatePicker
            value={gregorianValue || ""}
            onChange={(iso) =>
              emit({
                gregorian: iso || "",
                calendar: "gregory",
                hijri: iso ? gregorianToHijri(iso) : "",
              })
            }
            placeholder={placeholder}
            allowClear={allowClear}
          />
          {gregorianValue && hijriMirror ? (
            <p className="text-xs text-slate-500 dark:text-white/45 mt-1" dir="rtl">
              هجري: {formatHijriLabel(hijriMirror)}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          {/* السنة على سطر كامل: قائمة GlassSelect تأخذ عرض زرها، فالعمود
              الضيّق (1/3) كان يقصّ سنة من 4 خانات (1448 → "...48"). شهر
              ويوم في سطر ثانٍ، الشهر أوسع لاسم مثل "جمادى الآخرة". */}
          <div className="space-y-2">
            {/* Year — full width so all 4 digits show */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/50 mb-1">
                السنة (هجري)
              </label>
              <GlassSelect
                value={String(hijriParts.y)}
                onChange={(v) => onHijriChange({ y: Number(v) })}
                options={yearOptions}
                placeholder="السنة"
                buttonClassName="px-3 py-3 text-sm"
              />
            </div>
            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
              {/* Month */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/50 mb-1">
                  الشهر
                </label>
                <GlassSelect
                  value={String(hijriParts.m)}
                  onChange={(v) => onHijriChange({ m: Number(v) })}
                  options={monthOptions}
                  placeholder="الشهر"
                  buttonClassName="px-3 py-3 text-sm"
                  menuClassName="min-w-[9rem]"
                />
              </div>
              {/* Day */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/50 mb-1">
                  اليوم
                </label>
                <GlassSelect
                  value={String(hijriParts.d)}
                  onChange={(v) => onHijriChange({ d: Number(v) })}
                  options={dayOptions}
                  placeholder="اليوم"
                  buttonClassName="px-3 py-3 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            {gregorianValue ? (
              <p className="text-xs text-slate-500 dark:text-white/45" dir="rtl">
                ميلادي: <span dir="ltr">{gregorianValue}</span>
              </p>
            ) : (
              <span />
            )}
            {allowClear && (gregorianValue || hijriValue) ? (
              <button
                type="button"
                onClick={clear}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 dark:text-white/45 dark:hover:text-red-300"
              >
                <X className="w-3.5 h-3.5" />
                مسح
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
