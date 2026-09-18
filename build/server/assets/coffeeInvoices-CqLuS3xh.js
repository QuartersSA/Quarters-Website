import sql from './sql-CSDV1lSC.js';
import { e as ensureAccountsSchema, n as nextChildCode } from './accountsTree-BiYqjwch.js';
import { l as logPurchaseAudit } from './purchaseAudit-CVdAiEPz.js';
import { g as getDefaultInventoryUnitSnapshots, s as snapshotForItem, e as ensureInventoryUnitSnapshotSchema } from './inventoryUnitSnapshots-B5krAOBv.js';
import { a as assertItemsEnabledAtBranch } from './branchVisibility-CPqSH5sT.js';

// وحدة حساب البن — تُستخدم على الخادم (مصدر الحقيقة) وفي الواجهة
// (المعاينة الحية) بنفس المعادلات حتى لا يختلف رقم بين الشاشة والقاعدة.
//
// كل الأرقام بالريال. الضريبة من البند نفسه (لا ثابت 15%):
//   الكيلو الخام        = الكمية × كيلو/الخيشة   (أو الكمية مباشرة في وضع كغ)
//   تكلفة البن (خالي)   = صافي البند بعد حصة الخصم
//   تكلفة البن (شامل)   = خالي + ضريبة البند بعد حصة الخصم
//   التحميص             = تحميص/كغ × الكيلو الخام (+ ضريبة التحميص إن وُجدت)
//   الهدر %             = (1 − الواصل ÷ الخام) × 100          ← عند اكتمال الوصول فقط
//   الصافي/كغ (خالي)    = (بن خالي + تحميص + إضافي) ÷ الواصل
//   الصافي/كغ (شامل)    = (بن شامل + تحميص + ضريبته + إضافي) ÷ الواصل ← تكلفة الصنف

const DEFAULT_ROAST_PER_KG = 9;
const DEFAULT_ROAST_TAX_RATE = 0;
const ROAST_DUE_DAYS = 15;
// حارس سعر الكيلو الخام — يلتقط الخطأ الشائع: كمية بالكيلو تُحسب خياشًا.
const RAW_PRICE_MIN = 3;
const RAW_PRICE_MAX = 500;
const WASTE_CONFIRM = 60;
function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function round3(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}
function round4(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}

// null عند الفراغ — لا يتحول الفراغ إلى 0 أبدًا (0 قيمة مقصودة).
function numOrNull(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// توزيع خصم الرأس على البنود بنسبة صافي كل بند، بأكبر الباقي حتى
// يساوي المجموع خصم الرأس تمامًا. يعيد مصفوفة حصص بنفس ترتيب البنود.
function allocateDiscount(lineSubtotals, discount) {
  const subs = lineSubtotals.map(v => Math.max(Number(v) || 0, 0));
  const raw = subs.reduce((s, v) => s + v, 0);
  const d = Math.min(Math.max(Number(discount) || 0, 0), raw);
  if (d <= 0 || raw <= 0) return subs.map(() => 0);
  const shares = subs.map(v => round2(d * v / raw));
  const residual = round2(d - shares.reduce((s, v) => s + v, 0));
  if (Math.abs(residual) >= 0.005) {
    let idx = 0;
    for (let i = 1; i < subs.length; i += 1) if (subs[i] > subs[idx]) idx = i;
    shares[idx] = round2(shares[idx] + residual);
  }
  return shares;
}

// حساب بند بن واحد. المدخلات كلها أرقام جاهزة (لا نصوص).
function computeCoffeeLine({
  quantity,
  quantityUnit,
  kgPerSack,
  lineSubtotal,
  lineTax,
  lineDiscount = 0,
  discountFactor = 1,
  roastPerKg,
  roastTaxRate = 0,
  extraCost = 0,
  receivedKg = null,
  arrivalComplete = false
}) {
  const qty = Number(quantity) || 0;
  const unit = quantityUnit === "kg" ? "kg" : "sack";
  const kps = numOrNull(kgPerSack);
  const rawKgExact = unit === "kg" ? qty : kps ? qty * kps : 0;
  const rawKg = round3(rawKgExact);
  const sacks = unit === "sack" ? round3(qty) : kps && kps > 0 ? round3(qty / kps) : null;
  const beanExcl = round2(Math.max((Number(lineSubtotal) || 0) - (Number(lineDiscount) || 0), 0));
  const beanTax = round2((Number(lineTax) || 0) * (Number(discountFactor) || 1));
  const beanIncl = round2(beanExcl + beanTax);
  const roastRate = Math.max(numOrNull(roastPerKg) ?? 0, 0);
  const roastNet = round2(roastRate * rawKgExact);
  const roastTax = round2(roastNet * Math.max(Number(roastTaxRate) || 0, 0) / 100);
  const extra = round2(Math.max(Number(extraCost) || 0, 0));
  const landedExcl = round2(beanExcl + roastNet + extra);
  const landedIncl = round2(beanIncl + roastNet + roastTax + extra);
  const rawCostPerKg = rawKgExact > 0 ? round4(beanExcl / rawKgExact) : null;
  const received = numOrNull(receivedKg);
  const complete = !!arrivalComplete && received !== null && received > 0;
  const wastePercent = complete && rawKgExact > 0 ? round4((1 - received / rawKgExact) * 100) : null;
  const netExclPerKg = complete ? round4(landedExcl / received) : null;
  const netInclPerKg = complete ? round4(landedIncl / received) : null;
  return {
    quantityUnit: unit,
    rawKg,
    sacks,
    beanCostExcl: beanExcl,
    beanCostIncl: beanIncl,
    rawCostPerKg,
    roastTotalNet: roastNet,
    roastTaxAmount: roastTax,
    extraCost: extra,
    landedExcl,
    landedIncl,
    receivedKg: received,
    arrivalComplete: complete,
    wastePercent,
    netExclPerKg,
    netInclPerKg
  };
}

// تاريخ + أيام (سلاسل YYYY-MM-DD) — بلا اعتماد على المنطقة الزمنية.
function addDays(dateKey, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

// تكلفة البن داخل فاتورة المشتريات:
//   - بند بن = بند حسابه مرآة صنف مخزون نشط تحت تصنيف معلَّم «بن قهوة
//     محمصة». الأهلية تُشتق على الخادم في كل مسار (لا ثقة بالواجهة).
//   - بيانات التحميص تُحفظ على البند نفسه (لقطات مجمّدة بالريال).
//   - فاتورة التحميص فاتورة مستقلة على المحمصة (invoice_kind='roast')
//     مربوطة بفاتورة البن عبر source_invoice_id، وبنودها مربوطة ببنود
//     البن عبر roast_for_item_id. الربط بالمعرّف لا بالرقم.
//   - الوصول والإيداع وتكلفة الصنف يملكها الخادم (مسار arrival) ولا
//     تُقرأ أبدًا من حمولة حفظ الفاتورة.

const ROASTING_SYSTEM_KEY = "roasting";
const ROASTED_CATEGORY_NAME = "بن قهوة محمصة";
const ROASTER_CONTACT_NAME = "محمصة درر";
class CoffeeError extends Error {
  constructor(status, message, extra = null) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Riyadh"
  });
}

// ── المخطط ────────────────────────────────────────────────────────

let ensured = false;
let ensuring = null;
async function ensureCoffeeSchema() {
  if (ensured) return;
  if (ensuring) return ensuring;
  ensuring = doEnsureCoffeeSchema();
  try {
    await ensuring;
    ensured = true;
  } finally {
    ensuring = null;
  }
}

