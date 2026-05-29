import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Minimal employees list for the bonuses entry UI
async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_access_hr"
    }, {
      role: "Admin",
      permission: "can_manage_accounting"
    }]
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    // Pull employee + first associated branch name. We surface the
    // branch on bonus / overtime / loan selectors so the operator can
    // disambiguate employees with the same first name across branches.
    //
    // Resolution: prefer employees.branch_id (primary branch); fall
    // back to the lowest-id row in employee_branches. Same priority
    // the payroll route uses internally.
    const rows = await sql`
      SELECT
        e.id,
        e.name,
        br.name AS branch_name
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT b.name
        FROM branches b
        WHERE b.id = COALESCE(
          e.branch_id,
          (
            SELECT eb.branch_id
            FROM employee_branches eb
            WHERE eb.employee_id = e.id
            ORDER BY eb.id ASC
            LIMIT 1
          )
        )
        LIMIT 1
      ) br ON true
      ORDER BY e.name ASC, e.id ASC
    `;
    return Response.json(rows);
  } catch (error) {
    console.error("HR: Error fetching bonuses employees:", error);
    return Response.json({
      error: "Failed to fetch employees"
    }, {
      status: 500
    });
  }
}

export { GET };
