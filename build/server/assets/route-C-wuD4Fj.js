import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Catalog of reusable measurement units (شدة / كرتون / كيلو / ...).
// Shared across every item — items reference these via the
// item_units join table. Names are stored bilingually (Arabic
// required, English optional) so list rendering can pick the right
// label based on the operator's UI language.

async function ensureSchema() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS measurement_units (
        id          SERIAL PRIMARY KEY,
        name_ar     TEXT NOT NULL UNIQUE,
        name_en     TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  } catch (e) {
    console.error("ensureSchema measurement_units:", e?.message);
  }
}
async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_inventory"
    }, {
      role: "Admin",
      permission: "can_manage_accounting"
    }, {
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
    const rows = await sql`
      SELECT id, name_ar, name_en, created_at
      FROM measurement_units
      ORDER BY name_ar
    `;
    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching measurement units:", error);
    return Response.json({
      error: "Failed to fetch units",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_inventory"
    }, {
      role: "Admin",
      permission: "can_manage_accounting"
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
    const body = await request.json();
    const name_ar = (body?.name_ar || "").trim();
    const name_en = body?.name_en ? String(body.name_en).trim() || null : null;
    if (!name_ar) {
      return Response.json({
        error: "اسم الوحدة بالعربية مطلوب"
      }, {
        status: 400
      });
    }
    await ensureSchema();

    // Upsert by name_ar so duplicate POSTs are idempotent and
    // existing rows can pick up a missing English label.
    const rows = await sql`
      INSERT INTO measurement_units (name_ar, name_en)
      VALUES (${name_ar}, ${name_en})
      ON CONFLICT (name_ar)
        DO UPDATE SET name_en = COALESCE(measurement_units.name_en, EXCLUDED.name_en)
      RETURNING id, name_ar, name_en, created_at
    `;
    return Response.json(rows[0], {
      status: 201
    });
  } catch (error) {
    console.error("Error creating measurement unit:", error);
    return Response.json({
      error: "Failed to create unit",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
