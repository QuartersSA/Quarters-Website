import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import '@neondatabase/serverless';
import 'crypto';

function toId(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}
function toNumberOrUndefined(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return n;
}
function validateNonNegative(value, label) {
  if (value === null || value === undefined) return {
    ok: true
  };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      ok: false,
      error: `قيمة غير صحيحة: ${label}`
    };
  }
  if (value < 0) {
    return {
      ok: false,
      error: `${label} يجب أن يكون 0 أو أكثر`
    };
  }
  return {
    ok: true
  };
}

// PUT /api/accounting/green-beans/:id
// body: { priceKgExclTax?, bagSizeKg?, roastCostExclTax?, roastCostInclTax?, extraCostPerKg?, wastePercent? }
async function PUT(request, {
  params
}) {
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
  const id = toId(params?.id);
  if (!id) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const priceKgExclTax = toNumberOrUndefined(body?.priceKgExclTax);
    const bagSizeKg = toNumberOrUndefined(body?.bagSizeKg);
    const roastCostExclTax = toNumberOrUndefined(body?.roastCostExclTax);
    const roastCostInclTax = toNumberOrUndefined(body?.roastCostInclTax);
    const extraCostPerKg = toNumberOrUndefined(body?.extraCostPerKg);
    const wastePercent = toNumberOrUndefined(body?.wastePercent);
    const checks = [validateNonNegative(priceKgExclTax, "سعر الكيلو"), validateNonNegative(bagSizeKg, "حجم الخيشة"), validateNonNegative(roastCostExclTax, "تكلفة التحميص (غير شامل)"), validateNonNegative(roastCostInclTax, "تكلفة التحميص (شامل)"), validateNonNegative(extraCostPerKg, "التكاليف الإضافية للكيلو"), validateNonNegative(wastePercent, "نسبة الهدر")];
    const failed = checks.find(c => !c.ok);
    if (failed) {
      return Response.json({
        error: failed.error
      }, {
        status: 400
      });
    }
    const setClauses = [];
    const values = [];
    let idx = 1;
    const add = (col, val) => {
      if (val === undefined) return;
      setClauses.push(`${col} = $${idx}`);
      values.push(val);
      idx += 1;
    };
    add("price_kg_excl_tax", priceKgExclTax);
    add("bag_size_kg", bagSizeKg);
    add("roast_cost_excl_tax", roastCostExclTax);
    add("roast_cost_incl_tax", roastCostInclTax);
    add("extra_cost_per_kg", extraCostPerKg);
    add("waste_percent", wastePercent);
    if (setClauses.length === 0) {
      const [existing] = await sql(`SELECT * FROM accounting_green_beans WHERE id = $1 LIMIT 1`, [id]);
      return Response.json({
        bean: existing || null
      });
    }
    setClauses.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);
    const query = `
      UPDATE accounting_green_beans
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING *
    `;
    const [row] = await sql(query, values);
    if (!row) {
      return Response.json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    return Response.json({
      bean: row
    });
  } catch (error) {
    console.error("green beans PUT error", error);
    return Response.json({
      error: "فشل تحديث بيانات البن"
    }, {
      status: 500
    });
  }
}

// GET /api/accounting/green-beans/:id
async function GET(request, {
  params
}) {
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
  const id = toId(params?.id);
  if (!id) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    const [row] = await sql(`SELECT * FROM accounting_green_beans WHERE id = $1 LIMIT 1`, [id]);
    if (!row) {
      return Response.json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    return Response.json({
      bean: row
    });
  } catch (error) {
    console.error("green beans GET(id) error", error);
    return Response.json({
      error: "فشل تحميل البن"
    }, {
      status: 500
    });
  }
}

export { GET, PUT };
