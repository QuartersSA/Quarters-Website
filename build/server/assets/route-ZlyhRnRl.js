import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureUploadTables, g as getOwnedSession } from './_utils-Bbv0EQLW.js';
import '@neondatabase/serverless';
import 'crypto';

async function DELETE(request, {
  params: {
    sessionId
  }
}) {
  // Admins, plus field flows that attach files (رفع فاتورة مشتريات).
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin"
    }, {
      permission: "can_add_purchase_invoices"
    }]
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureUploadTables();
    const id = Number(sessionId);
    if (!Number.isFinite(id)) {
      return Response.json({
        error: "معرّف الرفع غير صحيح"
      }, {
        status: 400
      });
    }
    const owned = await getOwnedSession(id, Number(auth.user?.id));
    if (owned.error) {
      return Response.json({
        error: owned.error
      }, {
        status: owned.status
      });
    }
    await sql`DELETE FROM upload_sessions WHERE id = ${id}`;
    return Response.json({
      ok: true
    }, {
      status: 200
    });
  } catch (e) {
    console.error("upload abort error", e);
    return Response.json({
      error: "فشل إلغاء الرفع"
    }, {
      status: 500
    });
  }
}

export { DELETE };
