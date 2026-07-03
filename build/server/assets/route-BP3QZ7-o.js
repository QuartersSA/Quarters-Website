import { s as sql } from './sql-BfhTxwII.js';
import { hash } from 'argon2';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureEmployeeDisplayNameSchema } from './employeeDisplayName-Ba9mYj5Z.js';
import '@neondatabase/serverless';
import 'crypto';

// Idempotent: ensure the waste-logging permission column exists so
// PUT can persist the flag without a manual migration.
async function ensureWasteColumn() {
  try {
    await ensureEmployeeDisplayNameSchema();
    await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_log_waste BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_add_purchase_invoices BOOLEAN DEFAULT false`;
  } catch (e) {
    console.error("ensureWasteColumn:", e?.message);
  }
}

// GET single employee with branches
async function GET(request, {
  params
}) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_employees"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureEmployeeDisplayNameSchema();
    const {
      id
    } = params;
    const [employee] = await sql`
      SELECT
        e.id,
        e.name,
        e.display_name,
        e.email,
        e.phone,
        e.username,
        e.role,
        e.created_at,
        e.iqama_number,
        e.iqama_expiry_date,
        COALESCE(e.sponsorship_transferred, false) as sponsorship_transferred,
        COALESCE(e.work_card_issued, false) as work_card_issued,
        COALESCE(e.medical_check_issued, false) as medical_check_issued,
        COALESCE(e.health_card_issued, false) as health_card_issued,
        e.position,
        e.base_salary,
        e.other_allowances,
        COALESCE(e.can_access_workspace, false) as can_access_workspace,
        COALESCE(e.can_manage_inventory, false) as can_manage_inventory,
        COALESCE(e.can_manage_accounting, false) as can_manage_accounting,
        COALESCE(e.can_manage_marketing, false) as can_manage_marketing,
        COALESCE(e.can_manage_employees, false) as can_manage_employees,
        COALESCE(e.can_access_hr, false) as can_access_hr,
        COALESCE(e.can_manage_deductions, false) as can_manage_deductions,
        COALESCE(e.can_do_inventory, false) as can_do_inventory,
        COALESCE(e.can_close_shift, false) as can_close_shift,
        COALESCE(e.can_log_waste, false) as can_log_waste,
        COALESCE(e.can_add_purchase_invoices, false) as can_add_purchase_invoices,
        COALESCE(e.notify_shift_close_push, false) as notify_shift_close_push,
        COALESCE(e.notify_inventory_operation_push, false) as notify_inventory_operation_push,
        COALESCE(e.notify_shift_close_wa, false) as notify_shift_close_wa,
        COALESCE(e.notify_inventory_operation_wa, false) as notify_inventory_operation_wa,
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
    console.error("Error fetching employee:", error);
    return Response.json({
      error: "Failed to fetch employee"
    }, {
      status: 500
    });
  }
}

