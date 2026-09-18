import sql from './sql-CSDV1lSC.js';
import { l as legacyGone } from './legacyGreenBean-BA_TFDYb.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

function toId(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

// GET /api/accounting/green-bean-orders/:id
async function GET(request, {
  params
}) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  const id = toId(params?.id);
  if (!id) {
    return Response.json({
      error: "Invalid id"
    }, {
      status: 400
    });
  }
  try {
    const [order] = await sql(`SELECT * FROM accounting_green_bean_orders WHERE id = $1 LIMIT 1`, [id]);
    if (!order) {
      return Response.json({
        error: "Not found"
      }, {
        status: 404
      });
    }
    const items = await sql(`
        SELECT
          i.*,
          b.name AS bean_name_current
        FROM accounting_green_bean_order_items i
        LEFT JOIN accounting_green_beans b
          ON b.id = i.bean_id
        WHERE i.order_id = $1
        ORDER BY i.id ASC
      `, [id]);
    return Response.json({
      order,
      items: items || []
    });
  } catch (error) {
    console.error("green bean order GET(id) error", error);
    return Response.json({
      error: "فشل تحميل الطلب"
    }, {
      status: 500
    });
  }
}

// DELETE — مؤرشف (410): تعديل/حذف طلب توريد قديم
async function DELETE(request, {
  params
}) {
  // بوابة المصادقة تبقى (اختبار apiAuthAudit) — ثم 410 للمؤرشف.
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  return legacyGone();
}

// PUT — مؤرشف (410): تعديل/حذف طلب توريد قديم
async function PUT(request, {
  params
}) {
  // بوابة المصادقة تبقى (اختبار apiAuthAudit) — ثم 410 للمؤرشف.
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  return legacyGone();
}

export { DELETE, GET, PUT };
