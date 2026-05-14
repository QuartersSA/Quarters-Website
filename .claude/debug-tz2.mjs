import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
const env = readFileSync(".env", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)[1];
const sql = neon(process.env.DATABASE_URL);

const r = await sql`
  SELECT
    NOW() AS a_raw,
    NOW()::text AS a_text,
    (NOW() AT TIME ZONE 'Asia/Riyadh') AS b_raw,
    (NOW() AT TIME ZONE 'Asia/Riyadh')::text AS b_text,
    pg_typeof(NOW())::text AS a_type,
    pg_typeof(NOW() AT TIME ZONE 'Asia/Riyadh')::text AS b_type
`;
console.log(JSON.stringify(r, null, 2));

// Also test the cast pattern used in INSERT
const r2 = await sql`
  SELECT
    '2026-05-14T23:45'::timestamp AS c_raw,
    ('2026-05-14T23:45'::timestamp)::text AS c_text,
    pg_typeof('2026-05-14T23:45'::timestamp)::text AS c_type,
    '2026-05-14T23:45'::timestamp AT TIME ZONE 'Asia/Riyadh' AS d_raw,
    ('2026-05-14T23:45'::timestamp AT TIME ZONE 'Asia/Riyadh')::text AS d_text,
    pg_typeof('2026-05-14T23:45'::timestamp AT TIME ZONE 'Asia/Riyadh')::text AS d_type
`;
console.log(JSON.stringify(r2, null, 2));
