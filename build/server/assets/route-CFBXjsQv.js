import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

async function safeInsertHrEmployeeLog({
  employeeId,
  employeeName,
  action,
  actor,
  summary,
  changes
}) {
  try {
    await sql`
      INSERT INTO hr_employee_logs (
        employee_id,
        employee_name,
        action,
        actor_employee_id,
        actor_name,
        summary,
        changes
      )
      VALUES (
        ${employeeId},
        ${employeeName || null},
        ${action},
        ${actor?.id || null},
        ${actor?.name || null},
        ${summary || null},
        ${changes || {}}
      )
    `;
  } catch (error) {
    console.error("HR: failed to insert employee log", error);
  }
}
function normalizeIsoDate(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}
function toSortedBranches(branches) {
  const list = Array.isArray(branches) ? branches : [];
  const normalized = list.map(b => {
    const id = Number(b?.id);
    const name = b?.name ? String(b.name) : null;
    if (!Number.isFinite(id)) return null;
    return {
      id,
      name
    };
  }).filter(Boolean);
  normalized.sort((a, b) => a.id - b.id);
  return normalized;
}

// Idempotent. Adds the start_date column when missing so older
// schemas keep working without a manual migration. Cheap because of
// IF NOT EXISTS.
async function ensureHrSchema() {
  await sql`
    ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS start_date DATE
  `;
  // Expiry of the health card. Only meaningful while
  // health_card_issued = true; the date may legitimately be in the
  // past (an issued-but-expired card the operator needs to track).
  await sql`
    ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS health_card_expiry_date DATE
  `;
}

