import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

async function ensureSchema() {
  try {
    await sql`
      ALTER TABLE item_categories
      ADD COLUMN IF NOT EXISTS show_in_inventory BOOLEAN NOT NULL DEFAULT TRUE
    `;
  } catch (error) {
    console.error("ensureSchema item_categories.show_in_inventory:", error?.message);
  }
}
function categoryAuthRules() {
  return [{
    role: "Admin",
    permission: "can_manage_inventory"
  }, {
    role: "Admin",
    permission: "can_manage_accounting"
  }];
}
async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [...categoryAuthRules(), {
      role: "Employee",
      permission: "can_do_inventory"
    }]
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const rows = scope === "purchases" ? await sql`
            SELECT id, name, name_en, show_in_inventory, created_at
            FROM item_categories
            ORDER BY name ASC
          ` : await sql`
            SELECT id, name, name_en, show_in_inventory, created_at
            FROM item_categories
            WHERE show_in_inventory IS DISTINCT FROM FALSE
            ORDER BY name ASC
          `;
    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching item categories:", error);
    return Response.json({
      error: "Failed to fetch item categories"
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: categoryAuthRules()
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json();
    const nameRaw = body?.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    const nameEnRaw = body?.name_en;
    const name_en = typeof nameEnRaw === "string" ? nameEnRaw.trim() : "";
    const showInInventory = body?.show_in_inventory !== undefined ? !!body.show_in_inventory : true;
    if (!name) {
      return Response.json({
        error: "اسم الفئة (عربي) مطلوب"
      }, {
        status: 400
      });
    }
    if (!name_en) {
      return Response.json({
        error: "اسم الفئة (إنجليزي) مطلوب"
      }, {
        status: 400
      });
    }
    await ensureSchema();
    try {
      const inserted = await sql`
        INSERT INTO item_categories (name, name_en, show_in_inventory)
        VALUES (${name}, ${name_en}, ${showInInventory})
        RETURNING id, name, name_en, show_in_inventory, created_at
      `;
      return Response.json(inserted[0], {
        status: 201
      });
    } catch (err) {
      // likely unique constraint
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.includes("unique")) {
        return Response.json({
          error: "هذه الفئة موجودة مسبقاً"
        }, {
          status: 409
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error creating item category:", error);
    return Response.json({
      error: "Failed to create item category"
    }, {
      status: 500
    });
  }
}
async function PUT(request) {
  const auth = requireAuth(request, {
    anyOf: categoryAuthRules()
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json();
    const idRaw = body?.id;
    const id = typeof idRaw === "number" ? idRaw : parseInt(String(idRaw));
    const nameRaw = body?.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
    const nameEnRaw = body?.name_en;
    const name_en = typeof nameEnRaw === "string" ? nameEnRaw.trim() : "";
    const hasScope = body?.show_in_inventory !== undefined;
    const showInInventory = hasScope ? !!body.show_in_inventory : null;
    if (!id || Number.isNaN(id)) {
      return Response.json({
        error: "معرّف الفئة مطلوب"
      }, {
        status: 400
      });
    }
    if (!name) {
      return Response.json({
        error: "اسم الفئة (عربي) مطلوب"
      }, {
        status: 400
      });
    }
    if (!name_en) {
      return Response.json({
        error: "اسم الفئة (إنجليزي) مطلوب"
      }, {
        status: 400
      });
    }
    await ensureSchema();
    if (hasScope && showInInventory === false) {
      const usedByInventoryItems = await sql`
        SELECT COUNT(*)::int AS count
        FROM items
        WHERE category_id = ${id}
          AND is_active IS DISTINCT FROM FALSE
          AND show_in_inventory IS DISTINCT FROM FALSE
      `;
      if (Number(usedByInventoryItems[0]?.count || 0) > 0) {
        return Response.json({
          error: "لا يمكن تحويل الفئة إلى مشتريات فقط لأنها مرتبطة بأصناف تظهر في المخزون"
        }, {
          status: 400
        });
      }
    }
    try {
      const updated = await sql`
        UPDATE item_categories
        SET
          name = ${name},
          name_en = ${name_en},
          show_in_inventory = COALESCE(${showInInventory}, show_in_inventory)
        WHERE id = ${id}
        RETURNING id, name, name_en, show_in_inventory, created_at
      `;
      if (updated.length === 0) {
        return Response.json({
          error: "الفئة غير موجودة"
        }, {
          status: 404
        });
      }
      return Response.json(updated[0]);
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.includes("unique")) {
        return Response.json({
          error: "هذه الفئة موجودة مسبقاً"
        }, {
          status: 409
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error updating item category:", error);
    return Response.json({
      error: "Failed to update item category"
    }, {
      status: 500
    });
  }
}

export { GET, POST, PUT };
