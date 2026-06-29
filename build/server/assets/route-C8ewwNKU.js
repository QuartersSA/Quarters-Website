import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { a as assertItemsEnabledAtBranch } from './branchVisibility-CLODkXYw.js';
import { e as ensureInventoryUnitSnapshotSchema, g as getDefaultInventoryUnitSnapshots, s as snapshotForItem } from './inventoryUnitSnapshots-T_VBWOHv.js';
import { v as validateBusinessDate } from './dateUtils-FqivhP-u.js';
import '@neondatabase/serverless';
import 'crypto';

/**
 * Validate a received_at value.
 * Returns the parsed Date or null when out of business range.
 */
function validateReceivedAt(value) {
  const result = validateBusinessDate(value, {
    allowFuture: 1,
    minYear: 2020
  });
  return result.ok ? result.date : null;
}
async function GET(request) {
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
    await ensureInventoryUnitSnapshotSchema();
    const {
      searchParams
    } = new URL(request.url);
    const branchIdRaw = searchParams.get("branchId");
    const itemIdRaw = searchParams.get("itemId");
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const branchId = branchIdRaw ? parseInt(branchIdRaw) : null;
    const itemId = itemIdRaw ? parseInt(itemIdRaw) : null;
    const values = [];
    let where = "WHERE 1=1";
    let idx = 1;
    if (branchId && !Number.isNaN(branchId)) {
      where += ` AND pr.branch_id = $${idx}`;
      values.push(branchId);
      idx += 1;
    }
    if (itemId && !Number.isNaN(itemId)) {
      where += ` AND pr.item_id = $${idx}`;
      values.push(itemId);
      idx += 1;
    }
    const hasFromTo = !!fromRaw && !!toRaw;
    if (hasFromTo) {
      where += ` AND (pr.received_at AT TIME ZONE 'Asia/Riyadh')::date >= $${idx}::date`;
      values.push(fromRaw);
      idx += 1;
      where += ` AND (pr.received_at AT TIME ZONE 'Asia/Riyadh')::date <= $${idx}::date`;
      values.push(toRaw);
      idx += 1;
    }
    const query = `
      SELECT
        pr.id,
        pr.branch_id,
        b.name as branch_name,
        pr.item_id,
        i.name as item_name,
        COALESCE(pr.unit_name, i.unit) as item_unit,
        pr.quantity,
        pr.received_at,
        pr.note,
        pr.receipt_batch_id,
        pr.created_at,
        pr.created_by_employee_id,
        COALESCE(pr.created_by_employee_name, e.name) as created_by_employee_name
      FROM purchase_receipts pr
      LEFT JOIN branches b ON b.id = pr.branch_id
      LEFT JOIN items i ON i.id = pr.item_id
      LEFT JOIN employees e ON e.id = pr.created_by_employee_id
      ${where}
      ORDER BY pr.received_at DESC, pr.id DESC
    `;
    const rows = await sql(query, values);
    return Response.json({
      rows
    });
  } catch (error) {
    console.error("Error listing purchase receipts:", error);
    return Response.json({
      error: "Failed to list purchase receipts"
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
    await ensureInventoryUnitSnapshotSchema();
    const body = await request.json();

    // ── Multi-item mode ──
    if (Array.isArray(body.items) && body.items.length > 0) {
      const {
        branchId,
        receivedAt,
        note,
        items
      } = body;
      const branchIdNum = parseInt(branchId);
      if (!branchIdNum || Number.isNaN(branchIdNum)) {
        return Response.json({
          error: "معرّف الفرع مطلوب"
        }, {
          status: 400
        });
      }
      if (!receivedAt) {
        return Response.json({
          error: "تاريخ الوارد مطلوب"
        }, {
          status: 400
        });
      }
      if (!validateReceivedAt(receivedAt)) {
        return Response.json({
          error: "تاريخ الوارد غير صالح (يجب أن يكون بين 2020 واليوم)"
        }, {
          status: 400
        });
      }
      if (items.length > 200) {
        return Response.json({
          error: "الحد الأقصى 200 صنف"
        }, {
          status: 400
        });
      }
      const cleanedItems = [];
      for (const it of items) {
        const itemId = parseInt(it?.itemId);
        const qty = Number(it?.quantity);
        if (!itemId || Number.isNaN(itemId)) continue;
        if (!Number.isFinite(qty) || qty <= 0) continue;
        cleanedItems.push({
          itemId,
          quantity: qty
        });
      }
      if (cleanedItems.length === 0) {
        return Response.json({
          error: "لا توجد أصناف صالحة"
        }, {
          status: 400
        });
      }

      // Branch-visibility guard: reject receipts for items disabled at
      // this branch. Otherwise the row writes successfully but the
      // items API hides it via the disabled-pair filter — the stock
      // simply vanishes from totals.
      {
        const fail = await assertItemsEnabledAtBranch(branchIdNum, cleanedItems.map(c => c.itemId));
        if (fail) return Response.json(fail.body, {
          status: fail.status
        });
      }
      const actingEmployeeId = auth.user?.id || null;
      const actingEmployeeName = auth.user?.name || null;

      // Generate a single batch id for all items in this receipt
      const batchId = `RB-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const snapshots = await getDefaultInventoryUnitSnapshots(cleanedItems.map(it => it.itemId));
      const itemIds = [];
      const quantities = [];
      const unitIds = [];
      const unitNames = [];
      const unitFactors = [];
      for (const it of cleanedItems) {
        const snap = snapshotForItem(snapshots, it.itemId);
        itemIds.push(it.itemId);
        quantities.push(Math.round(it.quantity * 1000) / 1000);
        unitIds.push(snap.unitId);
        unitNames.push(snap.unitName);
        unitFactors.push(snap.unitFactor);
      }

      // Storage = real moment. `receivedAt` is a Riyadh wall-clock
      // string from the picker; pin the cast to Asia/Riyadh so the
      // recorded moment matches the user's intent regardless of the
      // PG session TZ. `created_at` records the actual insertion
      // moment.
      const receipts = await sql(`
          WITH rows AS (
            SELECT
              unnest($7::int[]) AS item_id,
              unnest($8::numeric[]) AS quantity,
              unnest($9::int[]) AS unit_id,
              unnest($10::text[]) AS unit_name,
              unnest($11::numeric[]) AS unit_factor
          )
          INSERT INTO purchase_receipts (
            branch_id, item_id, quantity, received_at, note,
            created_by_employee_id, created_by_employee_name, receipt_batch_id,
            created_at, unit_id, unit_name, unit_factor
          )
          SELECT
            $1, rows.item_id, rows.quantity,
            $2::timestamp AT TIME ZONE 'Asia/Riyadh',
            $3, $4, $5, $6, NOW(),
            rows.unit_id, rows.unit_name, rows.unit_factor
          FROM rows
          RETURNING id, branch_id, item_id, quantity, received_at, note,
                    created_at, created_by_employee_id, created_by_employee_name,
                    receipt_batch_id, unit_id, unit_name, unit_factor
        `, [branchIdNum, receivedAt, note || null, actingEmployeeId, actingEmployeeName, batchId, itemIds, quantities, unitIds, unitNames, unitFactors]);
      return Response.json({
        receipts,
        count: receipts.length,
        batchId
      }, {
        status: 201
      });
    }

    // ── Single-item mode (legacy) ──
    const {
      branchId,
      itemId,
      quantity,
      receivedAt,
      note
    } = body;
    const branchIdNum = parseInt(branchId);
    const itemIdNum = parseInt(itemId);
    const qtyNum = Number(quantity);
    if (!branchIdNum || Number.isNaN(branchIdNum)) {
      return Response.json({
        error: "معرّف الفرع مطلوب"
      }, {
        status: 400
      });
    }
    if (!itemIdNum || Number.isNaN(itemIdNum)) {
      return Response.json({
        error: "معرّف الصنف مطلوب"
      }, {
        status: 400
      });
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      return Response.json({
        error: "الكمية يجب أن تكون رقم أكبر من صفر"
      }, {
        status: 400
      });
    }
    if (!receivedAt) {
      return Response.json({
        error: "تاريخ الوارد مطلوب"
      }, {
        status: 400
      });
    }
    if (!validateReceivedAt(receivedAt)) {
      return Response.json({
        error: "تاريخ الوارد غير صالح (يجب أن يكون بين 2020 واليوم)"
      }, {
        status: 400
      });
    }

    // Branch-visibility guard (single-item legacy path).
    {
      const fail = await assertItemsEnabledAtBranch(branchIdNum, [itemIdNum]);
      if (fail) return Response.json(fail.body, {
        status: fail.status
      });
    }
    const actingEmployeeId = auth.user?.id || null;
    const actingEmployeeName = auth.user?.name || null;
    const snapshots = await getDefaultInventoryUnitSnapshots([itemIdNum]);
    const unitSnap = snapshotForItem(snapshots, itemIdNum);

    // Storage = real moment (single-item legacy path). `received_at`
    // is a Riyadh wall-clock string from the picker, pinned to
    // Asia/Riyadh on the cast so the moment is correct independent of
    // the PG session TZ.
    const [row] = await sql(`
        INSERT INTO purchase_receipts (
          branch_id, item_id, quantity, received_at, note,
          created_by_employee_id, created_by_employee_name, created_at,
          unit_id, unit_name, unit_factor
        )
        VALUES (
          $1, $2, $3, $4::timestamp AT TIME ZONE 'Asia/Riyadh', $5,
          $6, $7, NOW(), $8, $9, $10
        )
        RETURNING id, branch_id, item_id, quantity, received_at, note,
                  created_at, created_by_employee_id, created_by_employee_name,
                  unit_id, unit_name, unit_factor
      `, [branchIdNum, itemIdNum, qtyNum, receivedAt, note || null, actingEmployeeId, actingEmployeeName, unitSnap.unitId, unitSnap.unitName, unitSnap.unitFactor]);
    return Response.json({
      receipt: row
    }, {
      status: 201
    });
  } catch (error) {
    console.error("Error creating purchase receipt:", error);
    return Response.json({
      error: "Failed to create purchase receipt"
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
    await ensureInventoryUnitSnapshotSchema();
    const body = await request.json();
    const {
      operationId,
      branchId,
      receivedAt,
      note,
      items
    } = body;
    if (!operationId) {
      return Response.json({
        error: "معرّف العملية مطلوب"
      }, {
        status: 400
      });
    }
    const branchIdNum = parseInt(branchId);
    if (!branchIdNum || Number.isNaN(branchIdNum)) {
      return Response.json({
        error: "معرّف الفرع مطلوب"
      }, {
        status: 400
      });
    }
    if (!receivedAt) {
      return Response.json({
        error: "تاريخ الوارد مطلوب"
      }, {
        status: 400
      });
    }
    if (!validateReceivedAt(receivedAt)) {
      return Response.json({
        error: "تاريخ الوارد غير صالح"
      }, {
        status: 400
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({
        error: "أضف صنف واحد على الأقل"
      }, {
        status: 400
      });
    }
    if (items.length > 200) {
      return Response.json({
        error: "الحد الأقصى 200 صنف"
      }, {
        status: 400
      });
    }
    const cleanedItems = [];
    for (const it of items) {
      const itemId = parseInt(it?.itemId);
      const qty = Number(it?.quantity);
      if (!itemId || Number.isNaN(itemId)) continue;
      if (!Number.isFinite(qty) || qty <= 0) continue;
      cleanedItems.push({
        itemId,
        quantity: qty
      });
    }
    if (cleanedItems.length === 0) {
      return Response.json({
        error: "لا توجد أصناف صالحة"
      }, {
        status: 400
      });
    }

    // Branch-visibility guard on edit too — admin can otherwise
    // sidestep the rule by editing an existing receipt to add a
    // disabled item.
    {
      const fail = await assertItemsEnabledAtBranch(branchIdNum, cleanedItems.map(c => c.itemId));
      if (fail) return Response.json(fail.body, {
        status: fail.status
      });
    }
    const actingEmployeeId = auth.user?.id || null;
    const actingEmployeeName = auth.user?.name || null;
    const snapshots = await getDefaultInventoryUnitSnapshots(cleanedItems.map(it => it.itemId));
    const itemIds = [];
    const quantities = [];
    const unitIds = [];
    const unitNames = [];
    const unitFactors = [];
    for (const it of cleanedItems) {
      const snap = snapshotForItem(snapshots, it.itemId);
      itemIds.push(it.itemId);
      quantities.push(Math.round(it.quantity * 1000) / 1000);
      unitIds.push(snap.unitId);
      unitNames.push(snap.unitName);
      unitFactors.push(snap.unitFactor);
    }

    // ── Edit a batched receipt ──
    if (String(operationId).startsWith("batch-")) {
      const batchId = String(operationId).replace("batch-", "");
      const existing = await sql(`SELECT id FROM purchase_receipts WHERE receipt_batch_id = $1`, [batchId]);
      if (!existing || existing.length === 0) {
        return Response.json({
          error: "سجل الوارد غير موجود"
        }, {
          status: 404
        });
      }

      // Re-insert with updated data — storage = real moment, pin the
      // picker-supplied `received_at` to Asia/Riyadh on the cast.
      const receipts = await sql(`
          WITH deleted AS (
            DELETE FROM purchase_receipts WHERE receipt_batch_id = $1
            RETURNING 1
          ),
          rows AS (
            SELECT
              unnest($7::int[]) AS item_id,
              unnest($8::numeric[]) AS quantity,
              unnest($9::int[]) AS unit_id,
              unnest($10::text[]) AS unit_name,
              unnest($11::numeric[]) AS unit_factor
          )
          INSERT INTO purchase_receipts (
            branch_id, item_id, quantity, received_at, note,
            created_by_employee_id, created_by_employee_name, receipt_batch_id,
            created_at, unit_id, unit_name, unit_factor
          )
          SELECT
            $2, rows.item_id, rows.quantity,
            $3::timestamp AT TIME ZONE 'Asia/Riyadh',
            $4, $5, $6, $1, NOW(),
            rows.unit_id, rows.unit_name, rows.unit_factor
          FROM rows
          RETURNING id, branch_id, item_id, quantity, received_at, note,
                    created_at, created_by_employee_id, created_by_employee_name,
                    receipt_batch_id, unit_id, unit_name, unit_factor
        `, [batchId, branchIdNum, receivedAt, note || null, actingEmployeeId, actingEmployeeName, itemIds, quantities, unitIds, unitNames, unitFactors]);
      return Response.json({
        receipts,
        count: receipts.length,
        batchId
      });
    }

    // ── Edit a single (legacy) receipt ──
    if (String(operationId).startsWith("rcpt-")) {
      const receiptId = parseInt(String(operationId).replace("rcpt-", ""));
      if (!Number.isFinite(receiptId) || receiptId <= 0) {
        return Response.json({
          error: "معرّف الوارد غير صحيح"
        }, {
          status: 400
        });
      }
      const [existing] = await sql`
        SELECT id FROM purchase_receipts WHERE id = ${receiptId}
      `;
      if (!existing) {
        return Response.json({
          error: "سجل الوارد غير موجود"
        }, {
          status: 404
        });
      }

      // For single receipt, just update the first item
      const firstItem = cleanedItems[0];
      const firstSnap = snapshotForItem(snapshots, firstItem.itemId);
      const [row] = await sql(`UPDATE purchase_receipts
         SET branch_id = $1, item_id = $2, quantity = $3,
             received_at = $4::timestamp AT TIME ZONE 'Asia/Riyadh',
             note = $5,
             created_by_employee_id = $6, created_by_employee_name = $7,
             unit_id = $8, unit_name = $9, unit_factor = $10
         WHERE id = $11
         RETURNING *`, [branchIdNum, firstItem.itemId, firstItem.quantity, receivedAt, note || null, actingEmployeeId, actingEmployeeName, firstSnap.unitId, firstSnap.unitName, firstSnap.unitFactor, receiptId]);
      return Response.json({
        receipt: row
      });
    }
    return Response.json({
      error: "نوع العملية غير مدعوم للتعديل"
    }, {
      status: 400
    });
  } catch (error) {
    console.error("Error updating purchase receipt:", error);
    return Response.json({
      error: "فشل تعديل الوارد"
    }, {
      status: 500
    });
  }
}

export { GET, POST, PUT };
