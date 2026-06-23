/**
 * Unified date utilities for Quarters Website.
 *
 * Project policy (Quarters Coffee Bar):
 *   - Business dates are Gregorian and pinned to Asia/Riyadh.
 *   - Hijri entry/display is allowed only in HR employee fields
 *     (iqama expiry + health-card expiry) through `src/utils/hijri.js`.
 *   - Display dates in Arabic month names but with Latin (Western) digits.
 *   - Use `LOCALE` constant everywhere instead of "ar-SA" / "ar-SA-u-nu-latn",
 *     since plain "ar-SA" defaults to the Umm al-Qura (Hijri) calendar in JS Intl.
 */

// Gregorian + Arabic month names + Latin digits
export const LOCALE = "ar-SA-u-ca-gregory-nu-latn";

/**
 * The DB stores `timestamp without time zone` but neon's JSON serializer
 * appends "Z", which JS then interprets as UTC and shifts ±3h on display.
 * Stripping the "Z" prevents that shift and keeps the stored wall-clock time.
 */
export function stripTZ(value) {
  if (!value) return value;
  return String(value).replace(/Z$/i, "");
}

/**
 * Format an ISO date string / Date as `YYYY-MM-DD` (input fields, query params, DB keys).
 */
export function formatDateForInput(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Like `formatDateForInput` but ALWAYS interprets the Date in Riyadh
 * (Asia/Riyadh) wall-clock, regardless of the runtime's local TZ.
 *
 * Use this when capturing "today" for business records — `new Date()`
 * + `getFullYear/Date` returned the runtime's TZ date, which on a UTC
 * SSR server (Railway) or a mis-configured browser produced
 * yesterday's date for users near midnight Riyadh time and tripped
 * backdate guards.
 */
export function formatRiyadhDateForInput(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const y = get("year");
    const m = get("month");
    const dd = get("day");
    if (!y || !m || !dd) return formatDateForInput(date);
    return `${y}-${m}-${dd}`;
  } catch {
    return formatDateForInput(date);
  }
}

/**
 * Today's business date as `YYYY-MM-DD` in Asia/Riyadh.
 *
 * Use this for export filenames, local draft keys, default filters, and
 * "today" values in business flows. Do not use `toISOString().split("T")[0]`
 * for those cases; it is UTC and flips to the wrong day around Riyadh
 * midnight.
 */
export function todayRiyadhDateKey() {
  return formatRiyadhDateForInput(new Date());
}

/** Format an instant for a datetime-local input in Riyadh wall-clock time. */
export function formatRiyadhDateTimeForInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    let hour = get("hour");
    if (hour === "24") hour = "00";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    const minute = get("minute");
    return year && month && day && hour && minute
      ? `${year}-${month}-${day}T${hour}:${minute}`
      : "";
  } catch {
    return "";
  }
}

/** Current hour (0-23) in Asia/Riyadh. */
export function currentRiyadhHour() {
  const hour = Number(formatRiyadhDateTimeForInput().slice(11, 13));
  return Number.isFinite(hour) ? hour : 0;
}

/**
 * Business date offset from Riyadh today as `YYYY-MM-DD`.
 */
export function riyadhDateKeyFromOffset(days = 0) {
  const n = Number(days);
  const offset = Number.isFinite(n) ? Math.trunc(n) : 0;
  const today = todayRiyadhDateKey();
  if (!offset) return today;

  const d = new Date(`${today}T00:00:00+03:00`);
  d.setUTCDate(d.getUTCDate() + offset);
  return formatRiyadhDateForInput(d);
}

/**
 * Business date month offset from Riyadh today as `YYYY-MM-DD`.
 */
