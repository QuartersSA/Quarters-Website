import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

/**
 * POST /api/accounting/green-bean-orders/:id/deposit
 *
 * Deposits the received-after-waste quantities from a green bean order
 * into inventory as purchase receipts for the linked items.
 *
 * When the same bean type appears multiple times in an order (multiple bags),
 * the quantities are aggregated into a single deposit per bean type.
 *
 * Body: { branchId: number, note?: string }
 */
export async function POST(request, { params }) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_manage_accounting" },
      { role: "Admin", permission: "can_manage_inventory" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const orderId = Number(params?.id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return Response.json({ error: "معرّف الطلب غير صحيح" }, { status: 400 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const branchId = Number(body?.branchId);
  if (!Number.isFinite(branchId) || branchId <= 0) {
    return Response.json({ error: "اختر الفرع" }, { status: 400 });
  }

  const note = body?.note ? String(body.note).trim() : null;

  try {
    // 1. Verify the order exists
    const [order] = await sql(
      `SELECT id, order_date, supplier_name FROM accounting_green_bean_orders WHERE id = $1 LIMIT 1`,
      [orderId],
    );

    if (!order) {
      return Response.json({ error: "الطلب غير موجود" }, { status: 404 });
    }

    // 2. Verify the branch exists
    const [branch] = await sql(
      `SELECT id, name FROM branches WHERE id = $1 LIMIT 1`,
      [branchId],
    );

    if (!branch) {
      return Response.json({ error: "الفرع غير موجود" }, { status: 404 });
    }

    // 3. Get order items with their linked inventory items
    const orderItems = await sql(
      `SELECT
         oi.id as order_item_id,
         oi.bean_id,
         oi.bean_name_snapshot,
         oi.computed_received_after_waste_kg,
         i.id as inventory_item_id,
         i.name as inventory_item_name
       FROM accounting_green_bean_order_items oi
       LEFT JOIN items i ON i.linked_green_bean_id = oi.bean_id
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC`,
      [orderId],
    );

    if (!orderItems || orderItems.length === 0) {
      return Response.json(
        { error: "لا توجد أصناف في هذا الطلب" },
        { status: 400 },
      );
    }

    // 4. Aggregate quantities by bean type (same bean_id → sum the received kg)
    const aggregatedMap = new Map();
    const unlinked = [];

    for (const item of orderItems) {
      if (!item.inventory_item_id) {
        // Avoid duplicate unlinked entries for the same bean
        const alreadyUnlinked = unlinked.some((u) => u.beanId === item.bean_id);
        if (!alreadyUnlinked) {
          unlinked.push({
            beanName: item.bean_name_snapshot || "—",
            beanId: item.bean_id,
          });
        }
        continue;
      }

      const received = Number(item.computed_received_after_waste_kg);
      if (!Number.isFinite(received) || received <= 0) {
        const alreadyUnlinked = unlinked.some((u) => u.beanId === item.bean_id);
        if (!alreadyUnlinked) {
          unlinked.push({
            beanName: item.bean_name_snapshot || "—",
            beanId: item.bean_id,
            reason: "الكمية الواصلة غير محددة أو صفر",
          });
        }
        continue;
      }

      const key = String(item.bean_id);
      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key);
        existing.quantity += received;
        existing.bagCount += 1;
      } else {
        aggregatedMap.set(key, {
          beanId: item.bean_id,
          beanName: item.bean_name_snapshot || "—",
          inventoryItemId: item.inventory_item_id,
          inventoryItemName: item.inventory_item_name,
          quantity: received,
          bagCount: 1,
        });
      }
    }

    const linked = Array.from(aggregatedMap.values());

    if (linked.length === 0) {
      return Response.json(
        {
          error:
            "لا يوجد أصناف بن مربوطة بأصناف المخزون. يرجى ربط أنواع البن بأصناف المخزون أولاً من صفحة الأصناف.",
          unlinked,
        },
        { status: 400 },
      );
    }

    // 5. Create one purchase receipt per bean type (aggregated)
    const actingEmployeeId = auth.user?.id || null;
    const actingEmployeeName = auth.user?.name || null;

    // order_date may come as a Date object or ISO string from postgres
    let dateStr = null;
    if (order.order_date instanceof Date) {
      dateStr = order.order_date.toISOString().slice(0, 10);
    } else if (order.order_date) {
      const raw = String(order.order_date);
      // Try ISO format first: "2026-02-16T00:00:00.000Z"
      const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) {
        dateStr = isoMatch[1];
      } else {
        // Fallback: parse as Date
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          dateStr = parsed.toISOString().slice(0, 10);
        }
      }
    }

    const receivedAt = dateStr
      ? `${dateStr}T12:00:00`
      : new Date().toISOString();

    const depositNote = note
      ? `إيداع من طلب بن أخضر #${orderId} — ${note}`
      : `إيداع من طلب بن أخضر #${orderId}`;

    const batchId = `GB-${orderId}-${Date.now()}`;

    const receipts = [];

    for (const item of linked) {
      // Round quantity to 3 decimal places
      const roundedQty = Math.round(item.quantity * 1000) / 1000;

      const [row] = await sql(
        `INSERT INTO purchase_receipts
           (branch_id, item_id, quantity, received_at, note,
            created_by_employee_id, created_by_employee_name, receipt_batch_id)
         VALUES ($1, $2, $3, $4::timestamp, $5, $6, $7, $8)
         RETURNING id, branch_id, item_id, quantity, received_at, note, created_at,
                   created_by_employee_id, created_by_employee_name, receipt_batch_id`,
        [
          branchId,
          item.inventoryItemId,
          roundedQty,
          receivedAt,
          depositNote,
          actingEmployeeId,
          actingEmployeeName,
          batchId,
        ],
      );

      receipts.push({
        ...row,
        beanName: item.beanName,
        inventoryItemName: item.inventoryItemName,
        bagCount: item.bagCount,
      });
    }

    return Response.json(
      {
        ok: true,
        deposited: receipts.length,
        skipped: unlinked.length,
        receipts,
        unlinked,
        batchId,
        branchName: branch.name,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("green bean order deposit error:", error);
    const detail = error?.message ? String(error.message).slice(0, 200) : "";
    return Response.json(
      { error: `فشل الإيداع في المخزون${detail ? ": " + detail : ""}` },
      { status: 500 },
    );
  }
}
