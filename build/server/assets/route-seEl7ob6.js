import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensurePurchaseAuditSchema } from './purchaseAudit-CVdAiEPz.js';
import '@neondatabase/serverless';
import 'crypto';

const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};

// سجل النشاط — قراءة فقط مع فلاتر: كيان محدد (خط زمني للفاتورة في
// درج المعاينة) أو فترة/بحث (شاشة سجل النشاط في التقارير).
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensurePurchaseAuditSchema();
    const url = new URL(request.url);
    const entityType = (url.searchParams.get("entity_type") || "").trim();
    const entityId = Number(url.searchParams.get("entity_id"));
    const from = (url.searchParams.get("from") || "").trim();
    const to = (url.searchParams.get("to") || "").trim();
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limitRaw = Number(url.searchParams.get("limit"));
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 1000 ? limitRaw : 400;
    const conditions = [];
    const values = [];
    let idx = 1;
    if (entityType) {
      conditions.push(`entity_type = $${idx}`);
      values.push(entityType);
      idx += 1;
    }
    if (Number.isInteger(entityId) && entityId > 0) {
      conditions.push(`entity_id = $${idx}`);
      values.push(entityId);
      idx += 1;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      conditions.push(`created_at >= $${idx}::date`);
      values.push(from);
      idx += 1;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      conditions.push(`created_at < ($${idx}::date + INTERVAL '1 day')`);
      values.push(to);
      idx += 1;
    }
    if (q) {
      conditions.push(`(LOWER(COALESCE(summary,'')) LIKE $${idx} OR LOWER(COALESCE(actor_name,'')) LIKE $${idx} OR LOWER(action) LIKE $${idx})`);
      values.push(`%${q}%`);
      idx += 1;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await sql(`
        SELECT id, entity_type, entity_id, action, summary,
               actor_id, actor_name,
               TO_CHAR(created_at, 'YYYY-MM-DD') AS log_date,
               TO_CHAR(created_at, 'HH24:MI') AS log_time
        FROM accounting_purchase_audit_log
        ${where}
        ORDER BY id DESC
        LIMIT ${limit}
      `, values);
    return Response.json({
      entries: rows
    });
  } catch (error) {
    console.error("purchase audit log GET error", error);
    return Response.json({
      error: "فشل تحميل سجل النشاط",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET };
