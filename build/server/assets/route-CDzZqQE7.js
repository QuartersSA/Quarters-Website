import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { whatsappStatus } from './whatsappBaileys-CRYlQjW8.js';
import 'crypto';
import './sql-BfhTxwII.js';
import '@neondatabase/serverless';

const REQUIRE_ADMIN = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  },
  // بطاقة الربط تعيش في صفحة إدارة الموظفين.
  {
    role: "Admin",
    permission: "can_manage_employees"
  }]
};

// حالة اتصال واتساب المستضاف ذاتياً — المزود، الاتصال، الرقم المقترن.
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ADMIN);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const status = await whatsappStatus();
    return Response.json(status);
  } catch (error) {
    console.error("whatsapp status error", error);
    return Response.json({
      error: "فشل قراءة حالة واتساب",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