// HR Employees API (separate from /api/employees)
// GET: list employees (HR fields only)
async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_access_hr"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureHrSchema();
    const employees = await sql`
      SELECT
        e.id,
        e.name,
        e.phone,
        e.created_at,
        e.iqama_number,
        e.iqama_expiry_date,
        COALESCE(e.sponsorship_transferred, false) as sponsorship_transferred,
        COALESCE(e.work_card_issued, false) as work_card_issued,
        COALESCE(e.medical_check_issued, false) as medical_check_issued,
        COALESCE(e.health_card_issued, false) as health_card_issued,
        TO_CHAR(e.health_card_expiry_date, 'YYYY-MM-DD') AS health_card_expiry_date,
        e.position,
        e.base_salary,
        e.other_allowances,
        TO_CHAR(e.start_date, 'YYYY-MM-DD') AS start_date,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'id', b.id,
              'name', b.name,
              'location', b.location
            )
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::jsonb
        ) as branches
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT branch_id
        FROM employees
        WHERE id = e.id AND branch_id IS NOT NULL
        UNION
        SELECT branch_id
        FROM employee_branches
        WHERE employee_id = e.id
      ) br ON true
      LEFT JOIN branches b ON b.id = br.branch_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;
    return Response.json(employees);
  } catch (error) {
    console.error("HR: Error fetching employees:", error);
    return Response.json({
      error: "Failed to fetch employees"
    }, {
      status: 500
    });
  }
}

// CREATE new employee (HR fields only)
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_access_hr"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureHrSchema();
    const body = await request.json();
    const {
      name,
      phone,
      iqama_number,
      iqama_expiry_date,
      sponsorship_transferred,
      work_card_issued,
      medical_check_issued,
      health_card_issued,
      health_card_expiry_date,
      position,
      base_salary,
      other_allowances,
      start_date,
      branchIds
    } = body;
    if (!name) {
      return Response.json({
        error: "Name is required"
      }, {
        status: 400
      });
    }
    const normalizedBranchIds = Array.isArray(branchIds) ? branchIds.filter(id => id !== null && id !== undefined) : [];
    const [inserted] = await sql`
      INSERT INTO employees (
        name,
        phone,
        iqama_number,
        iqama_expiry_date,
        sponsorship_transferred,
        work_card_issued,
        medical_check_issued,
        health_card_issued,
        health_card_expiry_date,
        position,
        base_salary,
        other_allowances,
        start_date
      )
      VALUES (
        ${name},
        ${phone || null},
        ${iqama_number || null},
        ${iqama_expiry_date || null},
        ${!!sponsorship_transferred},
        ${!!work_card_issued},
        ${!!medical_check_issued},
        ${!!health_card_issued},
        ${health_card_issued ? normalizeIsoDate(health_card_expiry_date) || null : null},
        ${position || null},
        ${base_salary ?? null},
        ${other_allowances ?? null},
        ${normalizeIsoDate(start_date) || null}
      )
      RETURNING id
    `;
    const employeeId = inserted?.id;
    if (!employeeId) {
      return Response.json({
        error: "Failed to create employee"
      }, {
        status: 500
      });
    }
    if (normalizedBranchIds.length > 0) {
      for (const branchId of normalizedBranchIds) {
        await sql`
          INSERT INTO employee_branches (employee_id, branch_id)
          VALUES (${employeeId}, ${branchId})
          ON CONFLICT (employee_id, branch_id) DO NOTHING
        `;
      }
    }
    const [employeeWithBranches] = await sql`
      SELECT
        e.id,
        e.name,
        e.phone,
        e.created_at,
        e.iqama_number,
        e.iqama_expiry_date,
        COALESCE(e.sponsorship_transferred, false) as sponsorship_transferred,
        COALESCE(e.work_card_issued, false) as work_card_issued,
        COALESCE(e.medical_check_issued, false) as medical_check_issued,
        COALESCE(e.health_card_issued, false) as health_card_issued,
        TO_CHAR(e.health_card_expiry_date, 'YYYY-MM-DD') AS health_card_expiry_date,
        e.position,
        e.base_salary,
        e.other_allowances,
        TO_CHAR(e.start_date, 'YYYY-MM-DD') AS start_date,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'id', b.id,
              'name', b.name,
              'location', b.location
            )
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::jsonb
        ) as branches
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT branch_id
        FROM employees
        WHERE id = e.id AND branch_id IS NOT NULL
        UNION
        SELECT branch_id
        FROM employee_branches
        WHERE employee_id = e.id
      ) br ON true
      LEFT JOIN branches b ON b.id = br.branch_id
      WHERE e.id = ${employeeId}
      GROUP BY e.id
    `;
    const branchesForLog = toSortedBranches(employeeWithBranches?.branches);
    await safeInsertHrEmployeeLog({
      employeeId,
      employeeName: employeeWithBranches?.name || name,
      action: "created",
      actor: auth.user,
      summary: "تم إنشاء موظف (HR)",
      changes: {
        fields: {
          name: {
            from: null,
            to: name
          },
          phone: {
            from: null,
            to: phone || null
          },
          iqama_number: {
            from: null,
            to: iqama_number || null
          },
          iqama_expiry_date: {
            from: null,
            to: normalizeIsoDate(iqama_expiry_date || null)
          },
          sponsorship_transferred: {
            from: null,
            to: !!sponsorship_transferred
          },
          work_card_issued: {
            from: null,
            to: !!work_card_issued
          },
          medical_check_issued: {
            from: null,
            to: !!medical_check_issued
          },
          health_card_issued: {
            from: null,
            to: !!health_card_issued
          },
          health_card_expiry_date: {
            from: null,
            to: health_card_issued ? normalizeIsoDate(health_card_expiry_date || null) : null
          },
          position: {
            from: null,
            to: position || null
          },
          base_salary: {
            from: null,
            to: base_salary ?? null
          },
          other_allowances: {
            from: null,
            to: other_allowances ?? null
          },
          start_date: {
            from: null,
            to: normalizeIsoDate(start_date || null)
          }
        },
        branches: {
          from: [],
          to: branchesForLog
        }
      }
    });
    return Response.json(employeeWithBranches);
  } catch (error) {
    console.error("HR: Error creating employee:", error);
    return Response.json({
      error: "Failed to create employee",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
