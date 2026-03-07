import sql from "@/app/api/utils/sql";

/**
 * GET /api/accounting/cash-counts?branchId=X&month=YYYY-MM
 * Returns the cash count for a given branch + month, plus logs.
 *
 * Or GET /api/accounting/cash-counts?branchId=X  (returns all months for that branch)
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId");
    const month = url.searchParams.get("month"); // YYYY-MM

    // Special mode: list all branches (so this page doesn't depend on /api/branches permission)
    if (branchId === "list") {
      const branches = await sql`
        SELECT id, name FROM branches ORDER BY name ASC
      `;
      return Response.json({ branches });
    }

    if (!branchId) {
      return Response.json({ error: "branchId مطلوب" }, { status: 400 });
    }

    if (month) {
      // Specific month
      const monthDate = `${month}-01`;

      const rows = await sql`
        SELECT * FROM accounting_cash_counts
        WHERE branch_id = ${Number(branchId)}
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

      return Response.json({ record, logs });
    }

    // All months for branch
    const rows = await sql`
      SELECT * FROM accounting_cash_counts
      WHERE branch_id = ${Number(branchId)}
      ORDER BY count_month DESC
      LIMIT 100
    `;

    return Response.json({ records: rows });
  } catch (err) {
    console.error("GET /api/accounting/cash-counts error:", err);
    return Response.json(
      { error: err.message || "خطأ في الخادم" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/accounting/cash-counts
 * Create or update a cash count for branch + month (upsert).
 *
 * Body: { branchId, month (YYYY-MM), d500, d200, d100, d50, d20, d10, d5, d1, note?, employeeId?, employeeName? }
 */
export async function POST(request) {
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
      note = "",
      employeeId,
      employeeName,
    } = body;

    if (!branchId || !month) {
      return Response.json(
        { error: "branchId و month مطلوبين" },
        { status: 400 },
      );
    }

    const monthDate = `${month}-01`;

    const totalAmount =
      Number(d500) * 500 +
      Number(d200) * 200 +
      Number(d100) * 100 +
      Number(d50) * 50 +
      Number(d20) * 20 +
      Number(d10) * 10 +
      Number(d5) * 5 +
      Number(d1) * 1;

    // Check if record exists
    const existing = await sql`
      SELECT * FROM accounting_cash_counts
      WHERE branch_id = ${Number(branchId)}
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
        note: existing[0].note,
      };

      const updated = await sql`
        UPDATE accounting_cash_counts
        SET
          d500 = ${Number(d500)},
          d200 = ${Number(d200)},
          d100 = ${Number(d100)},
          d50 = ${Number(d50)},
          d20 = ${Number(d20)},
          d10 = ${Number(d10)},
          d5 = ${Number(d5)},
          d1 = ${Number(d1)},
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
          (${Number(branchId)}, ${monthDate}, ${Number(d500)}, ${Number(d200)}, ${Number(d100)}, ${Number(d50)}, ${Number(d20)}, ${Number(d10)}, ${Number(d5)}, ${Number(d1)}, ${totalAmount}, ${note || null}, ${employeeId ? Number(employeeId) : null}, ${employeeName || null})
        RETURNING *
      `;
      record = inserted[0];
    }

    // Insert log
    const newValues = {
      d500: Number(d500),
      d200: Number(d200),
      d100: Number(d100),
      d50: Number(d50),
      d20: Number(d20),
      d10: Number(d10),
      d5: Number(d5),
      d1: Number(d1),
      total_amount: totalAmount,
      note: note || null,
    };

    const summary =
      action === "created"
        ? `إنشاء حاسبة كاش — الإجمالي: ${totalAmount}`
        : `تعديل حاسبة كاش — الإجمالي: ${totalAmount}`;

    const oldValuesJson = oldValues ? JSON.stringify(oldValues) : "{}";

    await sql`
      INSERT INTO accounting_cash_count_logs
        (cash_count_id, action, actor_employee_id, actor_name, summary, old_values, new_values)
      VALUES
        (${record.id}, ${action}, ${employeeId ? Number(employeeId) : null}, ${employeeName || null}, ${summary}, ${oldValuesJson}::jsonb, ${JSON.stringify(newValues)}::jsonb)
    `;

    return Response.json({ record, action });
  } catch (err) {
    console.error("POST /api/accounting/cash-counts error:", err);
    return Response.json(
      { error: err.message || "خطأ في الخادم" },
      { status: 500 },
    );
  }
}
