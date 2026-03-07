import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import '@neondatabase/serverless';
import 'crypto';

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
      where += ` AND pr.received_at::date >= $${idx}::date`;
      values.push(fromRaw);
      idx += 1;
      where += ` AND pr.received_at::date <= $${idx}::date`;
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
        pr.quantity,
        pr.received_at,
        pr.note,
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
      const actingEmployeeId = auth.user?.id || null;
      const actingEmployeeName = auth.user?.name || null;

      // Generate a single batch id for all items in this receipt
      const batchId = `RB-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const receipts = [];
      for (const it of cleanedItems) {
        const [row] = await sql(`INSERT INTO purchase_receipts (branch_id, item_id, quantity, received_at, note, created_by_employee_id, created_by_employee_name, receipt_batch_id)
           VALUES ($1, $2, $3, $4::timestamp, $5, $6, $7, $8)
           RETURNING id, branch_id, item_id, quantity, received_at, note, created_at, created_by_employee_id, created_by_employee_name, receipt_batch_id`, [branchIdNum, it.itemId, it.quantity, receivedAt, note || null, actingEmployeeId, actingEmployeeName, batchId]);
        receipts.push(row);
      }
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
    const actingEmployeeId = auth.user?.id || null;
    const actingEmployeeName = auth.user?.name || null;
    const [row] = await sql(`
        INSERT INTO purchase_receipts (branch_id, item_id, quantity, received_at, note, created_by_employee_id, created_by_employee_name)
        VALUES ($1, $2, $3, $4::timestamp, $5, $6, $7)
        RETURNING id, branch_id, item_id, quantity, received_at, note, created_at, created_by_employee_id, created_by_employee_name
      `, [branchIdNum, itemIdNum, qtyNum, receivedAt, note || null, actingEmployeeId, actingEmployeeName]);
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
    const actingEmployeeId = auth.user?.id || null;
    const actingEmployeeName = auth.user?.name || null;

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

      // Delete old items
      await sql(`DELETE FROM purchase_receipts WHERE receipt_batch_id = $1`, [batchId]);

      // Re-insert with updated data
      const receipts = [];
      for (const it of cleanedItems) {
        const [row] = await sql(`INSERT INTO purchase_receipts (branch_id, item_id, quantity, received_at, note, created_by_employee_id, created_by_employee_name, receipt_batch_id)
           VALUES ($1, $2, $3, $4::timestamp, $5, $6, $7, $8)
           RETURNING id, branch_id, item_id, quantity, received_at, note, created_at, created_by_employee_id, created_by_employee_name, receipt_batch_id`, [branchIdNum, it.itemId, it.quantity, receivedAt, note || null, actingEmployeeId, actingEmployeeName, batchId]);
        receipts.push(row);
      }
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
      const [row] = await sql(`UPDATE purchase_receipts
         SET branch_id = $1, item_id = $2, quantity = $3, received_at = $4::timestamp, note = $5,
             created_by_employee_id = $6, created_by_employee_name = $7
         WHERE id = $8
         RETURNING *`, [branchIdNum, firstItem.itemId, firstItem.quantity, receivedAt, note || null, actingEmployeeId, actingEmployeeName, receiptId]);
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
