import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting"
};
function validMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ""));
}
function safeCount(value) {
  const count = Number(value ?? 0);
  return Number.isInteger(count) && count >= 0 && count <= 1_000_000 ? count : null;
}

/**
 * GET /api/accounting/cash-counts?branchId=X&month=YYYY-MM
 * Returns the cash count for a given branch + month, plus logs.
 *
 * Or GET /api/accounting/cash-counts?branchId=X  (returns all months for that branch)
 */
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId");
    const month = url.searchParams.get("month"); // YYYY-MM

    // Special mode: list all branches (so this page doesn't depend on /api/branches permission)
    if (branchId === "list") {
      const branches = await sql`
        SELECT id, name FROM branches ORDER BY name ASC
      `;
      return Response.json({
        branches
      });
    }
    const parsedBranchId = Number(branchId);
    if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
      return Response.json({
        error: "branchId مطلوب"
      }, {
        status: 400
      });
    }
    if (month && !validMonth(month)) {
      return Response.json({
        error: "صيغة الشهر غير صحيحة"
      }, {
        status: 400
      });
    }
    if (month) {
      // Specific month
      const monthDate = `${month}-01`;
      const rows = await sql`
        SELECT * FROM accounting_cash_counts
        WHERE branch_id = ${parsedBranchId}
          AND count_month = ${monthDate}
        LIMIT 1
      `;
      const record = rows.length > 0 ? rows[0] : null;
      let logs = [];
      if (record) {
        logs = await sql`
          SELECT * FROM accounting_cash_count_logs
          WHERE cash_count_id = ${record.id}
          ORDER BY created_at DESC
          LIMIT 50
        `;
      }
      return Response.json({
        record,
        logs
      });
    }

    // All months for branch
    const rows = await sql`
      SELECT * FROM accounting_cash_counts
      WHERE branch_id = ${parsedBranchId}
      ORDER BY count_month DESC
      LIMIT 100
    `;
    return Response.json({
      records: rows
    });
  } catch (err) {
    console.error("GET /api/accounting/cash-counts error:", err);
    return Response.json({
      error: err.message || "خطأ في الخادم"
    }, {
      status: 500
    });
  }
}

/**
 * POST /api/accounting/cash-counts
 * Create or update a cash count for branch + month (upsert).
 *
 * Body: { branchId, month (YYYY-MM), d500, d200, d100, d50, d20, d10, d5, d1, note?, employeeId?, employeeName? }
 */
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json();
    const {
      branchId,
      month,
      d500 = 0,
      d200 = 0,
      d100 = 0,
      d50 = 0,
      d20 = 0,
      d10 = 0,
      d5 = 0,
      d1 = 0,
      note = ""
    } = body;
    const parsedBranchId = Number(branchId);
    if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0 || !validMonth(month)) {
      return Response.json({
        error: "branchId و month مطلوبين"
      }, {
        status: 400
      });
    }
    const monthDate = `${month}-01`;
    const counts = [d500, d200, d100, d50, d20, d10, d5, d1].map(safeCount);
    if (counts.some(value => value === null)) {
      return Response.json({
        error: "أعداد الفئات يجب أن تكون أرقاماً صحيحة وغير سالبة"
      }, {
        status: 400
      });
    }
    const [c500, c200, c100, c50, c20, c10, c5, c1] = counts;
    const actorId = Number(auth.user?.id) || null;
    const actorName = String(auth.user?.name || auth.user?.username || "").trim() || null;
    const totalAmount = c500 * 500 + c200 * 200 + c100 * 100 + c50 * 50 + c20 * 20 + c10 * 10 + c5 * 5 + c1;

    // Check if record exists
    const existing = await sql`
      SELECT * FROM accounting_cash_counts
      WHERE branch_id = ${parsedBranchId}
        AND count_month = ${monthDate}
      LIMIT 1
    `;
    let record;
    let action;
    let oldValues = null;
    if (existing.length > 0) {
      // Update
      action = "updated";
      oldValues = {
        d500: existing[0].d500,
        d200: existing[0].d200,
        d100: existing[0].d100,
        d50: existing[0].d50,
        d20: existing[0].d20,
        d10: existing[0].d10,
        d5: existing[0].d5,
        d1: existing[0].d1,
        total_amount: existing[0].total_amount,
        note: existing[0].note
      };
      const updated = await sql`
        UPDATE accounting_cash_counts
        SET
          d500 = ${c500},
          d200 = ${c200},
          d100 = ${c100},
          d50 = ${c50},
          d20 = ${c20},
          d10 = ${c10},
          d5 = ${c5},
          d1 = ${c1},
          total_amount = ${totalAmount},
          note = ${note || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
      record = updated[0];
    } else {
      // Insert
      action = "created";
      const inserted = await sql`
        INSERT INTO accounting_cash_counts
          (branch_id, count_month, d500, d200, d100, d50, d20, d10, d5, d1, total_amount, note, created_by_employee_id, created_by_employee_name)
        VALUES
          (${parsedBranchId}, ${monthDate}, ${c500}, ${c200}, ${c100}, ${c50}, ${c20}, ${c10}, ${c5}, ${c1}, ${totalAmount}, ${note || null}, ${actorId}, ${actorName})
        RETURNING *
      `;
      record = inserted[0];
    }

    // Insert log
    const newValues = {
      d500: c500,
      d200: c200,
      d100: c100,
      d50: c50,
      d20: c20,
      d10: c10,
      d5: c5,
      d1: c1,
      total_amount: totalAmount,
      note: note || null
    };
    const summary = action === "created" ? `إنشاء حاسبة كاش — الإجمالي: ${totalAmount}` : `تعديل حاسبة كاش — الإجمالي: ${totalAmount}`;
    const oldValuesJson = oldValues ? JSON.stringify(oldValues) : "{}";
    await sql`
      INSERT INTO accounting_cash_count_logs
        (cash_count_id, action, actor_employee_id, actor_name, summary, old_values, new_values)
      VALUES
        (${record.id}, ${action}, ${actorId}, ${actorName}, ${summary}, ${oldValuesJson}::jsonb, ${JSON.stringify(newValues)}::jsonb)
    `;
    return Response.json({
      record,
      action
    });
  } catch (err) {
    console.error("POST /api/accounting/cash-counts error:", err);
    return Response.json({
      error: err.message || "خطأ في الخادم"
    }, {
      status: 500
    });
  }
}

export { GET, POST };
