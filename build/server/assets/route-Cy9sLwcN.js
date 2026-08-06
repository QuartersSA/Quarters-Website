import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import '@neondatabase/serverless';
import 'crypto';

// التقارير الضريبية الشهرية المحفوظة — لقطة معتمدة لكل شهر ميلادي:
// مدخلات المبيعات اليدوية + أرقام المشتريات المحسوبة لحظة الحفظ.
// عرض «الربع» يجمع الأشهر المحفوظة فيقرأ منها المبيعات بدل إعادة
// إدخالها، والمشتريات تُحسب حية من الفواتير دائماً.

const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};
const PERIOD_RE = /^\d{4}-\d{2}$/;
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_vat_reports (
      id SERIAL PRIMARY KEY,
      period_key TEXT NOT NULL UNIQUE,
      basis TEXT NOT NULL DEFAULT 'accrual',
      sales JSONB,
      purchases JSONB,
      totals JSONB,
      saved_by_employee_id INTEGER,
      saved_by_employee_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
}

// GET ?keys=2026-01,2026-02,2026-03 — تقارير أشهر محددة (أو الكل
// بدون keys، محدودة بآخر 36).
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
    await ensureSchema();
    const url = new URL(request.url);
    const keysParam = (url.searchParams.get("keys") || "").trim();
    const keys = keysParam ? keysParam.split(",").map(key => key.trim()).filter(key => PERIOD_RE.test(key)) : null;
    const reports = keys ? await sql`
          SELECT period_key, basis, sales, purchases, totals,
                 saved_by_employee_name,
                 TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI') AS saved_at
          FROM accounting_vat_reports
          WHERE period_key = ANY(${keys})
          ORDER BY period_key
        ` : await sql`
          SELECT period_key, basis, sales, purchases, totals,
                 saved_by_employee_name,
                 TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI') AS saved_at
          FROM accounting_vat_reports
          ORDER BY period_key DESC
          LIMIT 36
        `;
    return Response.json({
      reports
    });
  } catch (error) {
    console.error("vat reports GET error", error);
    return Response.json({
      error: "فشل تحميل التقارير الضريبية",
      details: error.message
    }, {
      status: 500
    });
  }
}

// POST { period_key: "2026-07", basis, sales, purchases, totals } —
// حفظ/تحديث تقرير الشهر (upsert).
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const periodKey = String(body?.period_key || "").trim();
    if (!PERIOD_RE.test(periodKey)) {
      return Response.json({
        error: "مفتاح الفترة غير صحيح — الصيغة YYYY-MM"
      }, {
        status: 400
      });
    }
    const basis = body?.basis === "cash" ? "cash" : "accrual";
    const clean = value => value && typeof value === "object" ? JSON.stringify(value) : null;
    const [saved] = await sql`
      INSERT INTO accounting_vat_reports (
        period_key, basis, sales, purchases, totals,
        saved_by_employee_id, saved_by_employee_name
      )
      VALUES (
        ${periodKey}, ${basis},
        ${clean(body?.sales)}::jsonb,
        ${clean(body?.purchases)}::jsonb,
        ${clean(body?.totals)}::jsonb,
        ${auth.user?.id ? Number(auth.user.id) : null},
        ${auth.user?.name || null}
      )
      ON CONFLICT (period_key) DO UPDATE SET
        basis = EXCLUDED.basis,
        sales = EXCLUDED.sales,
        purchases = EXCLUDED.purchases,
        totals = EXCLUDED.totals,
        saved_by_employee_id = EXCLUDED.saved_by_employee_id,
        saved_by_employee_name = EXCLUDED.saved_by_employee_name,
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      RETURNING period_key, TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI') AS saved_at
    `;
    logPurchaseAudit({
      entityType: "vat_report",
      entityId: null,
      action: "saved",
      summary: `حُفظ التقرير الضريبي لشهر ${periodKey}`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      report: saved
    });
  } catch (error) {
    console.error("vat reports POST error", error);
    return Response.json({
      error: "فشل حفظ التقرير الضريبي",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
