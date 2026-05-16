import { s as sql } from './sql-BfhTxwII.js';
import { e as ensureMarketingSchema } from './_schema-DJCyIsi1.js';
import '@neondatabase/serverless';

// GET /api/marketing/welcome/<slug>
// PUBLIC — no auth. The welcome page calls this on mount.
// Returns blogger + menu + settings in a single payload.

async function GET(_request, {
  params
}) {
  await ensureMarketingSchema();
  const slug = String(params?.slug || "").trim();
  if (!slug) return Response.json({
    error: "الكود مطلوب"
  }, {
    status: 400
  });
  const [blogger] = await sql`
    SELECT id, name, slug, state, activated_at, activated_by_employee_name, note
      FROM marketing_bloggers
     WHERE slug = ${slug}
     LIMIT 1
  `;
  if (!blogger) {
    return Response.json({
      error: "الكود غير موجود"
    }, {
      status: 404
    });
  }

  // Menu — only active items. Welcome page groups by category client-side.
  const items = await sql`
    SELECT id, category, name_ar, name_en, description, price, sort_order
      FROM marketing_menu_items
     WHERE is_active = TRUE
     ORDER BY category ASC, sort_order ASC, id ASC
  `;
  const [settings] = await sql`SELECT * FROM marketing_settings WHERE id = 1 LIMIT 1`;
  return Response.json({
    blogger,
    items,
    settings
  });
}

export { GET };
