import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import '@neondatabase/serverless';
import 'crypto';

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
    const query = `
      SELECT
        io.id as operation_id,
        io.inventory_number,
        COALESCE(io.operation_date, io.created_at) as created_at,
        io.branch_id,
        b.name as branch_name,
        ii.item_id,
        i.name as item_name,
        ii.quantity::numeric as actual_quantity,
        os.id as opening_session_id,
        os.opened_at as opening_opened_at,
        COALESCE(osi.quantity, 0)::numeric as opening_quantity,
        COALESCE(
          (
            SELECT SUM(pr.quantity)::numeric
            FROM purchase_receipts pr
            WHERE pr.branch_id = io.branch_id
              AND pr.item_id = ii.item_id
              AND (
                os.opened_at IS NULL
                OR pr.received_at >= os.opened_at::timestamp
              )
              AND pr.received_at <= COALESCE(io.operation_date, io.created_at)
          ),
          0
        )::numeric as receipts_quantity,
        (
          COALESCE(osi.quantity, 0)::numeric +
          COALESCE(
            (
              SELECT SUM(pr.quantity)::numeric
              FROM purchase_receipts pr
              WHERE pr.branch_id = io.branch_id
                AND pr.item_id = ii.item_id
                AND (
                  os.opened_at IS NULL
                  OR pr.received_at >= os.opened_at::timestamp
                )
                AND pr.received_at <= COALESCE(io.operation_date, io.created_at)
            ),
            0
          )::numeric
        ) as expected_quantity,
        (ii.quantity::numeric - (
          COALESCE(osi.quantity, 0)::numeric +
          COALESCE(
            (
              SELECT SUM(pr.quantity)::numeric
              FROM purchase_receipts pr
              WHERE pr.branch_id = io.branch_id
                AND pr.item_id = ii.item_id
                AND (
                  os.opened_at IS NULL
                  OR pr.received_at >= os.opened_at::timestamp
                )
                AND pr.received_at <= COALESCE(io.operation_date, io.created_at)
            ),
            0
          )::numeric
        )) as delta_quantity
      FROM inventory_operations io
      JOIN inventory_items ii ON ii.operation_id = io.id
      LEFT JOIN branches b ON b.id = io.branch_id
      LEFT JOIN items i ON i.id = ii.item_id
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
      WHERE io.status = 'Completed'
        AND io.inventory_type IN ('Daily', 'Weekly', 'Transfer', 'Opening')
        AND io.branch_id = $1
        AND ii.item_id = $2
        AND COALESCE(io.operation_date, io.created_at) >= $3::date
        AND COALESCE(io.operation_date, io.created_at) < ($4::date + INTERVAL '1 day')
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
