import sql from './sql-CSDV1lSC.js';
import { s as sendWhatsAppViaWasender } from './wasender-yto7m5av.js';

// إشعارات واتساب حسب تفضيلات الموظف — عمود wa_prefs (JSONB) على
// جدول employees يحمل مفاتيح الأحداث التي اشترك فيها الموظف من
// نافذة الموظف في /admin/employees. الإرسال «أطلق وانسَ»: لا يؤخر
// الطلب الأصلي ولا يفشله، وسلسلة التهدئة في مزود الواتساب تضبط
// المعدل.
//
// مفاتيح الأحداث:
//   المحاسبة: acc_payment_receipt (دفعة على فاتورة أنشأها الموظف)
//             acc_invoice_created (أي فاتورة مشتريات جديدة)
//             acc_invoice_overdue (ملخص المتأخرات اليومي 8 صباحاً)
//   الجرد:    inv_stocktake | inv_transfer | inv_receipt
//             inv_low_stock (صنف بلغ حده الأدنى بعد عملية)

async function ensureWaPrefsColumn() {
  await sql`
    ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS wa_prefs JSONB DEFAULT '[]'::jsonb
  `;
}
async function notifyByPref(prefKey, text, {
  onlyEmployeeId = null,
  excludeEmployeeIds = []
} = {}) {
  try {
    await ensureWaPrefsColumn();
    const prefJson = JSON.stringify([prefKey]);
    // استثناء من استلم رسالة مباشرة عن نفس الحدث (الخاصم/المخصوم)
    // حتى لا تصله نسختان.
    const excluded = (excludeEmployeeIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0);
    const rows = onlyEmployeeId ? await sql`
          SELECT id, phone FROM employees
          WHERE id = ${Number(onlyEmployeeId)}
            AND COALESCE(wa_prefs, '[]'::jsonb) @> ${prefJson}::jsonb
            AND phone IS NOT NULL AND TRIM(phone) <> ''
        ` : await sql`
          SELECT id, phone FROM employees
          WHERE COALESCE(wa_prefs, '[]'::jsonb) @> ${prefJson}::jsonb
            AND phone IS NOT NULL AND TRIM(phone) <> ''
            AND NOT (id = ANY(${excluded.length ? excluded : [0]}))
          ORDER BY id ASC
          LIMIT 30
        `;
    for (const row of rows) {
      sendWhatsAppViaWasender({
        to: row.phone,
        text
      }).then(result => {
        if (!result.ok) {
          console.error("wa pref notify failed", {
            employeeId: row.id,
            prefKey,
            error: result.error
          });
        }
      });
    }
    return {
      ok: true,
      recipients: rows.length
    };
  } catch (error) {
    console.error("notifyByPref error", error);
    return {
      ok: false,
      error: error.message
    };
  }
}

// حارس «مرة واحدة يومياً» للإشعارات الدورية (ملخص المتأخرات).
async function onceDaily(flagKey) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS wa_notify_log (
        key TEXT PRIMARY KEY,
        last_value TEXT
      )
    `;
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Riyadh"
    });
    const [row] = await sql`
      SELECT last_value FROM wa_notify_log WHERE key = ${flagKey}
    `;
    if (row?.last_value === today) return false;
    await sql`
      INSERT INTO wa_notify_log (key, last_value)
      VALUES (${flagKey}, ${today})
      ON CONFLICT (key) DO UPDATE SET last_value = EXCLUDED.last_value
    `;
    return true;
  } catch (error) {
    console.error("onceDaily error", error);
    return false;
  }
}

// فحص الحد الأدنى بعد عملية مخزون: الأصناف المتأثرة في الفرع التي
// نزلت إلى/تحت min_stock_threshold تُبلَّغ لمشتركي inv_low_stock.
async function notifyLowStockIfAny({
  branchId,
  itemIds
}) {
  try {
    const ids = (itemIds || []).map(Number).filter(n => Number.isInteger(n));
    if (!ids.length || !branchId) return;
    // الحد الفعّال: حد الفرع الخاص إن وُجد وإلا الافتراضي للصنف.
    await sql`
      CREATE TABLE IF NOT EXISTS item_branch_min_stock (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        min_stock NUMERIC(14, 3) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by_employee_name TEXT,
        PRIMARY KEY (item_id, branch_id)
      )
    `;
    const rows = await sql`
      SELECT i.name,
             COALESCE(inv_unit.name_ar, i.unit, '') AS unit,
             COALESCE(ibm.min_stock, i.min_stock_threshold) AS min_stock_threshold,
             (ibm.min_stock IS NOT NULL) AS branch_specific,
             COALESCE(cs.current_quantity, 0) AS current_quantity,
             b.name AS branch_name
      FROM items i
      JOIN branches b ON b.id = ${Number(branchId)}
      LEFT JOIN inventory_current_stock_v cs
        ON cs.item_id = i.id AND cs.branch_id = b.id
      LEFT JOIN item_branch_min_stock ibm
        ON ibm.item_id = i.id AND ibm.branch_id = b.id
      LEFT JOIN LATERAL (
        SELECT mu.name_ar
        FROM item_units iu
        JOIN measurement_units mu ON mu.id = iu.unit_id
        WHERE iu.id = i.default_inventory_unit_id
        LIMIT 1
      ) inv_unit ON true
      WHERE i.id = ANY(${ids})
        AND COALESCE(COALESCE(ibm.min_stock, i.min_stock_threshold), 0) > 0
        AND COALESCE(cs.current_quantity, 0) <= COALESCE(ibm.min_stock, i.min_stock_threshold)
      LIMIT 15
    `;
    if (!rows.length) return;
    const lines = ["⚠️ أصناف بلغت الحد الأدنى", `الفرع: ${rows[0].branch_name}`, "", ...rows.map(row => {
      const unit = row.unit ? ` ${row.unit}` : "";
      const badge = row.branch_specific ? " — حد خاص بالفرع" : "";
      return `• ${row.name}: الرصيد ${Number(row.current_quantity)}${unit} (الحد ${Number(row.min_stock_threshold)}${unit}${badge})`;
    })];
    await notifyByPref("inv_low_stock", lines.join("\n"));
  } catch (error) {
    console.error("notifyLowStockIfAny error", error);
  }
}

export { notifyLowStockIfAny as a, notifyByPref as n, onceDaily as o };
