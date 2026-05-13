import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// GET /api/items/stock-value
// One row per item with:
//   - quantity = sum across ALL branches of (last inventory + receipts after)
//   - effective_cost = COALESCE(i.cost, last green-bean order price)
//   - value = quantity * effective_cost
//
// Cost source matches /api/dashboard/analytics deliberately so the
// "قيمة المخزون" stat on the admin dashboard equals the grand total on
// this page. Without the bean-price fallback, items linked to a green
// bean variety but missing i.cost would silently zero out here while
// the dashboard counted them — causing drift between the two screens.
//
// Inactive / hidden items are excluded. Items still missing a price
// after the fallback show up with value = null + an amber "غير محدد"
// pill so the user can spot what needs a cost entered.
export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rows = await sql`
      WITH per_branch AS (
        SELECT
          i.id   AS item_id,
          b.id   AS branch_id,
          COALESCE(last_inv.inv_quantity, 0)
            + COALESCE(receipts_after.total_received, 0) AS qty
        FROM items i
        CROSS JOIN branches b

        LEFT JOIN LATERAL (
          SELECT
            ii.quantity AS inv_quantity,
            COALESCE(io.operation_date, io.created_at) AS op_date
          FROM inventory_items ii
          JOIN inventory_operations io ON io.id = ii.operation_id
          WHERE ii.item_id  = i.id
            AND io.branch_id = b.id
            AND io.status    = 'Completed'
            AND io.inventory_type IN ('Daily', 'Weekly', 'Transfer', 'Opening')
          ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
          LIMIT 1
        ) last_inv ON true

        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
          FROM purchase_receipts pr
          WHERE pr.item_id   = i.id
            AND pr.branch_id = b.id
            AND (
              last_inv.op_date IS NULL
              -- GREATEST(received_at, created_at): protects against
              -- backdated rows (e.g. green-bean deposits stamped with
              -- an older order_date) that would otherwise be silently
              -- excluded from totals.
              OR GREATEST(pr.received_at, pr.created_at) > last_inv.op_date
            )
        ) receipts_after ON true
      )
      SELECT
        i.id,
        i.name,
        i.name_en,
        i.unit,
        i.image_url,
        i.cost,
        -- effective_cost = direct cost, then fall back to the latest
        -- green-bean order price for items linked to a bean. Mirrors
        -- /api/dashboard/analytics so the two screens agree.
        COALESCE(i.cost, last_bean_price.final_price) AS effective_cost,
        last_bean_price.final_price AS fallback_cost,
        c.name AS category_name,
        COALESCE(SUM(pb.qty), 0)::numeric(12, 3) AS total_quantity,
        CASE
          WHEN COALESCE(i.cost, last_bean_price.final_price) IS NULL
            THEN NULL
          ELSE (
            COALESCE(SUM(pb.qty), 0)
            * COALESCE(i.cost, last_bean_price.final_price)
          )::numeric(14, 2)
        END AS total_value
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN per_branch pb ON pb.item_id = i.id
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
      GROUP BY i.id, c.name, last_bean_price.final_price
      ORDER BY i.name ASC
    `;

    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching stock value:", error);
    return Response.json(
      { error: "Failed to fetch stock value", details: error.message },
      { status: 500 },
    );
  }
}
