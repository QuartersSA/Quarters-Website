import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setDate(
      startOfThisWeek.getDate() - startOfThisWeek.getDay(),
    );
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek);

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // 1. Week-over-week comparison.
    // Two separate COUNT(*) queries used to round-trip twice. Single query
    // with FILTER clauses computes both windows in one scan.
    const [weeklyCounts] = await sql(
      `
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(operation_date, created_at) >= $1) AS this_cnt,
          COUNT(*) FILTER (
            WHERE COALESCE(operation_date, created_at) >= $2
              AND COALESCE(operation_date, created_at) < $3
          ) AS last_cnt
        FROM inventory_operations
        WHERE COALESCE(operation_date, created_at) >= $2
      `,
      [
        startOfThisWeek.toISOString(),
        startOfLastWeek.toISOString(),
        endOfLastWeek.toISOString(),
      ],
    );

    const thisWeekCount = Number(weeklyCounts?.this_cnt || 0);
    const lastWeekCount = Number(weeklyCounts?.last_cnt || 0);
    const weekChangePercent =
      lastWeekCount > 0
        ? Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100)
        : thisWeekCount > 0
          ? 100
          : 0;

    // 2. Branch performance
    const branchPerformance = await sql`
      SELECT 
        b.id,
        b.name,
        b.location,
        COUNT(io.id) FILTER (WHERE COALESCE(io.operation_date, io.created_at) >= ${startOfThisMonth.toISOString()}) as ops_this_month,
        COUNT(io.id) FILTER (WHERE io.status = 'Completed') as completed_ops,
        COUNT(io.id) as total_ops
      FROM branches b
      LEFT JOIN inventory_operations io ON io.branch_id = b.id
      GROUP BY b.id, b.name, b.location
      ORDER BY b.name
    `;

    // 3. Low-stock count per branch. Uses the same reset + receipts +
    //    signed transfer deltas formula as the items-summary / low-stock
    //    endpoints so the dashboard tile agrees with the dedicated pages.
    const lowStockData = await sql`
      SELECT
        b.id as branch_id,
        b.name as branch_name,
        COUNT(*) FILTER (
          WHERE (
            COALESCE(last_reset.inv_quantity, 0)
            + COALESCE(receipts_after.total_received, 0)
            + COALESCE(transfers_after.net_transfer, 0)
          ) < i.min_stock_threshold
          AND (
            last_reset.op_date IS NOT NULL
            OR receipts_after.total_received > 0
            OR transfers_after.net_transfer <> 0
          )
        ) as low_stock_count,
        COUNT(*) FILTER (
          WHERE (
            COALESCE(last_reset.inv_quantity, 0)
            + COALESCE(receipts_after.total_received, 0)
            + COALESCE(transfers_after.net_transfer, 0)
          ) = 0
          AND last_reset.op_date IS NOT NULL
        ) as out_of_stock_count,
        COUNT(*) FILTER (
          WHERE
            last_reset.op_date IS NOT NULL
            OR receipts_after.total_received > 0
            OR transfers_after.net_transfer <> 0
        ) as tracked_items
      FROM branches b
      CROSS JOIN items i
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id

      LEFT JOIN LATERAL (
        SELECT ii.quantity AS inv_quantity,
               COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id  = i.id
          AND io.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
        LIMIT 1
      ) last_reset ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
        FROM purchase_receipts pr
        WHERE pr.item_id   = i.id
          AND pr.branch_id = b.id
          AND (
            last_reset.op_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > last_reset.op_date
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
          AND ii.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type = 'Transfer'
          AND (
            last_reset.op_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > last_reset.op_date
          )
      ) transfers_after ON true

      WHERE i.is_active = true AND i.show_in_inventory = true
        AND ibd.item_id IS NULL
      GROUP BY b.id, b.name
      ORDER BY b.name
    `;

    // 4. Smart alerts
    const alerts = [];

    // Items completely out of stock. "Last count" here is the most
    // recent physical recount (Daily / Weekly / Opening). Transfer
    // rows are excluded because their stored absolute can drift and
    // a transfer whose post-state happens to be 0 isn't the same
    // signal as a physical recount of 0.
    const outOfStockItems = await sql`
      SELECT DISTINCT i.name
      FROM items i
      JOIN inventory_items ii ON ii.item_id = i.id
      JOIN inventory_operations io ON io.id = ii.operation_id
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = io.branch_id
      WHERE i.is_active = true AND i.show_in_inventory = true
        AND ibd.item_id IS NULL
        AND io.status = 'Completed'
        AND ii.quantity = 0
        AND io.id = (
          SELECT io2.id FROM inventory_operations io2
          JOIN inventory_items ii2 ON ii2.operation_id = io2.id
          WHERE ii2.item_id = i.id AND io2.branch_id = io.branch_id
            AND io2.status = 'Completed'
            AND io2.inventory_type IN ('Daily','Weekly','Opening')
          ORDER BY COALESCE(io2.operation_date, io2.created_at) DESC
          LIMIT 1
        )
      LIMIT 5
    `;

    if (outOfStockItems.length > 0) {
      alerts.push({
        type: "danger",
        message: `${outOfStockItems.length} أصناف نفدت تماماً`,
        items: outOfStockItems.map((r) => r.name),
      });
    }

    // Three independent COUNT(*) queries used to round-trip three times
    // (pending / today / total). Single query with FILTER clauses scans
    // inventory_operations once and returns all three.
    const [opCounts] = await sql(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Pending') AS pending_cnt,
         COUNT(*) FILTER (
           WHERE COALESCE(operation_date, created_at) >= $1
         ) AS today_cnt,
         COUNT(*) AS total_cnt
       FROM inventory_operations`,
      [startOfToday.toISOString()],
    );
    const pendingCount = Number(opCounts?.pending_cnt || 0);
    const todayOpsCount = Number(opCounts?.today_cnt || 0);
    const totalAllOps = Number(opCounts?.total_cnt || 1);

    if (pendingCount > 0) {
      alerts.push({
        type: "warning",
        message: `${pendingCount} عمليات قيد الانتظار`,
      });
    }

    if (todayOpsCount === 0) {
      alerts.push({
        type: "info",
        message: "لا توجد عمليات جرد اليوم بعد",
      });
    }

    // Aggregate lowStockData in one pass — previously this array was
    // reduced three separate times (totalLowStock for alerts, then
    // totalTrackedItems + totalLowStockItems + totalOutOfStock for the
    // health score). Single loop avoids 3× iteration over the same
    // array and removes the duplicate "sum of low_stock_count" pair.
    let totalTrackedItems = 0;
    let totalLowStockItems = 0;
    let totalOutOfStock = 0;
    for (const r of lowStockData) {
      totalTrackedItems += Number(r.tracked_items || 0);
      totalLowStockItems += Number(r.low_stock_count || 0);
      totalOutOfStock += Number(r.out_of_stock_count || 0);
    }
    if (totalLowStockItems > 0) {
      alerts.push({
        type: "warning",
        message: `${totalLowStockItems} صنف منخفض الكمية عبر جميع الفروع`,
      });
    }

    // 5. Inventory cost per branch — quantity uses the timeline
    //    formula (reset + receipts + signed transfers) for consistency
    //    with /api/items/stock-value.
    const inventoryCost = await sql`
      SELECT
        b.id as branch_id,
        b.name as branch_name,
        SUM(
          (
            COALESCE(last_reset.inv_quantity, 0)
            + COALESCE(receipts_after.total_received, 0)
            + COALESCE(transfers_after.net_transfer, 0)
          )
          * COALESCE(i.cost, last_bean_price.final_price, 0)
        ) as total_cost,
        COUNT(*) FILTER (
          WHERE COALESCE(i.cost, last_bean_price.final_price) IS NOT NULL
            AND COALESCE(i.cost, last_bean_price.final_price) > 0
        ) as priced_items
      FROM branches b
      CROSS JOIN items i
      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id

      LEFT JOIN LATERAL (
        SELECT ii.quantity AS inv_quantity,
               COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id  = i.id
          AND io.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Opening')
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
        LIMIT 1
      ) last_reset ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
        FROM purchase_receipts pr
        WHERE pr.item_id   = i.id
          AND pr.branch_id = b.id
          AND (
            last_reset.op_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > last_reset.op_date
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
          AND ii.branch_id = b.id
          AND io.status    = 'Completed'
          AND io.inventory_type = 'Transfer'
          AND (
            last_reset.op_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > last_reset.op_date
          )
      ) transfers_after ON true

      LEFT JOIN LATERAL (
        SELECT oi.computed_final_price_per_kg AS final_price
        FROM accounting_green_bean_order_items oi
        JOIN accounting_green_bean_orders o ON o.id = oi.order_id
        WHERE oi.bean_id = i.linked_green_bean_id
          AND oi.computed_final_price_per_kg IS NOT NULL
        ORDER BY o.order_date DESC, oi.id DESC
        LIMIT 1
      ) last_bean_price ON i.linked_green_bean_id IS NOT NULL

      WHERE i.is_active = true AND i.show_in_inventory = true
        AND ibd.item_id IS NULL
        AND (
          last_reset.op_date IS NOT NULL
          OR receipts_after.total_received > 0
          OR transfers_after.net_transfer <> 0
        )
      GROUP BY b.id, b.name
      ORDER BY b.name
    `;

    const totalInventoryCost = inventoryCost.reduce(
      (s, r) => s + Number(r.total_cost || 0),
      0,
    );

    // 6. Health Score calculation
    // totalTrackedItems / totalLowStockItems / totalOutOfStock were
    // already computed above in the single fused loop over lowStockData.
    // Health Score = 100 - (low stock penalty) - (out of stock penalty) - (no recent ops penalty)
    let healthScore = 100;
    if (totalTrackedItems > 0) {
      const lowStockRatio = totalLowStockItems / totalTrackedItems;
      const outOfStockRatio = totalOutOfStock / totalTrackedItems;
      healthScore -= Math.round(lowStockRatio * 30); // up to -30 for low stock
      healthScore -= Math.round(outOfStockRatio * 40); // up to -40 for out of stock
    }
    // Penalty for pending operations.
    // `totalAllOps` was computed above in the combined opCounts query —
    // reuse instead of issuing another COUNT(*) round-trip.
    const pendingRatio = pendingCount / Math.max(totalAllOps, 1);
    healthScore -= Math.round(pendingRatio * 20);
    healthScore = Math.max(0, Math.min(100, healthScore));

    // 7. Monthly inventory movement
    const monthlyMovement = await sql`
      SELECT
        i.id as item_id,
        i.name as item_name,
        i.unit,
        i.cost,
        b.id as branch_id,
        b.name as branch_name,
        COALESCE(opening.qty, 0) as opening_qty,
        COALESCE(received.qty, 0) as received_qty,
        COALESCE(closing.qty, 0) as closing_qty
      FROM items i
      CROSS JOIN branches b

      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id

      LEFT JOIN LATERAL (
        SELECT ii.quantity as qty
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = i.id AND io.branch_id = b.id
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily','Weekly','Transfer','Opening')
          AND COALESCE(io.operation_date, io.created_at) < ${startOfThisMonth.toISOString()}
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC
        LIMIT 1
      ) opening ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pr.quantity), 0) as qty
        FROM purchase_receipts pr
        WHERE pr.item_id = i.id AND pr.branch_id = b.id
          AND pr.received_at >= ${startOfThisMonth.toISOString()}
          AND pr.received_at < ${now.toISOString()}
      ) received ON true

      LEFT JOIN LATERAL (
        SELECT ii.quantity as qty
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = i.id AND io.branch_id = b.id
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily','Weekly','Transfer','Opening')
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC
        LIMIT 1
      ) closing ON true

      WHERE i.is_active = true AND i.show_in_inventory = true
        AND ibd.item_id IS NULL
        AND (opening.qty IS NOT NULL OR received.qty > 0 OR closing.qty IS NOT NULL)
      ORDER BY i.name, b.name
    `;

    // 8. Stock depletion prediction
    // Compare last two inventory counts to estimate daily consumption
    const depletionData = await sql`
      SELECT
        i.id as item_id,
        i.name as item_name,
        i.unit,
        b.id as branch_id,
        b.name as branch_name,
        i.min_stock_threshold,
        latest.qty as current_qty,
        latest.op_date as latest_date,
        prev.qty as prev_qty,
        prev.op_date as prev_date
      FROM items i
      CROSS JOIN branches b

      LEFT JOIN item_branch_disabled ibd
        ON ibd.item_id = i.id AND ibd.branch_id = b.id

      LEFT JOIN LATERAL (
        SELECT ii.quantity as qty, COALESCE(io.operation_date, io.created_at) as op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = i.id AND io.branch_id = b.id
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily','Weekly')
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC
        LIMIT 1
      ) latest ON true

      LEFT JOIN LATERAL (
        SELECT ii.quantity as qty, COALESCE(io.operation_date, io.created_at) as op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = i.id AND io.branch_id = b.id
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily','Weekly')
          AND COALESCE(io.operation_date, io.created_at) < latest.op_date
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC
        LIMIT 1
      ) prev ON true

      WHERE i.is_active = true AND i.show_in_inventory = true
        AND ibd.item_id IS NULL
        AND latest.qty IS NOT NULL
        AND prev.qty IS NOT NULL
        AND prev.qty > latest.qty
      ORDER BY i.name, b.name
    `;

    // Calculate days to depletion
    const depletionPredictions = depletionData
      .map((row) => {
        const currentQty = Number(row.current_qty);
        const prevQty = Number(row.prev_qty);
        const latestDate = new Date(row.latest_date);
        const prevDate = new Date(row.prev_date);
        const daysBetween = Math.max(
          1,
          (latestDate - prevDate) / (1000 * 60 * 60 * 24),
        );
        const dailyConsumption = (prevQty - currentQty) / daysBetween;

        if (dailyConsumption <= 0) return null;

        const daysToDepletion = Math.round(currentQty / dailyConsumption);
        const predictedDepletionDate = new Date(latestDate);
        predictedDepletionDate.setDate(
          predictedDepletionDate.getDate() + daysToDepletion,
        );

        return {
          item_id: row.item_id,
          item_name: row.item_name,
          unit: row.unit,
          branch_id: row.branch_id,
          branch_name: row.branch_name,
          current_qty: currentQty,
          daily_consumption: Math.round(dailyConsumption * 100) / 100,
          days_to_depletion: daysToDepletion,
          predicted_depletion_date: predictedDepletionDate.toISOString(),
          min_stock_threshold: Number(row.min_stock_threshold || 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.days_to_depletion - b.days_to_depletion)
      .slice(0, 20);

    // 9. Operations timeline (recent 10)
    const timeline = await sql`
      SELECT 
        io.id,
        io.inventory_number,
        io.inventory_type,
        io.status,
        COALESCE(io.operation_date, io.created_at) as op_date,
        b.name as branch_name,
        e.name as employee_name,
        io.note
      FROM inventory_operations io
      LEFT JOIN branches b ON io.branch_id = b.id
      LEFT JOIN employees e ON io.employee_id = e.id
      ORDER BY COALESCE(io.operation_date, io.created_at) DESC
      LIMIT 10
    `;

    // Also get recent purchase receipts for timeline
    const recentReceipts = await sql`
      SELECT 
        pr.id,
        pr.receipt_batch_id,
        b.name as branch_name,
        i.name as item_name,
        pr.quantity,
        pr.received_at as op_date,
        COALESCE(pr.created_by_employee_name, e.name) as employee_name,
        pr.note
      FROM purchase_receipts pr
      LEFT JOIN branches b ON b.id = pr.branch_id
      LEFT JOIN items i ON i.id = pr.item_id
      LEFT JOIN employees e ON e.id = pr.created_by_employee_id
      ORDER BY pr.received_at DESC
      LIMIT 5
    `;

    const timelineItems = [
      ...timeline.map((t) => ({
        id: t.id,
        type: t.inventory_type,
        status: t.status,
        date: t.op_date,
        branch: t.branch_name,
        employee: t.employee_name,
        number: t.inventory_number,
        note: t.note,
      })),
      ...recentReceipts.map((r) => ({
        id: `rcpt-${r.id}`,
        type: "Receipt",
        status: "Completed",
        date: r.op_date,
        branch: r.branch_name,
        employee: r.employee_name,
        number: `RCV-${r.receipt_batch_id || r.id}`,
        note: r.note,
        itemName: r.item_name,
        quantity: Number(r.quantity),
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 12);

    return Response.json({
      weekComparison: {
        thisWeek: thisWeekCount,
        lastWeek: lastWeekCount,
        changePercent: weekChangePercent,
      },
      branchPerformance: branchPerformance.map((bp) => ({
        ...bp,
        ops_this_month: Number(bp.ops_this_month),
        completed_ops: Number(bp.completed_ops),
        total_ops: Number(bp.total_ops),
        completion_rate:
          Number(bp.total_ops) > 0
            ? Math.round(
                (Number(bp.completed_ops) / Number(bp.total_ops)) * 100,
              )
            : 0,
        low_stock_count: Number(
          lowStockData.find((ls) => ls.branch_id === bp.id)?.low_stock_count ||
            0,
        ),
        out_of_stock_count: Number(
          lowStockData.find((ls) => ls.branch_id === bp.id)
            ?.out_of_stock_count || 0,
        ),
        tracked_items: Number(
          lowStockData.find((ls) => ls.branch_id === bp.id)?.tracked_items || 0,
        ),
      })),
      alerts,
      inventoryCost: {
        byBranch: inventoryCost.map((ic) => ({
          branch_id: ic.branch_id,
          branch_name: ic.branch_name,
          total_cost: Math.round(Number(ic.total_cost || 0) * 100) / 100,
          priced_items: Number(ic.priced_items),
        })),
        totalCost: Math.round(totalInventoryCost * 100) / 100,
      },
      healthScore,
      monthlyMovement,
      depletionPredictions,
      timeline: timelineItems,
    });
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    return Response.json(
      { error: "Failed to fetch dashboard analytics" },
      { status: 500 },
    );
  }
}
