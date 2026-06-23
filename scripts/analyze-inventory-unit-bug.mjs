// READ-ONLY analysis of the employee-inventory ×factor bug.
//
// Window: the buggy multiply shipped 2026-06-04 02:14 +03:00 (commit
// 9cf2d25) and was fixed 2026-06-16 17:50 +03:00 (commit 160292b).
// During that window the employee inventory page stored
// `entered × default_inventory_unit.conversion_factor` instead of the
// raw count. Only items whose default inventory unit has factor ≠ 1
// were distorted.
//
// This script ONLY SELECTs. It writes nothing. Run:
//   node --env-file=.env scripts/analyze-inventory-unit-bug.mjs

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Riyadh-local bounds of the buggy window, expressed as UTC instants.
const WINDOW_START = "2026-06-03 23:14:36+00"; // 02:14 +03
const WINDOW_END = "2026-06-16 14:50:34+00"; // 17:50 +03

const rows = await sql`
  WITH inv_unit AS (
    SELECT
      i.id AS item_id,
      i.name AS item_name,
      mu.name_ar AS unit_name,
      iu.conversion_factor AS factor
    FROM items i
    JOIN item_units iu ON iu.id = i.default_inventory_unit_id
    JOIN measurement_units mu ON mu.id = iu.unit_id
    WHERE iu.conversion_factor <> 1
  )
  SELECT
    iu.item_id,
    iu.item_name,
    iu.unit_name,
    iu.factor,
    COUNT(ii.id)::int AS affected_rows,
    MIN(COALESCE(io.operation_date, io.created_at)) AS first_op,
    MAX(COALESCE(io.operation_date, io.created_at)) AS last_op,
    SUM(ii.quantity)::numeric(14,3) AS stored_total,
    SUM(ii.quantity / NULLIF(iu.factor, 0))::numeric(14,3) AS corrected_total
  FROM inv_unit iu
  JOIN inventory_items ii ON ii.item_id = iu.item_id
  JOIN inventory_operations io ON io.id = ii.operation_id
  WHERE io.inventory_type IN ('Daily', 'Weekly')
    AND io.status = 'Completed'
    AND COALESCE(io.operation_date, io.created_at) >= ${WINDOW_START}::timestamptz
    AND COALESCE(io.operation_date, io.created_at) <= ${WINDOW_END}::timestamptz
  GROUP BY iu.item_id, iu.item_name, iu.unit_name, iu.factor
  ORDER BY affected_rows DESC, iu.item_name
`;

if (rows.length === 0) {
  console.log(
    "\n✅ لا توجد صفوف متأثرة: ما في صنف وحدة جرده الافتراضية factor ≠ 1 مع إدخالات في فترة الخطأ.\n",
  );
} else {
  let totalRows = 0;
  console.log("\n=== الأصناف المتأثرة بخطأ ضرب الوحدة في جرد الموظفين ===\n");
  for (const r of rows) {
    totalRows += r.affected_rows;
    console.log(
      `• ${r.item_name}  [وحدة الجرد: ${r.unit_name}, factor=${r.factor}]`,
    );
    console.log(
      `    صفوف متأثرة: ${r.affected_rows}  |  المخزّن الحالي: ${r.stored_total}  →  المصحّح: ${r.corrected_total}`,
    );
    console.log(
      `    أول/آخر عملية: ${new Date(r.first_op).toISOString().slice(0, 10)} … ${new Date(r.last_op).toISOString().slice(0, 10)}`,
    );
  }
  console.log(
    `\nإجمالي الصفوف المتأثرة: ${totalRows} عبر ${rows.length} صنف.\n`,
  );
}

// Also surface a per-row sample (first 20) so the operator can eyeball
// individual corrections before approving anything.
const sample = await sql`
  WITH inv_unit AS (
    SELECT
      i.id AS item_id,
      i.name AS item_name,
      iu.conversion_factor AS factor
    FROM items i
    JOIN item_units iu ON iu.id = i.default_inventory_unit_id
    WHERE iu.conversion_factor <> 1
  )
  SELECT
    ii.id AS row_id,
    iu.item_name,
    b.name AS branch_name,
    COALESCE(io.operation_date, io.created_at) AS op_date,
    ii.quantity AS stored_qty,
    (ii.quantity / NULLIF(iu.factor, 0))::numeric(14,3) AS corrected_qty
  FROM inv_unit iu
  JOIN inventory_items ii ON ii.item_id = iu.item_id
  JOIN inventory_operations io ON io.id = ii.operation_id
  LEFT JOIN branches b ON b.id = ii.branch_id
  WHERE io.inventory_type IN ('Daily', 'Weekly')
    AND io.status = 'Completed'
    AND COALESCE(io.operation_date, io.created_at) >= ${WINDOW_START}::timestamptz
    AND COALESCE(io.operation_date, io.created_at) <= ${WINDOW_END}::timestamptz
  ORDER BY op_date DESC
  LIMIT 20
`;

if (sample.length > 0) {
  console.log("=== عيّنة (آخر 20 صف) ===\n");
  for (const s of sample) {
    console.log(
      `  #${s.row_id}  ${s.item_name} @ ${s.branch_name || "—"}  ${new Date(s.op_date).toISOString().slice(0, 10)}  :  ${s.stored_qty} → ${s.corrected_qty}`,
    );
  }
  console.log("");
}
