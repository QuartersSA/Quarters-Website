import { s as sql } from './sql-BfhTxwII.js';
import { verify } from 'argon2';
import { s as signSessionToken } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// POST - Employee login
async function POST(request) {
  // Parse JSON safely (bad JSON should be 400 not 500)
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({
      error: "صيغة البيانات غير صحيحة"
    }, {
      status: 400
    });
  }
  try {
    const {
      username,
      password
    } = body || {};
    if (!username || !password) {
      return Response.json({
        error: "اسم المستخدم وكلمة المرور مطلوبان"
      }, {
        status: 400
      });
    }
    const findEmployee = async ({
      includeManageEmployees = true,
      includeAccessHr = true,
      includeManageDeductions = true,
      includeLogWaste = true,
      includeEmployeeBranches = true
    } = {}) => {
      const selectManageEmployees = includeManageEmployees ? "COALESCE(e.can_manage_employees, false) as can_manage_employees," : "false as can_manage_employees,";
      const selectAccessHr = includeAccessHr ? "COALESCE(e.can_access_hr, false) as can_access_hr," : "false as can_access_hr,";
      const selectManageDeductions = includeManageDeductions ? "COALESCE(e.can_manage_deductions, false) as can_manage_deductions," : "false as can_manage_deductions,";
      const selectLogWaste = includeLogWaste ? "COALESCE(e.can_log_waste, false) as can_log_waste," : "false as can_log_waste,";
      const branchesJoin = includeEmployeeBranches ? `LEFT JOIN LATERAL (
            SELECT branch_id
            FROM employees
            WHERE id = e.id AND branch_id IS NOT NULL
            UNION
            SELECT branch_id
            FROM employee_branches
            WHERE employee_id = e.id
          ) br ON true` : `LEFT JOIN LATERAL (
            SELECT branch_id
            FROM employees
            WHERE id = e.id AND branch_id IS NOT NULL
          ) br ON true`;
      const query = `
        SELECT
          e.id,
          e.name,
          e.username,
          e.password,
          e.role,
          e.email,
          e.phone,
          COALESCE(e.can_access_workspace, false) as can_access_workspace,
          COALESCE(e.can_manage_inventory, false) as can_manage_inventory,
          COALESCE(e.can_manage_accounting, false) as can_manage_accounting,
          COALESCE(e.can_manage_marketing, false) as can_manage_marketing,
          ${selectManageEmployees}
          ${selectAccessHr}
          ${selectManageDeductions}
          ${selectLogWaste}
          COALESCE(e.can_do_inventory, false) as can_do_inventory,
          COALESCE(e.can_close_shift, false) as can_close_shift,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', b.id,
                'name', b.name,
                'location', b.location
              )
            ) FILTER (WHERE b.id IS NOT NULL),
            '[]'
          ) as branches
        FROM employees e
        ${branchesJoin}
        LEFT JOIN branches b ON b.id = br.branch_id
        WHERE LOWER(e.username) = LOWER($1)
        GROUP BY e.id
      `;
      const rows = await sql(query, [username]);
      return rows?.[0] || null;
    };

    // Find employee by username (case-insensitive)
    // NOTE: Some published deployments can temporarily have schema drift during publish.
    // We attempt a fallback query if a newer column/table isn't available yet.
    let employee = null;
    try {
      employee = await findEmployee({
        includeManageEmployees: true,
        includeAccessHr: true,
        includeManageDeductions: true,
        includeEmployeeBranches: true
      });
    } catch (e) {
      const code = String(e?.code || "");
      const msg = String(e?.message || "");

      // Undefined column -> rerun without it
      if (code === "42703" && msg.includes("can_manage_employees")) {
        employee = await findEmployee({
          includeManageEmployees: false,
          includeAccessHr: true,
          includeManageDeductions: true,
          includeEmployeeBranches: true
        });
      } else if (code === "42703" && msg.includes("can_access_hr")) {
        employee = await findEmployee({
          includeManageEmployees: true,
          includeAccessHr: false,
          includeManageDeductions: true,
          includeEmployeeBranches: true
        });
      } else if (code === "42703" && msg.includes("can_manage_deductions")) {
        employee = await findEmployee({
          includeManageEmployees: true,
          includeAccessHr: true,
          includeManageDeductions: false,
          includeEmployeeBranches: true
        });
      } else if (code === "42703" && msg.includes("can_log_waste")) {
        employee = await findEmployee({
          includeManageEmployees: true,
          includeAccessHr: true,
          includeManageDeductions: true,
          includeLogWaste: false,
          includeEmployeeBranches: true
        });
      } else if (code === "42P01" && msg.includes("employee_branches")) {
        // employee_branches table missing -> rerun without the join
        employee = await findEmployee({
          includeManageEmployees: true,
          includeAccessHr: true,
          includeManageDeductions: true,
          includeEmployeeBranches: false
        });
      } else {
        throw e;
      }
    }
    if (!employee) {
      return Response.json({
        error: "اسم المستخدم أو كلمة المرور غير صحيحة"
      }, {
        status: 401
      });
    }

    // Verify password (case-sensitive)
    // NOTE: argon2.verify can throw if the stored hash is malformed — treat as invalid credentials.
    let isPasswordValid = false;
    try {
      isPasswordValid = await verify(employee.password, password);
    } catch (e) {
      console.error("Password verify error:", e);
      isPasswordValid = false;
    }
    if (!isPasswordValid) {
      return Response.json({
        error: "اسم المستخدم أو كلمة المرور غير صحيحة"
      }, {
        status: 401
      });
    }

    // Remove password from response
    const {
      password: _pw,
      ...employeeData
    } = employee;
    const branchIds = Array.isArray(employeeData.branches) ? employeeData.branches.map(b => Number(b?.id)).filter(n => Number.isFinite(n)) : [];

    // Signed session token used for API authorization (server-side)
    let token;
    try {
      token = signSessionToken({
        id: employeeData.id,
        role: employeeData.role,
        name: employeeData.name,
        username: employeeData.username,
        can_access_workspace: !!employeeData.can_access_workspace,
        can_manage_inventory: !!employeeData.can_manage_inventory,
        can_manage_accounting: !!employeeData.can_manage_accounting,
        can_manage_marketing: !!employeeData.can_manage_marketing,
        can_manage_employees: !!employeeData.can_manage_employees,
        can_access_hr: !!employeeData.can_access_hr,
        can_manage_deductions: !!employeeData.can_manage_deductions,
        can_do_inventory: !!employeeData.can_do_inventory,
        can_close_shift: !!employeeData.can_close_shift,
        can_log_waste: !!employeeData.can_log_waste,
        branchIds
      });
    } catch (e) {
      console.error("Token sign error:", e);
      return Response.json({
        error: "حدث خطأ أثناء تسجيل الدخول",
        debug_code: "token_sign_failed"
      }, {
        status: 500
      });
    }
    return Response.json({
      success: true,
      token,
      employee: employeeData
    });
  } catch (error) {
    console.error("Login error:", error);
    const maybePgCode = error?.code ? String(error.code) : null;
    const debug_code = maybePgCode ? `db_${maybePgCode}` : "server_error";
    return Response.json({
      error: "حدث خطأ أثناء تسجيل الدخول",
      debug_code
    }, {
      status: 500
    });
  }
}

export { POST };
