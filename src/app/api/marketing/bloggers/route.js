// GET    /api/marketing/bloggers              — list all
// POST   /api/marketing/bloggers              — create (auto-slug)
// PUT    /api/marketing/bloggers (body.id)    — update
// DELETE /api/marketing/bloggers?id=...       — delete

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  ensureMarketingSchema,
  generateSlugSuffix,
  slugifyName,
} from "../_schema.js";

const REQUIRE_MARKETING = {
  role: "Admin",
  permission: "can_manage_marketing",
};

export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_MARKETING);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  await ensureMarketingSchema();

  const rows = await sql`
    SELECT id, name, handle, phone, note, slug, state,
           activated_at, activated_by_employee_id, activated_by_employee_name,
           created_at, updated_at
      FROM marketing_bloggers
     ORDER BY created_at DESC, id DESC
  `;
  return Response.json({ bloggers: rows });
}

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_MARKETING);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  await ensureMarketingSchema();

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return Response.json({ error: "الاسم مطلوب" }, { status: 400 });

  const handle = body.handle ? String(body.handle).trim().replace(/^@/, "") : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const note = body.note ? String(body.note).trim() : null;

  // Slug = NAME-SUFFIX. Retry up to 5 times on collision (very rare
  // given 32^4 alphabet but worth handling).
  const base = slugifyName(name);
  let slug = null;
  for (let i = 0; i < 5; i += 1) {
    const candidate = `${base}-${generateSlugSuffix(4)}`;
    const [exists] = await sql`SELECT 1 FROM marketing_bloggers WHERE slug = ${candidate} LIMIT 1`;
    if (!exists) {
      slug = candidate;
      break;
    }
  }
  if (!slug) {
    return Response.json({ error: "تعذّر توليد كود فريد، حاول مجدداً" }, { status: 500 });
  }

  const [row] = await sql`
    INSERT INTO marketing_bloggers (name, handle, phone, note, slug, state)
    VALUES (${name}, ${handle}, ${phone}, ${note}, ${slug}, 'pending')
    RETURNING id, name, handle, phone, note, slug, state, created_at, updated_at
  `;
  return Response.json({ blogger: row }, { status: 201 });
}

export async function PUT(request) {
  const auth = requireAuth(request, REQUIRE_MARKETING);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  await ensureMarketingSchema();

  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: "id مطلوب" }, { status: 400 });
  }

  const name = body.name !== undefined ? String(body.name).trim() : null;
  if (name !== null && !name) {
    return Response.json({ error: "الاسم لا يمكن أن يكون فارغاً" }, { status: 400 });
  }
  const handle = body.handle !== undefined
    ? (body.handle ? String(body.handle).trim().replace(/^@/, "") : null)
    : undefined;
  const phone = body.phone !== undefined
    ? (body.phone ? String(body.phone).trim() : null)
    : undefined;
  const note = body.note !== undefined
    ? (body.note ? String(body.note).trim() : null)
    : undefined;

  // Build dynamic UPDATE. Only touch fields that were sent.
  const sets = [];
  const vals = [];
  let idx = 1;
  if (name !== null) {
    sets.push(`name = $${idx}`);
    vals.push(name);
    idx += 1;
  }
  if (handle !== undefined) {
    sets.push(`handle = $${idx}`);
    vals.push(handle);
    idx += 1;
  }
  if (phone !== undefined) {
    sets.push(`phone = $${idx}`);
    vals.push(phone);
    idx += 1;
  }
  if (note !== undefined) {
    sets.push(`note = $${idx}`);
    vals.push(note);
    idx += 1;
  }
  if (sets.length === 0) {
    return Response.json({ error: "لا توجد حقول للتعديل" }, { status: 400 });
  }
  sets.push(`updated_at = NOW()`);
  vals.push(id);

  const query = `
    UPDATE marketing_bloggers
       SET ${sets.join(", ")}
     WHERE id = $${idx}
     RETURNING id, name, handle, phone, note, slug, state,
               activated_at, activated_by_employee_id, activated_by_employee_name,
               created_at, updated_at
  `;
  const [row] = await sql(query, vals);
  if (!row) return Response.json({ error: "غير موجود" }, { status: 404 });
  return Response.json({ blogger: row });
}

export async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_MARKETING);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  await ensureMarketingSchema();

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: "id مطلوب" }, { status: 400 });
  }
  const [row] = await sql`
    DELETE FROM marketing_bloggers WHERE id = ${id}
    RETURNING id
  `;
  if (!row) return Response.json({ error: "غير موجود" }, { status: 404 });
  return Response.json({ ok: true, id: row.id });
}
