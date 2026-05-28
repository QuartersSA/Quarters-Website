import { s as sql } from './sql-BfhTxwII.js';
import { e as ensureMarketingSchema } from './_schema-D3GCdwVm.js';
import '@neondatabase/serverless';

// POST /api/marketing/activate
// body: { slug, pin, cashierName? }
//
// PUBLIC endpoint — the blogger scans the QR, hands the phone to the
// cashier, who types the PIN to confirm presence + activate the code.
// On success the blogger's state flips from 'pending' to 'active' and
// the welcome page becomes accessible.
//
// One-shot: a code that's already 'active' returns the existing record
// without changing state (allows the blogger to re-open their welcome
// later — the activation itself remains a one-time event).


// Hardcoded PIN per requirement. Move to env later if needed.
const CASHIER_PIN = "335595";
async function POST(request) {
  await ensureMarketingSchema();
  const body = await request.json().catch(() => ({}));
  const slug = String(body.slug || "").trim();
  const pin = String(body.pin || "").trim();
  const cashierName = body.cashierName ? String(body.cashierName).trim() : null;
  if (!slug) return Response.json({
    error: "الكود مطلوب"
  }, {
    status: 400
  });
  if (!pin) return Response.json({
    error: "رقم التفعيل مطلوب"
  }, {
    status: 400
  });

  // Constant-time compare on equal length is overkill for a 6-char PIN,
  // but a quick length-then-equality keeps timing roughly uniform.
  if (pin.length !== CASHIER_PIN.length || pin !== CASHIER_PIN) {
    return Response.json({
      error: "رقم التفعيل غير صحيح"
    }, {
      status: 401
    });
  }
  const [row] = await sql`
    SELECT id, name, slug, state, activated_at, activated_by_employee_name
      FROM marketing_bloggers
     WHERE slug = ${slug}
     LIMIT 1
  `;
  if (!row) {
    return Response.json({
      error: "الكود غير موجود"
    }, {
      status: 404
    });
  }
  if (row.state === "active") {
    return Response.json({
      error: "هذا الكود مُفعَّل مسبقاً ولا يمكن استخدامه مرة أخرى.",
      blogger: row
    }, {
      status: 409
    });
  }
  const [updated] = await sql`
    UPDATE marketing_bloggers
       SET state = 'active',
           activated_at = NOW(),
           activated_by_employee_name = ${cashierName},
           updated_at = NOW()
     WHERE id = ${row.id}
       AND state IN ('pending', 'invited')
     RETURNING id, name, slug, state, activated_at, activated_by_employee_name
  `;
  if (!updated) {
    // Race: someone else activated between SELECT and UPDATE.
    return Response.json({
      error: "تم تفعيل الكود من قِبل جلسة أخرى"
    }, {
      status: 409
    });
  }
  return Response.json({
    ok: true,
    blogger: updated
  });
}

export { POST };
