// Shared idempotent schema migration for the marketing module.
// Called by each marketing route at the top of every request so the
// tables exist on first hit without needing a separate migration
// step. Once the tables exist further calls are near-no-ops.

import sql from "@/app/api/utils/sql";

let schemaReadyPromise = null;

export function ensureMarketingSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS marketing_bloggers (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            handle TEXT,
            phone TEXT,
            note TEXT,
            slug TEXT NOT NULL UNIQUE,
            state TEXT NOT NULL DEFAULT 'pending',
            activated_at TIMESTAMPTZ,
            activated_by_employee_id INTEGER,
            activated_by_employee_name TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        await sql`
          CREATE TABLE IF NOT EXISTS marketing_menu_items (
            id SERIAL PRIMARY KEY,
            category TEXT NOT NULL,
            name_ar TEXT NOT NULL,
            name_en TEXT,
            description TEXT,
            price NUMERIC(10, 2),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        // Single-row settings table — using a fixed id=1 record. Cleaner
        // than a KV table for the small fixed set we need here.
        await sql`
          CREATE TABLE IF NOT EXISTS marketing_settings (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            cafe_name TEXT NOT NULL DEFAULT 'Quarters Coffee Bar',
            logo_letter TEXT NOT NULL DEFAULT 'Q',
            accent_color TEXT NOT NULL DEFAULT '#10b981',
            welcome_headline TEXT NOT NULL DEFAULT 'مرحباً بك في Quarters',
            welcome_subtext TEXT NOT NULL DEFAULT 'استمتع بتجربتك معنا',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        // Seed the single settings row if missing.
        await sql`
          INSERT INTO marketing_settings (id)
          VALUES (1)
          ON CONFLICT (id) DO NOTHING
        `;
      } catch (e) {
        // Don't permanently cache the failure — retry on next call.
        console.error("marketing schema ensure error", e?.message);
        schemaReadyPromise = null;
        throw e;
      }
    })();
  }
  return schemaReadyPromise;
}

// 4-char alphanumeric suffix (uppercase, no easily-confused chars).
// Combined with the blogger's first-name initial, slugs read like
// "RC-AHMD-7K2P" and stay short enough to type in a pinch.
const SLUG_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateSlugSuffix(len = 4) {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}

export function slugifyName(name) {
  const cleaned = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s؀-ۿ]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 8);
  // Strip Arabic — Latin only for URL-safe slugs.
  const latin = cleaned.replace(/[^A-Z0-9]/g, "");
  return latin || "GUEST";
}
