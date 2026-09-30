import { requireAuth } from "@/app/api/utils/sessionToken";
import { REQUIRE_LEASE } from "@/app/api/utils/leaseContracts";
import { runLeaseContractAnalysis } from "@/app/api/utils/leaseContractAnalysis";

// التحليل الذكي لعقد إيجار (رفع العقد → ملء فراغات النموذج).
// POST /api/accounting/lease-contracts/analyze
// body: { file_base64, media_type, text? } → { ok, analysis } أو 503/413/400/422/502 { error }

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_LEASE);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runLeaseContractAnalysis({
      fileBase64: body?.file_base64 ? String(body.file_base64) : "",
      mediaType: body?.media_type ? String(body.media_type) : "",
      text: body?.text ? String(body.text) : "",
    });
    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: result.status || 500 },
      );
    }
    return Response.json({ ok: true, analysis: result.analysis });
  } catch (error) {
    console.error("lease contract analyze error", error);
    return Response.json(
      { error: "فشل التحليل الذكي للعقد", details: error.message },
      { status: 500 },
    );
  }
}
