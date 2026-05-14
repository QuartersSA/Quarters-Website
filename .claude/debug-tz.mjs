import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
process.env.DATABASE_URL = m[1];

const sql = neon(process.env.DATABASE_URL);

const tz = await sql`SELECT current_setting('TimeZone') AS tz, NOW() AS now_ts, (NOW() AT TIME ZONE 'Asia/Riyadh') AS now_riyadh_wall`;
console.log("session:", tz);

const cols = await sql`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_name = 'purchase_receipts'
    AND column_name IN ('received_at', 'created_at')
`;
console.log("purchase_receipts columns:", cols);

const cols2 = await sql`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_name = 'inventory_operations'
    AND column_name IN ('operation_date', 'created_at')
`;
console.log("inventory_operations columns:", cols2);

const last = await sql`
  SELECT id, branch_id, received_at, created_at,
    received_at::text AS received_text,
    created_at::text AS created_text
  FROM purchase_receipts
  ORDER BY id DESC
  LIMIT 3
`;
console.log("last 3 receipts:");
for (const r of last) {
  console.log(JSON.stringify(r, null, 2));
}
