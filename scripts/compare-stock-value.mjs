// READ-ONLY. Per-item comparison of the two stock-value formulas so
// we can decide which matches reality. No writes.
//   node --env-file=.env scripts/compare-stock-value.mjs

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  WITH last_reset AS (
    SELECT DISTINCT ON (ii.item_id, io.branch_id)
      ii.item_id, io.branch_id,
      ii.quantity AS inv_quantity,
      COALESCE(io.operation_date, io.created_at) AS op_date
    FROM inventory_items ii
    JOIN inventory_operations io ON io.id = ii.operation_id
    WHERE io.status = 'Completed'
      AND io.inventory_type IN ('Daily','Weekly','Opening')
    ORDER BY ii.item_id, io.branch_id,
      COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
  ),
  receipts_after AS (
    SELECT pr.item_id, pr.branch_id, SUM(pr.quantity) AS total_received
    FROM purchase_receipts pr
    LEFT JOIN last_reset li ON li.item_id = pr.item_id AND li.branch_id = pr.branch_id
    WHERE (li.op_date IS NULL OR GREATEST(pr.received_at, pr.created_at) > li.op_date)
    GROUP BY pr.item_id, pr.branch_id
  ),
  transfers_after AS (
    SELECT ii.item_id, ii.branch_id,
      SUM(CASE io.transfer_direction WHEN 'in' THEN COALESCE(ii.transfer_quantity,0)
            WHEN 'out' THEN -COALESCE(ii.transfer_quantity,0) ELSE 0 END) AS net_transfer
    FROM inventory_items ii
    JOIN inventory_operations io ON io.id = ii.operation_id
    LEFT JOIN last_reset li ON li.item_id = ii.item_id AND li.branch_id = ii.branch_id
    WHERE io.status = 'Completed' AND io.inventory_type = 'Transfer'
      AND (li.op_date IS NULL OR COALESCE(io.operation_date, io.created_at) > li.op_date)
    GROUP BY ii.item_id, ii.branch_id
  ),
  totals AS (
    SELECT i.id AS item_id,
      SUM(COALESCE(lr.inv_quantity,0)+COALESCE(ra.total_received,0)+COALESCE(ta.net_transfer,0)) AS base_qty
    FROM items i
    CROSS JOIN branches b
    LEFT JOIN item_branch_disabled ibd ON ibd.item_id=i.id AND ibd.branch_id=b.id
    LEFT JOIN last_reset lr ON lr.item_id=i.id AND lr.branch_id=b.id
    LEFT JOIN receipts_after ra ON ra.item_id=i.id AND ra.branch_id=b.id
    LEFT JOIN transfers_after ta ON ta.item_id=i.id AND ta.branch_id=b.id
    WHERE ibd.item_id IS NULL
    GROUP BY i.id
  )
  SELECT
    i.name,
    COALESCE(i.base_purchase_cost, i.cost) AS base_cost,
    mu.name_ar AS inv_unit,
    COALESCE(iu.conversion_factor, 1) AS inv_factor,
    t.base_qty,
    -- Dashboard / fixed stock-value: base_qty × base_cost
    (t.base_qty * COALESCE(i.base_purchase_cost, i.cost))::numeric(14,2) AS val_no_factor,
    -- Old stock-value: base_qty × base_cost × inv_factor (= displayed qty × displayed cost)
    (t.base_qty * COALESCE(i.base_purchase_cost, i.cost) * COALESCE(iu.conversion_factor,1))::numeric(14,2) AS val_with_factor
  FROM items i
  JOIN totals t ON t.item_id = i.id
  LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
  LEFT JOIN measurement_units mu ON mu.id = iu.unit_id
  WHERE i.is_active = true AND i.show_in_inventory = true
    AND COALESCE(i.base_purchase_cost, i.cost) IS NOT NULL
    AND t.base_qty <> 0
  ORDER BY val_no_factor DESC
  LIMIT 15
`;

console.log("\nالصنف | سعر أساسي | وحدة الجرد(factor) | كمية | بدون factor | مع factor\n");
let sumNo = 0, sumWith = 0;
for (const r of rows) {
  console.log(
    `${r.name}  |  ${r.base_cost}  |  ${r.inv_unit || "—"}(${r.inv_factor})  |  ${r.base_qty}  |  ${r.val_no_factor}  |  ${r.val_with_factor}`,
  );
}

// Grand totals across ALL items (not just top 15)
const [grand] = await sql`
  WITH last_reset AS (
    SELECT DISTINCT ON (ii.item_id, io.branch_id)
      ii.item_id, io.branch_id, ii.quantity AS inv_quantity,
      COALESCE(io.operation_date, io.created_at) AS op_date
    FROM inventory_items ii JOIN inventory_operations io ON io.id = ii.operation_id
    WHERE io.status='Completed' AND io.inventory_type IN ('Daily','Weekly','Opening')
    ORDER BY ii.item_id, io.branch_id, COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
  ),
  receipts_after AS (
    SELECT pr.item_id, pr.branch_id, SUM(pr.quantity) AS total_received
    FROM purchase_receipts pr
    LEFT JOIN last_reset li ON li.item_id=pr.item_id AND li.branch_id=pr.branch_id
    WHERE (li.op_date IS NULL OR GREATEST(pr.received_at, pr.created_at) > li.op_date)
    GROUP BY pr.item_id, pr.branch_id
  ),
  transfers_after AS (
    SELECT ii.item_id, ii.branch_id,
      SUM(CASE io.transfer_direction WHEN 'in' THEN COALESCE(ii.transfer_quantity,0)
            WHEN 'out' THEN -COALESCE(ii.transfer_quantity,0) ELSE 0 END) AS net_transfer
    FROM inventory_items ii JOIN inventory_operations io ON io.id=ii.operation_id
    LEFT JOIN last_reset li ON li.item_id=ii.item_id AND li.branch_id=ii.branch_id
    WHERE io.status='Completed' AND io.inventory_type='Transfer'
      AND (li.op_date IS NULL OR COALESCE(io.operation_date, io.created_at) > li.op_date)
    GROUP BY ii.item_id, ii.branch_id
  )
  SELECT
    SUM((COALESCE(lr.inv_quantity,0)+COALESCE(ra.total_received,0)+COALESCE(ta.net_transfer,0))
        * COALESCE(i.base_purchase_cost,i.cost,0))::numeric(14,2) AS total_no_factor,
    SUM((COALESCE(lr.inv_quantity,0)+COALESCE(ra.total_received,0)+COALESCE(ta.net_transfer,0))
        * COALESCE(i.base_purchase_cost,i.cost,0) * COALESCE(iu.conversion_factor,1))::numeric(14,2) AS total_with_factor
  FROM items i
  CROSS JOIN branches b
  LEFT JOIN item_branch_disabled ibd ON ibd.item_id=i.id AND ibd.branch_id=b.id
  LEFT JOIN last_reset lr ON lr.item_id=i.id AND lr.branch_id=b.id
  LEFT JOIN receipts_after ra ON ra.item_id=i.id AND ra.branch_id=b.id
  LEFT JOIN transfers_after ta ON ta.item_id=i.id AND ta.branch_id=b.id
  LEFT JOIN item_units iu ON iu.id = i.default_inventory_unit_id
  WHERE i.is_active=true AND i.show_in_inventory=true AND ibd.item_id IS NULL
`;
console.log(`\nالإجمالي بدون factor (= لوحة التحكم): ${grand.total_no_factor}`);
console.log(`الإجمالي مع factor (= قيمة المخزون القديمة): ${grand.total_with_factor}\n`);
