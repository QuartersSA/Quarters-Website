import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// HR employee suspensions.
//
// Two suspension kinds:
//   - 'monthly'     : a single payroll month is skipped. month = YYYY-MM-01
//   - 'indefinite'  : employee is suspended from effective_from onward
//                     until the row is canceled (is_active=false).
//
// Payroll aggregate checks this table per run month and zeroes out
// the suspended employee's base + allowances. Past payroll runs that
// already wrote stored numbers stay intact — only NEW / rebuilt runs
// reflect a freshly added suspension.

async function ensureSuspensionsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS employee_suspensions (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      month DATE,
      effective_from DATE,
      reason TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  // Constraint juggling — drop & re-add so older deploys that pre-date
  // the enum widening (or never had it) end up in the target state.
  try {
    await sql`
      ALTER TABLE employee_suspensions
      DROP CONSTRAINT IF EXISTS employee_suspensions_kind_chk
    `;
    await sql`
      ALTER TABLE employee_suspensions
      ADD CONSTRAINT employee_suspensions_kind_chk
      CHECK (kind IN ('monthly', 'indefinite'))
    `;
  } catch {
    // already-in-target — harmless
  }
}
const REQUIRE_HR = {
  role: "Admin",
  permission: "can_access_hr"
};

// GET /api/hr/employees/:id/suspensions
//   ?includeInactive=1 to include canceled ones too
async function GET(request, {
  params
}) {
  const auth = requireAuth(request, REQUIRE_HR);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSuspensionsSchema();
    const resolved = await params;
    const employeeId = Number(resolved?.id);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return Response.json({
        error: "Invalid employee id"
      }, {
        status: 400
      });
    }
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const rows = includeInactive ? await sql`
          SELECT
            id, employee_id, kind,
            TO_CHAR(month, 'YYYY-MM-DD') AS month,
            TO_CHAR(effective_from, 'YYYY-MM-DD') AS effective_from,
            reason, is_active, created_at,
            created_by_employee_id, created_by_employee_name
          FROM employee_suspensions
          WHERE employee_id = ${employeeId}
          ORDER BY is_active DESC, created_at DESC
        ` : await sql`
          SELECT
            id, employee_id, kind,
            TO_CHAR(month, 'YYYY-MM-DD') AS month,
            TO_CHAR(effective_from, 'YYYY-MM-DD') AS effective_from,
            reason, is_active, created_at,
            created_by_employee_id, created_by_employee_name
          FROM employee_suspensions
          WHERE employee_id = ${employeeId}
            AND is_active = TRUE
          ORDER BY created_at DESC
        `;
    return Response.json({
      suspensions: rows
    });
  } catch (error) {
    console.error("hr suspensions GET", error);
    return Response.json({
      error: "فشل تحميل الإيقافات",
      details: error.message
    }, {
      status: 500
    });
  }
}

// POST /api/hr/employees/:id/suspensions
// body:
//   - { kind: 'monthly',   month: 'YYYY-MM', reason? }
//   - { kind: 'indefinite', effective_from: 'YYYY-MM-DD', reason? }
async function POST(request, {
  params
}) {
  const auth = requireAuth(request, REQUIRE_HR);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSuspensionsSchema();
    const resolved = await params;
    const employeeId = Number(resolved?.id);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return Response.json({
        error: "Invalid employee id"
      }, {
        status: 400
      });
    }
    const body = await request.json().catch(() => ({}));
    const kind = body?.kind === "indefinite" ? "indefinite" : "monthly";
    const reason = body?.reason ? String(body.reason).trim() : null;
    let month = null;
    let effectiveFrom = null;
    if (kind === "monthly") {
      const raw = body?.month ? String(body.month).trim() : "";
      if (!/^\d{4}-\d{2}$/.test(raw)) {
        return Response.json({
          error: "صيغة الشهر غير صحيحة (YYYY-MM)"
        }, {
          status: 400
        });
      }
      month = `${raw}-01`;
    } else {
      const raw = body?.effective_from ? String(body.effective_from).trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return Response.json({
          error: "تاريخ بدء الإيقاف غير صحيح"
        }, {
          status: 400
        });
      }
      effectiveFrom = raw;
    }
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const [created] = await sql`
      INSERT INTO employee_suspensions (
        employee_id, kind, month, effective_from, reason,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${employeeId}, ${kind}, ${month}, ${effectiveFrom}, ${reason},
        ${createdById}, ${createdByName}
      )
      RETURNING
        id, employee_id, kind,
        TO_CHAR(month, 'YYYY-MM-DD') AS month,
        TO_CHAR(effective_from, 'YYYY-MM-DD') AS effective_from,
        reason, is_active, created_at,
        created_by_employee_id, created_by_employee_name
    `;
    return Response.json({
      ok: true,
      suspension: created
    });
  } catch (error) {
    console.error("hr suspensions POST", error);
    return Response.json({
      error: "فشل إضافة الإيقاف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
