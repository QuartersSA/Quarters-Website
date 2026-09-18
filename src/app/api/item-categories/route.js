import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureCoffeeSchema } from "@/app/api/utils/coffeeInvoices";

async function ensureSchema() {
  try {
    await sql`
      ALTER TABLE item_categories
      ADD COLUMN IF NOT EXISTS show_in_inventory BOOLEAN NOT NULL DEFAULT TRUE
    `;
  } catch (error) {
    console.error("ensureSchema item_categories.show_in_inventory:", error?.message);
  }
  // أعمدة البن المحمّص على الفئة (is_roasted_coffee, roast_cost_per_kg,
  // roast_tax_rate, default_roaster_contact_id) — مُعرّفة في مخطط البن.
  try {
    await ensureCoffeeSchema();
  } catch (error) {
    console.error("ensureSchema item_categories coffee columns:", error?.message);
  }
}

const CATEGORY_COLUMNS = `
  c.id, c.name, c.name_en, c.show_in_inventory, c.created_at,
  c.is_roasted_coffee, c.roast_cost_per_kg, c.roast_tax_rate,
  c.default_roaster_contact_id,
  r.name AS default_roaster_name
`;

// حقول البن المحمّص من جسم الطلب. undefined = لا تغيير (عند التعديل).
// يرمي Error برسالة عربية عند قيمة غير صالحة.
function parseCoffeeFields(body) {
  const out = {};
  if (body?.is_roasted_coffee !== undefined) {
    out.is_roasted_coffee = !!body.is_roasted_coffee;
  }
  if (body?.roast_cost_per_kg !== undefined) {
    const raw = body.roast_cost_per_kg;
    if (raw === null || raw === "") out.roast_cost_per_kg = null;
    else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) throw new Error("تكلفة التحميص للكيلو غير صالحة");
      out.roast_cost_per_kg = Math.round(n * 10000) / 10000;
    }
  }
  if (body?.roast_tax_rate !== undefined) {
    const raw = body.roast_tax_rate;
    if (raw === null || raw === "") out.roast_tax_rate = null;
    else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("نسبة ضريبة التحميص غير صالحة (0–100)");
      out.roast_tax_rate = Math.round(n * 100) / 100;
    }
  }
  if (body?.default_roaster_contact_id !== undefined) {
    const raw = body.default_roaster_contact_id;
    if (raw === null || raw === "") out.default_roaster_contact_id = null;
    else {
      const n = parseInt(String(raw), 10);
      if (!Number.isInteger(n) || n <= 0) throw new Error("المحمصة الافتراضية غير صالحة");
      out.default_roaster_contact_id = n;
    }
  }
  return out;
}

async function assertRoasterExists(contactId) {
  if (!contactId) return;
  const [row] = await sql`
    SELECT id, is_active FROM accounting_contacts WHERE id = ${contactId}
  `;
  if (!row) throw new Error("المحمصة المختارة غير موجودة في جهات الاتصال");
  if (row.is_active === false) throw new Error("المحمصة المختارة موقوفة — فعّلها أولًا");
}

function categoryAuthRules() {
  return [
    { role: "Admin", permission: "can_manage_inventory" },
    { role: "Admin", permission: "can_manage_accounting" },
  ];
}

