import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { e as ensureInvoiceBatchSchema, M as MAX_BATCH_ITEMS, v as verifyUploadSessionForItem } from './invoiceBatches-BefXoxDb.js';
import '@neondatabase/serverless';
import 'crypto';

// دفعات الرفع الجماعي — نفس صلاحيات إنشاء الفاتورة الواحدة.
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

// GET /api/accounting/purchase-invoice-batches
// آخر الدفعات مع عدادات الحالات — لاستئناف المراجعة من حيث توقفت.
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
    await ensureInvoiceBatchSchema();
    // غير المشرف (صلاحية الإدخال الميداني فقط) يرى دفعاته هو حصراً —
    // نفس نموذج الفاتورة الواحدة: الإضافة مسموحة والاطلاع على سجل
    // الغير محجوب.
    const isAdmin = auth.user?.role === "Admin";
    const ownerId = auth.user?.id ? Number(auth.user.id) : 0;
    const batches = await sql`
      SELECT b.id,
             b.created_by_employee_name,
             TO_CHAR(b.created_at, 'YYYY-MM-DD HH24:MI') AS created_at,
             COUNT(i.id)::int AS total_items,
             COUNT(i.id) FILTER (WHERE i.status = 'uploaded')::int AS uploaded_count,
             COUNT(i.id) FILTER (WHERE i.status = 'analyzing')::int AS analyzing_count,
             COUNT(i.id) FILTER (WHERE i.status = 'ready')::int AS ready_count,
             COUNT(i.id) FILTER (WHERE i.status = 'needs_attention')::int AS attention_count,
             COUNT(i.id) FILTER (WHERE i.status = 'approved')::int AS approved_count,
             COUNT(i.id) FILTER (WHERE i.status = 'submitted')::int AS submitted_count,
             COUNT(i.id) FILTER (WHERE i.status = 'failed')::int AS failed_count
      FROM accounting_invoice_batches b
      LEFT JOIN accounting_invoice_batch_items i ON i.batch_id = b.id
      WHERE ${isAdmin} OR b.created_by_employee_id = ${ownerId}
      GROUP BY b.id
      ORDER BY b.id DESC
      LIMIT 20
    `;
    return Response.json({
      batches
    });
  } catch (error) {
    console.error("invoice batches list error", error);
    return Response.json({
      error: "فشل تحميل دفعات الرفع",
      details: error.message
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/purchase-invoice-batches
// body: { items: [{ file_name, file_url, media_type, upload_session_id }] }
// حتى 50 فاتورة؛ الملفات تكون مرفوعة مسبقاً عبر /api/uploads.
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_CREATE);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return Response.json({
        error: "لا توجد ملفات في الدفعة"
      }, {
        status: 400
      });
    }
    if (items.length > MAX_BATCH_ITEMS) {
      return Response.json({
        error: `الحد الأقصى ${MAX_BATCH_ITEMS} فاتورة في الدفعة الواحدة`
      }, {
        status: 400
      });
    }
    await ensureInvoiceBatchSchema();
    // كل بند يُثبت ملكيته لجلسة الرفع (الرابط يحمل رمز وصول الجلسة
    // نفسها) — يمنع تمرير معرفات جلسات الغير واستخراج محتواها.
    // نوع الملف يؤخذ من سجل الرفع لا من طلب العميل.
    const verified = [];
    for (const item of items) {
      if (!item?.file_url) {
        return Response.json({
          error: "كل ملف يحتاج رابط رفع صالحاً"
        }, {
          status: 400
        });
      }
      const session = await verifyUploadSessionForItem({
        fileUrl: item.file_url,
        uploadSessionId: item.upload_session_id
      });
      if (!session) {
        return Response.json({
          error: `ملف «${item.file_name || "?"}» غير صالح أو غير مكتمل الرفع`
        }, {
          status: 400
        });
      }
      verified.push({
        item,
        session
      });
    }
    const [batch] = await sql`
      INSERT INTO accounting_invoice_batches (
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${auth.user?.id ? Number(auth.user.id) : null},
        ${auth.user?.name ? String(auth.user.name) : null}
      )
      RETURNING id
    `;
    for (const {
      item,
      session
    } of verified) {
      await sql`
        INSERT INTO accounting_invoice_batch_items (
          batch_id, file_name, file_url, media_type, upload_session_id
        )
        VALUES (
          ${batch.id},
          ${item.file_name ? String(item.file_name).slice(0, 300) : null},
          ${String(item.file_url)},
          ${session.mime_type || String(item.media_type || "")},
          ${session.id}
        )
      `;
    }
    logPurchaseAudit({
      entityType: "invoice_batch",
      entityId: batch.id,
      action: "created",
      summary: `دفعة رفع جماعي جديدة: ${items.length} فاتورة`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      batch_id: batch.id
    }, {
      status: 201
    });
  } catch (error) {
    console.error("invoice batch create error", error);
    return Response.json({
      error: "فشل إنشاء الدفعة",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
