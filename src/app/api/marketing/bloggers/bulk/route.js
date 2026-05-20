// POST /api/marketing/bloggers/bulk
//
// Body: { bloggers: [{ name, handle?, phone?, note? }, ...] }
//
// Bulk-creates bloggers in one request. Each row gets a fresh
// auto-generated slug (NAME-XXXX). Rows with no `name` are skipped
// and surfaced under `skipped`. Slug collisions retry up to 5 times
// per row before falling through to the skipped list.
//
// Response:
//   { created: [{name, slug, ...}, ...], skipped: [{row, reason}, ...] }

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  ensureMarketingSchema,
  generateSlugSuffix,
  slugifyName,
} from "../../_schema.js";

const REQUIRE_MARKETING = {
  role: "Admin",
  permission: "can_manage_marketing",
};

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_MARKETING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  await ensureMarketingSchema();

  const body = await request.json().catch(() => ({}));
  const rows = Array.isArray(body?.bloggers) ? body.bloggers : null;
  if (!rows) {
    return Response.json(
      { error: "صيغة البيانات غير صحيحة" },
      { status: 400 },
    );
  }
  if (rows.length === 0) {
    return Response.json(
      { error: "لا توجد بلوقرز في الملف" },
      { status: 400 },
    );
  }
  if (rows.length > 500) {
    return Response.json(
      { error: "الحد الأقصى 500 بلوقر في كل رفعة" },
      { status: 400 },
    );
  }

  const created = [];
  const skipped = [];

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i] || {};
    const name = String(r.name || "").trim();

    if (!name) {
      skipped.push({ row: i + 1, reason: "الاسم مطلوب" });
      continue;
    }

    const handle = r.handle
      ? String(r.handle).trim().replace(/^@/, "")
      : null;
    const phone = r.phone ? String(r.phone).trim() : null;
    const note = r.note ? String(r.note).trim() : null;

    const base = slugifyName(name);
    let slug = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}-${generateSlugSuffix(4)}`;
      const [exists] = await sql`
        SELECT 1 FROM marketing_bloggers WHERE slug = ${candidate} LIMIT 1
      `;
      if (!exists) {
        slug = candidate;
        break;
      }
    }
    if (!slug) {
      skipped.push({ row: i + 1, reason: "تعذّر توليد كود فريد" });
      continue;
    }

    try {
      const [inserted] = await sql`
        INSERT INTO marketing_bloggers (name, handle, phone, note, slug, state)
        VALUES (${name}, ${handle}, ${phone}, ${note}, ${slug}, 'pending')
        RETURNING id, name, handle, phone, note, slug, state, created_at, updated_at
      `;
      created.push(inserted);
    } catch (err) {
      console.error("bulk blogger insert failed", err);
      skipped.push({
        row: i + 1,
        reason: err?.message || "فشل الحفظ",
      });
    }
  }

  return Response.json({
    created,
    skipped,
    counts: {
      total: rows.length,
      created: created.length,
      skipped: skipped.length,
    },
  });
}
