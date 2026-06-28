import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-10jAIaE4.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/items/:id/timeline?branchId=N
//
// Chronological timeline of every stock-changing event for a single
// (item, branch) pair, from the very beginning. Used by the items
// summary page's "تقرير زمني" report.
//
// Each row is one event with the absolute quantity at the branch
// AFTER the event. Three event sources:
//   - inventory_operations  (Daily / Weekly / Opening / Transfer)
//   - purchase_receipts     (Receipt — adds to balance)
//
// For Receipt rows the running balance is computed by accumulating
// receipts AFTER the most recent inventory_operations row that reset
// the absolute. That mirrors how `branch-stock-at` computes
// point-in-time stock everywhere else.

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
    await ensureInventoryUnitSnapshotSchema();
    const itemId = parseInt(params.id);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return Response.json({
        error: "معرّف الصنف غير صحيح"
      }, {
        status: 400
      });
    }
    const {
      searchParams
    } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const branchId = Number(branchIdRaw);
    if (!Number.isFinite(branchId) || branchId <= 0) {
      return Response.json({
        error: "الفرع مطلوب"
      }, {
        status: 400
      });
    }

    // Item + branch metadata for the report header.
    const [item] = await sql`
      SELECT
        i.id,
        i.name,
        i.description,
        COALESCE(mu.name_ar, i.unit, 'حبة') AS unit,
        COALESCE(iu.conversion_factor, 1)::numeric AS current_factor
      FROM items i
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
      WHERE i.id = ${itemId}
      LIMIT 1
    `;
    if (!item) {
      return Response.json({
        error: "الصنف غير موجود"
      }, {
        status: 404
      });
    }
    const [branch] = await sql`
      SELECT id, name, location FROM branches WHERE id = ${branchId} LIMIT 1
    `;
    if (!branch) {
      return Response.json({
        error: "الفرع غير موجود"
      }, {
        status: 404
      });
    }

    // Inventory-operations events. `transfer_quantity` may be NULL on
    // legacy rows — for those we still surface the absolute and let
    // the UI compute delta from the previous row.
    const invRows = await sql`
      SELECT
        io.id              AS operation_id,
        io.inventory_number,
        io.inventory_type,
        io.status,
        io.transfer_direction,
        io.transfer_branch_id,
        tb.name            AS transfer_branch_name,
        io.note,
        COALESCE(io.operation_date, io.created_at) AS event_at,
        e.name             AS employee_name,
        (
          ii.quantity::numeric
            * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
        ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS new_quantity,
        (
          ii.transfer_quantity::numeric
            * COALESCE(ii.unit_factor, iu.conversion_factor, 1)::numeric
        ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS transfer_quantity
      FROM inventory_items ii
      JOIN inventory_operations io ON io.id = ii.operation_id
      JOIN items i ON i.id = ii.item_id
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN branches tb ON tb.id = io.transfer_branch_id
      LEFT JOIN employees e ON e.id = io.employee_id
      WHERE ii.item_id = ${itemId}
        AND ii.branch_id = ${branchId}
        AND io.status = 'Completed'
      ORDER BY COALESCE(io.operation_date, io.created_at) ASC, io.id ASC
    `;

    // Purchase receipts (deltas on top of the previous absolute).
    const receiptRows = await sql`
      SELECT
        pr.id                                        AS operation_id,
        pr.receipt_batch_id                          AS inventory_number,
        (
          pr.quantity::numeric
            * COALESCE(pr.unit_factor, iu.conversion_factor, 1)::numeric
        ) / NULLIF(COALESCE(iu.conversion_factor, 1)::numeric, 0) AS delta,
        pr.note,
        GREATEST(pr.received_at, pr.created_at)      AS event_at,
        COALESCE(pr.created_by_employee_name, e.name) AS employee_name
      FROM purchase_receipts pr
      JOIN items i ON i.id = pr.item_id
      LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
      LEFT JOIN employees e ON e.id = pr.created_by_employee_id
      WHERE pr.item_id = ${itemId}
        AND pr.branch_id = ${branchId}
      ORDER BY GREATEST(pr.received_at, pr.created_at) ASC, pr.id ASC
    `;

    // Merge + sort + compute running balance.
    const merged = [];
    for (const r of invRows) {
      merged.push({
        kind: "inv",
        operation_id: r.operation_id,
        inventory_number: r.inventory_number,
        inventory_type: r.inventory_type,
        transfer_direction: r.transfer_direction,
        transfer_branch_id: r.transfer_branch_id,
        transfer_branch_name: r.transfer_branch_name,
        note: r.note,
        event_at: r.event_at,
        employee_name: r.employee_name,
        new_quantity: Number(r.new_quantity) || 0,
        transfer_quantity: r.transfer_quantity !== null && r.transfer_quantity !== undefined ? Number(r.transfer_quantity) : null
      });
    }
    for (const r of receiptRows) {
      merged.push({
        kind: "receipt",
        operation_id: r.operation_id,
        inventory_number: r.inventory_number,
        inventory_type: "Receipt",
        transfer_direction: null,
        transfer_branch_id: null,
        transfer_branch_name: null,
        note: r.note,
        event_at: r.event_at,
        employee_name: r.employee_name,
        delta: Number(r.delta) || 0,
        new_quantity: null
      });
    }
    merged.sort((a, b) => {
      const ta = new Date(a.event_at).getTime();
      const tb = new Date(b.event_at).getTime();
      if (ta !== tb) return ta - tb;
      // Tie-break: invs before receipts at same instant (an inventory
      // reset normally precedes any receipt logged for that moment).
      if (a.kind !== b.kind) return a.kind === "inv" ? -1 : 1;
      return Number(a.operation_id) - Number(b.operation_id);
    });

    // Running balance + delta. Three families:
    //
    //   - Transfer rows: delta is derived from the operation's
    //     intent (transfer_quantity + direction), not from the
    //     stored absolutes. This keeps the displayed sign correct
    //     regardless of any chain-adjustment artefacts and matches
    //     what the user sees in /admin/operations.
    //     balance = prev_balance ± transfer_quantity
    //
    //   - Other inv rows (Daily / Weekly / Opening): the stored
    //     quantity IS the new absolute — it's a recount that resets
    //     the chain. balance = new_quantity. delta vs previous.
    //
    //   - Receipt rows: explicit additive delta on top of the
    //     running balance.
    let runningBalance = 0;
    const events = merged.map(m => {
      let balance;
      let delta;
      if (m.kind === "receipt") {
        delta = m.delta;
        balance = runningBalance + delta;
      } else if (m.inventory_type === "Transfer") {
        // Prefer transfer_quantity (the moved amount, populated by
        // the transfer route and backfilled for legacy rows). Fall
        // back to |stored - prev| if it's NULL for whatever reason.
        const moved = m.transfer_quantity !== null && m.transfer_quantity !== undefined ? Number(m.transfer_quantity) : Math.abs((Number(m.new_quantity) || 0) - runningBalance);
        const sign = m.transfer_direction === "out" ? -1 : 1;
        delta = sign * moved;
        balance = runningBalance + delta;
      } else {
        balance = Number(m.new_quantity) || 0;
        delta = balance - runningBalance;
      }
      runningBalance = balance;
      return {
        ...m,
        balance,
        delta
      };
    });
    return Response.json({
      item,
      branch,
      events
    });
  } catch (err) {
    console.error("Error fetching item timeline:", err);
    return Response.json({
      error: "Failed to fetch item timeline"
    }, {
      status: 500
    });
  }
}

export { GET };
