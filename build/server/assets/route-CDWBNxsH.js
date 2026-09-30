import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { h as listPayments, R as REQUIRE_LEASE } from './leaseContracts-D5eH32Je.js';
import 'crypto';
import './sql-CSDV1lSC.js';
import '@neondatabase/serverless';
import './leaseMath-DWUZXg5N.js';

// دفعات العقود التأجيرية مع سياق العقد (قسم «سداد المستحق»).
// GET /api/accounting/lease-contracts/payments?status=pending|paid|all&from=&to=&contract_id=

async function GET(request) {
  const auth = requireAuth(request, REQUIRE_LEASE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const url = new URL(request.url);
    const payments = await listPayments({
      status: url.searchParams.get("status") || "pending",
      from: url.searchParams.get("from") || null,
      to: url.searchParams.get("to") || null,
      contractId: url.searchParams.get("contract_id") || null
    });
    return Response.json({
      payments
    });
  } catch (error) {
    console.error("lease payments GET error", error);
    return Response.json({
      error: "فشل تحميل دفعات العقود",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
