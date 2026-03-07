import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import '@neondatabase/serverless';
import 'crypto';

// PATCH /api/accounting/payroll/payment
// body: { entry_id, is_paid, paid_amount?, payment_method?, payment_note? }
async function PATCH(request) {
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
    const entryId = body.entry_id ? Number(body.entry_id) : null;
    if (!entryId) {
      return Response.json({
        error: "entry_id is required"
      }, {
        status: 400
      });
    }
    const isPaid = !!body.is_paid;
    const paidAmount = body.paid_amount !== undefined && body.paid_amount !== null && body.paid_amount !== "" ? Number(body.paid_amount) : null;
    const paymentMethod = body.payment_method || null;
    const paymentNote = body.payment_note || null;
    const paidById = auth.user?.id ? Number(auth.user.id) : null;
    const paidByName = auth.user?.name ? String(auth.user.name) : null;

    // Validate payment_method
    if (paymentMethod && !["cash", "transfer"].includes(paymentMethod)) {
      return Response.json({
        error: "Invalid payment_method"
      }, {
        status: 400
      });
    }

    // Check that the entry exists and its run is not closed
    const [entry] = await sql("SELECT e.id, e.run_id, e.net_salary, r.is_closed FROM accounting_payroll_entries e JOIN accounting_payroll_runs r ON r.id = e.run_id WHERE e.id = $1", [entryId]);
    if (!entry) {
      return Response.json({
        error: "Entry not found"
      }, {
        status: 404
      });
    }
    if (entry.is_closed) {
      return Response.json({
        error: "الشهر مقفل - لا يمكن التعديل"
      }, {
        status: 400
      });
    }
    const paidAt = isPaid ? new Date().toISOString() : null;
    const [updated] = await sql(`UPDATE accounting_payroll_entries
       SET is_paid = $1,
           paid_amount = $2,
           payment_method = $3,
           payment_note = $4,
           paid_at = $5,
           paid_by_employee_id = $6,
           paid_by_employee_name = $7
       WHERE id = $8
       RETURNING *`, [isPaid, paidAmount, paymentMethod, paymentNote, paidAt, paidById, paidByName, entryId]);
    return Response.json({
      ok: true,
      entry: updated
    });
  } catch (error) {
    console.error("payroll payment PATCH error", error);
    return Response.json({
      error: "فشل تحديث حالة الدفع",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { PATCH };
