import sql from './sql-CSDV1lSC.js';
import { l as legacyGone } from './legacyGreenBean-BA_TFDYb.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

function toDateOnly(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  // basic YYYY-MM-DD check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}
function toInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

// GET /api/accounting/green-bean-orders
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
    const {
      searchParams
    } = new URL(request.url);
    const includeItems = String(searchParams.get("includeItems") || "") === "1";
    const from = toDateOnly(searchParams.get("from"));
    const to = toDateOnly(searchParams.get("to"));
    const rawLimit = toInt(searchParams.get("limit"));
    const limit = clampInt(rawLimit ?? 200, 1, 2000);
    const whereParts = [];
    const values = [];
    let idx = 1;
    if (from) {
      whereParts.push(`o.order_date >= $${idx}`);
      values.push(from);
      idx += 1;
    }
    if (to) {
      whereParts.push(`o.order_date <= $${idx}`);
      values.push(to);
      idx += 1;
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    if (includeItems) {
      values.push(limit);
      const limitParam = `$${idx}`;
      const rows = await sql(`
          SELECT
            o.id,
            o.order_date,
            o.supplier_name,
            o.note,
            o.created_by_employee_name,
            o.created_at,
            COALESCE(COUNT(i.id), 0)::int AS items_count,
            COALESCE(SUM(i.computed_total_incl), 0) AS total_incl,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', i.id,
                  'bean_id', i.bean_id,
                  'bean_name_snapshot', i.bean_name_snapshot,
                  'price_kg_excl_tax', i.price_kg_excl_tax,
                  'bag_size_kg', i.bag_size_kg,
                  'roast_cost_incl_tax', i.roast_cost_incl_tax,
                  'extra_cost_per_kg', i.extra_cost_per_kg,
                  'extra_cost_kg', i.extra_cost_kg,
                  'waste_percent', i.waste_percent,
                  'computed_total_incl', i.computed_total_incl,
                  'computed_received_after_waste_kg', i.computed_received_after_waste_kg,
                  'computed_final_price_per_kg', i.computed_final_price_per_kg,
                  'created_at', i.created_at,
                  'updated_at', i.updated_at
                )
                ORDER BY i.id ASC
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::jsonb
            ) AS items
          FROM accounting_green_bean_orders o
          LEFT JOIN accounting_green_bean_order_items i
            ON i.order_id = o.id
          ${whereClause}
          GROUP BY o.id
          ORDER BY o.order_date DESC, o.id DESC
          LIMIT ${limitParam}
        `, values);
      return Response.json({
        orders: rows || []
      });
    }
    values.push(limit);
    const limitParam = `$${idx}`;
    const rows = await sql(`
        SELECT
          o.id,
          o.order_date,
          o.supplier_name,
          o.note,
          o.created_by_employee_name,
          o.created_at,
          COALESCE(COUNT(i.id), 0)::int AS items_count,
          COALESCE(SUM(i.computed_total_incl), 0) AS total_incl
        FROM accounting_green_bean_orders o
        LEFT JOIN accounting_green_bean_order_items i
          ON i.order_id = o.id
        ${whereClause}
        GROUP BY o.id
        ORDER BY o.order_date DESC, o.id DESC
        LIMIT ${limitParam}
      `, values);
    return Response.json({
      orders: rows || []
    });
  } catch (error) {
    console.error("green bean orders GET error", error);
    return Response.json({
      error: "فشل تحميل طلبات البن"
    }, {
      status: 500
    });
  }
}

// POST — مؤرشف (410): إنشاء طلب توريد قديم (كان يكتب تكلفة الصنف مباشرة)
async function POST(request) {
  return legacyGone();
}

export { GET, POST };
