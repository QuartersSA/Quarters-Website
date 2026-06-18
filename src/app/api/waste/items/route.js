import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// Items eligible for waste logging: ACTIVE items whose category is
// "مخبوزات" (baked goods) or "حلويات" (sweets/desserts). Authed for
// the waste permission so a waste-only employee (no can_do_inventory)
// can still load the list. Matches by category name in both Arabic
// and English so the catalog's naming doesn't have to be exact.
//
// Branch is irrelevant to which items are eligible — the same baked/
// sweet catalog applies everywhere — so this returns the full
// eligible set and the page records quantities against the logged-in
// branch.
export async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Employee", permission: "can_log_waste" },
      { role: "Admin", permission: "can_manage_accounting" },
      { role: "Admin", permission: "can_manage_inventory" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const items = await sql`
      SELECT
        i.id,
        i.name,
        i.name_en,
        i.unit,
        i.category_id,
        c.name AS category_name,
        c.name_en AS category_name_en
      FROM items i
      JOIN item_categories c ON c.id = i.category_id
      WHERE i.is_active = true
        AND (
          c.name ILIKE '%مخبوز%'
          OR c.name ILIKE '%حلويات%'
          OR c.name ILIKE '%حلوي%'
          OR c.name ILIKE '%حلى%'
          OR c.name_en ILIKE '%baker%'
          OR c.name_en ILIKE '%baked%'
          OR c.name_en ILIKE '%pastr%'
          OR c.name_en ILIKE '%sweet%'
          OR c.name_en ILIKE '%dessert%'
        )
      ORDER BY c.name ASC, i.name ASC
    `;

    return Response.json(items);
  } catch (error) {
    console.error("waste items GET error", error);
    return Response.json(
      { error: "فشل تحميل الأصناف", details: error.message },
      { status: 500 },
    );
  }
}