// UPDATE employee
async function PUT(request, {
  params
}) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_employees"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureWasteColumn();
    const {
      id
    } = params;
    const body = await request.json();
    const {
      name,
      display_name,
      email,
      phone,
      username,
      password,
      role,
      branchIds,
      // HR fields
      iqama_number,
      iqama_expiry_date,
      sponsorship_transferred,
      work_card_issued,
      medical_check_issued,
      health_card_issued,
      position,
      base_salary,
      other_allowances,
      // Admin section permissions
      can_access_workspace,
      can_manage_inventory,
      can_manage_accounting,
      can_manage_marketing,
      can_manage_employees,
      can_access_hr,
      can_manage_deductions,
      // Employee permissions
      can_do_inventory,
      can_close_shift,
      can_log_waste,
      can_add_purchase_invoices,
      // Admin notification preferences (push)
      notify_shift_close_push,
      notify_inventory_operation_push,
      // Admin notification preferences (WhatsApp)
      notify_shift_close_wa,
      notify_inventory_operation_wa
    } = body;
    const employeeId = parseInt(id);
    const [existing] = await sql`
      SELECT
        id,
        role,
        COALESCE(can_access_workspace, false) as can_access_workspace,
        COALESCE(can_manage_inventory, false) as can_manage_inventory,
        COALESCE(can_manage_accounting, false) as can_manage_accounting,
        COALESCE(can_manage_employees, false) as can_manage_employees,
        COALESCE(can_access_hr, false) as can_access_hr,
        COALESCE(can_manage_deductions, false) as can_manage_deductions,
        COALESCE(can_do_inventory, false) as can_do_inventory,
        COALESCE(can_close_shift, false) as can_close_shift,
        COALESCE(can_log_waste, false) as can_log_waste,
        COALESCE(notify_shift_close_push, false) as notify_shift_close_push,
        COALESCE(notify_inventory_operation_push, false) as notify_inventory_operation_push,
        COALESCE(notify_shift_close_wa, false) as notify_shift_close_wa,
        COALESCE(notify_inventory_operation_wa, false) as notify_inventory_operation_wa
      FROM employees
      WHERE id = ${employeeId}
    `;
    if (!existing) {
      return Response.json({
        error: "Employee not found"
      }, {
        status: 404
      });
    }
    const effectiveRole = role !== undefined ? role : existing.role;
    const isAdmin = effectiveRole === "Admin";
    const effectiveCanDoInventory = can_do_inventory !== undefined ? !!can_do_inventory : !!existing.can_do_inventory;
    const effectiveCanCloseShift = can_close_shift !== undefined ? !!can_close_shift : !!existing.can_close_shift;
    const effectiveNotifyShiftClosePush = notify_shift_close_push !== undefined ? !!notify_shift_close_push : !!existing.notify_shift_close_push;
    const effectiveNotifyInventoryOperationPush = notify_inventory_operation_push !== undefined ? !!notify_inventory_operation_push : !!existing.notify_inventory_operation_push;
    const effectiveNotifyShiftCloseWa = notify_shift_close_wa !== undefined ? !!notify_shift_close_wa : !!existing.notify_shift_close_wa;
    const effectiveNotifyInventoryOperationWa = notify_inventory_operation_wa !== undefined ? !!notify_inventory_operation_wa : !!existing.notify_inventory_operation_wa;
    const normalizedBranchIds = Array.isArray(branchIds) ? branchIds.filter(v => v !== null && v !== undefined) : null;

    // Enforce: employee-role permissions require >= 1 branch
    if (!isAdmin && (effectiveCanDoInventory || effectiveCanCloseShift)) {
      if (normalizedBranchIds) {
        if (normalizedBranchIds.length === 0) {
          return Response.json({
            error: "لا يمكن تحديث الموظف بدون تحديد فرع واحد على الأقل"
          }, {
            status: 400
          });
        }
      } else {
        const [branchCountRow] = await sql`
          SELECT
            (
              CASE WHEN e.branch_id IS NULL THEN 0 ELSE 1 END
              + (SELECT COUNT(*)::int FROM employee_branches eb WHERE eb.employee_id = e.id)
            ) as branch_count
          FROM employees e
          WHERE e.id = ${employeeId}
        `;
        const branchCount = Number(branchCountRow?.branch_count || 0);
        if (branchCount < 1) {
          return Response.json({
            error: "لا يمكن تحديث الموظف بدون تحديد فرع واحد على الأقل"
          }, {
            status: 400
          });
        }
      }
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount}`);
      values.push(display_name || null);
      paramCount++;
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }
    if (username !== undefined) {
      updates.push(`username = $${paramCount}`);
      values.push(username);
      paramCount++;
    }

    // HR fields
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
    if (password !== undefined && password !== "") {
      const hashedPassword = await hash(password);
      updates.push(`password = $${paramCount}`);
      values.push(hashedPassword);
      paramCount++;
    }
    if (role !== undefined) {
      updates.push(`role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }
    if (can_access_workspace !== undefined) {
      updates.push(`can_access_workspace = $${paramCount}`);
      values.push(!!can_access_workspace);
      paramCount++;
    }
    if (can_manage_inventory !== undefined) {
      updates.push(`can_manage_inventory = $${paramCount}`);
      values.push(!!can_manage_inventory);
      paramCount++;
    }
    if (can_manage_accounting !== undefined) {
      updates.push(`can_manage_accounting = $${paramCount}`);
      values.push(!!can_manage_accounting);
      paramCount++;
    }
    if (can_manage_marketing !== undefined) {
      updates.push(`can_manage_marketing = $${paramCount}`);
      values.push(!!can_manage_marketing);
      paramCount++;
    }
    if (can_manage_employees !== undefined) {
      updates.push(`can_manage_employees = $${paramCount}`);
      values.push(isAdmin ? !!can_manage_employees : false);
      paramCount++;
    }

    // If role is being changed to Employee (or anything non-Admin), force-clear this permission.
    if (!isAdmin && role !== undefined && can_manage_employees === undefined) {
      updates.push("can_manage_employees = false");
    }
    if (can_access_hr !== undefined) {
      updates.push(`can_access_hr = $${paramCount}`);
      values.push(isAdmin ? !!can_access_hr : false);
      paramCount++;
    }

    // If role is being changed to Employee (or anything non-Admin), force-clear this permission.
    if (!isAdmin && role !== undefined && can_access_hr === undefined) {
      updates.push("can_access_hr = false");
    }
    if (can_manage_deductions !== undefined) {
      updates.push(`can_manage_deductions = $${paramCount}`);
      values.push(isAdmin ? !!can_manage_deductions : false);
      paramCount++;
    }

    // If role is being changed to Employee (or anything non-Admin), force-clear this permission.
    if (!isAdmin && role !== undefined && can_manage_deductions === undefined) {
      updates.push("can_manage_deductions = false");
    }
    if (can_do_inventory !== undefined) {
      updates.push(`can_do_inventory = $${paramCount}`);
      values.push(!!can_do_inventory);
      paramCount++;
    }
    if (can_log_waste !== undefined) {
      updates.push(`can_log_waste = $${paramCount}`);
      values.push(!!can_log_waste);
      paramCount++;
    }
    if (can_add_purchase_invoices !== undefined) {
      updates.push(`can_add_purchase_invoices = $${paramCount}`);
      values.push(!!can_add_purchase_invoices);
      paramCount++;
    }
    if (can_close_shift !== undefined) {
      updates.push(`can_close_shift = $${paramCount}`);
      values.push(!!can_close_shift);
      paramCount++;
    }
    if (notify_shift_close_push !== undefined) {
      updates.push(`notify_shift_close_push = $${paramCount}`);
      values.push(isAdmin ? effectiveNotifyShiftClosePush : false);
      paramCount++;
    }
    if (notify_inventory_operation_push !== undefined) {
      updates.push(`notify_inventory_operation_push = $${paramCount}`);
      values.push(isAdmin ? effectiveNotifyInventoryOperationPush : false);
      paramCount++;
    }
    if (notify_shift_close_wa !== undefined) {
      updates.push(`notify_shift_close_wa = $${paramCount}`);
      values.push(isAdmin ? effectiveNotifyShiftCloseWa : false);
      paramCount++;
    }
    if (notify_inventory_operation_wa !== undefined) {
      updates.push(`notify_inventory_operation_wa = $${paramCount}`);
      values.push(isAdmin ? effectiveNotifyInventoryOperationWa : false);
      paramCount++;
    }

    // If role is being changed to Employee (or anything non-Admin), force-clear these preferences.
    if (!isAdmin && role !== undefined) {
      if (notify_shift_close_push === undefined) {
        updates.push("notify_shift_close_push = false");
      }
      if (notify_inventory_operation_push === undefined) {
        updates.push("notify_inventory_operation_push = false");
      }
      if (notify_shift_close_wa === undefined) {
        updates.push("notify_shift_close_wa = false");
      }
      if (notify_inventory_operation_wa === undefined) {
        updates.push("notify_inventory_operation_wa = false");
      }
    }

    // Update employee if there are fields to update
    if (updates.length > 0) {
      const updateQuery = `UPDATE employees SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING *`;
      values.push(employeeId);
      await sql(updateQuery, values);
    }

    // Update branches if provided
    if (normalizedBranchIds !== null) {
      // Delete existing branch associations
      await sql`DELETE FROM employee_branches WHERE employee_id = ${employeeId}`;

      // Insert new branch associations
      if (normalizedBranchIds.length > 0) {
        for (const branchId of normalizedBranchIds) {
          await sql`INSERT INTO employee_branches (employee_id, branch_id) VALUES (${employeeId}, ${branchId})`;
        }
      }
    }

    // Fetch updated employee with branches
    const [updated] = await sql`
      SELECT
        e.id,
        e.name,
        e.display_name,
        e.email,
        e.phone,
        e.username,
        e.role,
        e.created_at,
        e.iqama_number,
        e.iqama_expiry_date,
        COALESCE(e.sponsorship_transferred, false) as sponsorship_transferred,
        COALESCE(e.work_card_issued, false) as work_card_issued,
        COALESCE(e.medical_check_issued, false) as medical_check_issued,
        COALESCE(e.health_card_issued, false) as health_card_issued,
        e.position,
        e.base_salary,
        e.other_allowances,
        COALESCE(e.can_access_workspace, false) as can_access_workspace,
        COALESCE(e.can_manage_inventory, false) as can_manage_inventory,
        COALESCE(e.can_manage_accounting, false) as can_manage_accounting,
        COALESCE(e.can_manage_marketing, false) as can_manage_marketing,
        COALESCE(e.can_manage_employees, false) as can_manage_employees,
        COALESCE(e.can_access_hr, false) as can_access_hr,
        COALESCE(e.can_manage_deductions, false) as can_manage_deductions,
        COALESCE(e.can_do_inventory, false) as can_do_inventory,
        COALESCE(e.can_close_shift, false) as can_close_shift,
        COALESCE(e.can_log_waste, false) as can_log_waste,
        COALESCE(e.can_add_purchase_invoices, false) as can_add_purchase_invoices,
        COALESCE(e.notify_shift_close_push, false) as notify_shift_close_push,
        COALESCE(e.notify_inventory_operation_push, false) as notify_inventory_operation_push,
        COALESCE(e.notify_shift_close_wa, false) as notify_shift_close_wa,
        COALESCE(e.notify_inventory_operation_wa, false) as notify_inventory_operation_wa,
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
    return Response.json(updated);
  } catch (error) {
    console.error("Error updating employee:", error);
    return Response.json({
      error: "Failed to update employee",
      details: error.message
    }, {
      status: 500
    });
  }
}

// DELETE employee
async function DELETE(request, {
  params
}) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_employees"
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
    await sql`DELETE FROM employees WHERE id = ${id}`;
    return Response.json({
      success: true
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    return Response.json({
      error: "Failed to delete employee"
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, PUT };
