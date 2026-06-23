import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Idempotent schema additions; runs cheaply on every request.
async function ensureSchema() {
  try {
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS max_stock_threshold NUMERIC(12, 3)`;
    await sql`ALTER TABLE items ALTER COLUMN min_stock_threshold TYPE NUMERIC(12, 3) USING min_stock_threshold::numeric`;
    await sql`ALTER TABLE items ALTER COLUMN max_stock_threshold TYPE NUMERIC(12, 3) USING max_stock_threshold::numeric`;
  } catch (e) {
    // Don't fail the request if the migration has already been applied
    // by a concurrent request or if the user lacks ALTER permission.
    console.error("ensureSchema items.max_stock_threshold:", e?.message);
  }

  // Sparse per-branch visibility table. Default = item visible at every
  // branch (no row). INSERT a row only when an admin disables the item
  // at a specific branch; DELETE the row to re-enable. Cascading
  // deletes keep cleanup automatic when items or branches are removed.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS item_branch_disabled (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        disabled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        disabled_by_employee_id INTEGER,
        disabled_by_employee_name TEXT,
        PRIMARY KEY (item_id, branch_id)
      )
    `;
  } catch (e) {
    console.error("ensureSchema item_branch_disabled:", e?.message);
  }

  // ─── Multi-unit support ──────────────────────────────────────────
  // measurement_units = catalog عام (reusable عبر كل الأصناف).
  // item_units = ربط بالصنف + معدّل التحويل.
  // أرقام الكميات في inventory_items / opening_session_items / إلخ
  // كلها تبقى محفوظة بالـ "الوحدة الأساسية" — التحويل يحصل عند الإدخال.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS measurement_units (
        id          SERIAL PRIMARY KEY,
        name_ar     TEXT NOT NULL UNIQUE,
        name_en     TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  } catch (e) {
    console.error("ensureSchema measurement_units:", e?.message);
  }
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS item_units (
        id                SERIAL PRIMARY KEY,
        item_id           INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        unit_id           INTEGER NOT NULL REFERENCES measurement_units(id) ON DELETE RESTRICT,
        conversion_factor NUMERIC(14, 4) NOT NULL CHECK (conversion_factor > 0),
        is_base           BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order        INTEGER NOT NULL DEFAULT 0,
        UNIQUE(item_id, unit_id)
      )
    `;
    await sql`
      ALTER TABLE item_units
      ALTER COLUMN conversion_factor TYPE NUMERIC(20, 8)
      USING conversion_factor::numeric
    `;
  } catch (e) {
    console.error("ensureSchema item_units:", e?.message);
  }

  // Exactly one base unit per item — enforced at the DB level so a
  // racing UPDATE can never leave two rows with is_base=TRUE.
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS item_units_one_base_per_item
        ON item_units(item_id) WHERE is_base = TRUE
    `;
  } catch (e) {
    console.error("ensureSchema item_units_one_base_per_item:", e?.message);
  }

  // Two unit-default pointers on items + a single base_purchase_cost
  // (per the spec the cost lives on the BASE unit only — other units
  // derive their cost as base_cost × conversion_factor).
  try {
    await sql`
      ALTER TABLE items
        ADD COLUMN IF NOT EXISTS default_purchase_unit_id  INTEGER REFERENCES item_units(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS default_inventory_unit_id INTEGER REFERENCES item_units(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS base_purchase_cost        NUMERIC(14, 2)
    `;
  } catch (e) {
    console.error("ensureSchema items multi-unit columns:", e?.message);
  }

  // Auto-seed: every item without an item_units row gets one based on
  // its legacy `items.unit` text field. The legacy text becomes the
  // base unit at factor=1, the catalog row is created on demand, and
  // both default pointers (purchase + inventory) get wired up. Cost
  // copied from items.cost into base_purchase_cost when missing.
  // Runs once per item — the WHERE NOT EXISTS guard keeps it cheap
  // on every subsequent request.
  try {
    await sql`
      WITH legacy AS (
        SELECT
          i.id   AS item_id,
          COALESCE(NULLIF(TRIM(i.unit), ''), 'حبة') AS unit_name,
          i.cost AS legacy_cost
        FROM items i
        WHERE NOT EXISTS (
          SELECT 1 FROM item_units iu WHERE iu.item_id = i.id
        )
      ),
      unit_upsert AS (
        INSERT INTO measurement_units (name_ar)
        SELECT DISTINCT unit_name FROM legacy
        ON CONFLICT (name_ar) DO UPDATE SET name_ar = EXCLUDED.name_ar
        RETURNING id, name_ar
      ),
      all_units AS (
        SELECT id, name_ar FROM unit_upsert
        UNION
        SELECT id, name_ar FROM measurement_units
      ),
      inserted AS (
        INSERT INTO item_units (item_id, unit_id, conversion_factor, is_base, sort_order)
        SELECT l.item_id, u.id, 1, TRUE, 0
        FROM legacy l
        JOIN all_units u ON u.name_ar = l.unit_name
        RETURNING id, item_id
      )
      UPDATE items i
      SET
        default_purchase_unit_id  = COALESCE(i.default_purchase_unit_id,  ins.id),
        default_inventory_unit_id = COALESCE(i.default_inventory_unit_id, ins.id),
        base_purchase_cost        = COALESCE(i.base_purchase_cost, i.cost)
      FROM inserted ins
      WHERE i.id = ins.item_id
    `;
  } catch (e) {
    console.error("ensureSchema auto-seed item_units:", e?.message);
  }
}
async function GET(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_inventory"
    }, {
      role: "Employee",
      permission: "can_do_inventory"
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
    await ensureSchema();
    console.log("Fetching items...");
    const items = await sql`
      SELECT
        i.id,
        i.name,
        i.name_en,
        i.description,
        i.image_url,
        i.unit,
        i.min_stock_threshold,
        i.max_stock_threshold,
        i.is_active,
        i.category_id,
        i.cost,
        i.base_purchase_cost,
        i.default_purchase_unit_id,
        i.default_inventory_unit_id,
        i.show_in_inventory,
        i.linked_green_bean_id,
        c.name as category_name,
        c.name_en as category_name_en,
        gb.name as linked_green_bean_name,
        i.created_at
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN accounting_green_beans gb ON gb.id = i.linked_green_bean_id
      ORDER BY i.created_at DESC
    `;
    console.log("Found items:", items.length);

    // For items linked to green beans, fetch last order price info
    const linkedBeanIds = items.filter(it => it.linked_green_bean_id).map(it => it.linked_green_bean_id);
    let lastOrderPriceMap = {};
    if (linkedBeanIds.length > 0) {
      const uniqueIds = [...new Set(linkedBeanIds)];
      const lastPrices = await sql(`
          SELECT DISTINCT ON (oi.bean_id)
            oi.bean_id,
            oi.computed_final_price_per_kg,
            o.order_date
          FROM accounting_green_bean_order_items oi
          JOIN accounting_green_bean_orders o ON o.id = oi.order_id
          WHERE oi.bean_id = ANY($1::bigint[])
            AND oi.computed_final_price_per_kg IS NOT NULL
          ORDER BY oi.bean_id, o.order_date DESC, oi.id DESC
        `, [uniqueIds]);
      for (const row of lastPrices) {
        lastOrderPriceMap[row.bean_id] = {
          last_order_price_per_kg: row.computed_final_price_per_kg,
          last_order_date: row.order_date
        };
      }
    }

    // Batch per-branch stock for ALL items in a single query.
    // Previously this was Promise.all over items × one query per item
    // (N+1) — at ~30 items × 5 branches that's 30 round-trips. Now: one.
    const itemIds = items.map(it => it.id);
    const stockRowsByItem = new Map();
    if (itemIds.length > 0) {
      // current quantity = last RESET (Daily/Weekly/Opening) +
      // receipts after that reset + signed transfer deltas after that
      // reset. Same formula as /api/items/summary and the timeline
      // report so the numbers stay consistent across endpoints.
      const stockRows = await sql(`
          WITH last_reset AS (
            SELECT DISTINCT ON (ii.item_id, io.branch_id)
              ii.item_id,
              io.branch_id,
              ii.quantity AS inv_quantity,
              COALESCE(io.operation_date, io.created_at) AS op_date
            FROM inventory_items ii
            JOIN inventory_operations io ON io.id = ii.operation_id
            WHERE ii.item_id = ANY($1::bigint[])
              AND io.status = 'Completed'
              AND io.inventory_type IN ('Daily','Weekly','Opening')
            ORDER BY
              ii.item_id,
              io.branch_id,
              COALESCE(io.operation_date, io.created_at) DESC,
              io.id DESC
          ),
          receipts_after AS (
            SELECT
              pr.item_id,
              pr.branch_id,
              SUM(pr.quantity) AS total_received
            FROM purchase_receipts pr
            LEFT JOIN last_reset li
              ON li.item_id = pr.item_id AND li.branch_id = pr.branch_id
            WHERE pr.item_id = ANY($1::bigint[])
              AND (
                li.op_date IS NULL
                OR GREATEST(pr.received_at, pr.created_at) > li.op_date
              )
            GROUP BY pr.item_id, pr.branch_id
          ),
          transfers_after AS (
            SELECT
              ii.item_id,
              ii.branch_id,
              SUM(
                CASE io.transfer_direction
                  WHEN 'in'  THEN  COALESCE(ii.transfer_quantity, 0)
                  WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)
                  ELSE 0
                END
              ) AS net_transfer
            FROM inventory_items ii
            JOIN inventory_operations io ON io.id = ii.operation_id
            LEFT JOIN last_reset li
              ON li.item_id = ii.item_id AND li.branch_id = ii.branch_id
            WHERE ii.item_id = ANY($1::bigint[])
              AND io.status = 'Completed'
              AND io.inventory_type = 'Transfer'
              AND (
                li.op_date IS NULL
                OR COALESCE(io.operation_date, io.created_at) > li.op_date
              )
            GROUP BY ii.item_id, ii.branch_id
          )
          SELECT
            ix.id          AS item_id,
            b.id           AS branch_id,
            b.name         AS branch_name,
            COALESCE(li.inv_quantity, 0)
              + COALESCE(ra.total_received, 0)
              + COALESCE(ta.net_transfer, 0)
            AS quantity
          FROM (SELECT unnest($1::bigint[]) AS id) ix
          CROSS JOIN branches b
          LEFT JOIN last_reset li
            ON li.item_id = ix.id AND li.branch_id = b.id
          LEFT JOIN receipts_after ra
            ON ra.item_id = ix.id AND ra.branch_id = b.id
          LEFT JOIN transfers_after ta
            ON ta.item_id = ix.id AND ta.branch_id = b.id
          LEFT JOIN item_branch_disabled ibd
            ON ibd.item_id = ix.id AND ibd.branch_id = b.id
          WHERE ibd.item_id IS NULL
          ORDER BY ix.id, b.name
        `, [itemIds]);
      for (const row of stockRows) {
        // Key as String so the lookup below tolerates the postgres
        // driver returning the unnested bigint as a string while
        // `items.id` (from a plain SELECT on a `serial` column) comes
        // back as a JS number. Without normalisation `Map.get(5)` after
        // `Map.set("5", …)` misses, branch_stock becomes null for every
        // item, and the items page renders "-" instead of totals.
        const key = String(row.item_id);
        const arr = stockRowsByItem.get(key) || [];
        arr.push({
          branch_id: row.branch_id,
          branch_name: row.branch_name,
          quantity: row.quantity
        });
        stockRowsByItem.set(key, arr);
      }
    }

    // Per-item list of branches where the admin has disabled this item.
    // Used by the items page modal to seed the toggle UI without an
    // extra round-trip per item.
    const disabledByItem = new Map();
    if (itemIds.length > 0) {
      const disabledRows = await sql(`SELECT item_id, branch_id FROM item_branch_disabled
         WHERE item_id = ANY($1::bigint[])`, [itemIds]);
      for (const row of disabledRows) {
        const key = String(row.item_id);
        const arr = disabledByItem.get(key) || [];
        arr.push(Number(row.branch_id));
        disabledByItem.set(key, arr);
      }
    }

    // Multi-unit attachment: every item gets a `units` array
    // [{ id, unit_id, name_ar, name_en, conversion_factor, is_base, sort_order }]
    // ordered by (is_base DESC, sort_order, id) so the base unit is
    // always first — frontend code can take units[0] when it needs
    // the canonical reference.
    const unitsByItem = new Map();
    if (itemIds.length > 0) {
      const unitRows = await sql(`
          SELECT
            iu.id,
            iu.item_id,
            iu.unit_id,
            iu.conversion_factor,
            iu.is_base,
            iu.sort_order,
            mu.name_ar,
            mu.name_en
          FROM item_units iu
          JOIN measurement_units mu ON mu.id = iu.unit_id
          WHERE iu.item_id = ANY($1::bigint[])
          ORDER BY iu.item_id, iu.is_base DESC, iu.sort_order, iu.id
        `, [itemIds]);
      for (const row of unitRows) {
        const key = String(row.item_id);
        const arr = unitsByItem.get(key) || [];
        arr.push({
          id: Number(row.id),
          unit_id: Number(row.unit_id),
          name_ar: row.name_ar,
          name_en: row.name_en,
          conversion_factor: Number(row.conversion_factor),
          is_base: !!row.is_base,
          sort_order: Number(row.sort_order)
        });
        unitsByItem.set(key, arr);
      }
    }
    const itemsWithStock = items.map(item => {
      const branchStock = stockRowsByItem.get(String(item.id)) || [];
      const greenBeanInfo = item.linked_green_bean_id ? lastOrderPriceMap[item.linked_green_bean_id] || null : null;
      const disabledBranches = disabledByItem.get(String(item.id)) || [];
      const units = unitsByItem.get(String(item.id)) || [];
      const baseUnit = units.find(u => u.is_base) || units[0] || null;
      return {
        ...item,
        branch_stock: branchStock.length > 0 ? branchStock : null,
        disabled_branches: disabledBranches,
        units,
        base_unit: baseUnit,
        last_order_price_per_kg: greenBeanInfo?.last_order_price_per_kg || null,
        last_order_date: greenBeanInfo?.last_order_date || null
      };
    });
    console.log("Returning items with stock:", itemsWithStock.length);
    return Response.json(itemsWithStock);
  } catch (error) {
    console.error("Error fetching items:", error);
    return Response.json({
      error: "Failed to fetch items",
      details: error.message
    }, {
      status: 500
    });
  }
}

