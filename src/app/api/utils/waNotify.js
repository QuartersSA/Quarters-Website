import sql from "@/app/api/utils/sql";
import { sendWhatsAppViaWasender } from "@/app/api/utils/wasender";

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

export async function ensureWaPrefsColumn() {
  await sql`
    ALTER TABLE employees
      ADD COLUMN IF NOT EXISTS wa_prefs JSONB DEFAULT '[]'::jsonb
  `;
}

export async function notifyByPref(prefKey, text, { onlyEmployeeId = null } = {}) {
  try {
    await ensureWaPrefsColumn();
    const prefJson = JSON.stringify([prefKey]);
    const rows = onlyEmployeeId
      ? await sql`
          SELECT id, phone FROM employees
          WHERE id = ${Number(onlyEmployeeId)}
            AND COALESCE(wa_prefs, '[]'::jsonb) @> ${prefJson}::jsonb
            AND phone IS NOT NULL AND TRIM(phone) <> ''
        `
      : await sql`
          SELECT id, phone FROM employees
          WHERE COALESCE(wa_prefs, '[]'::jsonb) @> ${prefJson}::jsonb
            AND phone IS NOT NULL AND TRIM(phone) <> ''
          ORDER BY id ASC
          LIMIT 30
        `;
    for (const row of rows) {
      sendWhatsAppViaWasender({ to: row.phone, text }).then((result) => {
        if (!result.ok) {
          console.error("wa pref notify failed", {
            employeeId: row.id,
            prefKey,
            error: result.error,
          });
        }
      });
    }
    return { ok: true, recipients: rows.length };
  } catch (error) {
    console.error("notifyByPref error", error);
    return { ok: false, error: error.message };
  }
}

// حارس «مرة واحدة يومياً» للإشعارات الدورية (ملخص المتأخرات).
export async function onceDaily(flagKey) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS wa_notify_log (
        key TEXT PRIMARY KEY,
        last_value TEXT
      )
    `;
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Riyadh",
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
export async function notifyLowStockIfAny({ branchId, itemIds }) {
  try {
    const ids = (itemIds || []).map(Number).filter((n) => Number.isInteger(n));
    if (!ids.length || !branchId) return;
    const rows = await sql`
      SELECT i.name,
             i.min_stock_threshold,
             COALESCE(cs.current_quantity, 0) AS current_quantity,
             b.name AS branch_name
      FROM items i
      JOIN branches b ON b.id = ${Number(branchId)}
      LEFT JOIN inventory_current_stock_v cs
        ON cs.item_id = i.id AND cs.branch_id = b.id
      WHERE i.id = ANY(${ids})
        AND COALESCE(i.min_stock_threshold, 0) > 0
        AND COALESCE(cs.current_quantity, 0) <= i.min_stock_threshold
      LIMIT 15
    `;
    if (!rows.length) return;
    const lines = [
      "⚠️ أصناف بلغت الحد الأدنى",
      `الفرع: ${rows[0].branch_name}`,
      "",
      ...rows.map(
        (row) =>
          `• ${row.name}: الرصيد ${Number(row.current_quantity)} (الحد ${Number(row.min_stock_threshold)})`,
      ),
    ];
    await notifyByPref("inv_low_stock", lines.join("\n"));
  } catch (error) {
    console.error("notifyLowStockIfAny error", error);
  }
}
