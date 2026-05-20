// POST /api/marketing/bloggers/:id/mark-invited
//
// Flips a blogger's state from 'pending' to 'invited' and stamps
// `invited_at`. Idempotent: calling it again on an already-invited
// blogger returns 200 with the existing row. Once a blogger is
// 'active' (cashier-activated) we don't allow walking the state
// backward — returns 409.

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureMarketingSchema } from "../../../_schema.js";

const REQUIRE_MARKETING = {
  role: "Admin",
  permission: "can_manage_marketing",
};

export async function POST(request, { params }) {
  const auth = requireAuth(request, REQUIRE_MARKETING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  await ensureMarketingSchema();

  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({ error: "id غير صحيح" }, { status: 400 });
  }

  const [existing] = await sql`
    SELECT id, state FROM marketing_bloggers WHERE id = ${id} LIMIT 1
  `;
  if (!existing) {
    return Response.json({ error: "البلوقر غير موجود" }, { status: 404 });
  }

  if (existing.state === "active") {
    return Response.json(
      { error: "البلوقر مُفعَّل بالفعل، لا يمكن إرجاع الحالة" },
      { status: 409 },
    );
  }

  if (existing.state === "invited") {
    const [row] = await sql`
      SELECT id, name, handle, phone, note, slug, state,
             activated_at, activated_by_employee_id, activated_by_employee_name,
             invited_at, created_at, updated_at
        FROM marketing_bloggers
       WHERE id = ${id}
    `;
    return Response.json({ blogger: row, alreadyInvited: true });
  }

  const [row] = await sql`
    UPDATE marketing_bloggers
       SET state = 'invited',
           invited_at = NOW(),
           updated_at = NOW()
     WHERE id = ${id}
       AND state = 'pending'
     RETURNING id, name, handle, phone, note, slug, state,
               activated_at, activated_by_employee_id, activated_by_employee_name,
               invited_at, created_at, updated_at
  `;
  if (!row) {
    return Response.json(
      { error: "تعذّر تحديث الحالة" },
      { status: 409 },
    );
  }
  return Response.json({ blogger: row });
}
