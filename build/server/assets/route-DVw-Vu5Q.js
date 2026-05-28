import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/items/[id]/stock-debug
// Admin-only diagnostic endpoint. Returns every raw row that contributes
// to "current stock" for a single item, plus the same computed totals
// the items page renders. Use when admin/items shows a quantity that
// doesn't match what the warehouse appears to hold — the JSON output
// reveals whether the discrepancy is in DB rows, the SQL filter, or the
// frontend sum.
//
// Shape:
//   item:          { id, name, cost, linked_green_bean_id }
//   branches:      [{ id, name }]
//   inventory_items_rows: every inventory_items row (with op date + type)
//   purchase_receipts_rows: every purchase_receipts row (raw + GREATEST)
//   per_branch_summary:
//     [{ branch_id, branch_name, last_inv_qty, last_inv_op_date,
//        last_inv_op_type, receipts_after_total, computed_stock }]
//   grand_total:   sum of computed_stock across branches
async function GET(request, {
  params
}) {
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
    const {
      id
    } = await params;
    const itemId = Number(id);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return Response.json({
        error: "Invalid item id"
      }, {
        status: 400
      });
    }
    const [item] = await sql`
      SELECT id, name, name_en, cost, linked_green_bean_id, is_active, show_in_inventory
      FROM items WHERE id = ${itemId}
    `;
    if (!item) {
      return Response.json({
        error: "Item not found"
      }, {
        status: 404
      });
    }
    const branches = await sql`
      SELECT id, name FROM branches ORDER BY name ASC
    `;

    // Every inventory_items row that mentions this item, across all
    // branches/ops. Includes ops that the items SQL would normally
    // skip (e.g. status != Completed) so the user sees the full picture.
    const inventoryRows = await sql`
      SELECT
        ii.id            AS inventory_item_id,
        ii.operation_id,
        ii.item_id,
        ii.quantity,
        ii.branch_id     AS ii_branch_id,
        io.branch_id     AS io_branch_id,
        b.name           AS branch_name,
        io.inventory_type,
        io.status,
        io.inventory_number,
        COALESCE(io.operation_date, io.created_at) AS effective_date,
        io.operation_date,
        io.created_at
      FROM inventory_items ii
      JOIN inventory_operations io ON io.id = ii.operation_id
      LEFT JOIN branches b ON b.id = io.branch_id
      WHERE ii.item_id = ${itemId}
      ORDER BY effective_date DESC, ii.id DESC
    `;

    // Every purchase_receipts row for this item, across all branches.
    const receiptRows = await sql`
      SELECT
        pr.id,
        pr.branch_id,
        b.name AS branch_name,
        pr.item_id,
        pr.quantity,
        pr.received_at,
        pr.created_at,
        GREATEST(pr.received_at, pr.created_at) AS effective_at,
        pr.note,
        pr.receipt_batch_id
      FROM purchase_receipts pr
      LEFT JOIN branches b ON b.id = pr.branch_id
      WHERE pr.item_id = ${itemId}
      ORDER BY effective_at DESC, pr.id DESC
    `;

    // Same formula the items API uses, scoped to this single item,
    // broken down per branch. Mirrors the timeline-aligned formula:
    //   last RESET (Daily/Weekly/Opening) + receipts since + signed
    //   transfer deltas since.
    const perBranch = await sql`
      WITH last_reset AS (
        SELECT DISTINCT ON (io.branch_id)
          io.branch_id,
          ii.quantity AS inv_quantity,
          COALESCE(io.operation_date, io.created_at) AS op_date,
          io.inventory_type AS op_type,
          io.inventory_number
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = ${itemId}
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily','Weekly','Opening')
        ORDER BY io.branch_id,
                 COALESCE(io.operation_date, io.created_at) DESC,
                 io.id DESC
      ),
      receipts_after AS (
        SELECT
          pr.branch_id,
          SUM(pr.quantity) AS total_received,
          COUNT(*)         AS receipt_count
        FROM purchase_receipts pr
        LEFT JOIN last_reset li ON li.branch_id = pr.branch_id
        WHERE pr.item_id = ${itemId}
          AND (
            li.op_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > li.op_date
          )
        GROUP BY pr.branch_id
      ),
      transfers_after AS (
        SELECT
          ii.branch_id,
          SUM(
            CASE io.transfer_direction
              WHEN 'in'  THEN  COALESCE(ii.transfer_quantity, 0)
              WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)
              ELSE 0
            END
          ) AS net_transfer,
          COUNT(*) AS transfer_count
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        LEFT JOIN last_reset li ON li.branch_id = ii.branch_id
        WHERE ii.item_id = ${itemId}
          AND io.status = 'Completed'
          AND io.inventory_type = 'Transfer'
          AND (
            li.op_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > li.op_date
          )
        GROUP BY ii.branch_id
      )
      SELECT
        b.id        AS branch_id,
        b.name      AS branch_name,
        li.inv_quantity AS last_inv_qty,
        li.op_date  AS last_inv_op_date,
        li.op_type  AS last_inv_op_type,
        li.inventory_number AS last_inv_number,
        ra.total_received AS receipts_after_total,
        ra.receipt_count  AS receipts_after_count,
        ta.net_transfer   AS transfers_after_net,
        ta.transfer_count AS transfers_after_count,
        (
          COALESCE(li.inv_quantity, 0)
          + COALESCE(ra.total_received, 0)
          + COALESCE(ta.net_transfer, 0)
        ) AS computed_stock
      FROM branches b
      LEFT JOIN last_reset li ON li.branch_id = b.id
      LEFT JOIN receipts_after ra ON ra.branch_id = b.id
      LEFT JOIN transfers_after ta ON ta.branch_id = b.id
      ORDER BY b.name ASC
    `;
    const grandTotal = perBranch.reduce((s, r) => s + Number(r.computed_stock || 0), 0);

    // Run the EXACT same SQL the stock-value endpoint runs, scoped to
    // this item, so we can confirm the number on /admin/stock-value
    // matches the per-branch breakdown above.
    const [stockValueRow] = await sql`
      WITH last_reset AS (
        SELECT DISTINCT ON (ii.item_id, io.branch_id)
          ii.item_id,
          io.branch_id,
          ii.quantity AS inv_quantity,
          COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = ${itemId}
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
        ORDER BY
          ii.item_id,
          io.branch_id,
          COALESCE(io.operation_date, io.created_at) DESC,
          io.id DESC
      ),
      receipts_after AS (
        SELECT
          pr.branch_id,
          SUM(pr.quantity) AS total_received
        FROM purchase_receipts pr
        LEFT JOIN last_reset li
          ON li.item_id = pr.item_id AND li.branch_id = pr.branch_id
        WHERE pr.item_id = ${itemId}
          AND (
            li.op_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > li.op_date
          )
        GROUP BY pr.branch_id
      ),
      transfers_after AS (
        SELECT
          ii.branch_id,
          SUM(
            CASE io.transfer_direction
              WHEN 'in'  THEN  COALESCE(ii.transfer_quantity, 0)
              WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)
              ELSE 0
            END
          ) AS net_transfer
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        LEFT JOIN last_reset li
          ON li.item_id = ii.item_id AND li.branch_id = ii.branch_id
        WHERE ii.item_id = ${itemId}
          AND io.status = 'Completed'
          AND io.inventory_type = 'Transfer'
          AND (
            li.op_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > li.op_date
          )
        GROUP BY ii.branch_id
      ),
      per_branch AS (
        SELECT
          b.id AS branch_id,
          COALESCE(li.inv_quantity, 0)
            + COALESCE(ra.total_received, 0)
            + COALESCE(ta.net_transfer, 0) AS qty
        FROM branches b
        LEFT JOIN last_reset li
          ON li.branch_id = b.id
        LEFT JOIN receipts_after ra
          ON ra.branch_id = b.id
        LEFT JOIN transfers_after ta
          ON ta.branch_id = b.id
      )
      SELECT
        ${itemId}::int AS item_id,
        COALESCE(SUM(pb.qty), 0)::numeric(12, 3) AS total_quantity
      FROM per_branch pb
    `;
    return Response.json({
      item,
      branches,
      counts: {
        inventory_items_rows: inventoryRows.length,
        purchase_receipts_rows: receiptRows.length,
        branches: branches.length
      },
      inventory_items_rows: inventoryRows,
      purchase_receipts_rows: receiptRows,
      per_branch_summary: perBranch,
      grand_total: grandTotal,
      stock_value_query: {
        // What /api/items/stock-value would return for total_quantity.
        // If `grand_total` above differs from this number for the same
        // item, the divergence is between the two queries — share the
        // full JSON so we can pin it down.
        total_quantity: stockValueRow?.total_quantity ?? 0,
        matches_grand_total: Number(stockValueRow?.total_quantity ?? 0) === Number(grandTotal)
      }
    });
  } catch (error) {
    console.error("stock-debug error:", error);
    return Response.json({
      error: "Failed",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
