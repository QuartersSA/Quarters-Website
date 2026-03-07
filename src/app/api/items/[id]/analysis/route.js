import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

/**
 * GET /api/items/:id/analysis?branchIds=1,2,3&from=&to=
 *
 * Returns ALL operation types for a single item across one or more branches
 * over a date range, so the front-end can draw separate bars for:
 *   - الجرد (Daily / Weekly inventory counts)
 *   - الوارد (Purchase receipts)
 *   - المخزون الافتتاحي (Opening sessions)
 *   - التحويلات الواردة (Transfer in)
 *   - التحويلات الصادرة (Transfer out)
 */
export async function GET(request, { params }) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const itemId = parseInt(params.id);
    if (!itemId || Number.isNaN(itemId)) {
      return Response.json({ error: "معرّف الصنف غير صحيح" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    // Support both branchId (single, legacy) and branchIds (comma-separated, new)
    const branchIdsRaw =
      searchParams.get("branchIds") || searchParams.get("branchId") || "";
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");

    // Parse branch IDs
    const branchIds = branchIdsRaw
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (branchIds.length === 0) {
      return Response.json({ error: "الفرع مطلوب" }, { status: 400 });
    }
    if (!fromRaw || !toRaw) {
      return Response.json({ error: "التاريخ مطلوب" }, { status: 400 });
    }

    // Build branch placeholders dynamically: $4, $5, $6, ...
    // Params: $1 = itemId, $2 = fromRaw, $3 = toRaw, $4.. = branchIds
    const branchPlaceholders = branchIds.map((_, i) => `$${i + 4}`).join(", ");
    const baseValues = [itemId, fromRaw, toRaw, ...branchIds];

    // 1) Inventory counts (Daily / Weekly) from inventory_operations + inventory_items
    const inventoryRows = await sql(
      `SELECT
         COALESCE(io.operation_date, io.created_at) AS event_date,
         ii.quantity,
         io.inventory_type,
         io.branch_id,
         b.name AS branch_name,
         'inventory' AS source
       FROM inventory_items ii
       JOIN inventory_operations io ON io.id = ii.operation_id
       LEFT JOIN branches b ON b.id = io.branch_id
       WHERE ii.item_id = $1
         AND io.branch_id IN (${branchPlaceholders})
         AND io.status = 'Completed'
         AND io.inventory_type IN ('Daily', 'Weekly')
         AND COALESCE(io.operation_date, io.created_at) >= $2::date
         AND COALESCE(io.operation_date, io.created_at) < ($3::date + INTERVAL '1 day')
       ORDER BY COALESCE(io.operation_date, io.created_at) ASC`,
      baseValues,
    );

    // 2) Purchase receipts (الوارد)
    const receiptRows = await sql(
      `SELECT
         pr.received_at AS event_date,
         pr.quantity,
         pr.branch_id,
         b.name AS branch_name,
         'receipt' AS source
       FROM purchase_receipts pr
       LEFT JOIN branches b ON b.id = pr.branch_id
       WHERE pr.item_id = $1
         AND pr.branch_id IN (${branchPlaceholders})
         AND pr.received_at >= $2::date
         AND pr.received_at < ($3::date + INTERVAL '1 day')
       ORDER BY pr.received_at ASC`,
      baseValues,
    );

    // 3) Opening sessions (المخزون الافتتاحي)
    const openingRows = await sql(
      `SELECT
         os.opened_at AS event_date,
         osi.quantity,
         os.branch_id,
         b.name AS branch_name,
         'opening' AS source
       FROM opening_session_items osi
       JOIN opening_sessions os ON os.id = osi.session_id
       LEFT JOIN branches b ON b.id = os.branch_id
       WHERE osi.item_id = $1
         AND os.branch_id IN (${branchPlaceholders})
         AND os.opened_at >= $2::date
         AND os.opened_at < ($3::date + INTERVAL '1 day')
       ORDER BY os.opened_at ASC`,
      baseValues,
    );

    // 4) Transfers in (تحويلات واردة) — branch is the receiving branch
    const transferInRows = await sql(
      `SELECT
         COALESCE(io.operation_date, io.created_at) AS event_date,
         ii.quantity,
         io.branch_id,
         b.name AS branch_name,
         'transfer_in' AS source
       FROM inventory_items ii
       JOIN inventory_operations io ON io.id = ii.operation_id
       LEFT JOIN branches b ON b.id = io.branch_id
       WHERE ii.item_id = $1
         AND io.branch_id IN (${branchPlaceholders})
         AND io.status = 'Completed'
         AND io.inventory_type = 'Transfer'
         AND io.transfer_direction = 'in'
         AND COALESCE(io.operation_date, io.created_at) >= $2::date
         AND COALESCE(io.operation_date, io.created_at) < ($3::date + INTERVAL '1 day')
       ORDER BY COALESCE(io.operation_date, io.created_at) ASC`,
      baseValues,
    );

    // 5) Transfers out (تحويلات صادرة) — branch is the sending branch
    const transferOutRows = await sql(
      `SELECT
         COALESCE(io.operation_date, io.created_at) AS event_date,
         ii.quantity,
         io.branch_id,
         b.name AS branch_name,
         'transfer_out' AS source
       FROM inventory_items ii
       JOIN inventory_operations io ON io.id = ii.operation_id
       LEFT JOIN branches b ON b.id = io.branch_id
       WHERE ii.item_id = $1
         AND io.branch_id IN (${branchPlaceholders})
         AND io.status = 'Completed'
         AND io.inventory_type = 'Transfer'
         AND io.transfer_direction = 'out'
         AND COALESCE(io.operation_date, io.created_at) >= $2::date
         AND COALESCE(io.operation_date, io.created_at) < ($3::date + INTERVAL '1 day')
       ORDER BY COALESCE(io.operation_date, io.created_at) ASC`,
      baseValues,
    );

    return Response.json({
      item_id: itemId,
      branch_ids: branchIds,
      from: fromRaw,
      to: toRaw,
      inventory: inventoryRows,
      receipts: receiptRows,
      openings: openingRows,
      transfers_in: transferInRows,
      transfers_out: transferOutRows,
    });
  } catch (error) {
    console.error("Error fetching item analysis:", error);
    return Response.json(
      { error: "فشل في تحميل تحليل المخزون" },
      { status: 500 },
    );
  }
}
