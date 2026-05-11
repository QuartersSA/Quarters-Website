import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// POST /api/accounting/payroll/close
// body: { month: 'YYYY-MM' }
// Closes (or reopens) the payroll month
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const monthRaw = body.month ? String(body.month).trim() : "";
    if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
      return Response.json({
        error: "Invalid month"
      }, {
        status: 400
      });
    }
    const [y, m] = monthRaw.split("-");
    const monthStart = `${y}-${m}-01`;
    const closedById = auth.user?.id ? Number(auth.user.id) : null;
    const closedByName = auth.user?.name ? String(auth.user.name) : null;

    // Find the run
    const [run] = await sql("SELECT * FROM accounting_payroll_runs WHERE payroll_month = $1 LIMIT 1", [monthStart]);
    if (!run) {
      return Response.json({
        error: "لا يوجد مسير لهذا الشهر"
      }, {
        status: 404
      });
    }

    // Toggle close/open
    const newIsClosed = !run.is_closed;
    const [updated] = await sql(`UPDATE accounting_payroll_runs
       SET is_closed = $1,
           closed_at = $2,
           closed_by_employee_id = $3,
           closed_by_employee_name = $4
       WHERE id = $5
       RETURNING *`, [newIsClosed, newIsClosed ? new Date().toISOString() : null, newIsClosed ? closedById : null, newIsClosed ? closedByName : null, run.id]);
    return Response.json({
      ok: true,
      run: updated
    });
  } catch (error) {
    console.error("payroll close POST error", error);
    return Response.json({
      error: "فشل تقفيلة الشهر",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { POST };
