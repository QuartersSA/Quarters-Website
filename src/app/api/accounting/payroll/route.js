import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

function parsePayrollMonth(raw) {
  const value = raw ? String(raw).trim() : "";
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  const monthStart = `${y}-${m}-01`;

  const next = new Date(Date.UTC(year, month, 1)); // month is 1-based here, so Date month index = month
  const nextY = next.getUTCFullYear();
  const nextM = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextMonthStart = `${nextY}-${nextM}-01`;

  return { month: value, monthStart, nextMonthStart };
}

async function getPayrollRunAndEntriesByMonth(payrollMonthStart) {
  const [run] = await sql`
    SELECT *
    FROM accounting_payroll_runs
    WHERE payroll_month = ${payrollMonthStart}
    LIMIT 1
  `;

  if (!run?.id) {
    return { run: null, entries: [] };
  }

  const entries = await sql`
    SELECT *
    FROM accounting_payroll_entries
    WHERE run_id = ${run.id}
    ORDER BY branch_name ASC NULLS LAST, employee_name ASC, employee_id ASC
  `;

  return { run, entries };
}

// GET /api/accounting/payroll?month=YYYY-MM
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
    const monthRaw = url.searchParams.get("month");

    if (monthRaw) {
      const parsed = parsePayrollMonth(monthRaw);
      if (!parsed) {
        return Response.json({ error: "Invalid month" }, { status: 400 });
      }

      const { run, entries } = await getPayrollRunAndEntriesByMonth(
        parsed.monthStart,
      );
      return Response.json({ month: parsed.month, run, entries });
    }

    const runs = await sql`
      SELECT *
      FROM accounting_payroll_runs
      ORDER BY payroll_month DESC
      LIMIT 24
    `;

    return Response.json({ runs });
  } catch (error) {
    console.error("payroll GET error", error);
    return Response.json({ error: "فشل تحميل مسير الرواتب" }, { status: 500 });
  }
}

