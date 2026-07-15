import { requireAuth } from "@/app/api/utils/sessionToken";
import { whatsappStatus } from "@/app/api/utils/whatsappBaileys";

const REQUIRE_ADMIN = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
    // بطاقة الربط تعيش في صفحة إدارة الموظفين.
    { role: "Admin", permission: "can_manage_employees" },
  ],
};

// حالة اتصال واتساب المستضاف ذاتياً — المزود، الاتصال، الرقم المقترن.
export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ADMIN);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const status = await whatsappStatus();
    return Response.json(status);
  } catch (error) {
    console.error("whatsapp status error", error);
    return Response.json(
      { error: "فشل قراءة حالة واتساب", details: error.message },
      { status: 500 },
    );
  }
}