// Resolve a measurement_units.id for a unit-row payload. Inserts a
// catalog row if `unit_id` wasn't provided and `name_ar` doesn't
// already exist. Returns the catalog id.
async function resolveMeasurementUnitId({
  unit_id,
  name_ar,
  name_en
}) {
  if (unit_id) {
    const n = parseInt(unit_id);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const trimmedAr = (name_ar || "").trim();
  if (!trimmedAr) {
    throw new Error("اسم الوحدة مطلوب");
  }
  const trimmedEn = name_en ? String(name_en).trim() || null : null;
  // INSERT ... ON CONFLICT (name_ar) DO UPDATE so RETURNING fires
  // on both the new-row and existing-row paths. A plain DO NOTHING
  // returns zero rows on conflict and forces a second SELECT.
  const rows = await sql`
    INSERT INTO measurement_units (name_ar, name_en)
    VALUES (${trimmedAr}, ${trimmedEn})
    ON CONFLICT (name_ar)
      DO UPDATE SET name_en = COALESCE(measurement_units.name_en, EXCLUDED.name_en)
    RETURNING id
  `;
  return Number(rows[0].id);
}

// Replace every item_units row for `itemId` from the supplied
// `units` array, then point the two default_* columns at whichever
// row carried the matching flag. Returns nothing — caller re-reads
// the item.
async function writeItemUnits(itemId, units) {
  if (!Array.isArray(units) || units.length === 0) return;

  // Validation: exactly one base, every factor > 0.
  const baseCount = units.filter(u => u.is_base).length;
  if (baseCount !== 1) {
    throw new Error("يجب اختيار وحدة أساسية واحدة بالضبط");
  }
  if (units.filter(u => u.default_purchase).length !== 1) {
    throw new Error("يجب اختيار وحدة مشتريات افتراضية واحدة");
  }
  if (units.filter(u => u.default_inventory).length !== 1) {
    throw new Error("يجب اختيار وحدة مخزون افتراضية واحدة");
  }
  for (const u of units) {
    const f = Number(u.conversion_factor);
    if (!Number.isFinite(f) || f <= 0) {
      throw new Error("معدّل التحويل يجب أن يكون رقم موجب");
    }
    if (u.is_base && Math.abs(f - 1) > 1e-6) {
      throw new Error("معدّل التحويل للوحدة الأساسية يجب أن يكون 1");
    }
  }
  const resolvedUnits = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const unitId = await resolveMeasurementUnitId({
      unit_id: u.unit_id,
      name_ar: u.name_ar,
      name_en: u.name_en
    });
    resolvedUnits.push({
      unit_id: unitId,
      conversion_factor: Number(u.conversion_factor),
      is_base: !!u.is_base,
      sort_order: i,
      default_purchase: !!u.default_purchase,
      default_inventory: !!u.default_inventory
    });
  }
  if (new Set(resolvedUnits.map(unitRow => unitRow.unit_id)).size !== resolvedUnits.length) {
    throw new Error("لا يمكن إضافة وحدة القياس نفسها مرتين");
  }
  const generatedIds = await sql`
    SELECT nextval(pg_get_serial_sequence('item_units', 'id'))::integer AS id
    FROM generate_series(1, ${resolvedUnits.length}::integer)
  `;
  if (generatedIds.length !== resolvedUnits.length) {
    throw new Error("Failed to reserve unit identifiers");
  }
  const rowsWithIds = resolvedUnits.map((unitRow, index) => ({
    ...unitRow,
    id: Number(generatedIds[index].id)
  }));
  const defaultPurchaseId = rowsWithIds.find(unitRow => unitRow.default_purchase).id;
  const defaultInventoryId = rowsWithIds.find(unitRow => unitRow.default_inventory).id;
  const statements = [sql`
      UPDATE items
      SET default_purchase_unit_id = NULL,
          default_inventory_unit_id = NULL
      WHERE id = ${itemId}
    `, sql`DELETE FROM item_units WHERE item_id = ${itemId}`, ...rowsWithIds.map(unitRow => sql`
        INSERT INTO item_units
          (id, item_id, unit_id, conversion_factor, is_base, sort_order)
        VALUES (
          ${unitRow.id}, ${itemId}, ${unitRow.unit_id},
          ${unitRow.conversion_factor}, ${unitRow.is_base},
          ${unitRow.sort_order}
        )
      `), sql`
      UPDATE items
      SET default_purchase_unit_id = ${defaultPurchaseId},
          default_inventory_unit_id = ${defaultInventoryId}
      WHERE id = ${itemId}
    `];

  // The Neon transaction keeps the item valid if any insert fails.
  await sql.transaction(statements);
}
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json();
    console.log("Creating item with data:", body);
    const {
      name,
      name_en,
      description,
      image_url,
      unit,
      min_stock_threshold,
      max_stock_threshold,
      is_active,
      category_id,
      categoryId,
      cost,
      base_purchase_cost,
      show_in_inventory,
      linked_green_bean_id,
      units
    } = body;
    if (!name || !name.trim()) {
      return Response.json({
        error: "اسم الصنف مطلوب"
      }, {
        status: 400
      });
    }
    const parsedThreshold = Number(min_stock_threshold ?? 10);
    const threshold = Number.isFinite(parsedThreshold) && parsedThreshold >= 0 ? parsedThreshold : 10;
    const maxThreshold = max_stock_threshold !== undefined && max_stock_threshold !== null && max_stock_threshold !== "" ? Number(max_stock_threshold) : null;
    const safeMaxThreshold = maxThreshold !== null && Number.isFinite(maxThreshold) && maxThreshold >= 0 ? maxThreshold : null;
    const showInInventory = show_in_inventory !== undefined ? show_in_inventory : true;
    // is_active is independent from show_in_inventory. The two used
    // to be coupled (active = showInInventory) which made any
    // purchases-only item (show_in_inventory=false) silently get
    // is_active=false and disappear from EVERY listing including
    // the purchases panel. Now: respect is_active if the caller
    // passes it; otherwise default to true.
    const active = is_active !== undefined ? !!is_active : true;
    const parsedCost = cost !== undefined && cost !== null && cost !== "" ? parseFloat(cost) : null;

    // base_purchase_cost = canonical cost per ONE base unit. Falls
    // back to `cost` so older callers keep working.
    const parsedBaseCost = base_purchase_cost !== undefined && base_purchase_cost !== null && base_purchase_cost !== "" ? parseFloat(base_purchase_cost) : parsedCost;
    const resolvedCategoryId = category_id !== undefined && category_id !== null && category_id !== "" ? parseInt(category_id) : categoryId !== undefined && categoryId !== null && categoryId !== "" ? parseInt(categoryId) : null;
    const safeCategoryId = resolvedCategoryId && !Number.isNaN(resolvedCategoryId) ? resolvedCategoryId : null;
    const safeLinkedBeanId = linked_green_bean_id !== undefined && linked_green_bean_id !== null && linked_green_bean_id !== "" ? parseInt(linked_green_bean_id) : null;
    await ensureSchema();
    const result = await sql`
      INSERT INTO items (name, name_en, description, image_url, unit, min_stock_threshold, max_stock_threshold, is_active, category_id, cost, base_purchase_cost, show_in_inventory, linked_green_bean_id)
      VALUES (${name.trim()}, ${name_en || null}, ${description || null}, ${image_url || null}, ${unit || null}, ${threshold}, ${safeMaxThreshold}, ${active}, ${safeCategoryId}, ${parsedCost}, ${parsedBaseCost}, ${showInInventory}, ${safeLinkedBeanId})
      RETURNING id, name, name_en, description, image_url, unit, min_stock_threshold, max_stock_threshold, is_active, category_id, cost, base_purchase_cost, show_in_inventory, linked_green_bean_id, created_at
    `;
    const newItemId = result[0].id;

    // Write units (multi-unit panel). Empty/missing units array →
    // ensureSchema auto-seed handles it on the next request, so no
    // hard failure here.
    if (Array.isArray(units) && units.length > 0) {
      try {
        await writeItemUnits(newItemId, units);
      } catch (e) {
        // Roll back the items row so we never leave an orphaned
        // item with no units when the units payload was bad.
        await sql`DELETE FROM items WHERE id = ${newItemId}`;
        return Response.json({
          error: e.message
        }, {
          status: 400
        });
      }
    }
    const withCategory = await sql`
      SELECT i.*, c.name as category_name, c.name_en as category_name_en, gb.name as linked_green_bean_name
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN accounting_green_beans gb ON gb.id = i.linked_green_bean_id
      WHERE i.id = ${newItemId}
    `;
    console.log("Item created successfully:", withCategory[0]);
    return Response.json(withCategory[0], {
      status: 201
    });
  } catch (error) {
    console.error("Error creating item:", error);
    return Response.json({
      error: "Failed to create item",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function PUT(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const body = await request.json();
    console.log("Updating item with data:", body);
    const {
      id,
      name,
      name_en,
      description,
      image_url,
      unit,
      min_stock_threshold,
      max_stock_threshold,
      is_active,
      category_id,
      categoryId,
      cost,
      base_purchase_cost,
      show_in_inventory,
      linked_green_bean_id,
      units
    } = body;
    if (!id) {
      return Response.json({
        error: "معرّف الصنف مطلوب"
      }, {
        status: 400
      });
    }
    if (!name || !name.trim()) {
      return Response.json({
        error: "اسم الصنف مطلوب"
      }, {
        status: 400
      });
    }
    const resolvedCategoryId = category_id !== undefined && category_id !== null && category_id !== "" ? parseInt(category_id) : categoryId !== undefined && categoryId !== null && categoryId !== "" ? parseInt(categoryId) : null;
    const safeCategoryId = resolvedCategoryId && !Number.isNaN(resolvedCategoryId) ? resolvedCategoryId : null;
    const showInInventory = show_in_inventory !== undefined ? show_in_inventory : true;
    // Same decoupling on UPDATE — respect explicit is_active so a
    // purchases-only item stays active even though it doesn't show
    // up in inventory.
    const active = is_active !== undefined ? !!is_active : true;
    const parsedCost = cost !== undefined && cost !== null && cost !== "" ? parseFloat(cost) : null;
    const parsedBaseCost = base_purchase_cost !== undefined && base_purchase_cost !== null && base_purchase_cost !== "" ? parseFloat(base_purchase_cost) : parsedCost;
    const safeLinkedBeanId = linked_green_bean_id !== undefined && linked_green_bean_id !== null && linked_green_bean_id !== "" ? parseInt(linked_green_bean_id) : null;
    const maxThreshold = max_stock_threshold !== undefined && max_stock_threshold !== null && max_stock_threshold !== "" ? Number(max_stock_threshold) : null;
    const safeMaxThreshold = maxThreshold !== null && Number.isFinite(maxThreshold) && maxThreshold >= 0 ? maxThreshold : null;
    const parsedMinThreshold = Number(min_stock_threshold ?? 10);
    const safeMinThreshold = Number.isFinite(parsedMinThreshold) && parsedMinThreshold >= 0 ? parsedMinThreshold : 10;
    await ensureSchema();
    const result = await sql`
      UPDATE items
      SET
        name = ${name.trim()},
        name_en = ${name_en || null},
        description = ${description || null},
        image_url = ${image_url || null},
        unit = ${unit || null},
        min_stock_threshold = ${safeMinThreshold},
        max_stock_threshold = ${safeMaxThreshold},
        is_active = ${active},
        category_id = ${safeCategoryId},
        cost = ${parsedCost},
        base_purchase_cost = ${parsedBaseCost},
        show_in_inventory = ${showInInventory},
        linked_green_bean_id = ${safeLinkedBeanId}
      WHERE id = ${id}
      RETURNING id, name, name_en, description, image_url, unit, min_stock_threshold, max_stock_threshold, is_active, category_id, cost, base_purchase_cost, show_in_inventory, linked_green_bean_id, created_at
    `;
    if (result.length === 0) {
      return Response.json({
        error: "الصنف غير موجود"
      }, {
        status: 404
      });
    }

    // Replace per-item units if the caller supplied any. Omitted →
    // existing units stay untouched (partial-update semantics).
    if (Array.isArray(units) && units.length > 0) {
      try {
        await writeItemUnits(id, units);
      } catch (e) {
        return Response.json({
          error: e.message
        }, {
          status: 400
        });
      }
    }
    const withCategory = await sql`
      SELECT i.*, c.name as category_name, c.name_en as category_name_en, gb.name as linked_green_bean_name
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN accounting_green_beans gb ON gb.id = i.linked_green_bean_id
      WHERE i.id = ${id}
    `;
    console.log("Item updated successfully:", withCategory[0]);
    return Response.json(withCategory[0]);
  } catch (error) {
    console.error("Error updating item:", error);
    return Response.json({
      error: "Failed to update item",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const {
      id
    } = await request.json();
    console.log("Deleting item with id:", id);
    if (!id) {
      return Response.json({
        error: "معرّف الصنف مطلوب"
      }, {
        status: 400
      });
    }
    const inventoryCheck = await sql`
      SELECT COUNT(*) as count
      FROM inventory_items
      WHERE item_id = ${id}
    `;
    if (parseInt(inventoryCheck[0].count) > 0) {
      return Response.json({
        error: "لا يمكن حذف الصنف لأنه مرتبط بعمليات جرد"
      }, {
        status: 400
      });
    }
    const result = await sql`
      DELETE FROM items
      WHERE id = ${id}
      RETURNING id
    `;
    if (result.length === 0) {
      return Response.json({
        error: "الصنف غير موجود"
      }, {
        status: 404
      });
    }
    console.log("Item deleted successfully");
    return Response.json({
      message: "تم حذف الصنف بنجاح"
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    return Response.json({
      error: "Failed to delete item",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST, PUT };