export function riyadhDateKeyFromMonthOffset(months = 0) {
  const n = Number(months);
  const offset = Number.isFinite(n) ? Math.trunc(n) : 0;
  const today = todayRiyadhDateKey();
  if (!offset) return today;

  const [year, month, day] = today.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

/** Current business month as `YYYY-MM`, pinned to Asia/Riyadh. */
export function currentRiyadhMonthKey() {
  return todayRiyadhDateKey().slice(0, 7);
}

/** Business month offset from Riyadh's current month as `YYYY-MM`. */
export function riyadhMonthKeyFromOffset(months = 0) {
  const n = Number(months);
  const offset = Number.isFinite(n) ? Math.trunc(n) : 0;
  const [year, month] = currentRiyadhMonthKey().split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Display format helpers (date / date-time / time only).
 *
 * Storage convention (post-fix): the DB stores the **real moment** in
 * UTC. Neon serializes it with a trailing "Z" — that "Z" is correct
 * here, not a quirk to be stripped. To render in Riyadh wall-clock we
 * just parse the ISO normally and pin `timeZone: "Asia/Riyadh"` on the
 * Intl formatter. This produces the local Riyadh time the user expects
 * regardless of the runtime (SSR on Railway UTC, client in any browser
 * TZ, etc.).
 *
 * The earlier `stripTZ` + LOCAL approach treated the stored moment as
 * if it were already a wall-clock string, which silently showed the
 * UTC wall-clock literal in the UI — 3 hours behind real Riyadh time.
 */
export function formatDate(value, options = {}) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Riyadh",
      ...options,
    });
  } catch {
    return String(value).slice(0, 10);
  }
}

/**
 * Format with date + time. Example: "11 مايو 2026، 14:30"
 */
export function formatDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Riyadh",
    });
  } catch {
    return String(value);
  }
}

/**
 * Format time only. Example: "14:30"
 */
export function formatTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Riyadh",
    });
  } catch {
    return "—";
  }
}

/**
 * Parse a user-entered datetime string preserving local time.
 *
 * Accepts:
 *   - "2026-05-11"            → 2026-05-11 00:00:00 local
 *   - "2026-05-11T14:30"      → 2026-05-11 14:30:00 local
 *   - "2026-05-11 14:30:00"   → 2026-05-11 14:30:00 local
 *   - ISO with Z              → preserved as-is
 *
 * Returns Date object or null if invalid.
 */
export function parseUserDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Date-only — append local midnight to avoid UTC interpretation.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00+03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    const d = new Date(`${str}+03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(str)) {
    const d = new Date(`${str.replace(" ", "T")}+03:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Convert a Date (or parseable string) to the format the DB expects:
 * `YYYY-MM-DD HH:mm:ss` — local wall-clock, no timezone marker.
 * Pairs with the `TIMESTAMP without time zone` column type so what the user
 * typed is exactly what's stored and displayed.
 */
export function toDbTimestamp(value) {
  const d = value instanceof Date ? value : parseUserDate(value);
  if (!d) return null;
  const local = formatRiyadhDateTimeForInput(d);
  return local ? `${local.replace("T", " ")}:00` : null;
}

/**
 * Validate that a date is within sensible business bounds.
 * Returns { ok, error } where error is an Arabic message.
 *
 * Options:
 *   - allowFuture: number of days in the future allowed (default: 1 — allows today + slight buffer)
 *   - minYear: oldest allowed year (default: 2020)
 *   - label: name of the field for error message (default: "التاريخ")
 */
export function validateBusinessDate(value, options = {}) {
  const { allowFuture = 1, minYear = 2020, label = "التاريخ" } = options;
  const d = parseUserDate(value);
  if (!d) return { ok: false, error: `${label} غير صالح` };

  const year = Number(formatRiyadhDateForInput(d).slice(0, 4));
  if (year < minYear) {
    return { ok: false, error: `${label} قديم جداً (قبل ${minYear})` };
  }

  const now = new Date();
  const maxFuture = new Date(now.getTime() + allowFuture * 24 * 60 * 60 * 1000);
  if (d > maxFuture) {
    return { ok: false, error: `${label} في المستقبل غير مقبول` };
  }

  return { ok: true, date: d };
}

/** Validate and normalize a user-entered Riyadh wall-clock timestamp for SQL. */
export function parseBusinessTimestamp(value, options = {}) {
  const result = validateBusinessDate(value, options);
  return result.ok ? toDbTimestamp(result.date) : null;
}