// seed يعمل مرة واحدة فقط خلف جدول علامات — ما يغيّره المالك بعدها يبقى.
async function runOnce(key, fn) {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_schema_markers (
      key TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  const claimed = await sql`
    INSERT INTO accounting_schema_markers (key) VALUES (${key})
    ON CONFLICT DO NOTHING
    RETURNING key
  `;
  if (!claimed.length) return false;
  try {
    await fn();
    return true;
  } catch (error) {
    // فشل الـ seed = إعادة المحاولة في الطلب القادم.
    await sql`DELETE FROM accounting_schema_markers WHERE key = ${key}`;
    throw error;
  }
}
async function doEnsureCoffeeSchema() {
  await ensureAccountsSchema();
  await ensureInventoryUnitSnapshotSchema();

  // أعمدة البند
  await sql`
    ALTER TABLE accounting_purchase_invoice_items
      ADD COLUMN IF NOT EXISTS line_discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS line_net NUMERIC(14, 2),
      ADD COLUMN IF NOT EXISTS roast_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS item_id INTEGER,
      ADD COLUMN IF NOT EXISTS bean_name TEXT,
      ADD COLUMN IF NOT EXISTS quantity_unit TEXT,
      ADD COLUMN IF NOT EXISTS kg_per_sack NUMERIC(12, 3),
      ADD COLUMN IF NOT EXISTS roast_per_kg NUMERIC(12, 4),
      ADD COLUMN IF NOT EXISTS roast_tax_rate NUMERIC(5, 2),
      ADD COLUMN IF NOT EXISTS extra_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS free_sample BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS raw_kg NUMERIC(14, 3),
      ADD COLUMN IF NOT EXISTS sacks NUMERIC(14, 3),
      ADD COLUMN IF NOT EXISTS bean_cost_excl NUMERIC(14, 2),
      ADD COLUMN IF NOT EXISTS bean_cost_incl NUMERIC(14, 2),
      ADD COLUMN IF NOT EXISTS raw_cost_per_kg NUMERIC(14, 4),
      ADD COLUMN IF NOT EXISTS roast_total_net NUMERIC(14, 2),
      ADD COLUMN IF NOT EXISTS roast_tax_amount NUMERIC(14, 2),
      ADD COLUMN IF NOT EXISTS landed_excl NUMERIC(14, 2),
      ADD COLUMN IF NOT EXISTS landed_incl NUMERIC(14, 2),
      ADD COLUMN IF NOT EXISTS received_kg NUMERIC(14, 3),
      ADD COLUMN IF NOT EXISTS arrival_date DATE,
      ADD COLUMN IF NOT EXISTS arrival_complete BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS arrival_note TEXT,
      ADD COLUMN IF NOT EXISTS arrival_reported_kg NUMERIC(14, 3),
      ADD COLUMN IF NOT EXISTS arrival_reported_by TEXT,
      ADD COLUMN IF NOT EXISTS arrival_recorded_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS arrival_recorded_by TEXT,
      ADD COLUMN IF NOT EXISTS waste_percent NUMERIC(7, 4),
      ADD COLUMN IF NOT EXISTS net_excl_per_kg NUMERIC(14, 4),
      ADD COLUMN IF NOT EXISTS net_incl_per_kg NUMERIC(14, 4),
      ADD COLUMN IF NOT EXISTS receipt_batch_id TEXT,
      ADD COLUMN IF NOT EXISTS deposit_branch_id INTEGER,
      ADD COLUMN IF NOT EXISTS deposited_kg NUMERIC(14, 3),
      ADD COLUMN IF NOT EXISTS roast_for_item_id INTEGER
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_pi_items_coffee_item
      ON accounting_purchase_invoice_items (item_id, arrival_date DESC, id DESC)
      WHERE roast_enabled = TRUE
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_pi_items_roast_for
      ON accounting_purchase_invoice_items (roast_for_item_id)
      WHERE roast_for_item_id IS NOT NULL
  `;

  // رأس الفاتورة: نوعها والربط بفاتورة التحميص
  await sql`
    ALTER TABLE accounting_purchase_invoices
      ADD COLUMN IF NOT EXISTS invoice_kind TEXT NOT NULL DEFAULT 'purchase',
      ADD COLUMN IF NOT EXISTS source_invoice_id INTEGER,
      ADD COLUMN IF NOT EXISTS roast_link_state TEXT,
      ADD COLUMN IF NOT EXISTS roast_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS roaster_reference TEXT,
      ADD COLUMN IF NOT EXISTS roaster_contact_id INTEGER,
      ADD COLUMN IF NOT EXISTS due_date_auto BOOLEAN NOT NULL DEFAULT FALSE
  `;
  // فاتورة تحميص نشطة واحدة لكل فاتورة بن.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_roast_source_unique
      ON accounting_purchase_invoices (source_invoice_id)
      WHERE invoice_kind = 'roast' AND is_active = TRUE
  `;

  // التصنيف: علم البن + الافتراضات + المحمصة
  await sql`
    ALTER TABLE item_categories
      ADD COLUMN IF NOT EXISTS is_roasted_coffee BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS roast_cost_per_kg NUMERIC(12, 4),
      ADD COLUMN IF NOT EXISTS roast_tax_rate NUMERIC(5, 2),
      ADD COLUMN IF NOT EXISTS default_roaster_contact_id INTEGER
  `;
  // الصنف: افتراضات + أثر التكلفة
  await sql`
    ALTER TABLE items
      ADD COLUMN IF NOT EXISTS bag_size_kg NUMERIC(12, 3),
      ADD COLUMN IF NOT EXISTS roast_cost_per_kg NUMERIC(12, 4),
      ADD COLUMN IF NOT EXISTS cost_source TEXT,
      ADD COLUMN IF NOT EXISTS cost_source_invoice_item_id INTEGER,
      ADD COLUMN IF NOT EXISTS cost_source_date DATE,
      ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP
  `;
  // دقة التكلفة: 4 منازل (صنف أساسه جرام يحتاجها). غير حاجب: لو منع
  // view قائم تغيير النوع تبقى الدقة منزلتين ويُسجَّل الخطأ.
  try {
    await runOnce("coffee_widen_item_cost_v1", async () => {
      await sql`ALTER TABLE items ALTER COLUMN cost TYPE NUMERIC(14, 4)`;
      await sql`ALTER TABLE items ALTER COLUMN base_purchase_cost TYPE NUMERIC(14, 4)`;
    });
  } catch (error) {
    console.error("coffee schema: widening items.cost skipped:", error?.message);
  }

  // وحدات القياس: كم كيلو في الوحدة (كيلو = 1، جرام = 0.001).
  await sql`
    ALTER TABLE measurement_units
      ADD COLUMN IF NOT EXISTS kg_per_unit NUMERIC(14, 6)
  `;
  await runOnce("coffee_seed_units_kg_v1", async () => {
    await sql`
      UPDATE measurement_units SET kg_per_unit = 1
      WHERE kg_per_unit IS NULL AND (
        TRIM(name_ar) IN ('كيلو', 'كجم', 'كغ', 'كلغ', 'كيلوجرام', 'كيلوغرام', 'كيلو جرام', 'كيلو غرام')
        OR LOWER(TRIM(COALESCE(name_en, ''))) IN ('kg', 'kilo', 'kilogram', 'kilograms', 'kgs')
      )
    `;
    await sql`
      UPDATE measurement_units SET kg_per_unit = 0.001
      WHERE kg_per_unit IS NULL AND (
        TRIM(name_ar) IN ('جرام', 'غرام', 'جم', 'غ', 'قرام')
        OR LOWER(TRIM(COALESCE(name_en, ''))) IN ('g', 'gram', 'grams', 'gm')
      )
    `;
  });

  // حساب «تحميص» (system_key) تحت المصروفات التشغيلية «52».
  await sql`
    ALTER TABLE accounting_accounts
      ADD COLUMN IF NOT EXISTS system_key TEXT
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_accounts_system_key
      ON accounting_accounts (system_key) WHERE system_key IS NOT NULL
  `;
  await ensureRoastingAccount();

  // بذر التصنيف بالاسم الحرفي + المحمصة الافتراضية.
  await runOnce("coffee_seed_category_v1", async () => {
    await sql`
      UPDATE item_categories
      SET is_roasted_coffee = TRUE,
          roast_cost_per_kg = COALESCE(roast_cost_per_kg, ${DEFAULT_ROAST_PER_KG}),
          roast_tax_rate = COALESCE(roast_tax_rate, ${DEFAULT_ROAST_TAX_RATE})
      WHERE TRIM(name) = ${ROASTED_CATEGORY_NAME}
    `;
  });
  await runOnce("coffee_seed_roaster_v1", async () => {
    await ensureRoasterContact();
  });
}
async function ensureRoastingAccount() {
  const [existing] = await sql`
    SELECT id FROM accounting_accounts WHERE system_key = ${ROASTING_SYSTEM_KEY}
  `;
  if (existing) return Number(existing.id);
  const [parent] = await sql`
    SELECT id, code FROM accounting_accounts
    WHERE code = '52' AND is_system AND is_active
    LIMIT 1
  `;
  if (!parent) return null;
  // حساب «تحميص» يدوي قائم تحت 52 يُتبنّى — لا تحت تصنيف البن أبدًا.
  const [manual] = await sql`
    SELECT id FROM accounting_accounts
    WHERE parent_id = ${parent.id} AND is_active AND account_type = 'expense'
      AND TRIM(name) = 'تحميص' AND source_item_id IS NULL AND source_category_id IS NULL
    LIMIT 1
  `;
  if (manual) {
    await sql`
      UPDATE accounting_accounts
      SET system_key = ${ROASTING_SYSTEM_KEY}, is_system = TRUE, is_postable = TRUE
      WHERE id = ${manual.id}
    `;
    return Number(manual.id);
  }
  const [free] = await sql`
    SELECT 1 AS taken FROM accounting_accounts WHERE code = '5206' AND is_active
  `;
  const code = free ? await nextChildCode(parent.id, parent.code) : "5206";
  const [created] = await sql`
    INSERT INTO accounting_accounts (
      code, name, name_en, account_type, parent_id, is_postable, is_system, system_key
    )
    VALUES (${code}, 'تحميص', 'Coffee Roasting', 'expense', ${parent.id}, TRUE, TRUE, ${ROASTING_SYSTEM_KEY})
    RETURNING id
  `;
  return Number(created.id);
}
async function getRoastingAccountId() {
  const [row] = await sql`
    SELECT id FROM accounting_accounts WHERE system_key = ${ROASTING_SYSTEM_KEY} AND is_active
  `;
  return row ? Number(row.id) : null;
}

// جهة اتصال المحمصة الافتراضية (مرة واحدة): بالاسم المطبَّع شاملًا
// الموقوف (يُعاد تفعيله)، وحسابها الافتراضي = تحميص.
async function ensureRoasterContact() {
  const [category] = await sql`
    SELECT id, default_roaster_contact_id FROM item_categories
    WHERE is_roasted_coffee = TRUE ORDER BY id LIMIT 1
  `;
  if (!category || category.default_roaster_contact_id) return;
  let [contact] = await sql`
    SELECT id, is_active FROM accounting_contacts
    WHERE REPLACE(TRIM(name), ' ', '') = REPLACE(${ROASTER_CONTACT_NAME}, ' ', '')
       OR (name LIKE '%درر%' AND name LIKE '%محمص%')
    ORDER BY is_active DESC, id ASC
    LIMIT 1
  `;
  const roastingAccountId = await getRoastingAccountId();
  if (contact) {
    await sql`
      UPDATE accounting_contacts
      SET is_active = TRUE,
          default_account_id = COALESCE(default_account_id, ${roastingAccountId})
      WHERE id = ${contact.id}
    `;
  } else {
    [contact] = await sql`
      INSERT INTO accounting_contacts (name, country, vat_registered, default_tax_rate, default_account_id, notes)
      VALUES (${ROASTER_CONTACT_NAME}, 'SA', FALSE, 0, ${roastingAccountId}, 'المحمصة الافتراضية لفواتير التحميص المولّدة من فواتير البن')
      RETURNING id
    `;
  }
  await sql`
    UPDATE item_categories SET default_roaster_contact_id = ${contact.id}
    WHERE id = ${category.id}
  `;
}

// ── الأهلية والافتراضات ───────────────────────────────────────────

// لكل حساب: هل هو مرآة صنف بن نشط؟ + افتراضاته. المصدر الوحيد للحقيقة.
async function loadBeanInfo(accountIds = []) {
  const ids = [...new Set(accountIds.map(Number).filter(id => Number.isInteger(id) && id > 0))];
  const map = new Map();
  if (!ids.length) return map;
  const rows = await sql`
    SELECT a.id AS account_id, a.system_key,
           i.id AS item_id, i.name AS item_name, i.is_active AS item_active,
           i.show_in_inventory, i.bag_size_kg, i.roast_cost_per_kg AS item_roast,
           c.id AS category_id, c.is_roasted_coffee,
           c.roast_cost_per_kg AS category_roast, c.roast_tax_rate,
           c.default_roaster_contact_id
    FROM accounting_accounts a
    LEFT JOIN items i ON i.id = a.source_item_id
    LEFT JOIN item_categories c ON c.id = i.category_id
    WHERE a.id = ANY(${ids})
  `;
  for (const row of rows) {
    const isBean = !!row.item_id && row.item_active !== false && row.is_roasted_coffee === true;
    map.set(Number(row.account_id), {
      isBean,
      isRoastingAccount: row.system_key === ROASTING_SYSTEM_KEY,
      itemId: row.item_id ? Number(row.item_id) : null,
      itemName: row.item_name || null,
      showInInventory: row.show_in_inventory !== false,
      bagSizeKg: numOrNull(row.bag_size_kg),
      roastPerKg: numOrNull(row.item_roast) ?? numOrNull(row.category_roast) ?? DEFAULT_ROAST_PER_KG,
      roastTaxRate: numOrNull(row.roast_tax_rate) ?? DEFAULT_ROAST_TAX_RATE,
      roasterContactId: row.default_roaster_contact_id ? Number(row.default_roaster_contact_id) : null
    });
  }
  return map;
}

// كم كيلو في الوحدة الأساسية للصنف (null = الصنف بلا ربط كيلو).
async function resolveKgPerBaseUnit(itemId) {
  const [row] = await sql`
    SELECT mu.kg_per_unit
    FROM item_units iu
    JOIN measurement_units mu ON mu.id = iu.unit_id
    WHERE iu.item_id = ${itemId} AND iu.is_base
    LIMIT 1
  `;
  const v = numOrNull(row?.kg_per_unit);
  return v && v > 0 ? v : null;
}

// ── حساب بنود البن عند الإنشاء/التعديل ─────────────────────────────

// items = ناتج parseItems (مع الحقول الإضافية التي يمررها المسار).
// payload = رأس الفاتورة بعد applyItemsToPayload. existingLines = بنود
// القاعدة الحالية (عند التعديل) لإبقاء ما يملكه الخادم.
// يعيد البنود مُثرّاة بأعمدة البن، ويرمي CoffeeError عند الرفض.
async function applyCoffeeToItems(items, payload, {
  existingLines = [],
  invoiceKind = "purchase"
} = {}) {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const rawSubtotal = round2(items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0));
  const discount = Math.min(Math.max(Number(payload.discountAmount) || 0, 0), rawSubtotal);
  const factor = rawSubtotal > 0 ? (rawSubtotal - discount) / rawSubtotal : 1;
  const shares = allocateDiscount(items.map(it => it.subtotal), discount);
  const info = await loadBeanInfo(items.map(it => it.accountId));
  const byId = new Map(existingLines.map(l => [Number(l.id), l]));
  return items.map((item, index) => {
    const existing = item.id ? byId.get(Number(item.id)) : null;
    const bean = item.accountId ? info.get(Number(item.accountId)) : null;
    const lineDiscount = shares[index] || 0;
    const lineNet = round2(item.subtotal - lineDiscount);
    const base = {
      ...item,
      lineDiscount,
      lineNet
    };

    // فاتورة تحميص لا تكون مصدر بن أبدًا.
    if (invoiceKind === "roast") {
      if (bean?.isBean && item.roast_enabled === true) {
        throw new CoffeeError(400, "فاتورة التحميص لا تحمل بنود بن — اختر حساب التحميص");
      }
      return {
        ...base,
        coffee: null
      };
    }

    // غياب المفتاح عن حزمة قديمة = إبقاء المخزَّن.
    const enabledRaw = item.roast_enabled;
    const enabled = enabledRaw === undefined || enabledRaw === null ? !!existing?.roast_enabled : enabledRaw === true;
    if (!enabled) return {
      ...base,
      coffee: null
    };
    if (!bean?.isBean) {
      if (bean?.isRoastingAccount) {
        throw new CoffeeError(400, `البند «${item.description || index + 1}» على حساب التحميص لا يحمل بيانات بن`);
      }
      throw new CoffeeError(400, `البند «${item.description || index + 1}»: فعّل التحميص على حساب نوع بن (صنف تحت «بن قهوة محمصة») — لا على التصنيف أو حساب يدوي`);
    }
    if (item.includesTax) {
      throw new CoffeeError(400, `البند «${item.description || bean.itemName}»: بنود البن تُدخل بسعر بدون ضريبة (أطفئ «شامل الضريبة»)`);
    }
    const quantityUnit = item.quantity_unit === "kg" ? "kg" : item.quantity_unit === "sack" ? "sack" : existing?.quantity_unit || null;
    if (!quantityUnit) {
      throw new CoffeeError(400, `البند «${item.description || bean.itemName}»: حدد وحدة الكمية (خيشة أم كغ)`);
    }
    const kgPerSack = numOrNull(item.kg_per_sack) ?? numOrNull(existing?.kg_per_sack) ?? bean.bagSizeKg;
    if (quantityUnit === "sack" && !(kgPerSack > 0)) {
      throw new CoffeeError(400, `البند «${item.description || bean.itemName}»: أدخل عدد الكيلو في الخيشة`);
    }
    const roastPerKg = numOrNull(item.roast_per_kg) ?? numOrNull(existing?.roast_per_kg) ?? bean.roastPerKg;
    if (roastPerKg < 0) throw new CoffeeError(400, "تكلفة التحميص لا تكون سالبة");
    const roastTaxRate = numOrNull(item.roast_tax_rate) ?? numOrNull(existing?.roast_tax_rate) ?? bean.roastTaxRate;
    if (roastTaxRate < 0 || roastTaxRate > 100) throw new CoffeeError(400, "نسبة ضريبة التحميص غير صحيحة");
    const extraCost = numOrNull(item.extra_cost) ?? numOrNull(existing?.extra_cost) ?? 0;
    if (extraCost < 0) throw new CoffeeError(400, "التكاليف الإضافية لا تكون سالبة");
    const freeSample = item.free_sample === true || item.free_sample === undefined && !!existing?.free_sample;

    // الوصول يملكه الخادم: يُحمل من المخزَّن دائمًا عند التعديل.
    const receivedKg = existing ? numOrNull(existing.received_kg) : null;
    const arrivalComplete = existing ? !!existing.arrival_complete : false;
    const c = computeCoffeeLine({
      quantity: item.quantity,
      quantityUnit,
      kgPerSack,
      lineSubtotal: item.subtotal,
      lineTax: item.tax,
      lineDiscount,
      discountFactor: factor,
      roastPerKg,
      roastTaxRate,
      extraCost,
      receivedKg,
      arrivalComplete
    });
    if (c.rawKg < 0.001) {
      throw new CoffeeError(400, `البند «${item.description || bean.itemName}»: الكمية الخام صفر — تحقق من الكمية وكيلو الخيشة`);
    }
    if (!freeSample && c.rawCostPerKg !== null && (c.rawCostPerKg < RAW_PRICE_MIN || c.rawCostPerKg > RAW_PRICE_MAX) && item.confirm_unusual_price !== true) {
      throw new CoffeeError(400, `البند «${item.description || bean.itemName}»: سعر الكيلو الخام غير منطقي (${c.rawCostPerKg} ر.س/كغ) — تحقق من وحدة الكمية (خيشة/كغ) أو أكّد السعر`, {
        code: "unusual_price",
        raw_cost_per_kg: c.rawCostPerKg
      });
    }
    if (arrivalComplete && receivedKg > c.rawKg * (roastPerKg === 0 ? 1.02 : 1) + 0.0005) {
      throw new CoffeeError(409, `البند «${item.description || bean.itemName}»: الكمية الواصلة المسجلة (${receivedKg} كغ) أكبر من الكيلو الخام الجديد — صحّح الوصول أولًا`, {
        code: "reconfirm_received"
      });
    }
    return {
      ...base,
      coffee: {
        itemId: bean.itemId,
        beanName: bean.itemName,
        quantityUnit,
        kgPerSack: quantityUnit === "sack" || kgPerSack ? round3(kgPerSack) : null,
        roastPerKg: round4(roastPerKg),
        roastTaxRate: round2(roastTaxRate),
        extraCost: c.extraCost,
        freeSample,
        rawKg: c.rawKg,
        sacks: c.sacks,
        beanCostExcl: c.beanCostExcl,
        beanCostIncl: c.beanCostIncl,
        rawCostPerKg: c.rawCostPerKg,
        roastTotalNet: c.roastTotalNet,
        roastTaxAmount: c.roastTaxAmount,
        landedExcl: c.landedExcl,
        landedIncl: c.landedIncl,
        wastePercent: c.wastePercent,
        netExclPerKg: c.netExclPerKg,
        netInclPerKg: c.netInclPerKg
      }
    };
  });
}

// ── كتابة البنود (مطابقة لا استبدال) ───────────────────────────────

const LINE_SELECT_COLUMNS = `
  id, invoice_id, position, description, account_id, quantity, unit_price,
  amount, tax_rate, amount_includes_tax, line_subtotal, line_tax, line_total,
  line_discount, line_net, roast_enabled, item_id, bean_name, quantity_unit,
  kg_per_sack, roast_per_kg, roast_tax_rate, extra_cost, free_sample,
  raw_kg, sacks, bean_cost_excl, bean_cost_incl, raw_cost_per_kg,
  roast_total_net, roast_tax_amount, landed_excl, landed_incl,
  received_kg, TO_CHAR(arrival_date, 'YYYY-MM-DD') AS arrival_date,
  arrival_complete, arrival_note, arrival_reported_kg, arrival_reported_by,
  arrival_recorded_at, arrival_recorded_by, waste_percent,
  net_excl_per_kg, net_incl_per_kg, receipt_batch_id, deposit_branch_id,
  deposited_kg, roast_for_item_id
`;
async function loadInvoiceLines(invoiceId) {
  return sql(`SELECT ${LINE_SELECT_COLUMNS} FROM accounting_purchase_invoice_items
     WHERE invoice_id = $1 ORDER BY position, id`, [invoiceId]);
}
function coffeeCols(line) {
  const c = line.coffee;
  return {
    roast_enabled: !!c,
    item_id: c ? c.itemId : null,
    bean_name: c ? c.beanName : null,
    quantity_unit: c ? c.quantityUnit : null,
    kg_per_sack: c ? c.kgPerSack : null,
    roast_per_kg: c ? c.roastPerKg : null,
    roast_tax_rate: c ? c.roastTaxRate : null,
    extra_cost: c ? c.extraCost : 0,
    free_sample: c ? c.freeSample : false,
    raw_kg: c ? c.rawKg : null,
    sacks: c ? c.sacks : null,
    bean_cost_excl: c ? c.beanCostExcl : null,
    bean_cost_incl: c ? c.beanCostIncl : null,
    raw_cost_per_kg: c ? c.rawCostPerKg : null,
    roast_total_net: c ? c.roastTotalNet : null,
    roast_tax_amount: c ? c.roastTaxAmount : null,
    landed_excl: c ? c.landedExcl : null,
    landed_incl: c ? c.landedIncl : null,
    waste_percent: c ? c.wastePercent : null,
    net_excl_per_kg: c ? c.netExclPerKg : null,
    net_incl_per_kg: c ? c.netInclPerKg : null
  };
}

// INSERT بند بمعرّف محجوز (للمعاملات) — يعيد جملة sql جاهزة.
function insertLineStatement(id, invoiceId, line, extra = {}) {
  const c = coffeeCols(line);
  return sql`
    INSERT INTO accounting_purchase_invoice_items (
      id, invoice_id, position, description, account_id,
      quantity, unit_price, amount, tax_rate, amount_includes_tax,
      line_subtotal, line_tax, line_total, line_discount, line_net,
      roast_enabled, item_id, bean_name, quantity_unit, kg_per_sack,
      roast_per_kg, roast_tax_rate, extra_cost, free_sample,
      raw_kg, sacks, bean_cost_excl, bean_cost_incl, raw_cost_per_kg,
      roast_total_net, roast_tax_amount, landed_excl, landed_incl,
      waste_percent, net_excl_per_kg, net_incl_per_kg, roast_for_item_id
    )
    VALUES (
      ${id}, ${invoiceId}, ${line.position}, ${line.description}, ${line.accountId},
      ${line.quantity}, ${line.unitPrice}, ${line.amount}, ${line.taxRate}, ${line.includesTax},
      ${line.subtotal}, ${line.tax}, ${line.total}, ${line.lineDiscount || 0}, ${line.lineNet ?? line.subtotal},
      ${c.roast_enabled}, ${c.item_id}, ${c.bean_name}, ${c.quantity_unit}, ${c.kg_per_sack},
      ${c.roast_per_kg}, ${c.roast_tax_rate}, ${c.extra_cost}, ${c.free_sample},
      ${c.raw_kg}, ${c.sacks}, ${c.bean_cost_excl}, ${c.bean_cost_incl}, ${c.raw_cost_per_kg},
      ${c.roast_total_net}, ${c.roast_tax_amount}, ${c.landed_excl}, ${c.landed_incl},
      ${c.waste_percent}, ${c.net_excl_per_kg}, ${c.net_incl_per_kg}, ${extra.roastForItemId ?? null}
    )
  `;
}

// UPDATE بند قائم: أعمدة المحرر فقط — الوصول والإيداع والربط تبقى.
function updateLineStatement(line) {
  const c = coffeeCols(line);
  return sql`
    UPDATE accounting_purchase_invoice_items
    SET position = ${line.position}, description = ${line.description}, account_id = ${line.accountId},
        quantity = ${line.quantity}, unit_price = ${line.unitPrice}, amount = ${line.amount},
        tax_rate = ${line.taxRate}, amount_includes_tax = ${line.includesTax},
        line_subtotal = ${line.subtotal}, line_tax = ${line.tax}, line_total = ${line.total},
        line_discount = ${line.lineDiscount || 0}, line_net = ${line.lineNet ?? line.subtotal},
        roast_enabled = ${c.roast_enabled}, item_id = ${c.item_id}, bean_name = ${c.bean_name},
        quantity_unit = ${c.quantity_unit}, kg_per_sack = ${c.kg_per_sack},
        roast_per_kg = ${c.roast_per_kg}, roast_tax_rate = ${c.roast_tax_rate},
        extra_cost = ${c.extra_cost}, free_sample = ${c.free_sample},
        raw_kg = ${c.raw_kg}, sacks = ${c.sacks}, bean_cost_excl = ${c.bean_cost_excl},
        bean_cost_incl = ${c.bean_cost_incl}, raw_cost_per_kg = ${c.raw_cost_per_kg},
        roast_total_net = ${c.roast_total_net}, roast_tax_amount = ${c.roast_tax_amount},
        landed_excl = ${c.landed_excl}, landed_incl = ${c.landed_incl},
        waste_percent = ${c.waste_percent}, net_excl_per_kg = ${c.net_excl_per_kg},
        net_incl_per_kg = ${c.net_incl_per_kg},
        received_kg = CASE WHEN ${c.roast_enabled} THEN received_kg ELSE NULL END,
        arrival_complete = CASE WHEN ${c.roast_enabled} THEN arrival_complete ELSE FALSE END
    WHERE id = ${line.id}
  `;
}
async function reserveIds(table, count) {
  if (count <= 0) return [];
  const rows = await sql(`SELECT nextval(pg_get_serial_sequence($1, 'id'))::integer AS id
     FROM generate_series(1, $2::integer)`, [table, count]);
  return rows.map(r => Number(r.id));
}

// خطة مطابقة البنود: تحديث القائم بمعرّفه، إدراج الجديد، حذف الغائب.
// ترفض حذف بند له وصول مكتمل أو إيداع (409).
async function planLineReconcile(invoiceId, items) {
  const existing = await loadInvoiceLines(invoiceId);
  const byId = new Map(existing.map(l => [Number(l.id), l]));
  const kept = new Set();
  const updates = [];
  const inserts = [];
  for (const item of items) {
    const id = Number(item.id);
    if (Number.isInteger(id) && byId.has(id)) {
      kept.add(id);
      updates.push({
        ...item,
        id
      });
    } else {
      inserts.push({
        ...item,
        id: null
      });
    }
  }
  const deletes = existing.filter(l => !kept.has(Number(l.id)));
  for (const gone of deletes) {
    if (gone.arrival_complete || Number(gone.deposited_kg) > 0) {
      throw new CoffeeError(409, `لا يمكن حذف البند «${gone.description || gone.bean_name || gone.id}» — له وصول مسجَّل${Number(gone.deposited_kg) > 0 ? " وإيداع في المخزون" : ""}. ألغِ الوصول أولًا من نافذة تسجيل الوصول`, {
        code: "deposited_line"
      });
    }
  }
  const newIds = await reserveIds("accounting_purchase_invoice_items", inserts.length);
  inserts.forEach((line, i) => {
    line.id = newIds[i];
  });
  const statements = [...deletes.map(l => sql`DELETE FROM accounting_purchase_invoice_items WHERE id = ${l.id}`), ...updates.map(l => updateLineStatement(l)), ...inserts.map(l => insertLineStatement(l.id, invoiceId, l))];
  return {
    statements,
    lines: [...updates, ...inserts],
    existing,
    deletes
  };
}

// ── فاتورة التحميص ────────────────────────────────────────────────

async function loadRoastChild(beanInvoiceId) {
  const [child] = await sql`
    SELECT id, invoice_number, contact_id, supplier_name, paid_amount, total_amount,
           roast_confirmed, roast_link_state, due_date_auto, is_active,
           TO_CHAR(invoice_date, 'YYYY-MM-DD') AS invoice_date,
           TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date
    FROM accounting_purchase_invoices
    WHERE invoice_kind = 'roast' AND source_invoice_id = ${beanInvoiceId} AND is_active = TRUE
    LIMIT 1
  `;
  return child || null;
}
function desiredRoastLines(beanLines) {
  const out = [];
  for (const line of beanLines) {
    const net = Number(line.roast_total_net ?? line.coffee?.roastTotalNet) || 0;
    const enabled = line.roast_enabled ?? !!line.coffee;
    if (!enabled || net <= 0) continue;
    const rawKg = Number(line.raw_kg ?? line.coffee?.rawKg) || 0;
    const perKg = Number(line.roast_per_kg ?? line.coffee?.roastPerKg) || 0;
    const taxRate = Number(line.roast_tax_rate ?? line.coffee?.roastTaxRate) || 0;
    const tax = round2(Number(line.roast_tax_amount ?? line.coffee?.roastTaxAmount) || 0);
    const beanName = line.bean_name ?? line.coffee?.beanName ?? line.description ?? "بن";
    out.push({
      roastForItemId: Number(line.id),
      description: `تحميص ${beanName} — ${rawKg} كغ × ${perKg}`,
      quantity: rawKg,
      unitPrice: perKg,
      amount: net,
      taxRate,
      subtotal: net,
      tax,
      total: round2(net + tax)
    });
  }
  return out;
}
function roastLinesEqual(existingLines, desired) {
  if (existingLines.length !== desired.length) return false;
  const key = l => `${l.roast_for_item_id ?? l.roastForItemId}|${round2(l.line_subtotal ?? l.subtotal)}|${round2(l.line_tax ?? l.tax)}|${round3(l.quantity)}`;
  const a = existingLines.map(key).sort().join(";");
  const b = desired.map(key).sort().join(";");
  return a === b;
}

// مزامنة فاتورة التحميص من فاتورة البن (idempotent). تُستدعى بعد
// الإنشاء والتعديل. bean = رأس فاتورة البن (id, invoice_number,
// invoice_date, roaster_contact_id). beanLines = بنود القاعدة الحالية.
async function syncRoastInvoice(bean, beanLines, actor, {
  allowCreate = true
} = {}) {
  const desired = desiredRoastLines(beanLines);
  const child = await loadRoastChild(bean.id);
  const roastingAccountId = await getRoastingAccountId();
  if (!child) {
    if (!desired.length || !allowCreate) return {
      action: "none"
    };
    if (!roastingAccountId) throw new CoffeeError(500, "حساب «تحميص» غير موجود في شجرة الحسابات");
    const roaster = await resolveRoaster(bean.roaster_contact_id, beanLines);
    if (!roaster) throw new CoffeeError(400, "حدد المحمصة (جهة اتصال) لفاتورة التحميص");
    const [invoiceId] = await reserveIds("accounting_purchase_invoices", 1);
    const lineIds = await reserveIds("accounting_purchase_invoice_items", desired.length);
    const subtotal = round2(desired.reduce((s, l) => s + l.subtotal, 0));
    const tax = round2(desired.reduce((s, l) => s + l.tax, 0));
    const total = round2(subtotal + tax);
    const dueDate = addDays(bean.invoice_date, ROAST_DUE_DAYS);
    const statements = [sql`
        INSERT INTO accounting_purchase_invoices (
          id, invoice_number, contact_id, supplier_name, expense_account_id,
          invoice_date, due_date, currency, subtotal_amount, discount_amount,
          tax_amount, total_amount, paid_amount, workflow_status, notes,
          invoice_kind, source_invoice_id, roast_link_state, due_date_auto,
          created_by_employee_name
        )
        VALUES (
          ${invoiceId}, ${`ROAST-${bean.id}`}, ${roaster.id}, ${roaster.name}, ${roastingAccountId},
          ${bean.invoice_date}, ${dueDate}, 'SAR', ${subtotal}, 0,
          ${tax}, ${total}, 0, 'pending_payment',
          ${`فاتورة تحميص مولّدة تلقائيًا من فاتورة المشتريات ${bean.invoice_number}`},
          'roast', ${bean.id}, 'linked', TRUE,
          'النظام — فاتورة تحميص'
        )
      `, ...desired.map((l, i) => insertLineStatement(lineIds[i], invoiceId, {
      position: i,
      description: l.description,
      accountId: roastingAccountId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      taxRate: l.taxRate,
      includesTax: false,
      subtotal: l.subtotal,
      tax: l.tax,
      total: l.total,
      lineDiscount: 0,
      lineNet: l.subtotal,
      coffee: null
    }, {
      roastForItemId: l.roastForItemId
    }))];
    await sql.transaction(statements);
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoiceId,
      action: "roast_generated",
      summary: `توليد فاتورة التحميص ROAST-${bean.id} على ${roaster.name} بمبلغ ${total.toFixed(2)} SAR من فاتورة البن ${bean.invoice_number}`,
      actor
    });
    return {
      action: "created",
      roastInvoiceId: invoiceId,
      total
    };
  }

  // طفل قائم — فاتورة درر مؤكَّدة = الحقيقة، لا تُلمس من جهة البن.
  if (child.roast_confirmed) return {
    action: "confirmed_skip",
    roastInvoiceId: child.id
  };
  const existingLines = await sql`
    SELECT id, roast_for_item_id, line_subtotal, line_tax, quantity
    FROM accounting_purchase_invoice_items WHERE invoice_id = ${child.id} ORDER BY position, id
  `;
  const paid = Number(child.paid_amount) || 0;
  const oldTotal = Number(child.total_amount) || 0;
  const subtotal = round2(desired.reduce((s, l) => s + l.subtotal, 0));
  const tax = round2(desired.reduce((s, l) => s + l.tax, 0));
  const total = round2(subtotal + tax);
  const roaster = await resolveRoaster(bean.roaster_contact_id, beanLines);
  const roasterChanged = roaster && Number(roaster.id) !== Number(child.contact_id);
  const linesChanged = !roastLinesEqual(existingLines, desired);
  const dateChanged = child.due_date_auto && child.invoice_date !== bean.invoice_date;
  if (!linesChanged && !roasterChanged && !dateChanged) return {
    action: "unchanged",
    roastInvoiceId: child.id
  };
  if (paid > 0 && paid >= oldTotal - 0.004 && (linesChanged || roasterChanged)) {
    throw new CoffeeError(409, `فاتورة التحميص ${child.invoice_number} مسددة بالكامل — عدّل التحميص من فاتورة التحميص نفسها`, {
      code: "roast_paid"
    });
  }
  if (paid > 0 && total < paid - 0.004) {
    throw new CoffeeError(409, `فاتورة التحميص ${child.invoice_number} عليها دفعات ${paid.toFixed(2)} أكبر من الإجمالي الجديد ${total.toFixed(2)} — ألغِ الدفعة أولًا`, {
      code: "roast_paid_over"
    });
  }
  if (paid > 0 && roasterChanged) {
    throw new CoffeeError(409, `فاتورة التحميص ${child.invoice_number} عليها دفعات — لا يمكن تغيير المحمصة`, {
      code: "roast_paid"
    });
  }
  if (!desired.length) {
    // لم يبقَ تحميص: إيقاف الطفل (بلا دفعات — تحقق أعلاه).
    await sql`
      UPDATE accounting_purchase_invoices
      SET is_active = FALSE, roast_link_state = 'detached', updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${child.id}
    `;
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: child.id,
      action: "deactivated",
      summary: `إيقاف فاتورة التحميص ${child.invoice_number} — لم يبقَ تحميص في فاتورة البن ${bean.invoice_number}`,
      actor
    });
    return {
      action: "deactivated",
      roastInvoiceId: child.id
    };
  }
  const lineIds = await reserveIds("accounting_purchase_invoice_items", desired.length);
  const dueDate = child.due_date_auto ? addDays(bean.invoice_date, ROAST_DUE_DAYS) : child.due_date;
  const statements = [sql`DELETE FROM accounting_purchase_invoice_items WHERE invoice_id = ${child.id}`, ...desired.map((l, i) => insertLineStatement(lineIds[i], child.id, {
    position: i,
    description: l.description,
    accountId: roastingAccountId,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    amount: l.amount,
    taxRate: l.taxRate,
    includesTax: false,
    subtotal: l.subtotal,
    tax: l.tax,
    total: l.total,
    lineDiscount: 0,
    lineNet: l.subtotal,
    coffee: null
  }, {
    roastForItemId: l.roastForItemId
  })), sql`
      UPDATE accounting_purchase_invoices
      SET subtotal_amount = ${subtotal}, tax_amount = ${tax}, total_amount = ${total},
          contact_id = ${roaster ? roaster.id : child.contact_id},
          supplier_name = ${roaster ? roaster.name : child.supplier_name},
          invoice_date = CASE WHEN due_date_auto THEN ${bean.invoice_date}::date ELSE invoice_date END,
          due_date = ${dueDate},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${child.id}
    `];
  await sql.transaction(statements);
  await logPurchaseAudit({
    entityType: "invoice",
    entityId: child.id,
    action: "roast_synced",
    summary: `مزامنة فاتورة التحميص ${child.invoice_number} من فاتورة البن ${bean.invoice_number} — الإجمالي ${oldTotal.toFixed(2)} → ${total.toFixed(2)} SAR`,
    actor
  });
  return {
    action: "synced",
    roastInvoiceId: child.id,
    total
  };
}

// فحص قبل الكتابة: هل تعديل فاتورة البن مسموح بالنظر لحالة دفع
// فاتورة التحميص؟ (يُستدعى قبل UPDATE الرأس حتى لا تتباعد الفاتورتان.)
async function assertRoastSyncAllowed(beanInvoiceId, enrichedLines, roasterContactId) {
  const child = await loadRoastChild(beanInvoiceId);
  if (!child || child.roast_confirmed) return;
  const desiredTotal = round2(enrichedLines.reduce((s, l) => s + (l.coffee ? l.coffee.roastTotalNet + l.coffee.roastTaxAmount : 0), 0));
  const paid = Number(child.paid_amount) || 0;
  const oldTotal = Number(child.total_amount) || 0;
  if (paid <= 0) return;
  const changed = Math.abs(desiredTotal - oldTotal) > 0.004;
  if (paid >= oldTotal - 0.004 && changed) {
    throw new CoffeeError(409, `فاتورة التحميص ${child.invoice_number} مسددة بالكامل — عدّل التحميص من فاتورة التحميص نفسها`, {
      code: "roast_paid"
    });
  }
  if (desiredTotal < paid - 0.004) {
    throw new CoffeeError(409, `فاتورة التحميص ${child.invoice_number} عليها دفعات ${paid.toFixed(2)} أكبر من الإجمالي الجديد ${desiredTotal.toFixed(2)} — ألغِ الدفعة أولًا`, {
      code: "roast_paid_over"
    });
  }
  if (roasterContactId && Number(roasterContactId) !== Number(child.contact_id)) {
    throw new CoffeeError(409, `فاتورة التحميص ${child.invoice_number} عليها دفعات — لا يمكن تغيير المحمصة`, {
      code: "roast_paid"
    });
  }
}
async function resolveRoaster(roasterContactId, beanLines) {
  let id = Number(roasterContactId) || null;
  if (!id) {
    const accountIds = beanLines.map(l => l.accountId ?? l.account_id).filter(Boolean);
    const info = await loadBeanInfo(accountIds);
    for (const v of info.values()) if (v.isBean && v.roasterContactId) {
      id = v.roasterContactId;
      break;
    }
  }
  if (!id) return null;
  const [contact] = await sql`SELECT id, name FROM accounting_contacts WHERE id = ${id}`;
  return contact ? {
    id: Number(contact.id),
    name: contact.name
  } : null;
}

// المزامنة العكسية: فاتورة درر عُدّلت يدويًا → تصير الحقيقة؛ تحميص
// كل بند بن يُنسخ كمبلغ من بند التحميص المرتبط، ويُعاد حساب الصافي.
async function reverseSyncRoastToBean(roastInvoiceId, actor) {
  const [child] = await sql`
    SELECT id, invoice_number, source_invoice_id, subtotal_amount, discount_amount
    FROM accounting_purchase_invoices WHERE id = ${roastInvoiceId} AND invoice_kind = 'roast'
  `;
  if (!child?.source_invoice_id) return [];
  const roastLines = await sql`
    SELECT roast_for_item_id, line_subtotal, line_tax, quantity
    FROM accounting_purchase_invoice_items
    WHERE invoice_id = ${child.id} AND roast_for_item_id IS NOT NULL
  `;
  const beanLines = await loadInvoiceLines(child.source_invoice_id);
  const rawSum = round2(roastLines.reduce((s, l) => s + Number(l.line_subtotal), 0));
  const disc = Math.min(Number(child.discount_amount) || 0, rawSum);
  const f = rawSum > 0 ? (rawSum - disc) / rawSum : 1;
  const touchedItems = new Set();
  const statements = [];
  for (const rl of roastLines) {
    const bean = beanLines.find(b => Number(b.id) === Number(rl.roast_for_item_id));
    if (!bean || !bean.roast_enabled) continue;
    const roastNet = round2(Number(rl.line_subtotal) * f);
    const roastTax = round2(Number(rl.line_tax) * f);
    const rawKg = Number(bean.raw_kg) || 0;
    const perKg = rawKg > 0 ? round4(roastNet / rawKg) : Number(bean.roast_per_kg) || 0;
    const landedExcl = round2(Number(bean.bean_cost_excl) + roastNet + Number(bean.extra_cost || 0));
    const landedIncl = round2(Number(bean.bean_cost_incl) + roastNet + roastTax + Number(bean.extra_cost || 0));
    const received = numOrNull(bean.received_kg);
    const complete = !!bean.arrival_complete && received > 0;
    statements.push(sql`
      UPDATE accounting_purchase_invoice_items
      SET roast_total_net = ${roastNet}, roast_tax_amount = ${roastTax}, roast_per_kg = ${perKg},
          landed_excl = ${landedExcl}, landed_incl = ${landedIncl},
          net_excl_per_kg = ${complete ? round4(landedExcl / received) : null},
          net_incl_per_kg = ${complete ? round4(landedIncl / received) : null}
      WHERE id = ${bean.id}
    `);
    if (bean.item_id) touchedItems.add(Number(bean.item_id));
  }
  statements.push(sql`
    UPDATE accounting_purchase_invoices SET roast_confirmed = TRUE WHERE id = ${child.id}
  `);
  await sql.transaction(statements);
  await logPurchaseAudit({
    entityType: "invoice",
    entityId: Number(child.source_invoice_id),
    action: "roast_reverse_synced",
    summary: `تحديث تكلفة التحميص في بنود البن من فاتورة التحميص ${child.invoice_number} (بعد تعديلها يدويًا)`,
    actor
  });
  return [...touchedItems];
}

// ── الوصول والإيداع ───────────────────────────────────────────────

function toDateKey(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

// تسجيل الوصول لبنود فاتورة بن. lines: [{ id, received_kg, arrival_date,
// arrival_complete, arrival_note, confirm_high_waste }]. deposit:
// { enabled, branch_id }. canFinalize=false → بلاغ فقط (لا اكتمال/إيداع/تكلفة).
async function recordArrival(invoice, lines, {
  deposit = null,
  actor = null,
  canFinalize = false
} = {}) {
  await ensureCoffeeSchema();
  const existing = await loadInvoiceLines(invoice.id);
  const byId = new Map(existing.map(l => [Number(l.id), l]));
  const today = todayRiyadh();
  const actorName = actor?.name ? String(actor.name) : null;
  const statements = [];
  const touchedItems = new Set();
  const depositPlans = [];
  const summaries = [];
  for (const input of lines) {
    const line = byId.get(Number(input.id));
    if (!line) throw new CoffeeError(404, `البند #${input.id} غير موجود في هذه الفاتورة`);
    if (!line.roast_enabled) throw new CoffeeError(400, `البند «${line.description || line.id}» ليس بند بن`);
    const received = numOrNull(input.received_kg);
    const rawKg = Number(line.raw_kg) || 0;
    const roastPerKg = Number(line.roast_per_kg) || 0;
    const arrivalDate = toDateKey(input.arrival_date) || line.arrival_date || today;
    if (arrivalDate > today) throw new CoffeeError(400, "تاريخ الوصول لا يكون في المستقبل");
    if (!canFinalize) {
      if (received === null || received < 0) throw new CoffeeError(400, "أدخل الكمية الواصلة");
      statements.push(sql`
        UPDATE accounting_purchase_invoice_items
        SET arrival_reported_kg = ${round3(received)}, arrival_reported_by = ${actorName},
            arrival_note = COALESCE(${input.arrival_note ? String(input.arrival_note).trim() : null}, arrival_note)
        WHERE id = ${line.id}
      `);
      summaries.push(`بلاغ وصول ${round3(received)} كغ للبند «${line.bean_name || line.description}»`);
      continue;
    }
    const complete = input.arrival_complete === true;
    if (received === null) {
      // إلغاء الوصول (فقط عندما لا يوجد إيداع).
      if (Number(line.deposited_kg) > 0) throw new CoffeeError(409, `البند «${line.bean_name}» مودَع في المخزون — ألغِ الإيداع أولًا`, {
        code: "deposited_line"
      });
      statements.push(sql`
        UPDATE accounting_purchase_invoice_items
        SET received_kg = NULL, arrival_date = NULL, arrival_complete = FALSE,
            waste_percent = NULL, net_excl_per_kg = NULL, net_incl_per_kg = NULL,
            arrival_recorded_at = (NOW() AT TIME ZONE 'Asia/Riyadh'), arrival_recorded_by = ${actorName},
            arrival_note = ${input.arrival_note ? String(input.arrival_note).trim() : null}
        WHERE id = ${line.id}
      `);
      if (line.item_id) touchedItems.add(Number(line.item_id));
      summaries.push(`إلغاء وصول البند «${line.bean_name || line.description}»`);
      continue;
    }
    if (received <= 0) throw new CoffeeError(400, `البند «${line.bean_name}»: الكمية الواصلة يجب أن تكون أكبر من صفر`);
    const cap = rawKg * (roastPerKg === 0 ? 1.02 : 1) + 0.0005;
    if (received > cap) throw new CoffeeError(400, `البند «${line.bean_name}»: الواصل (${received} كغ) أكبر من الكيلو الخام (${rawKg} كغ)`);
    if (complete && Number(line.deposited_kg) > 0 && Math.abs(Number(line.deposited_kg) - received) > 0.0005 && !deposit?.enabled) {
      // تصحيح واصل مودَع دون إعادة الإيداع = تباين — يُسمح لكن يُسجَّل.
      summaries.push(`تنبيه: الإيداع (${line.deposited_kg} كغ) لا يطابق الواصل الجديد (${received} كغ)`);
    }
    const c = computeCoffeeLine({
      quantity: Number(line.quantity),
      quantityUnit: line.quantity_unit,
      kgPerSack: line.kg_per_sack,
      lineSubtotal: Number(line.line_subtotal),
      lineTax: Number(line.line_tax),
      lineDiscount: Number(line.line_discount) || 0,
      discountFactor: Number(line.line_subtotal) > 0 ? Number(line.line_net) / Number(line.line_subtotal) : 1,
      roastPerKg,
      roastTaxRate: Number(line.roast_tax_rate) || 0,
      extraCost: Number(line.extra_cost) || 0,
      receivedKg: received,
      arrivalComplete: complete
    });
    if (complete && c.wastePercent !== null && c.wastePercent > WASTE_CONFIRM && input.confirm_high_waste !== true) {
      throw new CoffeeError(400, `البند «${line.bean_name}»: نسبة الهدر ${c.wastePercent}% غير اعتيادية — أكّدها مع ملاحظة`, {
        code: "high_waste",
        waste_percent: c.wastePercent
      });
    }
    // التحميص قد يكون مؤكدًا من فاتورة درر — نحترم المبالغ المخزَّنة.
    const landedExcl = round2(Number(line.bean_cost_excl) + Number(line.roast_total_net || 0) + Number(line.extra_cost || 0));
    const landedIncl = round2(Number(line.bean_cost_incl) + Number(line.roast_total_net || 0) + Number(line.roast_tax_amount || 0) + Number(line.extra_cost || 0));
    statements.push(sql`
      UPDATE accounting_purchase_invoice_items
      SET received_kg = ${round3(received)}, arrival_date = ${arrivalDate}, arrival_complete = ${complete},
          waste_percent = ${complete ? c.wastePercent : null},
          net_excl_per_kg = ${complete ? round4(landedExcl / received) : null},
          net_incl_per_kg = ${complete ? round4(landedIncl / received) : null},
          arrival_note = ${input.arrival_note ? String(input.arrival_note).trim() : null},
          arrival_recorded_at = (NOW() AT TIME ZONE 'Asia/Riyadh'), arrival_recorded_by = ${actorName},
          arrival_reported_kg = NULL
      WHERE id = ${line.id}
    `);
    if (line.item_id) touchedItems.add(Number(line.item_id));
    summaries.push(`${complete ? "وصول مكتمل" : "وصول جزئي"} ${round3(received)} كغ للبند «${line.bean_name || line.description}» بتاريخ ${arrivalDate}${complete ? ` — هدر ${c.wastePercent}%` : ""}`);
    if (deposit?.enabled && line.item_id) {
      depositPlans.push({
        line,
        received: round3(received),
        arrivalDate
      });
    }
  }
  if (depositPlans.length) {
    const branchId = Number(deposit.branch_id);
    if (!Number.isInteger(branchId) || branchId <= 0) throw new CoffeeError(400, "اختر فرع الإيداع");
    const depositStatements = await planDeposits(invoice, depositPlans, branchId, actor);
    statements.push(...depositStatements);
  }
  statements.push(sql`
    UPDATE accounting_purchase_invoices SET updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh') WHERE id = ${invoice.id}
  `);
  await sql.transaction(statements);
  for (const itemId of touchedItems) await recomputeItemCost(itemId, actor);
  await logPurchaseAudit({
    entityType: "invoice",
    entityId: invoice.id,
    action: canFinalize ? "coffee_arrival" : "coffee_arrival_report",
    summary: `${invoice.invoice_number}: ${summaries.join("؛ ")}`,
    actor
  });
  return {
    touchedItems: [...touchedItems]
  };
}

