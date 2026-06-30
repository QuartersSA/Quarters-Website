import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-Eh4y0Ete.js';
import '@neondatabase/serverless';
import 'crypto';
import './employeeDisplayName-Ba9mYj5Z.js';

async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureInventoryUnitSnapshotSchema();
    const {
      searchParams
    } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const itemIdRaw = searchParams.get("itemId");
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const branchId = branchIdRaw ? parseInt(branchIdRaw) : null;
    const itemId = itemIdRaw ? parseInt(itemIdRaw) : null;
    if (!branchId || Number.isNaN(branchId)) {
      return Response.json({
        error: "معرّف الفرع مطلوب"
      }, {
        status: 400
      });
    }
    if (!itemId || Number.isNaN(itemId)) {
      return Response.json({
        error: "معرّف الصنف مطلوب"
      }, {
        status: 400
      });
    }
    if (!fromRaw || !toRaw) {
      return Response.json({
        error: "يجب تحديد فترة (من / إلى)"
      }, {
        status: 400
      });
    }

    // Variance row computes two delta perspectives:
    //   delta_quantity        = actual − (opening + receipts since opening)
    //                           "loss/gain since the period opened"
    //   delta_since_previous  = actual − (previous_inv + receipts between prev and this)
    //                           "loss/gain since the last count" (incremental)
    // Two LATERAL subqueries compute receipts sums once each
    // (since_opening, since_previous). The five derived columns
    // (receipts_quantity, expected_quantity, delta_quantity,
    //  expected_since_previous, delta_since_previous) now reuse them
    // instead of repeating the same SELECT SUM(pr.quantity) subquery
    // five times — saves PostgreSQL ~4 redundant index scans per row.
    const query = `
      SELECT
        io.id as operation_id,
        io.inventory_number,
        COALESCE(io.operation_date, io.created_at) as created_at,
        io.branch_id,
        b.name as branch_name,
        ii.item_id,
        i.name as item_name,
        qty.actual_quantity,
        os.id as opening_session_id,
        os.opened_at as opening_opened_at,
        qty.opening_quantity,
        COALESCE(rso.sum_qty, 0)::numeric as receipts_quantity,
        COALESCE(tso.net_transfer, 0)::numeric as net_transfer_quantity,
        (
          qty.opening_quantity
          + COALESCE(rso.sum_qty, 0)::numeric
          + COALESCE(tso.net_transfer, 0)::numeric
        ) as expected_quantity,
        (
          qty.actual_quantity
          - (
              qty.opening_quantity
              + COALESCE(rso.sum_qty, 0)::numeric
              + COALESCE(tso.net_transfer, 0)::numeric
            )
        ) as delta_quantity,
        prev.prev_quantity,
        prev.prev_op_date,
        CASE
          WHEN prev.prev_quantity IS NULL THEN NULL
          ELSE (
            prev.prev_quantity::numeric
            + COALESCE(rsp.sum_qty, 0)::numeric
            + COALESCE(tsp.net_transfer, 0)::numeric
          )
        END as expected_since_previous,
        CASE
          WHEN prev.prev_quantity IS NULL THEN NULL
          ELSE (
            qty.actual_quantity
            - (
                prev.prev_quantity::numeric
                + COALESCE(rsp.sum_qty, 0)::numeric
                + COALESCE(tsp.net_transfer, 0)::numeric
              )
          )
        END as delta_since_previous
      FROM inventory_operations io
      JOIN inventory_items ii ON ii.operation_id = io.id
      LEFT JOIN branches b ON b.id = io.branch_id
      LEFT JOIN items i ON i.id = ii.item_id
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN LATERAL (
        SELECT os2.*
        FROM opening_sessions os2
        WHERE os2.branch_id = io.branch_id
          AND os2.opened_at <= COALESCE(io.operation_date, io.created_at)
        ORDER BY os2.opened_at DESC, os2.id DESC
        LIMIT 1
      ) os ON TRUE
      LEFT JOIN opening_session_items osi
        ON osi.session_id = os.id AND osi.item_id = ii.item_id
      LEFT JOIN LATERAL (
        SELECT
          (
            ii.quantity::numeric
              * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
          ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS actual_quantity,
          COALESCE(
            (
              osi.quantity::numeric
                * COALESCE(osi.unit_factor, iu.conversion_factor, 1)::numeric
            ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0),
            0
          ) AS opening_quantity
      ) qty ON TRUE
      -- Previous physical count (NOT a transfer). Variance's
      -- "expected_since_previous" baseline is the last human-observed
      -- snapshot. Transfer rows store a post-transfer absolute that
      -- can drift relative to chain intent, so basing prev on them
      -- made delta_since_previous wrong whenever a cascade left the
      -- stored value out of sync. Daily / Weekly / Opening are
      -- physical recounts — they're the ground truth this metric
      -- wants.
      LEFT JOIN LATERAL (
        SELECT
          (
            ii_p.quantity::numeric
              * COALESCE(ii_p.unit_factor, iu.conversion_factor, 1)::numeric
          ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS prev_quantity,
          COALESCE(io_p.operation_date, io_p.created_at) AS prev_op_date
        FROM inventory_items ii_p
        JOIN inventory_operations io_p ON io_p.id = ii_p.operation_id
        WHERE ii_p.item_id = ii.item_id
          AND io_p.branch_id = io.branch_id
          AND io_p.status = 'Completed'
          AND io_p.inventory_type IN ('Daily', 'Weekly', 'Opening')
          AND (
            COALESCE(io_p.operation_date, io_p.created_at)
              < COALESCE(io.operation_date, io.created_at)
            OR (
              COALESCE(io_p.operation_date, io_p.created_at)
                = COALESCE(io.operation_date, io.created_at)
              AND io_p.id < io.id
            )
          )
        ORDER BY COALESCE(io_p.operation_date, io_p.created_at) DESC, io_p.id DESC
        LIMIT 1
      ) prev ON TRUE

      -- Signed transfer deltas between prev physical count and the
      -- current count. expected_since_previous now accounts for
      -- transfers in/out of the branch in the interval, mirroring the
      -- formula used by /api/items/summary and the timeline report.
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
          CASE io_t.transfer_direction
            WHEN 'in'  THEN  COALESCE(ii_t.transfer_quantity, 0)::numeric
            WHEN 'out' THEN -COALESCE(ii_t.transfer_quantity, 0)::numeric
            ELSE 0
          END
          * COALESCE(ii_t.unit_factor, iu.conversion_factor, 1)::numeric
          / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0)
        ), 0)::numeric AS net_transfer
        FROM inventory_items ii_t
        JOIN inventory_operations io_t ON io_t.id = ii_t.operation_id
        WHERE ii_t.item_id   = ii.item_id
          AND ii_t.branch_id = io.branch_id
          AND io_t.status    = 'Completed'
          AND io_t.inventory_type = 'Transfer'
          AND prev.prev_op_date IS NOT NULL
          AND COALESCE(io_t.operation_date, io_t.created_at)
              > prev.prev_op_date
          AND COALESCE(io_t.operation_date, io_t.created_at)
              <= COALESCE(io.operation_date, io.created_at)
      ) tsp ON TRUE
      LEFT JOIN LATERAL (
        -- GREATEST(received_at, created_at) protects against legacy
        -- green-bean deposits that stored order_date in received_at.
        -- Without this, a deposit booked today against an old order
        -- date would be excluded from "receipts since opening".
        SELECT SUM(
          pr.quantity::numeric
            * COALESCE(pr.unit_factor, iu.conversion_factor, 1)::numeric
            / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0)
        )::numeric AS sum_qty
        FROM purchase_receipts pr
        WHERE pr.branch_id = io.branch_id
          AND pr.item_id = ii.item_id
          AND (
            os.opened_at IS NULL
            OR GREATEST(pr.received_at, pr.created_at) >= os.opened_at::timestamp
          )
          AND GREATEST(pr.received_at, pr.created_at)
            <= COALESCE(io.operation_date, io.created_at)
      ) rso ON TRUE
      -- Signed transfer deltas since opening. expected_quantity now
      -- accounts for movements in/out of the branch since the
      -- opening session, so a Daily count following transfer activity
      -- isn't misreported as a giant variance.
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
          CASE io_t.transfer_direction
            WHEN 'in'  THEN  COALESCE(ii_t.transfer_quantity, 0)::numeric
            WHEN 'out' THEN -COALESCE(ii_t.transfer_quantity, 0)::numeric
            ELSE 0
          END
          * COALESCE(ii_t.unit_factor, iu.conversion_factor, 1)::numeric
          / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0)
        ), 0)::numeric AS net_transfer
        FROM inventory_items ii_t
        JOIN inventory_operations io_t ON io_t.id = ii_t.operation_id
        WHERE ii_t.item_id   = ii.item_id
          AND ii_t.branch_id = io.branch_id
          AND io_t.status    = 'Completed'
          AND io_t.inventory_type = 'Transfer'
          AND (
            os.opened_at IS NULL
            OR COALESCE(io_t.operation_date, io_t.created_at)
                >= os.opened_at::timestamp
          )
          AND COALESCE(io_t.operation_date, io_t.created_at)
              <= COALESCE(io.operation_date, io.created_at)
      ) tso ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(
          pr.quantity::numeric
            * COALESCE(pr.unit_factor, iu.conversion_factor, 1)::numeric
            / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0)
        )::numeric AS sum_qty
        FROM purchase_receipts pr
        WHERE prev.prev_op_date IS NOT NULL
          AND pr.branch_id = io.branch_id
          AND pr.item_id = ii.item_id
          AND GREATEST(pr.received_at, pr.created_at) > prev.prev_op_date
          AND GREATEST(pr.received_at, pr.created_at)
            <= COALESCE(io.operation_date, io.created_at)
      ) rsp ON TRUE
      WHERE io.status = 'Completed'
        -- Transfer rows are intentionally excluded from variance: they
        -- are movements between branches, not inventory counts. Keeping
        -- them here caused every transfer to register as a phantom
        -- "loss" at the source and "gain" at the destination because
        -- expected_quantity = opening + receipts had no awareness of
        -- outgoing/incoming transfers. The prev-row lookup (io_p above)
        -- still includes Transfer so delta_since_previous correctly
        -- uses the post-transfer snapshot as its baseline.
        AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
        AND io.branch_id = $1
        AND ii.item_id = $2
        AND (COALESCE(io.operation_date, io.created_at) AT TIME ZONE 'Asia/Riyadh')::date >= $3::date
        AND (COALESCE(io.operation_date, io.created_at) AT TIME ZONE 'Asia/Riyadh')::date <= $4::date
      ORDER BY COALESCE(io.operation_date, io.created_at) ASC
    `;
    const rows = await sql(query, [branchId, itemId, fromRaw, toRaw]);
    return Response.json({
      branch_id: branchId,
      item_id: itemId,
      from: fromRaw,
      to: toRaw,
      rows
    });
  } catch (error) {
    console.error("Error fetching variance:", error);
    return Response.json({
      error: "Failed to fetch variance"
    }, {
      status: 500
    });
  }
}

export { GET };
