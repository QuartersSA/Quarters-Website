import sql from './sql-CSDV1lSC.js';

// سجل تدقيق قسم المشتريات: من فعل ماذا ومتى. الكتابة تتم من مسارات
// الفواتير/الأتمتة، والقراءة من /api/accounting/purchase-audit-log.
// Failures here must NEVER break the operation being logged.

async function ensurePurchaseAuditSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_purchase_audit_log (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      summary TEXT,
      actor_id INTEGER,
      actor_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_purchase_audit_entity
      ON accounting_purchase_audit_log (entity_type, entity_id, id DESC)
  `;
}
async function logPurchaseAudit({
  entityType,
  entityId = null,
  action,
  summary = null,
  actor = null
}) {
  try {
    await ensurePurchaseAuditSchema();
    await sql`
      INSERT INTO accounting_purchase_audit_log (
        entity_type, entity_id, action, summary, actor_id, actor_name
      )
      VALUES (
        ${entityType},
        ${entityId},
        ${action},
        ${summary},
        ${actor?.id ? Number(actor.id) : null},
        ${actor?.name ? String(actor.name) : null}
      )
    `;
  } catch (error) {
    console.error("purchase audit log write failed", error);
  }
}

export { ensurePurchaseAuditSchema as e, logPurchaseAudit as l };
