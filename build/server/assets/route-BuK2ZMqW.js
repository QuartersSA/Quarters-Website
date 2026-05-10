import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import { s as sendWhatsAppViaWasender } from './wasender-Cn2_RTrC.js';
import '@neondatabase/serverless';
import 'crypto';

async function notifyAdminsWhatsAppInventoryTransfer({
  fromBranchName,
  toBranchName,
  employeeName,
  transferNumber,
  items,
  note
}) {
  try {
    const admins = await sql`
      SELECT id, name, phone
      FROM employees
      WHERE role = 'Admin'
        AND COALESCE(can_manage_inventory, false) = true
        AND COALESCE(notify_inventory_operation_wa, false) = true
        AND phone IS NOT NULL
        AND TRIM(phone) <> ''
      ORDER BY id ASC
      LIMIT 25
    `;
    if (!admins.length) {
      return {
        ok: true,
        skipped: true,
        reason: "no_admin_phones"
      };
    }
    const itemsText = Array.isArray(items) ? items.slice(0, 15).map(it => `- ${it.itemName || "صنف"} (${it.quantity})`).join("\n") : "";
    const lines = ["تحويل بين الفروع", transferNumber ? `رقم التحويل: ${transferNumber}` : null, fromBranchName ? `من: ${fromBranchName}` : null, toBranchName ? `إلى: ${toBranchName}` : null, employeeName ? `بواسطة: ${employeeName}` : null, note ? `ملاحظة: ${note}` : null, itemsText ? `الأصناف:\n${itemsText}` : null, Array.isArray(items) && items.length > 15 ? `… والمزيد (${items.length - 15})` : null].filter(Boolean);
    const text = lines.join("\n").trim();
    const results = await Promise.all(admins.map(async a => {
      const r = await sendWhatsAppViaWasender({
        to: a.phone,
        text
      });
      if (!r.ok) {
        console.error("Inventory Transfer WhatsApp notify failed", {
          adminId: a.id,
          error: r.error,
          details: r.details
        });
      }
      return {
        adminId: a.id,
        ok: r.ok
      };
    }));
    return {
      ok: true,
      results
    };
  } catch (e) {
    console.error("notifyAdminsWhatsAppInventoryTransfer error", e);
    return {
      ok: false,
      error: "notify_failed"
    };
  }
}
async function getCurrentQuantitiesForBranch({
  txn,
  branchId,
  itemIds
}) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return new Map();
  }
  const safeBranchId = Number(branchId);
  if (!Number.isFinite(safeBranchId) || safeBranchId <= 0) {
    throw new Error("Invalid branchId");
  }
  const uniqueIds = Array.from(new Set(itemIds.map(x => Number(x)).filter(x => Number.isFinite(x))));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  // current stock = last Daily/Weekly/Transfer/Opening inventory count + SUM(receipts after it)
  // Fixed: added io.id DESC to break ties when operation_date is the same
  const rows = await txn(`
      SELECT
        i.id AS item_id,
        COALESCE(last_inv.inv_quantity, 0)
          + COALESCE(receipts_after.total_received, 0) AS current_quantity
      FROM items i

      LEFT JOIN LATERAL (
        SELECT ii.quantity AS inv_quantity, COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = i.id
          AND io.branch_id = $1
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily', 'Weekly', 'Transfer', 'Opening')
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
        LIMIT 1
      ) last_inv ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(pr.quantity), 0) AS total_received
        FROM purchase_receipts pr
        WHERE pr.item_id = i.id
          AND pr.branch_id = $1
          AND (
            last_inv.op_date IS NULL
            OR pr.received_at > last_inv.op_date
          )
      ) receipts_after ON true

      WHERE i.id = ANY($2::int[])
    `, [safeBranchId, uniqueIds]);
  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.item_id), Number(r.current_quantity) || 0);
  }

  // ensure any id that didn't exist comes back as 0
  for (const id of uniqueIds) {
    if (!map.has(id)) {
      map.set(id, 0);
    }
  }
  return map;
}

/**
 * Safely parse and validate operationDate.
 * Returns a valid ISO timestamp string or null.
 */
function parseOperationDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Try parsing as Date
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [{
      role: "Admin",
      permission: "can_manage_inventory"
    }, {
      role: "Admin",
      permission: "can_manage_accounting"
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
    const body = await request.json();
    const {
      fromBranchId,
      toBranchId,
      items,
      note,
      operationDate
    } = body;
    const fromId = Number(fromBranchId);
    const toId = Number(toBranchId);
    if (!Number.isFinite(fromId) || fromId <= 0) {
      return Response.json({
        error: "فرع المرسل مطلوب"
      }, {
        status: 400
      });
    }
    if (!Number.isFinite(toId) || toId <= 0) {
      return Response.json({
        error: "فرع المستقبل مطلوب"
      }, {
        status: 400
      });
    }
    if (fromId === toId) {
      return Response.json({
        error: "لا يمكن التحويل لنفس الفرع"
      }, {
        status: 400
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({
        error: "اختر صنف واحد على الأقل"
      }, {
        status: 400
      });
    }
    const cleanedItems = [];
    for (const it of items) {
      const itemId = Number(it?.itemId);
      const quantity = Number(it?.quantity);
      if (!Number.isFinite(itemId) || itemId <= 0) {
        continue;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        continue;
      }

      // Round to 3 decimal places (matches NUMERIC(12,3) precision)
      cleanedItems.push({
        itemId,
        quantity: Math.round(quantity * 1000) / 1000
      });
    }
    if (cleanedItems.length === 0) {
      return Response.json({
        error: "الكميات غير صحيحة"
      }, {
        status: 400
      });
    }
    const transferNumber = `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const actingEmployeeId = auth.user?.id || null;

    // Validate branches exist
    const [fromBranch] = await sql`
      SELECT id, name FROM branches WHERE id = ${fromId}
    `;
    const [toBranch] = await sql`
      SELECT id, name FROM branches WHERE id = ${toId}
    `;
    if (!fromBranch) {
      return Response.json({
        error: "فرع المرسل غير موجود"
      }, {
        status: 400
      });
    }
    if (!toBranch) {
      return Response.json({
        error: "فرع المستقبل غير موجود"
      }, {
        status: 400
      });
    }

    // Validate items exist + get names for message
    const itemIds = cleanedItems.map(x => x.itemId);
    const itemRows = await sql(`SELECT id, name FROM items WHERE id = ANY($1::int[])`, [itemIds]);
    const itemNameById = new Map(itemRows.map(r => [Number(r.id), String(r.name)]));
    for (const it of cleanedItems) {
      if (!itemNameById.has(it.itemId)) {
        return Response.json({
          error: `الصنف غير موجود (id: ${it.itemId})`
        }, {
          status: 400
        });
      }
    }
    const fromQtyMap = await getCurrentQuantitiesForBranch({
      txn: sql,
      branchId: fromId,
      itemIds
    });
    const toQtyMap = await getCurrentQuantitiesForBranch({
      txn: sql,
      branchId: toId,
      itemIds
    });

    // Validate available qty in from-branch
    for (const it of cleanedItems) {
      const current = Number(fromQtyMap.get(it.itemId) || 0);
      if (current < it.quantity) {
        const name = itemNameById.get(it.itemId) || "الصنف";
        return Response.json({
          error: `كمية غير كافية في فرع المرسل للصنف: ${name} (المتاح: ${current})`
        }, {
          status: 400
        });
      }
    }

    // Parse operation date safely — if invalid, use current timestamp
    const parsedDate = parseOperationDate(operationDate);

    // Create two operations (out + in)
    const [opOut] = await sql(`INSERT INTO inventory_operations (
        inventory_number, branch_id, employee_id, inventory_type, status,
        transfer_branch_id, transfer_direction, note, operation_date
      )
      VALUES (
        $1, $2, $3, 'Transfer', 'Completed',
        $4, 'out', $5, COALESCE($6::timestamp, CURRENT_TIMESTAMP)
      )
      RETURNING id, inventory_number, branch_id, employee_id, inventory_type, status, created_at, transfer_branch_id, transfer_direction, note, operation_date`, [transferNumber, fromId, actingEmployeeId, toId, note || null, parsedDate]);
    const [opIn] = await sql(`INSERT INTO inventory_operations (
        inventory_number, branch_id, employee_id, inventory_type, status,
        transfer_branch_id, transfer_direction, note, operation_date
      )
      VALUES (
        $1, $2, $3, 'Transfer', 'Completed',
        $4, 'in', $5, COALESCE($6::timestamp, CURRENT_TIMESTAMP)
      )
      RETURNING id, inventory_number, branch_id, employee_id, inventory_type, status, created_at, transfer_branch_id, transfer_direction, note, operation_date`, [transferNumber, toId, actingEmployeeId, fromId, note || null, parsedDate]);

    // Insert only the affected items with their NEW absolute quantities.
    // Quantity column is NUMERIC(12,3) — preserves up to 3 decimal places.
    for (const it of cleanedItems) {
      const fromCurrent = Number(fromQtyMap.get(it.itemId) || 0);
      const toCurrent = Number(toQtyMap.get(it.itemId) || 0);
      const fromNew = Math.round((fromCurrent - it.quantity) * 1000) / 1000;
      const toNew = Math.round((toCurrent + it.quantity) * 1000) / 1000;
      await sql`
        INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
        VALUES (${opOut.id}, ${it.itemId}, ${fromNew}, ${fromId})
      `;
      await sql`
        INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
        VALUES (${opIn.id}, ${it.itemId}, ${toNew}, ${toId})
      `;
    }
    const resultItems = cleanedItems.map(it => ({
      itemId: it.itemId,
      itemName: itemNameById.get(it.itemId) || "",
      quantity: it.quantity
    }));
    const result = {
      ok: true,
      transferNumber,
      fromBranch,
      toBranch,
      items: resultItems,
      operations: [opOut, opIn]
    };

    // Best-effort WhatsApp notify (never blocks saving)
    const actingId = Number(auth.user?.id);
    let employeeName = "";
    if (Number.isFinite(actingId) && actingId > 0) {
      const [emp] = await sql`SELECT id, name FROM employees WHERE id = ${actingId}`;
      employeeName = emp?.name || "";
    }
    notifyAdminsWhatsAppInventoryTransfer({
      fromBranchName: result?.fromBranch?.name || "—",
      toBranchName: result?.toBranch?.name || "—",
      employeeName,
      transferNumber: result.transferNumber,
      items: result.items,
      note: note || ""
    }).catch(e => console.error("notify admins whatsapp error", e));
    return Response.json(result, {
      status: 201
    });
  } catch (error) {
    console.error("Error creating inventory transfer:", error);
    const detail = error?.message ? String(error.message).slice(0, 200) : "";
    return Response.json({
      error: `فشل في تحويل المخزون${detail ? ": " + detail : ""}`
    }, {
      status: 500
    });
  }
}

export { POST };
