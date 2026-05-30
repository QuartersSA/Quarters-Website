import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Idempotent schema additions; runs cheaply on every request.
async function ensureSchema() {
  try {
    await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS max_stock_threshold INTEGER`;
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
    const itemsWithStock = items.map(item => {
      const branchStock = stockRowsByItem.get(String(item.id)) || [];
      const greenBeanInfo = item.linked_green_bean_id ? lastOrderPriceMap[item.linked_green_bean_id] || null : null;
      const disabledBranches = disabledByItem.get(String(item.id)) || [];
      return {
        ...item,
        branch_stock: branchStock.length > 0 ? branchStock : null,
        disabled_branches: disabledBranches,
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
      show_in_inventory,
      linked_green_bean_id
    } = body;
    if (!name || !name.trim()) {
      return Response.json({
        error: "اسم الصنف مطلوب"
      }, {
        status: 400
      });
    }
    const threshold = min_stock_threshold || 10;
    const maxThreshold = max_stock_threshold !== undefined && max_stock_threshold !== null && max_stock_threshold !== "" ? parseInt(max_stock_threshold) : null;
    const safeMaxThreshold = maxThreshold !== null && Number.isFinite(maxThreshold) && maxThreshold > 0 ? maxThreshold : null;
    const showInInventory = show_in_inventory !== undefined ? show_in_inventory : true;
    // is_active is independent from show_in_inventory. The two used
    // to be coupled (active = showInInventory) which made any
    // purchases-only item (show_in_inventory=false) silently get
    // is_active=false and disappear from EVERY listing including
    // the purchases panel. Now: respect is_active if the caller
    // passes it; otherwise default to true.
    const active = is_active !== undefined ? !!is_active : true;
    const parsedCost = cost !== undefined && cost !== null && cost !== "" ? parseFloat(cost) : null;
    const resolvedCategoryId = category_id !== undefined && category_id !== null && category_id !== "" ? parseInt(category_id) : categoryId !== undefined && categoryId !== null && categoryId !== "" ? parseInt(categoryId) : null;
    const safeCategoryId = resolvedCategoryId && !Number.isNaN(resolvedCategoryId) ? resolvedCategoryId : null;
    const safeLinkedBeanId = linked_green_bean_id !== undefined && linked_green_bean_id !== null && linked_green_bean_id !== "" ? parseInt(linked_green_bean_id) : null;
    await ensureSchema();
    const result = await sql`
      INSERT INTO items (name, name_en, description, image_url, unit, min_stock_threshold, max_stock_threshold, is_active, category_id, cost, show_in_inventory, linked_green_bean_id)
      VALUES (${name.trim()}, ${name_en || null}, ${description || null}, ${image_url || null}, ${unit || null}, ${threshold}, ${safeMaxThreshold}, ${active}, ${safeCategoryId}, ${parsedCost}, ${showInInventory}, ${safeLinkedBeanId})
      RETURNING id, name, name_en, description, image_url, unit, min_stock_threshold, max_stock_threshold, is_active, category_id, cost, show_in_inventory, linked_green_bean_id, created_at
    `;
    const withCategory = await sql`
      SELECT i.*, c.name as category_name, c.name_en as category_name_en, gb.name as linked_green_bean_name
      FROM items i
      LEFT JOIN item_categories c ON c.id = i.category_id
      LEFT JOIN accounting_green_beans gb ON gb.id = i.linked_green_bean_id
      WHERE i.id = ${result[0].id}
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
      show_in_inventory,
      linked_green_bean_id
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
    const safeLinkedBeanId = linked_green_bean_id !== undefined && linked_green_bean_id !== null && linked_green_bean_id !== "" ? parseInt(linked_green_bean_id) : null;
    const maxThreshold = max_stock_threshold !== undefined && max_stock_threshold !== null && max_stock_threshold !== "" ? parseInt(max_stock_threshold) : null;
    const safeMaxThreshold = maxThreshold !== null && Number.isFinite(maxThreshold) && maxThreshold > 0 ? maxThreshold : null;
    await ensureSchema();
    const result = await sql`
      UPDATE items
      SET
        name = ${name.trim()},
        name_en = ${name_en || null},
        description = ${description || null},
        image_url = ${image_url || null},
        unit = ${unit || null},
        min_stock_threshold = ${min_stock_threshold || 10},
        max_stock_threshold = ${safeMaxThreshold},
        is_active = ${active},
        category_id = ${safeCategoryId},
        cost = ${parsedCost},
        show_in_inventory = ${showInInventory},
        linked_green_bean_id = ${safeLinkedBeanId}
      WHERE id = ${id}
      RETURNING id, name, name_en, description, image_url, unit, min_stock_threshold, max_stock_threshold, is_active, category_id, cost, show_in_inventory, linked_green_bean_id, created_at
    `;
    if (result.length === 0) {
      return Response.json({
        error: "الصنف غير موجود"
      }, {
        status: 404
      });
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
