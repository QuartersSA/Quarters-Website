/**
 * Unified date utilities for Quarters Website.
 *
 * Project policy (Quarters Coffee Bar):
 *   - **Gregorian calendar ONLY** — never Hijri.
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
 * Format `YYYY-MM-DD` (date only, Gregorian, Arabic).
 * Example: "11 مايو 2026"
 */
export function formatDate(value, options = {}) {
  if (!value) return "—";
  try {
    const d = new Date(stripTZ(value));
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
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
    const d = new Date(stripTZ(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    const d = new Date(stripTZ(value));
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
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
    const d = new Date(`${str}T00:00:00`);
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
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mn}:${ss}`;
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

  const year = d.getFullYear();
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
