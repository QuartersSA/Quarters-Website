import { requireAuth } from "@/app/api/utils/sessionToken";
import { requestWhatsAppPairingCode } from "@/app/api/utils/whatsappBaileys";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";

const REQUIRE_ADMIN = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
  ],
};

// طلب رمز اقتران (8 خانات) لربط رقم واتساب المخصص بالخادم.
// يُدخل الرمز في جوال الرقم: الإعدادات ← الأجهزة المرتبطة ← ربط
// بجهاز ← «الربط برقم الهاتف بدلاً من ذلك».
export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ADMIN);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if ((process.env.WHATSAPP_PROVIDER || "").toLowerCase() !== "baileys") {
    return Response.json(
      {
        error:
          "الوضع الذاتي غير مفعّل — اضبط WHATSAPP_PROVIDER=baileys في متغيرات الخادم أولاً",
      },
      { status: 400 },
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const code = await requestWhatsAppPairingCode(body.phone);
    await logPurchaseAudit({
      entityType: "whatsapp",
      action: "pairing",
      summary: "طلب رمز اقتران واتساب (الاستضافة الذاتية)",
      actor: auth.user,
    });
    return Response.json({ ok: true, code });
  } catch (error) {
    console.error("whatsapp pair error", error);
    return Response.json(
      { error: error.message || "فشل طلب رمز الاقتران" },
      { status: 500 },
    );
  }
}
