import { requireAuth } from "@/app/api/utils/sessionToken";
import { REQUIRE_LEASE, listPayments } from "@/app/api/utils/leaseContracts";

// دفعات العقود التأجيرية مع سياق العقد (قسم «سداد المستحق»).
// GET /api/accounting/lease-contracts/payments?status=pending|paid|all&from=&to=&contract_id=

export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_LEASE);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const url = new URL(request.url);
    const payments = await listPayments({
      status: url.searchParams.get("status") || "pending",
      from: url.searchParams.get("from") || null,
      to: url.searchParams.get("to") || null,
      contractId: url.searchParams.get("contract_id") || null,
    });
    return Response.json({ payments });
  } catch (error) {
    console.error("lease payments GET error", error);
    return Response.json(
      { error: "فشل تحميل دفعات العقود", details: error.message },
      { status: 500 },
    );
  }
}