// POST /api/accounting/payroll
// body: { month: 'YYYY-MM' }
// Creates or refreshes the payroll run for that month using HR deductions + bonuses.
export async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_access_hr" },
      { role: "Admin", permission: "can_manage_deductions" },
      { role: "Admin", permission: "can_manage_accounting" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parsePayrollMonth(body?.month);
    if (!parsed) {
      return Response.json({ error: "month is required" }, { status: 400 });
    }

    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;

    // Refuse to rebuild a closed month. Once the accountant clicks
    // "تقفيل الشهر" the entries become a financial record; silently
    // wiping and re-inserting them (e.g. because someone added a
    // late bonus) would erase the actual paid amounts and the
    // closing audit trail. The UI shows a confirm dialog that says
    // "لا يمكن تعديل بعد التقفيل" but never enforced it — only the
    // per-entry payment endpoint did. Mirror that here.
    const [existingRun] = await sql(
      `SELECT id, is_closed
       FROM accounting_payroll_runs
       WHERE payroll_month = $1
       LIMIT 1`,
      [parsed.monthStart],
    );
    if (existingRun?.is_closed) {
      return Response.json(
        {
          error:
            "هذا الشهر مُقفّل ولا يمكن إعادة بناؤه. افتح التقفيل أولاً من زر «إلغاء التقفيل» إذا كان التعديل ضرورياً.",
          run_id: existingRun.id,
        },
        { status: 409 },
      );
    }

    // 1) Aggregate deductions + bonuses per employee for this month
    //    ✅ include ALL employees, even if they have no deductions/bonuses
    const rows = await sql(
      `
        SELECT
          e.id AS employee_id,
          e.name AS employee_name,
          br.branch_id AS branch_id,
          br.branch_name AS branch_name,
          COALESCE(e.base_salary, 0)::numeric(14,2) AS base_salary,
          COALESCE(e.other_allowances, 0)::numeric(14,2) AS other_allowances,
          (COALESCE(e.base_salary, 0) + COALESCE(e.other_allowances, 0))::numeric(14,2) AS total_salary,

          COALESCE(d.total_deductions, 0)::numeric(14,2) AS total_deductions,
          COALESCE(d.deductions_count, 0)::int AS deductions_count,
          COALESCE(d.deduction_ids, '{}'::int[]) AS deduction_ids,

          COALESCE(b.total_bonuses, 0)::numeric(14,2) AS total_bonuses,
          COALESCE(b.bonuses_count, 0)::int AS bonuses_count,
          COALESCE(b.bonus_ids, '{}'::int[]) AS bonus_ids,

          COALESCE(loan.monthly_total, 0)::numeric(14,2) AS loan_deduction,

          (
            (COALESCE(e.base_salary, 0) + COALESCE(e.other_allowances, 0))
            + COALESCE(b.total_bonuses, 0)
            - COALESCE(d.total_deductions, 0)
            - COALESCE(loan.monthly_total, 0)
          )::numeric(14,2) AS net_salary
        FROM employees e

        -- Deductions aggregate (LATERAL to avoid row multiplication)
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(x.amount), 0) AS total_deductions,
            COUNT(x.id)::int AS deductions_count,
            COALESCE(
              array_agg(x.id ORDER BY x.violation_date ASC, x.id ASC),
              '{}'::int[]
            ) AS deduction_ids
          FROM hr_employee_deductions x
          WHERE x.employee_id = e.id
            AND x.violation_date >= $1
            AND x.violation_date < $2
        ) d ON true

        -- Bonuses aggregate (LATERAL to avoid row multiplication)
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN x.amount_mode = 'percent' AND x.amount_percent IS NOT NULL THEN
                    ROUND(
                      (COALESCE(e.base_salary, 0) + COALESCE(e.other_allowances, 0))
                      * x.amount_percent::numeric / 100,
                      2
                    )
                  ELSE COALESCE(x.amount, 0)
                END
              ),
              0
            ) AS total_bonuses,
            COUNT(x.id)::int AS bonuses_count,
            COALESCE(
              array_agg(x.id ORDER BY x.bonus_date ASC, x.id ASC),
              '{}'::int[]
            ) AS bonus_ids
          FROM hr_employee_bonuses x
          WHERE x.employee_id = e.id
            AND x.bonus_date >= $1
            AND x.bonus_date < $2
        ) b ON true

        -- Active employee loans whose installment window covers
        -- this month. monthly_total = SUM(total_amount / installments)
        -- across every loan that's active and currently in its
        -- installment period.
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            SUM(
              ROUND(l.total_amount / NULLIF(l.installments_count, 0), 2)
            ),
            0
          ) AS monthly_total
          FROM accounting_employee_loans l
          WHERE l.employee_id = e.id
            AND l.is_active = TRUE
            AND l.start_month <= $1::date
            AND (l.start_month + (l.installments_count || ' months')::interval) > $1::date
        ) loan ON true

        -- Branch resolution
        LEFT JOIN LATERAL (
          SELECT
            br2.id AS branch_id,
            br2.name AS branch_name
          FROM branches br2
          WHERE br2.id = COALESCE(
            e.branch_id,
            (
              SELECT eb.branch_id
              FROM employee_branches eb
              WHERE eb.employee_id = e.id
              ORDER BY eb.id ASC
              LIMIT 1
            )
          )
          LIMIT 1
        ) br ON true

        ORDER BY br.branch_name ASC NULLS LAST, e.name ASC, e.id ASC
      `,
      [parsed.monthStart, parsed.nextMonthStart],
    );

    // Ensure accounting_payroll_entries carries the loan_deduction
    // column. Idempotent — first POST after the migration adds it,
    // subsequent calls are no-ops.
    await sql`
      ALTER TABLE accounting_payroll_entries
      ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC(14, 2) NOT NULL DEFAULT 0
    `;

    // 2) Upsert run
    const [run] = await sql(
      `
        INSERT INTO accounting_payroll_runs (
          payroll_month,
          created_by_employee_id,
          created_by_employee_name
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (payroll_month)
        DO UPDATE SET
          created_by_employee_id = EXCLUDED.created_by_employee_id,
          created_by_employee_name = EXCLUDED.created_by_employee_name,
          created_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [parsed.monthStart, createdById, createdByName],
    );

    // 3) Refresh entries in one transaction
    // First, read existing payment data so we can preserve it
    const existingPayments = await sql(
      `SELECT employee_id, is_paid, paid_amount, payment_method, payment_note, paid_at, paid_by_employee_id, paid_by_employee_name
       FROM accounting_payroll_entries
       WHERE run_id = $1 AND is_paid = true`,
      [run.id],
    );

    const paymentMap = {};
    for (const p of existingPayments) {
      paymentMap[Number(p.employee_id)] = p;
    }

    await sql.transaction((txn) => {
      const queries = [
        txn("DELETE FROM accounting_payroll_entries WHERE run_id = $1", [
          run.id,
        ]),
      ];

      for (const r of rows || []) {
        const empId = Number(r.employee_id);
        const prev = paymentMap[empId];

        queries.push(
          txn(
            `
              INSERT INTO accounting_payroll_entries (
                run_id,
                employee_id,
                employee_name,
                branch_id,
                branch_name,
                base_salary,
                other_allowances,
                total_salary,
                total_bonuses,
                total_deductions,
                loan_deduction,
                net_salary,
                deductions_count,
                deduction_ids,
                bonuses_count,
                bonus_ids,
                is_paid,
                paid_amount,
                payment_method,
                payment_note,
                paid_at,
                paid_by_employee_id,
                paid_by_employee_name
              )
              VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
              )
            `,
            [
              run.id,
              empId,
              String(r.employee_name || ""),
              r.branch_id === null || r.branch_id === undefined
                ? null
                : Number(r.branch_id),
              r.branch_name ? String(r.branch_name) : null,
              Number(r.base_salary || 0),
              Number(r.other_allowances || 0),
              Number(r.total_salary || 0),
              Number(r.total_bonuses || 0),
              Number(r.total_deductions || 0),
              Number(r.loan_deduction || 0),
              Number(r.net_salary || 0),
              Number(r.deductions_count || 0),
              Array.isArray(r.deduction_ids) ? r.deduction_ids : [],
              Number(r.bonuses_count || 0),
              Array.isArray(r.bonus_ids) ? r.bonus_ids : [],
              prev ? true : false,
              prev ? prev.paid_amount : null,
              prev ? prev.payment_method : null,
              prev ? prev.payment_note : null,
              prev ? prev.paid_at : null,
              prev ? prev.paid_by_employee_id : null,
              prev ? prev.paid_by_employee_name : null,
            ],
          ),
        );
      }

      return queries;
    });

    const { entries } = await getPayrollRunAndEntriesByMonth(parsed.monthStart);

    return Response.json({ ok: true, month: parsed.month, run, entries });
  } catch (error) {
    console.error("payroll POST error", error);
    return Response.json(
      { error: "فشل إرسال المسير إلى المحاسبة", details: error.message },
      { status: 500 },
    );
  }
}