// إيداع حتمي لكل بند: دفعة واحدة PINV-{invoice}-L{line} تُحدَّث في
// مكانها. الكمية بوحدة الجرد الافتراضية للصنف عبر معامل الكيلو.
// تاريخ الحركة = تاريخ الوصول (created_at أيضًا) حتى يُحسب الرصيد
// بحسب متى وصل البن فعلًا لا متى سُجّل.
async function planDeposits(invoice, plans, branchId, actor) {
  const itemIds = plans.map(p => Number(p.line.item_id));
  const [items, snapshots] = await Promise.all([sql`SELECT id, name, is_active, show_in_inventory FROM items WHERE id = ANY(${itemIds})`, getDefaultInventoryUnitSnapshots(itemIds)]);
  const itemById = new Map(items.map(i => [Number(i.id), i]));
  const fail = await assertItemsEnabledAtBranch(branchId, itemIds, id => itemById.get(Number(id))?.name);
  if (fail) throw new CoffeeError(fail.status, fail.body.error);
  const statements = [];
  for (const plan of plans) {
    const item = itemById.get(Number(plan.line.item_id));
    if (!item || item.is_active === false || item.show_in_inventory === false) {
      throw new CoffeeError(400, `الصنف «${item?.name || plan.line.bean_name}» لا يُدار في المخزون — لا يمكن إيداعه`);
    }
    const kgPerBase = await resolveKgPerBaseUnit(item.id);
    if (!kgPerBase) throw new CoffeeError(400, `الصنف «${item.name}» بلا وحدة كيلو — أضف له وحدة أساس كيلو/جرام أولًا`);
    const snap = snapshotForItem(snapshots, item.id);
    const qty = round3(plan.received / kgPerBase / (Number(snap.unitFactor) || 1));
    const batchId = `PINV-${invoice.id}-L${plan.line.id}`;
    const note = `إيداع من فاتورة مشتريات ${invoice.invoice_number} — ${plan.line.bean_name || item.name} (${plan.received} كغ)`;
    statements.push(sql`
      DELETE FROM purchase_receipts WHERE receipt_batch_id = ${batchId}
    `);
    statements.push(sql`
      INSERT INTO purchase_receipts (
        branch_id, item_id, quantity, received_at, note,
        created_by_employee_id, created_by_employee_name, receipt_batch_id,
        created_at, unit_id, unit_name, unit_factor
      )
      VALUES (
        ${branchId}, ${item.id}, ${qty}, ${plan.arrivalDate}::timestamp, ${note},
        ${actor?.id ? Number(actor.id) : null}, ${actor?.name || null}, ${batchId},
        ${plan.arrivalDate}::timestamp, ${snap.unitId}, ${snap.unitName}, ${snap.unitFactor}
      )
    `);
    statements.push(sql`
      UPDATE accounting_purchase_invoice_items
      SET receipt_batch_id = ${batchId}, deposit_branch_id = ${branchId}, deposited_kg = ${plan.received}
      WHERE id = ${plan.line.id}
    `);
  }
  return statements;
}

