import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// GET /api/accounting/purchase-invoices/check-number
//   ?number=INV-1     invoice number to test (required)
//   &contact_id=N     supplier — duplicates only count for the SAME
//                     supplier (required; different suppliers may
//                     legitimately share numbering)
//   &exclude_id=N     ignore this invoice id (editing an existing row)
//
// Lightweight duplicate probe for the invoice editor: fires while the
// operator types / after the smart scan fills the number, and returns
// the matching invoice's summary so the warning can say WHICH one.

const REQUIRE_PURCHASES_CREATE = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }, {
    permission: "can_add_purchase_invoices"
  }]
};
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_CREATE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const url = new URL(request.url);
    const number = (url.searchParams.get("number") || "").trim();
    const contactId = Number(url.searchParams.get("contact_id"));
    const excludeId = Number(url.searchParams.get("exclude_id")) || 0;
    if (!number || !Number.isInteger(contactId) || contactId <= 0) {
      return Response.json({
        duplicate: false
      });
    }
    const [match] = await sql`
      SELECT id, invoice_number,
             TO_CHAR(invoice_date, 'YYYY-MM-DD') AS invoice_date,
             total_amount
      FROM accounting_purchase_invoices
      WHERE is_active
        AND contact_id = ${contactId}
        AND LOWER(invoice_number) = LOWER(${number})
        AND id != ${excludeId}
      LIMIT 1
    `;
    return Response.json({
      duplicate: !!match,
      invoice: match || null
    });
  } catch (error) {
    console.error("check-number error", error);
    // A failed probe must never block invoice entry.
    return Response.json({
      duplicate: false
    });
  }
}

export { GET };
