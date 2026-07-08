import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-Eh4y0Ete.js';
import { p as parseBusinessTimestamp } from './dateUtils-DCPDkvv9.js';
import '@neondatabase/serverless';
import 'crypto';
import './employeeDisplayName-Ba9mYj5Z.js';

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
    await ensureInventoryUnitSnapshotSchema();
    // Point-in-time stock: use the same unified ledger that powers
    // inventory_current_stock_v and /api/items/summary. Quantities are
    // displayed in the item's default inventory/counting unit exactly as
    // entered, then receipts/transfers/waste after the latest physical
    // reset are layered as signed movement quantities.
    const rows = await sql(`
        WITH requested_items AS (
          SELECT unnest($2::int[])::int AS item_id
        ),
        last_reset AS (
          SELECT DISTINCT ON (le.item_id)
            le.item_id,
            le.entered_quantity::numeric AS inv_quantity,
            le.occurred_at,
            le.operation_id,
            le.source_id
          FROM inventory_ledger_entries_v le
          WHERE le.branch_id = $1
            AND le.item_id = ANY($2::int[])
            AND le.resets_stock = true
            AND (
              $3::timestamp IS NULL
              OR le.occurred_at <= $3::timestamp
            )
          ORDER BY
            le.item_id,
            le.occurred_at DESC,
            le.operation_id DESC NULLS LAST,
            le.source_id DESC
        ),
        movement_after AS (
          SELECT
            le.item_id,
            COALESCE(SUM(le.delta_quantity), 0)::numeric AS net_movement_quantity
          FROM inventory_ledger_entries_v le
          LEFT JOIN last_reset lr ON lr.item_id = le.item_id
          WHERE le.branch_id = $1
            AND le.item_id = ANY($2::int[])
            AND le.resets_stock = false
            AND (
              lr.occurred_at IS NULL
              OR le.occurred_at > lr.occurred_at
            )
            AND (
              $3::timestamp IS NULL
              OR le.occurred_at <= $3::timestamp
            )
          GROUP BY le.item_id
        )
        SELECT
          ri.item_id,
          COALESCE(last_reset.inv_quantity, 0)
            + COALESCE(movement_after.net_movement_quantity, 0) AS quantity_at_t
        FROM requested_items ri
        LEFT JOIN last_reset ON last_reset.item_id = ri.item_id
        LEFT JOIN movement_after ON movement_after.item_id = ri.item_id
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