// عكس الإيداع لبنود فاتورة (عند الإيقاف أو الطلب الصريح).
async function reverseDeposits(invoiceId, actor) {
  const lines = await sql`
    SELECT id, bean_name, receipt_batch_id, deposited_kg
    FROM accounting_purchase_invoice_items
    WHERE invoice_id = ${invoiceId} AND receipt_batch_id IS NOT NULL
  `;
  if (!lines.length) return 0;
  const statements = [];
  for (const line of lines) {
    statements.push(sql`DELETE FROM purchase_receipts WHERE receipt_batch_id = ${line.receipt_batch_id}`);
    statements.push(sql`
      UPDATE accounting_purchase_invoice_items
      SET receipt_batch_id = NULL, deposit_branch_id = NULL, deposited_kg = NULL
      WHERE id = ${line.id}
    `);
  }
  await sql.transaction(statements);
  await logPurchaseAudit({
    entityType: "invoice",
    entityId: invoiceId,
    action: "coffee_deposit_reversed",
    summary: `عكس إيداع المخزون: ${lines.map(l => `${l.bean_name || l.id} (${l.deposited_kg} كغ)`).join("، ")}`,
    actor
  });
  return lines.length;
}

// ── تكلفة الصنف ───────────────────────────────────────────────────

// تكلفة الصنف = الصافي/كغ شامل الضريبة من آخر فاتورة مكتملة الوصول
// (تاريخ الوصول ← تاريخ الفاتورة ← المعرّف)، محوّلة إلى الوحدة
// الأساسية. تُعاد من الصفر عند كل حدث، لا «تطبيق الفاتورة الجارية».
async function recomputeItemCost(itemId, actor = null) {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [latest] = await sql`
    SELECT li.invoice_id
    FROM accounting_purchase_invoice_items li
    JOIN accounting_purchase_invoices inv ON inv.id = li.invoice_id
    WHERE li.item_id = ${id} AND li.roast_enabled AND li.arrival_complete
      AND li.received_kg > 0 AND inv.is_active AND inv.invoice_kind = 'purchase'
    ORDER BY li.arrival_date DESC NULLS LAST, inv.invoice_date DESC, inv.id DESC, li.id DESC
    LIMIT 1
  `;
  if (!latest) return null;
  // كل بنود هذا الصنف في نفس الفاتورة: متوسط مرجّح بالواصل.
  const [agg] = await sql`
    SELECT SUM(li.landed_incl) AS landed, SUM(li.received_kg) AS received,
           MAX(TO_CHAR(li.arrival_date, 'YYYY-MM-DD')) AS arrival_date, MAX(li.id) AS line_id
    FROM accounting_purchase_invoice_items li
    WHERE li.invoice_id = ${latest.invoice_id} AND li.item_id = ${id}
      AND li.roast_enabled AND li.arrival_complete AND li.received_kg > 0
  `;
  const received = Number(agg?.received) || 0;
  if (received <= 0) return null;
  const netInclPerKg = Number(agg.landed) / received;
  const kgPerBase = await resolveKgPerBaseUnit(id);
  if (!kgPerBase) {
    await logPurchaseAudit({
      entityType: "item",
      entityId: id,
      action: "cost_sync_skipped",
      summary: `لم تُحدَّث تكلفة الصنف #${id}: بلا وحدة أساس كيلو/جرام`,
      actor
    });
    return null;
  }
  const baseCost = round4(netInclPerKg * kgPerBase);
  await sql`
    UPDATE items
    SET cost = ${baseCost}, base_purchase_cost = ${baseCost},
        cost_source = 'invoice', cost_source_invoice_item_id = ${Number(agg.line_id)},
        cost_source_date = ${agg.arrival_date}, cost_updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
    WHERE id = ${id}
  `;
  return baseCost;
}

