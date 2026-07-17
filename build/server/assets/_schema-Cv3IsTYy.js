import sql from './sql-CSDV1lSC.js';

// Shared idempotent schema migration for the marketing module.
// Called by each marketing route at the top of every request so the
// tables exist on first hit without needing a separate migration
// step. Once the tables exist further calls are near-no-ops.

let schemaReadyPromise = null;
function ensureMarketingSchema() {
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
            invited_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        // Additive column for the "تمت الدعوة" tracking state on tables
        // that predate this column. State values now include 'invited'
        // between 'pending' and 'active'.
        await sql`
          ALTER TABLE marketing_bloggers
            ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ
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

        // Single-row settings table — fixed id=1 record. Defaults match
        // the official Quarters Bar brand (olive sage, serif wordmark).
        await sql`
          CREATE TABLE IF NOT EXISTS marketing_settings (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            cafe_name TEXT NOT NULL DEFAULT 'QUARTERS',
            cafe_name_ar TEXT NOT NULL DEFAULT 'كوارتـــرز',
            cafe_tagline TEXT NOT NULL DEFAULT 'BAR',
            logo_letter TEXT NOT NULL DEFAULT 'Q',
            accent_color TEXT NOT NULL DEFAULT '#7a8b5f',
            cream_color TEXT NOT NULL DEFAULT '#e8e9d6',
            welcome_headline TEXT NOT NULL DEFAULT 'أهلاً بك في كوارترز',
            welcome_subtext TEXT NOT NULL DEFAULT 'ضيافة من القلب',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `;

        // Idempotent column additions for older rows.
        await sql`ALTER TABLE marketing_settings ADD COLUMN IF NOT EXISTS cafe_name_ar TEXT NOT NULL DEFAULT 'كوارتـــرز'`;
        await sql`ALTER TABLE marketing_settings ADD COLUMN IF NOT EXISTS cafe_tagline TEXT NOT NULL DEFAULT 'BAR'`;
        await sql`ALTER TABLE marketing_settings ADD COLUMN IF NOT EXISTS cream_color TEXT NOT NULL DEFAULT '#e8e9d6'`;

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
function generateSlugSuffix(len = 4) {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}
function slugifyName(name) {
  const cleaned = String(name || "").trim().toUpperCase().replace(/[^A-Z0-9\s؀-ۿ]/g, "").replace(/\s+/g, "").slice(0, 8);
  // Strip Arabic — Latin only for URL-safe slugs.
  const latin = cleaned.replace(/[^A-Z0-9]/g, "");
  return latin || "GUEST";
}

export { ensureMarketingSchema as e, generateSlugSuffix as g, slugifyName as s };
