import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { p as parseBusinessTimestamp } from './dateUtils-FqivhP-u.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/branch-stock-at?branchId=&itemIds=1,2,3&at=YYYY-MM-DDTHH:mm
//
// Returns the point-in-time stock for a branch and a set of items at
// the given moment. Used by the TransferModal to show the user the
// "available at T" number that the backend will actually validate
// against — so the picked transfer date and the qty preview are in
// sync.
//
// Response: { stock: { "<itemId>": number, ... }, atTime: string | null }

function parseAtTime(value) {
  return parseBusinessTimestamp(value, {
    allowFuture: 1,
    minYear: 2020
  });
}
async function GET(request) {
  // Any authenticated user can read stock; transfer creation is gated
  // separately. `requireAuth` without args just validates the session
  // token — no role/permission gate.
  const auth = requireAuth(request);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  const url = new URL(request.url);
  const branchIdRaw = url.searchParams.get("branchId");
  const itemIdsRaw = url.searchParams.get("itemIds");
  const atRaw = url.searchParams.get("at");
  const branchId = Number(branchIdRaw);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    return Response.json({
      error: "branchId مطلوب"
    }, {
      status: 400
    });
  }
  const itemIds = String(itemIdsRaw || "").split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n > 0);
  if (itemIds.length === 0) {
    return Response.json({
      stock: {},
      atTime: null
    });
  }

  // Cap to keep one request from accidentally scanning huge sets.
  if (itemIds.length > 500) {
    return Response.json({
      error: "عدد الأصناف يتجاوز الحد المسموح (500)"
    }, {
      status: 400
    });
  }
  const atTime = parseAtTime(atRaw);
  try {
    // Point-in-time stock: last RESET (Daily/Weekly/Opening physical
    // count) + receipts after that reset + signed transfer deltas
    // after that reset, all bounded by $3 (atTime). Mirrors the
    // formula used by /api/items/summary, /api/items, low-stock,
    // over-stock, stock-value, and the timeline report so transfer
    // creation validation, current-stock displays, and historical
    // reports all agree.
    const rows = await sql(`
        SELECT
          i.id AS item_id,
          COALESCE(last_reset.inv_quantity, 0)
            + COALESCE(receipts_after.total_received, 0)
            + COALESCE(transfers_after.net_transfer, 0) AS quantity_at_t
        FROM items i

        LEFT JOIN LATERAL (
          SELECT ii.quantity AS inv_quantity,
                 COALESCE(io.operation_date, io.created_at) AS op_date
          FROM inventory_items ii
          JOIN inventory_operations io ON io.id = ii.operation_id
          WHERE ii.item_id = i.id
            AND io.branch_id = $1
            AND io.status = 'Completed'
            AND io.inventory_type IN ('Daily','Weekly','Opening')
            AND (
              $3::timestamp IS NULL
              OR COALESCE(io.operation_date, io.created_at) <= $3::timestamp
            )
          ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
          LIMIT 1
        ) last_reset ON true

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
          FROM purchase_receipts pr
          WHERE pr.item_id = i.id
            AND pr.branch_id = $1
            AND (
              last_reset.op_date IS NULL
              OR GREATEST(pr.received_at, pr.created_at) > last_reset.op_date
            )
            AND (
              $3::timestamp IS NULL
              OR GREATEST(pr.received_at, pr.created_at) <= $3::timestamp
            )
        ) receipts_after ON true

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(
            CASE io.transfer_direction
              WHEN 'in'  THEN  COALESCE(ii.transfer_quantity, 0)
              WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)
              ELSE 0
            END
          ), 0) AS net_transfer
          FROM inventory_items ii
          JOIN inventory_operations io ON io.id = ii.operation_id
          WHERE ii.item_id   = i.id
            AND ii.branch_id = $1
            AND io.status    = 'Completed'
            AND io.inventory_type = 'Transfer'
            AND (
              last_reset.op_date IS NULL
              OR COALESCE(io.operation_date, io.created_at) > last_reset.op_date
            )
            AND (
              $3::timestamp IS NULL
              OR COALESCE(io.operation_date, io.created_at) <= $3::timestamp
            )
        ) transfers_after ON true

        WHERE i.id = ANY($2::int[])
      `, [branchId, itemIds, atTime]);
    const stock = {};
    for (const r of rows) {
      stock[String(r.item_id)] = Number(r.quantity_at_t) || 0;
    }
    // Backfill any requested items missing from the result with 0.
    for (const id of itemIds) {
      if (!(String(id) in stock)) {
        stock[String(id)] = 0;
      }
    }
    return Response.json({
      stock,
      atTime
    });
  } catch (err) {
    console.error("branch-stock-at GET error", err);
    return Response.json({
      error: "فشل في جلب الرصيد عند التاريخ المطلوب"
    }, {
      status: 500
    });
  }
}

export { GET };
