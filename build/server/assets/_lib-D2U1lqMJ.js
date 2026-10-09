import sql from './sql-CSDV1lSC.js';
import { a as phaseBelongsToProject, v as todayRiyadh } from './branchProjects-CcA6x5SF.js';

// مساعدات مشتركة لمسارات مشاريع تأسيس الفروع (ليس مسارًا — المولّد يلتقط
// route.js فقط). كل مسار يستدعي requireAuth بنفسه (اختبار apiAuthAudit).
// المحمّلات والمحوّلات (loadPhase/loadTask/mapInvoiceRow…) من utils/branchProjects.

function fail(status, error, extra = {}) {
  return Response.json({
    error,
    ...extra
  }, {
    status
  });
}
function serverError(route, error, message) {
  console.error(`branch project ${route} error`, error);
  return Response.json({
    error: message,
    details: error?.message
  }, {
    status: 500
  });
}
function parseDateKey(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : text;
}
function today() {
  return todayRiyadh();
}
function actorName(auth) {
  return auth?.user?.name ? String(auth.user.name) : null;
}
function actorId(auth) {
  return auth?.user?.id ? Number(auth.user.id) : null;
}

// ---------- المشروع ----------

// رأس المشروع النشط (للتحقق ونصوص التدقيق) أو null.
async function loadProjectHeader(id) {
  const [row] = await sql`
    SELECT id, code, name, status, is_active, lease_contract_id,
           TO_CHAR(actual_opening_date, 'YYYY-MM-DD') AS actual_opening_date
    FROM branch_projects
    WHERE id = ${id} AND is_active = TRUE
  `;
  return row || null;
}
function projectLabel(row) {
  if (!row) return "";
  return `${row.code || `#${row.id}`} — ${row.name || ""}`.trim();
}
async function touchProject(id) {
  await sql`
    UPDATE branch_projects SET updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh') WHERE id = ${id}
  `;
}

// ---------- الأقسام ----------

// phase_id اختياري: null مقبول؛ وإن أُعطي يجب أن يخص المشروع.
// يعيد { ok, phaseId } أو { ok:false, error }.
async function resolvePhaseId(projectId, raw) {
  if (raw === undefined || raw === null || raw === "") return {
    ok: true,
    phaseId: null
  };
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return {
    ok: false,
    error: "القسم غير صحيح"
  };
  const belongs = await phaseBelongsToProject(id, projectId);
  if (!belongs) return {
    ok: false,
    error: "القسم لا يخص هذا المشروع"
  };
  return {
    ok: true,
    phaseId: id
  };
}
async function phaseName(phaseId) {
  if (!phaseId) return null;
  const [row] = await sql`SELECT name FROM branch_project_phases WHERE id = ${phaseId}`;
  return row?.name || null;
}

// ---------- فواتير المشتريات ----------

async function purchaseInvoicesTableExists() {
  const [reg] = await sql`SELECT to_regclass('accounting_purchase_invoices') AS t`;
  return !!reg?.t;
}

export { actorId as a, actorName as b, phaseName as c, parseDateKey as d, today as e, fail as f, purchaseInvoicesTableExists as g, loadProjectHeader as l, projectLabel as p, resolvePhaseId as r, serverError as s, touchProject as t };
