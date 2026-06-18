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
function toSortedBranchIds(branches) {
  const list = Array.isArray(branches) ? branches : [];
  const ids = list.map(b => Number(b?.id)).filter(n => Number.isFinite(n));
  ids.sort((a, b) => a - b);
  return ids;
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

// HR Employees API (separate from /api/employees)

async function GET(request, {
  params
}) {
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
    const {
      id
    } = params;
    const [employee] = await sql`
      SELECT
        e.id,
        e.name,
        e.phone,
        e.created_at,
        e.iqama_number,
        e.iqama_expiry_date,
        e.iqama_expiry_calendar,
        e.iqama_expiry_hijri,
        COALESCE(e.sponsorship_transferred, false) as sponsorship_transferred,
        COALESCE(e.work_card_issued, false) as work_card_issued,
        COALESCE(e.medical_check_issued, false) as medical_check_issued,
        COALESCE(e.health_card_issued, false) as health_card_issued,
        TO_CHAR(e.health_card_expiry_date, 'YYYY-MM-DD') AS health_card_expiry_date,
        e.health_card_expiry_calendar,
        e.health_card_expiry_hijri,
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
      WHERE e.id = ${id}
      GROUP BY e.id
    `;
    if (!employee) {
      return Response.json({
        error: "Employee not found"
      }, {
        status: 404
      });
    }
    return Response.json(employee);
  } catch (error) {
    console.error("HR: Error fetching employee:", error);
    return Response.json({
      error: "Failed to fetch employee"
    }, {
      status: 500
    });
  }
}
async function PUT(request, {
  params
}) {
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
    const {
      id
    } = params;
    const employeeId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(employeeId)) {
      return Response.json({
        error: "Invalid employee id"
      }, {
        status: 400
      });
    }
    const [before] = await sql`
      SELECT
        e.id,
        e.name,
        e.phone,
        e.iqama_number,
        e.iqama_expiry_date,
        e.iqama_expiry_calendar,
        e.iqama_expiry_hijri,
        COALESCE(e.sponsorship_transferred, false) as sponsorship_transferred,
        COALESCE(e.work_card_issued, false) as work_card_issued,
        COALESCE(e.medical_check_issued, false) as medical_check_issued,
        COALESCE(e.health_card_issued, false) as health_card_issued,
        TO_CHAR(e.health_card_expiry_date, 'YYYY-MM-DD') AS health_card_expiry_date,
        e.health_card_expiry_calendar,
        e.health_card_expiry_hijri,
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
    if (!before) {
      return Response.json({
        error: "Employee not found"
      }, {
        status: 404
      });
    }
    const body = await request.json();
    const {
      name,
      phone,
      iqama_number,
      iqama_expiry_date,
      iqama_expiry_calendar,
      iqama_expiry_hijri,
      sponsorship_transferred,
      work_card_issued,
      medical_check_issued,
      health_card_issued,
      health_card_expiry_date,
      health_card_expiry_calendar,
      health_card_expiry_hijri,
      position,
      base_salary,
      other_allowances,
      start_date,
      branchIds
    } = body;
    const updates = [];
    const values = [];
    let paramCount = 1;
    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }
    if (iqama_number !== undefined) {
      updates.push(`iqama_number = $${paramCount}`);
      values.push(iqama_number);
      paramCount++;
    }
    if (iqama_expiry_date !== undefined) {
      updates.push(`iqama_expiry_date = $${paramCount}`);
      values.push(iqama_expiry_date);
      paramCount++;
    }
    if (iqama_expiry_calendar !== undefined) {
      updates.push(`iqama_expiry_calendar = $${paramCount}`);
      values.push(iqama_expiry_calendar || null);
      paramCount++;
    }
    if (iqama_expiry_hijri !== undefined) {
      updates.push(`iqama_expiry_hijri = $${paramCount}`);
      values.push(iqama_expiry_hijri || null);
      paramCount++;
    }
    if (sponsorship_transferred !== undefined) {
      updates.push(`sponsorship_transferred = $${paramCount}`);
      values.push(!!sponsorship_transferred);
      paramCount++;
    }
    if (work_card_issued !== undefined) {
      updates.push(`work_card_issued = $${paramCount}`);
      values.push(!!work_card_issued);
      paramCount++;
    }
    if (medical_check_issued !== undefined) {
      updates.push(`medical_check_issued = $${paramCount}`);
      values.push(!!medical_check_issued);
      paramCount++;
    }
    if (health_card_issued !== undefined) {
      updates.push(`health_card_issued = $${paramCount}`);
      values.push(!!health_card_issued);
      paramCount++;
      // Turning the card off clears its expiry so a stale date never
      // resurfaces when the card is re-issued later. Mirror the same
      // clear for the dual-calendar metadata.
      if (!health_card_issued) {
        updates.push(`health_card_expiry_date = $${paramCount}`);
        values.push(null);
        paramCount++;
        updates.push(`health_card_expiry_calendar = $${paramCount}`);
        values.push(null);
        paramCount++;
        updates.push(`health_card_expiry_hijri = $${paramCount}`);
        values.push(null);
        paramCount++;
      }
    }
    if (health_card_expiry_date !== undefined && (health_card_issued === undefined || health_card_issued)) {
      updates.push(`health_card_expiry_date = $${paramCount}`);
      values.push(normalizeIsoDate(health_card_expiry_date) || null);
      paramCount++;
    }
    if (health_card_expiry_calendar !== undefined && (health_card_issued === undefined || health_card_issued)) {
      updates.push(`health_card_expiry_calendar = $${paramCount}`);
      values.push(health_card_expiry_calendar || null);
      paramCount++;
    }
    if (health_card_expiry_hijri !== undefined && (health_card_issued === undefined || health_card_issued)) {
      updates.push(`health_card_expiry_hijri = $${paramCount}`);
      values.push(health_card_expiry_hijri || null);
      paramCount++;
    }
    if (position !== undefined) {
      updates.push(`position = $${paramCount}`);
      values.push(position);
      paramCount++;
    }
    if (base_salary !== undefined) {
      updates.push(`base_salary = $${paramCount}`);
      values.push(base_salary);
      paramCount++;
    }
    if (other_allowances !== undefined) {
      updates.push(`other_allowances = $${paramCount}`);
      values.push(other_allowances);
      paramCount++;
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount}`);
      values.push(normalizeIsoDate(start_date) || null);
      paramCount++;
    }
    if (updates.length > 0) {
      const query = `UPDATE employees SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id`;
      values.push(employeeId);
      const rows = await sql(query, values);
      if (!rows || rows.length === 0) {
        return Response.json({
          error: "Employee not found"
        }, {
          status: 404
        });
      }
    } else {
      const [exists] = await sql`SELECT id FROM employees WHERE id = ${employeeId}`;
      if (!exists) {
        return Response.json({
          error: "Employee not found"
        }, {
          status: 404
        });
      }
    }
    const normalizedBranchIds = Array.isArray(branchIds) ? branchIds.filter(v => v !== null && v !== undefined) : null;
    if (normalizedBranchIds !== null) {
      await sql`DELETE FROM employee_branches WHERE employee_id = ${employeeId}`;
      if (normalizedBranchIds.length > 0) {
        for (const branchId of normalizedBranchIds) {
          await sql`
            INSERT INTO employee_branches (employee_id, branch_id)
            VALUES (${employeeId}, ${branchId})
            ON CONFLICT (employee_id, branch_id) DO NOTHING
          `;
        }
      }
    }
    const [updated] = await sql`
      SELECT
        e.id,
        e.name,
        e.phone,
        e.created_at,
        e.iqama_number,
        e.iqama_expiry_date,
        e.iqama_expiry_calendar,
        e.iqama_expiry_hijri,
        COALESCE(e.sponsorship_transferred, false) as sponsorship_transferred,
        COALESCE(e.work_card_issued, false) as work_card_issued,
        COALESCE(e.medical_check_issued, false) as medical_check_issued,
        COALESCE(e.health_card_issued, false) as health_card_issued,
        TO_CHAR(e.health_card_expiry_date, 'YYYY-MM-DD') AS health_card_expiry_date,
        e.health_card_expiry_calendar,
        e.health_card_expiry_hijri,
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
    const changedFields = {};
    const keys = ["name", "phone", "iqama_number", "iqama_expiry_date", "sponsorship_transferred", "work_card_issued", "medical_check_issued", "health_card_issued", "health_card_expiry_date", "position", "base_salary", "other_allowances", "start_date"];
    const isDateField = key => key === "iqama_expiry_date" || key === "start_date" || key === "health_card_expiry_date";
    for (const key of keys) {
      const beforeValRaw = before?.[key];
      const afterValRaw = updated?.[key];
      const beforeVal = isDateField(key) ? normalizeIsoDate(beforeValRaw) : beforeValRaw ?? null;
      const afterVal = isDateField(key) ? normalizeIsoDate(afterValRaw) : afterValRaw ?? null;
      const isDifferent = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
      if (isDifferent) {
        changedFields[key] = {
          from: beforeVal,
          to: afterVal
        };
      }
    }
    const beforeBranchIds = toSortedBranchIds(before?.branches);
    const afterBranchIds = toSortedBranchIds(updated?.branches);
    const branchesChanged = JSON.stringify(beforeBranchIds) !== JSON.stringify(afterBranchIds);
    const changedFieldsCount = Object.keys(changedFields).length;
    const shouldLog = changedFieldsCount > 0 || branchesChanged;
    if (shouldLog) {
      const summaryParts = [];
      if (changedFieldsCount > 0) {
        summaryParts.push(`تعديل ${changedFieldsCount} حقول`);
      }
      if (branchesChanged) {
        summaryParts.push("تعديل الفرع");
      }
      const summary = summaryParts.length > 0 ? summaryParts.join(" + ") : null;
      const changes = {
        fields: changedFields
      };
      if (branchesChanged) {
        // store readable branch names for clearer HR logs UI
        const beforeBranches = toSortedBranches(before?.branches);
        const afterBranches = toSortedBranches(updated?.branches);
        changes.branches = {
          from: beforeBranches,
          to: afterBranches
        };
      }
      await safeInsertHrEmployeeLog({
        employeeId,
        employeeName: updated?.name || before?.name,
        action: "updated",
        actor: auth.user,
        summary,
        changes
      });
    }
    return Response.json(updated);
  } catch (error) {
    console.error("HR: Error updating employee:", error);
    return Response.json({
      error: "Failed to update employee",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request, {
  params
}) {
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
    const {
      id
    } = params;
    const employeeId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(employeeId)) {
      return Response.json({
        error: "Invalid employee id"
      }, {
        status: 400
      });
    }
    const [beforeDelete] = await sql`
      SELECT id, name
      FROM employees
      WHERE id = ${employeeId}
    `;
    await sql`DELETE FROM employees WHERE id = ${id}`;
    if (beforeDelete) {
      await safeInsertHrEmployeeLog({
        employeeId,
        employeeName: beforeDelete?.name,
        action: "deleted",
        actor: auth.user,
        summary: "تم حذف موظف (HR)",
        changes: {}
      });
    }
    return Response.json({
      success: true
    });
  } catch (error) {
    console.error("HR: Error deleting employee:", error);
    return Response.json({
      error: "Failed to delete employee"
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, PUT };