// ── القوالب المتكررة ──────────────────────────────────────────────

async function anyCoffeeAccount(accountIds = []) {
  const info = await loadBeanInfo(accountIds);
  for (const v of info.values()) if (v.isBean) return true;
  return false;
}

// ── عرض ملخص فاتورة التحميص المرتبطة ──────────────────────────────

async function loadRoastLinks(invoiceIds = []) {
  const ids = invoiceIds.map(Number).filter(n => Number.isInteger(n) && n > 0);
  const map = new Map();
  if (!ids.length) return map;
  const rows = await sql`
    SELECT r.id, r.source_invoice_id, r.invoice_number, r.total_amount, r.paid_amount,
           r.roast_confirmed, r.roast_link_state, r.roaster_reference, r.is_active,
           TO_CHAR(r.due_date, 'YYYY-MM-DD') AS due_date, c.name AS roaster_name
    FROM accounting_purchase_invoices r
    LEFT JOIN accounting_contacts c ON c.id = r.contact_id
    WHERE r.invoice_kind = 'roast' AND r.source_invoice_id = ANY(${ids})
    ORDER BY r.is_active DESC, r.id DESC
  `;
  for (const row of rows) {
    const key = Number(row.source_invoice_id);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

export { CoffeeError as C, LINE_SELECT_COLUMNS as L, anyCoffeeAccount as a, loadRoastChild as b, loadInvoiceLines as c, recomputeItemCost as d, ensureCoffeeSchema as e, reverseDeposits as f, loadRoastLinks as g, applyCoffeeToItems as h, assertRoastSyncAllowed as i, reverseSyncRoastToBean as j, resolveRoaster as k, loadBeanInfo as l, getRoastingAccountId as m, reserveIds as n, insertLineStatement as o, recordArrival as p, planLineReconcile as q, resolveKgPerBaseUnit as r, syncRoastInvoice as s };
