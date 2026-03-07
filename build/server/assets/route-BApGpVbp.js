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
function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}
function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}
function round4(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 10000) / 10000;
}
function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}

// PUT /api/accounting/green-bean-order-items/:id
// body: { receivedAfterWasteKg }
// Only updates the "received" quantity; waste% and final price are recomputed.
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
    const received = toNumber(body?.receivedAfterWasteKg);
    if (received === null) {
      return Response.json({
        error: "الكمية الواصلة مطلوبة"
      }, {
        status: 400
      });
    }
    if (received < 0) {
      return Response.json({
        error: "الكمية الواصلة يجب أن تكون 0 أو أكثر"
      }, {
        status: 400
      });
    }
    const [existing] = await sql(`
        SELECT
          id,
          bag_size_kg,
          computed_total_incl
        FROM accounting_green_bean_order_items
        WHERE id = $1
        LIMIT 1
      `, [id]);
    if (!existing) {
      return Response.json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    const bag = Number(existing.bag_size_kg);
    const totalIncl = Number(existing.computed_total_incl);
    let wastePercent = 0;
    if (Number.isFinite(bag) && bag > 0) {
      const rawWaste = (1 - received / bag) * 100;
      // keep within sane bounds for storage
      wastePercent = clamp(rawWaste, 0, 100);
      if (wastePercent === null) wastePercent = 0;
    }
    const finalPricePerKg = Number.isFinite(totalIncl) && received > 0 ? round2(totalIncl / received) : null;
    const [row] = await sql(`
        UPDATE accounting_green_bean_order_items
        SET
          computed_received_after_waste_kg = $2,
          waste_percent = $3,
          computed_final_price_per_kg = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id, received, round4(wastePercent), finalPricePerKg]);
    return Response.json({
      item: row || null
    });
  } catch (error) {
    console.error("green bean order item PUT error", error);
    return Response.json({
      error: "فشل تعديل الكمية الواصلة"
    }, {
      status: 500
    });
  }
}

export { PUT };
