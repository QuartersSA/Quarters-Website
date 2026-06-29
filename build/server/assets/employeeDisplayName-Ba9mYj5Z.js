import { s as sql } from './sql-BfhTxwII.js';

let ensured = false;
let ensuring = null;
async function ensureEmployeeDisplayNameSchema() {
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

export { ensureEmployeeDisplayNameSchema as e };
