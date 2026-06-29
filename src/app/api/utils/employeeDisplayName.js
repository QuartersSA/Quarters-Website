import sql from "@/app/api/utils/sql";

let ensured = false;
let ensuring = null;

export async function ensureEmployeeDisplayNameSchema() {
  if (ensured) return;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    await sql`
      ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS display_name TEXT
    `;
  })();

  try {
    await ensuring;
    ensured = true;
  } finally {
    ensuring = null;
  }
}
