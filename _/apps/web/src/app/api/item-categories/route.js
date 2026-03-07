import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

export async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_manage_inventory" },
      { role: "Employee", permission: "can_do_inventory" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rows = await sql`
      SELECT id, name, name_en, created_at
      FROM item_categories
      ORDER BY name ASC
    `;
    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching item categories:", error);
    return Response.json(
      { error: "Failed to fetch item categories" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    const nameRaw = body?.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";

    const nameEnRaw = body?.name_en;
    const name_en = typeof nameEnRaw === "string" ? nameEnRaw.trim() : "";

    if (!name) {
      return Response.json(
        { error: "اسم الفئة (عربي) مطلوب" },
        { status: 400 },
      );
    }

    if (!name_en) {
      return Response.json(
        { error: "اسم الفئة (إنجليزي) مطلوب" },
        { status: 400 },
      );
    }

    try {
      const inserted = await sql`
        INSERT INTO item_categories (name, name_en)
        VALUES (${name}, ${name_en})
        RETURNING id, name, name_en, created_at
      `;
      return Response.json(inserted[0], { status: 201 });
    } catch (err) {
      // likely unique constraint
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.includes("unique")) {
        return Response.json(
          { error: "هذه الفئة موجودة مسبقاً" },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Error creating item category:", error);
    return Response.json(
      { error: "Failed to create item category" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();

    const idRaw = body?.id;
    const id = typeof idRaw === "number" ? idRaw : parseInt(String(idRaw));

    const nameRaw = body?.name;
    const name = typeof nameRaw === "string" ? nameRaw.trim() : "";

    const nameEnRaw = body?.name_en;
    const name_en = typeof nameEnRaw === "string" ? nameEnRaw.trim() : "";

    if (!id || Number.isNaN(id)) {
      return Response.json({ error: "معرّف الفئة مطلوب" }, { status: 400 });
    }

    if (!name) {
      return Response.json(
        { error: "اسم الفئة (عربي) مطلوب" },
        { status: 400 },
      );
    }

    if (!name_en) {
      return Response.json(
        { error: "اسم الفئة (إنجليزي) مطلوب" },
        { status: 400 },
      );
    }

    try {
      const updated = await sql`
        UPDATE item_categories
        SET name = ${name}, name_en = ${name_en}
        WHERE id = ${id}
        RETURNING id, name, name_en, created_at
      `;

      if (updated.length === 0) {
        return Response.json({ error: "الفئة غير موجودة" }, { status: 404 });
      }

      return Response.json(updated[0]);
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.includes("unique")) {
        return Response.json(
          { error: "هذه الفئة موجودة مسبقاً" },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error) {
    console.error("Error updating item category:", error);
    return Response.json(
      { error: "Failed to update item category" },
      { status: 500 },
    );
  }
}