export async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [
      ...categoryAuthRules(),
      { role: "Employee", permission: "can_do_inventory" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const rows =
      scope === "purchases"
        ? await sql(`
            SELECT ${CATEGORY_COLUMNS}
            FROM item_categories c
            LEFT JOIN accounting_contacts r ON r.id = c.default_roaster_contact_id
            ORDER BY c.name ASC
          `)
        : await sql(`
            SELECT ${CATEGORY_COLUMNS}
            FROM item_categories c
            LEFT JOIN accounting_contacts r ON r.id = c.default_roaster_contact_id
            WHERE c.show_in_inventory IS DISTINCT FROM FALSE
            ORDER BY c.name ASC
          `);
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
    anyOf: categoryAuthRules(),
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
    const showInInventory =
      body?.show_in_inventory !== undefined ? !!body.show_in_inventory : true;

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

    let coffee;
    try {
      coffee = parseCoffeeFields(body);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 });
    }

    await ensureSchema();

    try {
      await assertRoasterExists(coffee.default_roaster_contact_id);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 });
    }

    try {
      const inserted = await sql`
        INSERT INTO item_categories (
          name, name_en, show_in_inventory,
          is_roasted_coffee, roast_cost_per_kg, roast_tax_rate, default_roaster_contact_id
        )
        VALUES (
          ${name}, ${name_en}, ${showInInventory},
          ${coffee.is_roasted_coffee ?? false},
          ${coffee.roast_cost_per_kg ?? null},
          ${coffee.roast_tax_rate ?? null},
          ${coffee.default_roaster_contact_id ?? null}
        )
        RETURNING id
      `;
      const [row] = await sql(
        `SELECT ${CATEGORY_COLUMNS}
         FROM item_categories c
         LEFT JOIN accounting_contacts r ON r.id = c.default_roaster_contact_id
         WHERE c.id = $1`,
        [inserted[0].id],
      );
      return Response.json(row, { status: 201 });
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
    anyOf: categoryAuthRules(),
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
    const hasScope = body?.show_in_inventory !== undefined;
    const showInInventory = hasScope ? !!body.show_in_inventory : null;

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

    let coffee;
    try {
      coffee = parseCoffeeFields(body);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 });
    }

    await ensureSchema();

    try {
      await assertRoasterExists(coffee.default_roaster_contact_id);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 400 });
    }

    if (hasScope && showInInventory === false) {
      const usedByInventoryItems = await sql`
        SELECT COUNT(*)::int AS count
        FROM items
        WHERE category_id = ${id}
          AND is_active IS DISTINCT FROM FALSE
          AND show_in_inventory IS DISTINCT FROM FALSE
      `;
      if (Number(usedByInventoryItems[0]?.count || 0) > 0) {
        return Response.json(
          {
            error:
              "لا يمكن تحويل الفئة إلى مشتريات فقط لأنها مرتبطة بأصناف تظهر في المخزون",
          },
          { status: 400 },
        );
      }
    }

    try {
      // الحقول غير المُرسلة (undefined) تبقى كما هي — نمرر علمًا لكل حقل.
      const setRoasted = coffee.is_roasted_coffee !== undefined;
      const setRoastCost = coffee.roast_cost_per_kg !== undefined;
      const setRoastTax = coffee.roast_tax_rate !== undefined;
      const setRoaster = coffee.default_roaster_contact_id !== undefined;
      const updated = await sql`
        UPDATE item_categories
        SET
          name = ${name},
          name_en = ${name_en},
          show_in_inventory = COALESCE(${showInInventory}, show_in_inventory),
          is_roasted_coffee = CASE WHEN ${setRoasted} THEN ${coffee.is_roasted_coffee ?? false} ELSE is_roasted_coffee END,
          roast_cost_per_kg = CASE WHEN ${setRoastCost} THEN ${coffee.roast_cost_per_kg ?? null}::numeric ELSE roast_cost_per_kg END,
          roast_tax_rate = CASE WHEN ${setRoastTax} THEN ${coffee.roast_tax_rate ?? null}::numeric ELSE roast_tax_rate END,
          default_roaster_contact_id = CASE WHEN ${setRoaster} THEN ${coffee.default_roaster_contact_id ?? null}::integer ELSE default_roaster_contact_id END
        WHERE id = ${id}
        RETURNING id
      `;

      if (updated.length === 0) {
        return Response.json({ error: "الفئة غير موجودة" }, { status: 404 });
      }

      const [row] = await sql(
        `SELECT ${CATEGORY_COLUMNS}
         FROM item_categories c
         LEFT JOIN accounting_contacts r ON r.id = c.default_roaster_contact_id
         WHERE c.id = $1`,
        [id],
      );
      return Response.json(row);
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
