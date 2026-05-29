// HR overtime entries.
//
// Each row = one overtime grant for an employee in a specific
// payroll month. The amount paid is derived from the employee's
// current base_salary using the Saudi convention:
//
//   per_day_overtime = (base_salary / 30) * 1.5
//   total            = per_day_overtime * days
//
// We store `days` (admin input) and `created_at` etc. The amount is
// recomputed by the payroll route on every rebuild so it always
// reflects the employee's CURRENT base_salary — if salary changes,
// the payroll re-aggregate picks it up automatically.

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

const REQUIRE_HR = { role: "Admin", permission: "can_access_hr" };

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS hr_employee_overtime (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      month DATE NOT NULL,
      days NUMERIC(6, 2) NOT NULL CHECK (days > 0),
      reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
}

// GET /api/hr/overtime
//   ?month=YYYY-MM       filter by month
//   ?employee_id=N       filter by employee
export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_HR);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const monthRaw = url.searchParams.get("month");
    const employeeIdRaw = url.searchParams.get("employee_id");

    const conditions = [];
    const values = [];
    let idx = 1;

    if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
      conditions.push(`o.month = $${idx}`);
      values.push(`${monthRaw}-01`);
      idx += 1;
    }
    if (employeeIdRaw) {
      const eid = Number(employeeIdRaw);
      if (Number.isFinite(eid) && eid > 0) {
        conditions.push(`o.employee_id = $${idx}`);
        values.push(eid);
        idx += 1;
      }
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const query = `
      SELECT
        o.id,
        o.employee_id,
        e.name AS employee_name,
        TO_CHAR(o.month, 'YYYY-MM-DD') AS month,
        o.days,
        o.reason,
        o.created_at,
        o.created_by_employee_id,
        o.created_by_employee_name,
        -- Derived amount based on the employee's CURRENT base_salary,
        -- so the list shows what the payroll will actually post.
        ROUND(
          COALESCE(e.base_salary, 0) / 30.0 * 1.5 * o.days,
          2
        ) AS amount,
        COALESCE(e.base_salary, 0) AS base_salary
      FROM hr_employee_overtime o
      JOIN employees e ON e.id = o.employee_id
      ${whereClause}
      ORDER BY o.month DESC, o.created_at DESC
    `;

    const rows = await sql(query, values);
    return Response.json({ overtime: rows });
  } catch (error) {
    console.error("hr overtime GET", error);
    return Response.json(
      { error: "فشل تحميل الأوفر تايم", details: error.message },
      { status: 500 },
    );
  }
}

// POST /api/hr/overtime
// body: { employee_id, month: 'YYYY-MM', days, reason? }
export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_HR);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const employeeId = Number(body.employee_id);
    const days = Number(body.days);
    const monthRaw = body.month ? String(body.month).trim() : "";
    const reason = body.reason ? String(body.reason).trim() : null;

    if (!Number.isFinite(employeeId) || employeeId <= 0) {
      return Response.json({ error: "الموظف مطلوب" }, { status: 400 });
    }
    if (!Number.isFinite(days) || days <= 0) {
      return Response.json(
        { error: "عدد الأيام يجب أن يكون أكبر من صفر" },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json(
        { error: "صيغة الشهر غير صحيحة (YYYY-MM)" },
        { status: 400 },
      );
    }
    const month = `${monthRaw}-01`;

    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;

    const [created] = await sql`
      INSERT INTO hr_employee_overtime (
        employee_id, month, days, reason,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${employeeId}, ${month}, ${days}, ${reason},
        ${createdById}, ${createdByName}
      )
      RETURNING
        id, employee_id,
        TO_CHAR(month, 'YYYY-MM-DD') AS month,
        days, reason, created_at,
        created_by_employee_id, created_by_employee_name
    `;

    return Response.json({ ok: true, overtime: created });
  } catch (error) {
    console.error("hr overtime POST", error);
    return Response.json(
      { error: "فشل إضافة الأوفر تايم", details: error.message },
      { status: 500 },
    );
  }
}
