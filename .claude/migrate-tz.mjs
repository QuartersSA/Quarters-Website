// Migrate date columns from `timestamp without time zone` to
// `timestamp with time zone`. Existing values are assumed to represent
// the UTC moment (which they do — session TZ is UTC and writes have
// been going through CURRENT_TIMESTAMP / NOW()).
//
// USING (col AT TIME ZONE 'UTC') asserts "treat the stored wall-clock
// as UTC" and produces a timestamptz of the same moment.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
process.env.DATABASE_URL = readFileSync(".env", "utf8").match(
  /^DATABASE_URL=(.+)$/m,
)[1];
const sql = neon(process.env.DATABASE_URL);

const targets = [
  ["inventory_operations", "created_at"],
  ["inventory_operations", "operation_date"],
  ["purchase_receipts", "created_at"],
  ["purchase_receipts", "received_at"],
];

for (const [table, column] of targets) {
  const [row] = await sql(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  if (!row) {
    console.log(`SKIP ${table}.${column}: not found`);
    continue;
  }
  if (row.data_type === "timestamp with time zone") {
    console.log(`OK   ${table}.${column}: already timestamptz`);
    continue;
  }
  console.log(`MIGRATE ${table}.${column}: ${row.data_type} -> timestamptz`);
  await sql(
    `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE timestamptz USING (${column} AT TIME ZONE 'UTC')`,
  );
  console.log(`DONE ${table}.${column}`);
}

// Verify
const after = await sql(
  `SELECT table_name, column_name, data_type
   FROM information_schema.columns
   WHERE (table_name, column_name) IN (
     ('inventory_operations','created_at'),
     ('inventory_operations','operation_date'),
     ('purchase_receipts','created_at'),
     ('purchase_receipts','received_at')
   )
   ORDER BY table_name, column_name`,
);
console.log("\nFinal state:");
for (const r of after) {
  console.log(`  ${r.table_name}.${r.column_name}: ${r.data_type}`);
}
