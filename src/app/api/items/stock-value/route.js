import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// GET /api/items/stock-value?branchId=<id>
// One row per item with:
//   - total_quantity   = sum across ALL branches of (last inventory + receipts after)
//                        OR — if `branchId` is supplied — that branch's qty only
//   - effective_cost   = COALESCE(i.cost, last green-bean order price)
//   - total_value      = total_quantity * effective_cost
//
// Math mirrors `/api/items` byte-for-byte (same last_inv + receipts_after
// CTEs). When `branchId` is omitted (or 0), the sum is across every
// branch — same total as the dashboard "قيمة المخزون" stat. When
// supplied, the API reports the value held at that single branch.
//
// Cost source mirrors `/api/dashboard/analytics` so a bean-linked item
// with NULL `items.cost` falls back to the latest green-bean order
// price. Inactive / hidden items are excluded.
export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const parsedBranchId = branchIdRaw ? Number(branchIdRaw) : null;
    const branchFilter =
      Number.isFinite(parsedBranchId) && parsedBranchId > 0
        ? parsedBranchId
        : null;

    // Explicit-params form (`sql(query, params)`) rather than tagged
    // template — tagged template with conditional interpolation inside
    // a SQL comment was producing extra/unused parameters that the
    // Neon HTTP driver couldn't validate, returning an empty array
    // silently. A single parameter referenced twice in the WHERE is
    // unambiguous.
    const query = `
      WITH last_inv AS (
        SELECT DISTINCT ON (ii.item_id, io.branch_id)
          ii.item_id,
          io.branch_id,
          ii.quantity AS inv_quantity,
          COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE io.status = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Transfer', 'Opening')
        ORDER BY
          ii.item_id,
          io.branch_id,
          COALESCE(io.operation_date, io.created_at) DESC,
          io.id DESC
      ),
      receipts_after AS (
        SELECT
          pr.item_id,
          pr.branch_id,
          SUM(pr.quantity) AS total_received
        FROM purchase_receipts pr
        LEFT JOIN last_inv li
          ON li.item_id = pr.item_id AND li.branch_id = pr.branch_id
        WHERE (
          li.op_date IS NULL
          OR GREATEST(pr.received_at, pr.created_at) > li.op_date
        )
        GROUP BY pr.item_id, pr.branch_id
      ),
      per_branch AS (
        SELECT
          i.id AS item_id,
          b.id AS branch_id,
          COALESCE(li.inv_quantity, 0)
            + COALESCE(ra.total_received, 0) AS qty
        FROM items i
        CROSS JOIN branches b
        LEFT JOIN last_inv li
          ON li.item_id = i.id AND li.branch_id = b.id
        LEFT JOIN receipts_after ra
          ON ra.item_id = i.id AND ra.branch_id = b.id
        -- Hide (item, branch) pairs admin disabled per-branch.
        LEFT JOIN item_branch_disabled ibd
          ON ibd.item_id = i.id AND ibd.branch_id = b.id
        -- $1 IS NULL → all branches; otherwise restrict to branch $1.
        WHERE ($1::int IS NULL OR b.id = $1::int)
          AND ibd.item_id IS NULL
      ),
      item_totals AS (
        SELECT
          pb.item_id,
          SUM(pb.qty)::numeric(12, 3) AS total_quantity
        FROM per_branch pb
        GROUP BY pb.item_id
      )
      SELECT
        i.id,
        i.name,
        i.name_en,
        i.unit,
        i.image_url,
        i.cost,
        COALESCE(i.cost, last_bean_price.final_price) AS effective_cost,
        last_bean_price.final_price AS fallback_cost,
        c.name AS category_name,
        COALESCE(it.total_quantity, 0)::numeric(12, 3) AS total_quantity,
        CASE
          WHEN COALESCE(i.cost, last_bean_price.final_price) IS NULL
            THEN NULL
          ELSE (
            COALESCE(it.total_quantity, 0)
              * COALESCE(i.cost, last_bean_price.final_price)
          )::numeric(14, 2)
        END AS total_value
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN item_totals it ON it.item_id = i.id
      LEFT JOIN LATERAL (
        SELECT oi.computed_final_price_per_kg AS final_price
        FROM accounting_green_bean_order_items oi
        JOIN accounting_green_bean_orders o ON o.id = oi.order_id
        WHERE oi.bean_id = i.linked_green_bean_id
          AND oi.computed_final_price_per_kg IS NOT NULL
        ORDER BY o.order_date DESC, oi.id DESC
        LIMIT 1
      ) last_bean_price ON i.linked_green_bean_id IS NOT NULL
      WHERE i.is_active = true
        AND i.show_in_inventory = true
      ORDER BY i.name ASC
    `;

    const rows = await sql(query, [branchFilter]);

    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching stock value:", error);
    return Response.json(
      { error: "Failed to fetch stock value", details: error.message },
      { status: 500 },
    );
  }
}
