import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureMarketingSchema } from './_schema-DJCyIsi1.js';
import '@neondatabase/serverless';
import 'crypto';

// GET    /api/marketing/menu       — list (admin) — flat list
// POST   /api/marketing/menu       — create
// PUT    /api/marketing/menu       — update by id
// DELETE /api/marketing/menu?id=   — delete

const ADMIN_ANY = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_inventory"
  }, {
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_access_hr"
  }]
};
async function GET(request) {
  const auth = requireAuth(request, ADMIN_ANY);
  if (!auth.ok) return Response.json({
    error: auth.error
  }, {
    status: auth.status
  });
  await ensureMarketingSchema();
  const rows = await sql`
    SELECT id, category, name_ar, name_en, description, price, sort_order, is_active,
           created_at, updated_at
      FROM marketing_menu_items
     ORDER BY category ASC, sort_order ASC, id ASC
  `;
  return Response.json({
    items: rows
  });
}
async function POST(request) {
  const auth = requireAuth(request, ADMIN_ANY);
  if (!auth.ok) return Response.json({
    error: auth.error
  }, {
    status: auth.status
  });
  await ensureMarketingSchema();
  const b = await request.json().catch(() => ({}));
  const category = String(b.category || "").trim();
  const name_ar = String(b.name_ar || "").trim();
  if (!category) return Response.json({
    error: "التصنيف مطلوب"
  }, {
    status: 400
  });
  if (!name_ar) return Response.json({
    error: "الاسم بالعربي مطلوب"
  }, {
    status: 400
  });
  const name_en = b.name_en ? String(b.name_en).trim() : null;
  const description = b.description ? String(b.description).trim() : null;
  const price = b.price === null || b.price === undefined || b.price === "" ? null : Number(b.price);
  if (price !== null && (!Number.isFinite(price) || price < 0)) {
    return Response.json({
      error: "السعر غير صحيح"
    }, {
      status: 400
    });
  }
  const sort_order = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;
  const is_active = b.is_active === undefined ? true : !!b.is_active;
  const [row] = await sql`
    INSERT INTO marketing_menu_items
      (category, name_ar, name_en, description, price, sort_order, is_active)
    VALUES
      (${category}, ${name_ar}, ${name_en}, ${description}, ${price}, ${sort_order}, ${is_active})
    RETURNING id, category, name_ar, name_en, description, price, sort_order, is_active,
              created_at, updated_at
  `;
  return Response.json({
    item: row
  }, {
    status: 201
  });
}
async function PUT(request) {
  const auth = requireAuth(request, ADMIN_ANY);
  if (!auth.ok) return Response.json({
    error: auth.error
  }, {
    status: auth.status
  });
  await ensureMarketingSchema();
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({
      error: "id مطلوب"
    }, {
      status: 400
    });
  }
  const sets = [];
  const vals = [];
  let idx = 1;
  const push = (col, val) => {
    sets.push(`${col} = $${idx}`);
    vals.push(val);
    idx += 1;
  };
  if (b.category !== undefined) {
    const v = String(b.category).trim();
    if (!v) return Response.json({
      error: "التصنيف لا يمكن أن يكون فارغاً"
    }, {
      status: 400
    });
    push("category", v);
  }
  if (b.name_ar !== undefined) {
    const v = String(b.name_ar).trim();
    if (!v) return Response.json({
      error: "الاسم لا يمكن أن يكون فارغاً"
    }, {
      status: 400
    });
    push("name_ar", v);
  }
  if (b.name_en !== undefined) push("name_en", b.name_en ? String(b.name_en).trim() : null);
  if (b.description !== undefined) push("description", b.description ? String(b.description).trim() : null);
  if (b.price !== undefined) {
    const v = b.price === null || b.price === "" ? null : Number(b.price);
    if (v !== null && (!Number.isFinite(v) || v < 0)) {
      return Response.json({
        error: "السعر غير صحيح"
      }, {
        status: 400
      });
    }
    push("price", v);
  }
  if (b.sort_order !== undefined) {
    const v = Number(b.sort_order);
    if (!Number.isFinite(v)) {
      return Response.json({
        error: "ترتيب غير صحيح"
      }, {
        status: 400
      });
    }
    push("sort_order", v);
  }
  if (b.is_active !== undefined) push("is_active", !!b.is_active);
  if (sets.length === 0) {
    return Response.json({
      error: "لا توجد حقول للتعديل"
    }, {
      status: 400
    });
  }
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const query = `
    UPDATE marketing_menu_items
       SET ${sets.join(", ")}
     WHERE id = $${idx}
     RETURNING id, category, name_ar, name_en, description, price, sort_order, is_active,
               created_at, updated_at
  `;
  const [row] = await sql(query, vals);
  if (!row) return Response.json({
    error: "غير موجود"
  }, {
    status: 404
  });
  return Response.json({
    item: row
  });
}
async function DELETE(request) {
  const auth = requireAuth(request, ADMIN_ANY);
  if (!auth.ok) return Response.json({
    error: auth.error
  }, {
    status: auth.status
  });
  await ensureMarketingSchema();
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return Response.json({
      error: "id مطلوب"
    }, {
      status: 400
    });
  }
  const [row] = await sql`DELETE FROM marketing_menu_items WHERE id = ${id} RETURNING id`;
  if (!row) return Response.json({
    error: "غير موجود"
  }, {
    status: 404
  });
  return Response.json({
    ok: true,
    id: row.id
  });
}

export { DELETE, GET, POST, PUT };
