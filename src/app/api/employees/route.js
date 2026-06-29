import sql from "@/app/api/utils/sql";
import { hash } from "argon2";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureEmployeeDisplayNameSchema } from "@/app/api/utils/employeeDisplayName";

// Idempotent: ensure the waste-logging permission column exists.
// Cheap (IF NOT EXISTS) and lets the employee form persist the flag
// without a manual migration.
async function ensureWasteColumn() {
  try {
    await ensureEmployeeDisplayNameSchema();
    await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_log_waste BOOLEAN DEFAULT false`;
  } catch (e) {
    console.error("ensureWasteColumn:", e?.message);
  }
}

// GET all employees with their branches
export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_employees",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureWasteColumn();
    const employees = await sql`
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
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;

    return Response.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return Response.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}

// CREATE new employee
export async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_employees",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
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
      // Admin notification preferences (push)
      notify_shift_close_push,
      notify_inventory_operation_push,
      // Admin notification preferences (WhatsApp)
      notify_shift_close_wa,
      notify_inventory_operation_wa,
      // Employee permissions
      can_do_inventory,
      can_close_shift,
      can_log_waste,
    } = body;

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    await ensureWasteColumn();

    const effectiveRole = role || "Employee";

    // If we are creating an Admin account, require login credentials.
    if (effectiveRole === "Admin" && (!username || !password)) {
      return Response.json(
        { error: "اسم المستخدم وكلمة المرور والصلاحية مطلوبة للمدير" },
        { status: 400 },
      );
    }

    const normalizedBranchIds = Array.isArray(branchIds)
      ? branchIds.filter((id) => id !== null && id !== undefined)
      : [];

    const isAdmin = effectiveRole === "Admin";

    const canAccessWorkspaceBool = isAdmin
      ? (can_access_workspace ?? true)
      : false;

    const canManageInventoryBool = isAdmin
      ? (can_manage_inventory ?? true)
      : false;

    const canManageAccountingBool = isAdmin
      ? (can_manage_accounting ?? true)
      : false;

    const canManageMarketingBool = isAdmin
      ? !!can_manage_marketing
      : false;

    const canManageEmployeesBool = isAdmin
      ? (can_manage_employees ?? true)
      : false;

    const canAccessHrBool = isAdmin ? (can_access_hr ?? true) : false;
    const canManageDeductionsBool = isAdmin ? !!can_manage_deductions : false;

    const canDoInventoryBool = !isAdmin ? !!can_do_inventory : false;
    const canCloseShiftBool = !isAdmin ? !!can_close_shift : false;
    const canLogWasteBool = !isAdmin ? !!can_log_waste : false;

    const notifyShiftClosePushBool = isAdmin
      ? !!notify_shift_close_push
      : false;
    const notifyInventoryOperationPushBool = isAdmin
      ? !!notify_inventory_operation_push
      : false;

    const notifyShiftCloseWaBool = isAdmin ? !!notify_shift_close_wa : false;
    const notifyInventoryOperationWaBool = isAdmin
      ? !!notify_inventory_operation_wa
      : false;

    // If employee can do inventory and/or shift close, they must be linked to at least one branch.
    if (
      !isAdmin &&
      (canDoInventoryBool || canCloseShiftBool || canLogWasteBool) &&
      normalizedBranchIds.length === 0
    ) {
      return Response.json(
        { error: "لا يمكن إضافة الموظف بدون تحديد فرع واحد على الأقل" },
        { status: 400 },
      );
    }

    // Hash password only if provided (HR may create employees without login)
    const hashedPassword = password ? await hash(password) : null;

    // Start transaction
    const result = await sql.transaction([
      // Insert employee
      sql`
        INSERT INTO employees (
          name,
          display_name,
          email,
          phone,
          username,
          password,
          role,
          iqama_number,
          iqama_expiry_date,
          sponsorship_transferred,
          work_card_issued,
          medical_check_issued,
          health_card_issued,
          position,
          base_salary,
          other_allowances,
          can_access_workspace,
          can_manage_inventory,
          can_manage_accounting,
          can_manage_marketing,
          can_manage_employees,
          can_access_hr,
          can_manage_deductions,
          can_do_inventory,
          can_close_shift,
          can_log_waste,
          notify_shift_close_push,
          notify_inventory_operation_push,
          notify_shift_close_wa,
          notify_inventory_operation_wa
        )
        VALUES (
          ${name},
          ${display_name || null},
          ${email || null},
          ${phone || null},
          ${username || null},
          ${hashedPassword},
          ${effectiveRole},
          ${iqama_number || null},
          ${iqama_expiry_date || null},
          ${!!sponsorship_transferred},
          ${!!work_card_issued},
          ${!!medical_check_issued},
          ${!!health_card_issued},
          ${position || null},
          ${base_salary ?? null},
          ${other_allowances ?? null},
          ${canAccessWorkspaceBool},
          ${canManageInventoryBool},
          ${canManageAccountingBool},
          ${canManageMarketingBool},
          ${canManageEmployeesBool},
          ${canAccessHrBool},
          ${canManageDeductionsBool},
          ${canDoInventoryBool},
          ${canCloseShiftBool},
          ${canLogWasteBool},
          ${notifyShiftClosePushBool},
          ${notifyInventoryOperationPushBool},
          ${notifyShiftCloseWaBool},
          ${notifyInventoryOperationWaBool}
        )
        RETURNING *
      `,
    ]);

    const [employee] = result[0];

    // Insert branch associations if provided
    if (normalizedBranchIds.length > 0) {
      for (const branchId of normalizedBranchIds) {
        await sql`INSERT INTO employee_branches (employee_id, branch_id) VALUES (${employee.id}, ${branchId})`;
      }
    }

    // Fetch employee with branches
    const [employeeWithBranches] = await sql`
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
      WHERE e.id = ${employee.id}
      GROUP BY e.id
    `;

    return Response.json(employeeWithBranches);
  } catch (error) {
    console.error("Error creating employee:", error);
    return Response.json(
      { error: "Failed to create employee", details: error.message },
      { status: 500 },
    );
  }
}
