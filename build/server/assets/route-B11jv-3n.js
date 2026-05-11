import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

function cleanName(value) {
  const name = value ? String(value).trim() : "";
  return name;
}
function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

// GET /api/accounting/green-beans
async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const rows = await sql`
      SELECT
        id,
        name,
        price_kg_excl_tax,
        bag_size_kg,
        roast_cost_excl_tax,
        roast_cost_incl_tax,
        extra_cost_per_kg,
        waste_percent,
        created_at,
        updated_at
      FROM accounting_green_beans
      ORDER BY name ASC, id ASC
    `;
    return Response.json({
      beans: rows || []
    });
  } catch (error) {
    console.error("green beans GET error", error);
    return Response.json({
      error: "فشل تحميل البن الأخضر"
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/green-beans
// body: { name }
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const name = cleanName(body?.name);
    if (!name) {
      return Response.json({
        error: "الاسم مطلوب"
      }, {
        status: 400
      });
    }

    // Optional: allow user to set initial values, but name-only is fine
    const priceKgExclTax = toNumberOrNull(body?.priceKgExclTax);
    const bagSizeKg = toNumberOrNull(body?.bagSizeKg);
    if (priceKgExclTax !== null && priceKgExclTax < 0) {
      return Response.json({
        error: "سعر الكيلو يجب أن يكون 0 أو أكثر"
      }, {
        status: 400
      });
    }
    if (bagSizeKg !== null && bagSizeKg < 0) {
      return Response.json({
        error: "حجم الخيشة يجب أن يكون 0 أو أكثر"
      }, {
        status: 400
      });
    }
    const [row] = await sql(`
        INSERT INTO accounting_green_beans (
          name,
          price_kg_excl_tax,
          bag_size_kg
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO NOTHING
        RETURNING *
      `, [name, priceKgExclTax, bagSizeKg]);
    if (!row) {
      return Response.json({
        error: "هذا الاسم موجود مسبقًا"
      }, {
        status: 409
      });
    }
    return Response.json({
      bean: row
    }, {
      status: 201
    });
  } catch (error) {
    console.error("green beans POST error", error);
    return Response.json({
      error: "فشل إضافة البن الأخضر"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
