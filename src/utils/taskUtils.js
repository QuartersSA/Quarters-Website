import { todayRiyadhDateKey } from "./dateUtils.js";

export function todayISO() {
  return todayRiyadhDateKey();
}

export function normalizeDate(value) {
  if (!value) return "";
  const s = String(value);
  if (s.includes("T")) return s.split("T")[0];
  return s;
}

export function isBeforeDate(a, b) {
  if (!a || !b) return false;
  return String(a) < String(b);
}

export function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0] ? parts[0][0] : "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
}

export function parseTags(value) {
  const s = String(value || "").trim();
  if (!s) return [];
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}
