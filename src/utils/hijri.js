// Hijri (Umm al-Qura) ⇄ Gregorian conversion built on the platform
// Intl calendar (islamic-umalqura). Both Node 18+ and modern browsers
// ship this calendar, so no external dependency is needed.
//
// Storage contract used across the app:
//   - the canonical value is always the GREGORIAN ISO date "YYYY-MM-DD"
//     (so expiry alerts / sorting / DATE columns keep working);
//   - alongside it we persist which calendar the operator entered
//     ("gregory" | "umalqura") + the Hijri string for display.
//
// All conversions anchor at 12:00 UTC of the day to avoid any
// timezone rollover affecting which calendar day we resolve.

// Calendar id. The official Saudi Umm al-Qura (as printed on iqamas)
// matches Intl's "islamic-rgsa" (real Saudi sighting) — NOT
// "islamic-umalqura", whose ICU tables run a day ahead for some
// historical dates (e.g. 16 ذو القعدة 1416 resolves to 1996-04-04 under
// rgsa, matching official documents, but 1996-04-05 under umalqura).
// "islamic-rgsa" also reproduces every modern official anchor
// (1 رمضان 1445 = 2024-03-11, 1 محرم 1447 = 2025-06-26). Fall back to
// the next supported id if a runtime lacks rgsa.
const HIJRI_CALENDAR = (() => {
  const prefs = ["islamic-rgsa", "islamic", "islamic-umalqura"];
  for (const c of prefs) {
    try {
      const fmt = new Intl.DateTimeFormat(`en-US-u-ca-${c}`, {
        year: "numeric",
      });
      // resolvedOptions().calendar falls back to a generic id when the
      // requested calendar isn't supported — only accept an exact match.
      if (fmt.resolvedOptions().calendar === c) return c;
    } catch {
      // try next
    }
  }
  return "islamic-umalqura";
})();

const HIJRI_LOCALE = `en-US-u-ca-${HIJRI_CALENDAR}-nu-latn`;

const HIJRI_MONTHS_AR = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

export function hijriMonthName(m) {
  const i = Number(m) - 1;
  return HIJRI_MONTHS_AR[i] || String(m);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Gregorian ISO "YYYY-MM-DD" → { y, m, d } in the Umm al-Qura calendar.
export function gregorianToHijriParts(iso) {
  if (!iso) return null;
  const date = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat(HIJRI_LOCALE, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    }).formatToParts(date);
    const g = (t) => Number(parts.find((p) => p.type === t)?.value);
    const y = g("year");
    const m = g("month");
    const d = g("day");
    if (!y || !m || !d) return null;
    return { y, m, d };
  } catch {
    return null;
  }
}

// Gregorian ISO → Hijri "YYYY-MM-DD" string (Latin digits) or "" .
export function gregorianToHijri(iso) {
  const p = gregorianToHijriParts(iso);
  if (!p) return "";
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

// Hijri (y, m, d) → Gregorian ISO "YYYY-MM-DD".
// No native "parse Hijri" exists, so we estimate the Gregorian instant
// from the mean Hijri year length, then scan a small window reading the
// Umm al-Qura parts back until they match the requested Hijri date.
export function hijriToGregorian(hy, hm, hd) {
  const y = Number(hy);
  const m = Number(hm);
  const d = Number(hd);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 30) return "";

  const fmt = new Intl.DateTimeFormat(HIJRI_LOCALE, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
  const partsOf = (date) => {
    const parts = fmt.formatToParts(date);
    const g = (t) => Number(parts.find((p) => p.type === t)?.value);
    return { y: g("year"), m: g("month"), d: g("day") };
  };

  // Mean Hijri year ≈ 354.367 days; epoch (1 Muharram 1 AH) ≈ 622-07-19.
  const epoch = Date.UTC(622, 6, 19, 12, 0, 0);
  const approxDays = (y - 1) * 354.367 + (m - 1) * 29.5305 + (d - 1);
  let guess = epoch + Math.round(approxDays) * 86400000;

  // Scan ±15 days around the estimate — comfortably covers the drift of
  // the mean-year approximation vs the tabular Umm al-Qura calendar.
  for (let off = 0; off <= 15; off += 1) {
    for (const sign of off === 0 ? [0] : [1, -1]) {
      const cand = new Date(guess + sign * off * 86400000);
      const p = partsOf(cand);
      if (p.y === y && p.m === m && p.d === d) {
        return new Date(cand).toISOString().slice(0, 10);
      }
    }
  }
  return "";
}

// Number of days in a given Hijri month (29 or 30) per Umm al-Qura.
export function hijriMonthLength(hy, hm) {
  if (hijriToGregorian(hy, hm, 30)) return 30;
  return 29;
}

// Today's Hijri parts in Asia/Riyadh.
export function todayHijriPartsRiyadh() {
  try {
    const parts = new Intl.DateTimeFormat(HIJRI_LOCALE, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "Asia/Riyadh",
    }).formatToParts(new Date());
    const g = (t) => Number(parts.find((p) => p.type === t)?.value);
    return { y: g("year"), m: g("month"), d: g("day") };
  } catch {
    return null;
  }
}

// Pretty Hijri label "DD شهر YYYY هـ" from a Hijri "YYYY-MM-DD" string.
export function formatHijriLabel(hijriStr) {
  if (!hijriStr) return "";
  const [y, m, d] = String(hijriStr).split("-").map(Number);
  if (!y || !m || !d) return String(hijriStr);
  return `${d} ${hijriMonthName(m)} ${y} هـ`;
}
