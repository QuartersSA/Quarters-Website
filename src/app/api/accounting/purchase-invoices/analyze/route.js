import { requireAuth } from "@/app/api/utils/sessionToken";
import { runInvoiceAnalysis } from "@/app/api/utils/invoiceAnalysis";

// Admin accounting, قسم المشتريات admins, or the dedicated field
// entry permission (رفع فاتورة مشتريات) — the entry flow scans too.
const REQUIRE_ACCOUNTING = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
    { permission: "can_add_purchase_invoices" },
  ],
};

// AI invoice analysis (تحليل ذكي للفاتورة) — مغلف رقيق حول النواة
// المشتركة في utils/invoiceAnalysis (يستخدمها أيضاً مسار الرفع
// الجماعي). العقد كما هو: file_base64/media_type و/أو text.
export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runInvoiceAnalysis({
      text: body?.text ? String(body.text) : "",
      fileBase64: body?.file_base64 ? String(body.file_base64) : "",
      mediaType: body?.media_type ? String(body.media_type) : "",
    });
    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: result.status || 500 },
      );
    }
    return Response.json({ ok: true, analysis: result.analysis });
  } catch (error) {
    console.error("invoice analyze error", error);
    return Response.json(
      { error: "فشل التحليل الذكي", details: error.message },
      { status: 500 },
    );
  }
}
