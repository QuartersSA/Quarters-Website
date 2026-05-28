import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureMarketingSchema } from './_schema-D3GCdwVm.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/marketing/settings — also PUBLIC (welcome page reads cafe
//   name + logo letter + accent + welcome copy to render the screen).
// PUT /api/marketing/settings — admin only.

const REQUIRE_MARKETING = {
  role: "Admin",
  permission: "can_manage_marketing"
};
async function GET(_request) {
  await ensureMarketingSchema();
  const [row] = await sql`SELECT * FROM marketing_settings WHERE id = 1 LIMIT 1`;
  return Response.json({
    settings: row || null
  });
}
async function PUT(request) {
  const auth = requireAuth(request, REQUIRE_MARKETING);
  if (!auth.ok) return Response.json({
    error: auth.error
  }, {
    status: auth.status
  });
  await ensureMarketingSchema();
  const b = await request.json().catch(() => ({}));
  const sets = [];
  const vals = [];
  let idx = 1;
  const push = (col, val) => {
    sets.push(`${col} = $${idx}`);
    vals.push(val);
    idx += 1;
  };
  if (b.cafe_name !== undefined) {
    const v = String(b.cafe_name).trim();
    if (!v) return Response.json({
      error: "الاسم لا يمكن أن يكون فارغاً"
    }, {
      status: 400
    });
    push("cafe_name", v);
  }
  if (b.cafe_name_ar !== undefined) {
    push("cafe_name_ar", String(b.cafe_name_ar).trim());
  }
  if (b.cafe_tagline !== undefined) {
    push("cafe_tagline", String(b.cafe_tagline).trim());
  }
  if (b.logo_letter !== undefined) {
    const v = String(b.logo_letter).trim().slice(0, 4);
    if (!v) return Response.json({
      error: "الحرف لا يمكن أن يكون فارغاً"
    }, {
      status: 400
    });
    push("logo_letter", v);
  }
  if (b.accent_color !== undefined) {
    const v = String(b.accent_color).trim();
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(v)) {
      return Response.json({
        error: "اللون غير صحيح (#RRGGBB)"
      }, {
        status: 400
      });
    }
    push("accent_color", v);
  }
  if (b.cream_color !== undefined) {
    const v = String(b.cream_color).trim();
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(v)) {
      return Response.json({
        error: "لون الكريم غير صحيح"
      }, {
        status: 400
      });
    }
    push("cream_color", v);
  }
  if (b.welcome_headline !== undefined) {
    push("welcome_headline", String(b.welcome_headline).trim());
  }
  if (b.welcome_subtext !== undefined) {
    push("welcome_subtext", String(b.welcome_subtext).trim());
  }
  if (sets.length === 0) {
    return Response.json({
      error: "لا توجد حقول للتعديل"
    }, {
      status: 400
    });
  }
  sets.push(`updated_at = NOW()`);
  const query = `
    UPDATE marketing_settings
       SET ${sets.join(", ")}
     WHERE id = 1
     RETURNING *
  `;
  const [row] = await sql(query, vals);
  return Response.json({
    settings: row
  });
}

export { GET, PUT };
