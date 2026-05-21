// GET /api/accounting/expenses/trend?months=12
//
// Returns one row per month for the last N months (default 12, max 36):
//   { month: "YYYY-MM", total, confirmed, pending, count }
// Plus a per-type breakdown for the CURRENT selected month (optional
// `currentMonth=YYYY-MM` query param; defaults to "now").
//
// Used by the expenses page chart (line trend + pie-by-type).

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const url = new URL(request.url);
    const monthsRaw = url.searchParams.get("months");
    const months = Math.max(1, Math.min(36, Number(monthsRaw) || 12));
    const currentMonthRaw = url.searchParams.get("currentMonth");

    let pivotMonth;
    if (currentMonthRaw && /^\d{4}-\d{2}$/.test(currentMonthRaw)) {
      pivotMonth = `${currentMonthRaw}-01`;
    } else {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      pivotMonth = `${y}-${m}-01`;
    }

    // Trend: last N months ending at pivotMonth. Use generate_series so
    // months with zero expenses still appear (otherwise the line graph
    // drops to nothing then jumps).
    const trend = await sql`
      WITH months AS (
        SELECT
          (date_trunc('month', ${pivotMonth}::date) - (INTERVAL '1 month' * gs))::date AS m
        FROM generate_series(0, ${months - 1}) gs
      )
      SELECT
        to_char(months.m, 'YYYY-MM') AS month,
        COALESCE(SUM(e.amount), 0)::numeric                   AS total,
        COALESCE(SUM(
          CASE WHEN e.is_confirmed THEN
            COALESCE(e.confirmed_amount, e.amount)
          ELSE 0 END
        ), 0)::numeric                                         AS confirmed,
        COALESCE(SUM(
          CASE WHEN e.is_confirmed THEN 0 ELSE e.amount END
        ), 0)::numeric                                         AS pending,
        COUNT(e.id)::int                                       AS count
      FROM months
      LEFT JOIN accounting_expenses e
        ON e.expense_month = months.m
      GROUP BY months.m
      ORDER BY months.m ASC
    `;

    // By-type breakdown for the pivot month (pie chart).
    const byType = await sql`
      SELECT
        t.id   AS type_id,
        t.name AS type_name,
        COALESCE(SUM(e.amount), 0)::numeric                     AS total,
        COALESCE(SUM(
          CASE WHEN e.is_confirmed THEN
            COALESCE(e.confirmed_amount, e.amount)
          ELSE 0 END
        ), 0)::numeric                                          AS confirmed,
        COUNT(e.id)::int                                        AS count
      FROM accounting_expenses e
      JOIN accounting_expense_types t ON t.id = e.expense_type_id
      WHERE e.expense_month = ${pivotMonth}
      GROUP BY t.id, t.name
      HAVING COALESCE(SUM(e.amount), 0) > 0
      ORDER BY total DESC
    `;

    return Response.json({
      months: trend,
      by_type: byType,
      pivot_month: pivotMonth.slice(0, 7),
    });
  } catch (error) {
    console.error("expenses trend GET error", error);
    return Response.json(
      { error: "فشل تحميل البيانات", details: error.message },
      { status: 500 },
    );
  }
}
