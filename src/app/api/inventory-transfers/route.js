import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { sendWhatsAppViaWasender } from "@/app/api/utils/wasender";
import { findDisabledItemsAtBranch } from "@/app/api/utils/branchVisibility";
import {
  ensureInventoryUnitSnapshotSchema,
  getDefaultInventoryUnitSnapshots,
  snapshotForItem,
} from "@/app/api/utils/inventoryUnitSnapshots";
import { parseBusinessTimestamp } from "@/utils/dateUtils";

async function notifyAdminsWhatsAppInventoryTransfer({
  fromBranchName,
  toBranchName,
  employeeName,
  transferNumber,
  items,
  note,
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
      return { ok: true, skipped: true, reason: "no_admin_phones" };
    }

    // Append unit (kg / لتر / حبة …) so the admin can tell "12.5" apart
    // from "12.5 لتر" at a glance — bare numbers were ambiguous.
    const itemsText = Array.isArray(items)
      ? items
          .slice(0, 15)
          .map((it) => {
            const unit = it.unit ? ` ${it.unit}` : "";
            return `- ${it.itemName || "صنف"} (${it.quantity}${unit})`;
          })
          .join("\n")
      : "";

    const lines = [
      "تحويل بين الفروع",
      transferNumber ? `رقم التحويل: ${transferNumber}` : null,
      fromBranchName ? `من: ${fromBranchName}` : null,
      toBranchName ? `إلى: ${toBranchName}` : null,
      employeeName ? `بواسطة: ${employeeName}` : null,
      note ? `ملاحظة: ${note}` : null,
      itemsText ? `الأصناف:\n${itemsText}` : null,
      Array.isArray(items) && items.length > 15
        ? `… والمزيد (${items.length - 15})`
        : null,
    ].filter(Boolean);

    const text = lines.join("\n").trim();

    const results = await Promise.all(
      admins.map(async (a) => {
        const r = await sendWhatsAppViaWasender({ to: a.phone, text });
        if (!r.ok) {
          console.error("Inventory Transfer WhatsApp notify failed", {
            adminId: a.id,
            error: r.error,
            details: r.details,
          });
        }
        return { adminId: a.id, ok: r.ok };
      }),
    );

    return { ok: true, results };
  } catch (e) {
    console.error("notifyAdminsWhatsAppInventoryTransfer error", e);
    return { ok: false, error: "notify_failed" };
  }
}

/**
 * Point-in-time stock for (branch, items) at an arbitrary moment.
 *
 * Formula: latest completed `Daily/Weekly/Transfer/Opening` snapshot at
 * or before `atTime`, plus the sum of `purchase_receipts` strictly
 * between that snapshot and `atTime`. When `atTime` is `null`, the
 * formula collapses to "current stock" (no upper bound).
 *
 * Replaces the original `getCurrentQuantitiesForBranch` which only
 * supported "now". Backdated transfers need to validate against the
 * branch's stock AT the back-date, not against today's stock — if
 * branch A had 10 kg yesterday and today has 0 (because of an
 * unrelated count), a transfer dated yesterday should still be
 * allowed.
 */
async function getQuantitiesAtTime({ txn, branchId, itemIds, atTime }) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return new Map();
  }

  const safeBranchId = Number(branchId);
  if (!Number.isFinite(safeBranchId) || safeBranchId <= 0) {
    throw new Error("Invalid branchId");
  }

  const uniqueIds = Array.from(
    new Set(itemIds.map((x) => Number(x)).filter((x) => Number.isFinite(x))),
  );

  if (uniqueIds.length === 0) {
    return new Map();
  }

  // Same formula as /api/branch-stock-at and the timeline report:
  //   last RESET (Daily/Weekly/Opening) + receipts since + signed
  //   transfer deltas since. Keeps the transfer route's
  //   pre-flight stock check aligned with what the reports show.
  const rows = await txn(
    `
      SELECT
        i.id AS item_id,
        (
          COALESCE(last_reset.inv_base_quantity, 0)
            + COALESCE(receipts_after.total_received_base, 0)
            + COALESCE(transfers_after.net_transfer_base, 0)
        ) / NULLIF(COALESCE(current_unit.conversion_factor, 1), 0) AS quantity_at_t
      FROM items i
      LEFT JOIN item_units current_unit
        ON current_unit.id = i.default_inventory_unit_id

      LEFT JOIN LATERAL (
        SELECT
               ii.quantity::numeric
                 * COALESCE(ii.unit_factor, current_unit.conversion_factor, 1)::numeric
                 AS inv_base_quantity,
               COALESCE(io.operation_date, io.created_at) AS op_date
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id = i.id
          AND io.branch_id = $1
          AND io.status = 'Completed'
          AND io.inventory_type IN ('Daily','Weekly','Opening')
          AND (
            $3::timestamp IS NULL
            OR COALESCE(io.operation_date, io.created_at) <= $3::timestamp
          )
        ORDER BY COALESCE(io.operation_date, io.created_at) DESC, io.id DESC
        LIMIT 1
      ) last_reset ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
          pr.quantity::numeric
            * COALESCE(pr.unit_factor, current_unit.conversion_factor, 1)::numeric
        ), 0) AS total_received_base
        FROM purchase_receipts pr
        WHERE pr.item_id = i.id
          AND pr.branch_id = $1
          AND (
            last_reset.op_date IS NULL
            OR GREATEST(pr.received_at, pr.created_at) > last_reset.op_date
          )
          AND (
            $3::timestamp IS NULL
            OR GREATEST(pr.received_at, pr.created_at) <= $3::timestamp
          )
      ) receipts_after ON true

      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(
          CASE io.transfer_direction
            WHEN 'in'  THEN  COALESCE(ii.transfer_quantity, 0)::numeric
            WHEN 'out' THEN -COALESCE(ii.transfer_quantity, 0)::numeric
            ELSE 0
          END
          * COALESCE(ii.unit_factor, current_unit.conversion_factor, 1)::numeric
        ), 0) AS net_transfer_base
        FROM inventory_items ii
        JOIN inventory_operations io ON io.id = ii.operation_id
        WHERE ii.item_id   = i.id
          AND ii.branch_id = $1
          AND io.status    = 'Completed'
          AND io.inventory_type = 'Transfer'
          AND (
            last_reset.op_date IS NULL
            OR COALESCE(io.operation_date, io.created_at) > last_reset.op_date
          )
          AND (
            $3::timestamp IS NULL
            OR COALESCE(io.operation_date, io.created_at) <= $3::timestamp
          )
      ) transfers_after ON true

      WHERE i.id = ANY($2::int[])
    `,
    [safeBranchId, uniqueIds, atTime],
  );

  const map = new Map();
  for (const r of rows) {
    map.set(Number(r.item_id), Number(r.quantity_at_t) || 0);
  }
  for (const id of uniqueIds) {
    if (!map.has(id)) {
      map.set(id, 0);
    }
  }
  return map;
}

/**
 * Safely parse and validate operationDate.
 * Preserves the user's local wall-clock time (no UTC shift) so what they typed
 * is what gets stored — matches the `TIMESTAMP without time zone` column.
 * Returns `YYYY-MM-DD HH:mm:ss` string or null.
 *
 * Rejects:
 *   - dates more than 1 day in the future
 *   - dates before 2020 (sanity floor for this business)
 */
function parseOperationDate(value) {
  return parseBusinessTimestamp(value, { allowFuture: 1, minYear: 2020 });
}

export async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Admin", permission: "can_manage_inventory" },
      { role: "Admin", permission: "can_manage_accounting" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // Idempotent: ensures the transfer_quantity column exists before we
  // try to INSERT it. The inventory-operations route applies the same
  // migration on every request, but transfers can be the first call in
  // a fresh tab so we cover ourselves here too.
  try {
    await sql`
      ALTER TABLE inventory_items
        ADD COLUMN IF NOT EXISTS transfer_quantity NUMERIC(12, 3)
    `;
    await ensureInventoryUnitSnapshotSchema();
  } catch (e) {
    console.error("ensureSchema inventory transfer snapshots:", e?.message);
  }

  try {
    const body = await request.json();
    const { fromBranchId, toBranchId, items, note, operationDate } = body;

    const fromId = Number(fromBranchId);
    const toId = Number(toBranchId);

    if (!Number.isFinite(fromId) || fromId <= 0) {
      return Response.json({ error: "فرع المرسل مطلوب" }, { status: 400 });
    }

    if (!Number.isFinite(toId) || toId <= 0) {
      return Response.json({ error: "فرع المستقبل مطلوب" }, { status: 400 });
    }

    if (fromId === toId) {
      return Response.json(
        { error: "لا يمكن التحويل لنفس الفرع" },
        { status: 400 },
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "اختر صنف واحد على الأقل" },
        { status: 400 },
      );
    }

    // Backend cap mirrors the UI cap in TransferModal (200 rows). A malicious
    // or buggy client could otherwise submit thousands of rows and lock the
    // DB on the batched INSERTs.
    const MAX_ITEMS_PER_TRANSFER = 200;
    if (items.length > MAX_ITEMS_PER_TRANSFER) {
      return Response.json(
        {
          error: `لا يمكن تحويل أكثر من ${MAX_ITEMS_PER_TRANSFER} صنف في عملية واحدة`,
        },
        { status: 400 },
      );
    }

    // Strict validation: reject the whole request if ANY row is malformed,
    // and report the offending rows. The previous loop silently skipped
    // bad rows (continue) which let buggy clients half-commit transfers.
    const cleanedItems = [];
    const invalidItems = [];
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const itemId = Number(it?.itemId);
      const quantity = Number(it?.quantity);

      if (!Number.isFinite(itemId) || itemId <= 0) {
        invalidItems.push({ index: i, reason: "itemId غير صالح" });
        continue;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        invalidItems.push({
          index: i,
          itemId,
          reason: "الكمية يجب أن تكون أكبر من صفر",
        });
        continue;
      }

      cleanedItems.push({
        itemId,
        // Round to 3 decimal places (matches NUMERIC(12,3) precision).
        quantity: Math.round(quantity * 1000) / 1000,
      });
    }

    if (invalidItems.length > 0) {
      return Response.json(
        {
          error: "بعض الأصناف غير صالحة — راجع الكميات والمعرّفات",
          invalidItems,
        },
        { status: 400 },
      );
    }

    if (cleanedItems.length === 0) {
      return Response.json({ error: "الكميات غير صحيحة" }, { status: 400 });
    }

    // crypto.randomUUID() avoids the 1-in-1000 collision risk of the old
    // Date.now()+random(1000) scheme. The transferNumber pairs the two
    // legs and is used as a delete-by-pair key.
    const uuid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    const transferNumber = `TRF-${Date.now()}-${uuid}`;
    const actingEmployeeId = auth.user?.id || null;

    // Validate branches exist
    const [fromBranch] = await sql`
      SELECT id, name FROM branches WHERE id = ${fromId}
    `;
    const [toBranch] = await sql`
      SELECT id, name FROM branches WHERE id = ${toId}
    `;

    if (!fromBranch) {
      return Response.json({ error: "فرع المرسل غير موجود" }, { status: 400 });
    }
    if (!toBranch) {
      return Response.json(
        { error: "فرع المستقبل غير موجود" },
        { status: 400 },
      );
    }

    // Validate items exist + get names + units for the notification
    const itemIds = cleanedItems.map((x) => x.itemId);
    const itemRows = await sql(
      `SELECT id, name, unit FROM items WHERE id = ANY($1::int[])`,
      [itemIds],
    );

    const itemNameById = new Map(
      itemRows.map((r) => [Number(r.id), String(r.name)]),
    );
    for (const it of cleanedItems) {
      if (!itemNameById.has(it.itemId)) {
        return Response.json(
          { error: `الصنف غير موجود (id: ${it.itemId})` },
          { status: 400 },
        );
      }
    }

    const unitSnapshots = await getDefaultInventoryUnitSnapshots(itemIds);
    const itemUnitById = new Map(
      itemIds.map((id) => [id, snapshotForItem(unitSnapshots, id).unitName]),
    );

    // Branch-visibility guard: refuse the transfer if any item is
    // disabled at either the source OR the destination. Running the
    // transfer anyway would write inventory_items rows that the items
    // API hides — stock silently disappears from totals.
    {
      const [disabledAtFrom, disabledAtTo] = await Promise.all([
        findDisabledItemsAtBranch(fromId, itemIds),
        findDisabledItemsAtBranch(toId, itemIds),
      ]);
      const combined = new Set([...disabledAtFrom, ...disabledAtTo]);
      if (combined.size > 0) {
        const offendingIds = Array.from(combined);
        const labels = offendingIds.map(
          (id) => itemNameById.get(id) || `#${id}`,
        );
        return Response.json(
          {
            error:
              "بعض الأصناف معطّلة في فرع المرسل أو المستقبل. أعد تفعيلها من إدارة الفروع قبل التحويل.",
            disabled_items: offendingIds,
            disabled_item_labels: labels,
            disabled_at_from: disabledAtFrom,
            disabled_at_to: disabledAtTo,
          },
          { status: 400 },
        );
      }
    }

    // Parse operation date safely. `null` means "no explicit date — use
    // server NOW()". Anything else is a user-supplied Riyadh wall-clock.
    const parsedDate = parseOperationDate(operationDate);

    // ─── Point-in-time stock validation ────────────────────────────────
    //
    // The previous implementation pulled "current stock" (now) and
    // refused the transfer if that current stock < requested quantity.
    // For a back-dated transfer that's WRONG: the user is asserting
    // "back at time T, branch A had Q kg — please record this past
    // event". The right check is "did branch A have ≥ Q at time T",
    // not "does branch A have ≥ Q right now".
    //
    // Example that the old logic broke:
    //   - Branch A opening on May 10: 10 kg.
    //   - User attempts on May 14 to record a May 11 transfer of 3 kg.
    //   - But on May 13 a daily count recorded 2 kg (consumption).
    //   - Old check: current = 2 < 3 → reject.
    //   - Correct check: stock at May 11 = 10 ≥ 3 → allow.
    //
    // Caveat (Phase 2 work, not done here): inserting a back-dated leg
    // does NOT recompute the `quantity` stored on later transfer rows
    // in the same chain — they keep the absolute snapshot they had at
    // their own insert time. For most flows that's harmless (counts
    // after T act as absolute resets and dominate), but a back-date
    // followed by other transfers (no count between) can leave the
    // chain internally inconsistent. The follow-up will add a
    // recompute pass; this commit unblocks the common case.
    const fromQtyMap = await getQuantitiesAtTime({
      txn: sql,
      branchId: fromId,
      itemIds,
      atTime: parsedDate,
    });
    const toQtyMap = await getQuantitiesAtTime({
      txn: sql,
      branchId: toId,
      itemIds,
      atTime: parsedDate,
    });

    const whenLabel = parsedDate
      ? `بتاريخ ${parsedDate.slice(0, 16).replace(" ", " ")}`
      : "حالياً";

    for (const it of cleanedItems) {
      const stockAtT = Number(fromQtyMap.get(it.itemId) || 0);
      if (stockAtT < it.quantity) {
        const name = itemNameById.get(it.itemId) || "الصنف";
        return Response.json(
          {
            error: `الكمية غير كافية في فرع المرسل للصنف "${name}" ${whenLabel} (المتاح: ${stockAtT}، المطلوب: ${it.quantity})`,
          },
          { status: 400 },
        );
      }
    }

    // Pre-compute the new absolute quantities for both branches per
    // item, based on the point-in-time stock at parsedDate (or "now"
    // when parsedDate is null). NUMERIC(12,3) precision preserved.
    const perItemIds = [];
    const fromNewArr = [];
    const toNewArr = [];
    const unitIdArr = [];
    const unitNameArr = [];
    const unitFactorArr = [];
    for (const it of cleanedItems) {
      const fromAtT = Number(fromQtyMap.get(it.itemId) || 0);
      const toAtT = Number(toQtyMap.get(it.itemId) || 0);
      const unitSnap = snapshotForItem(unitSnapshots, it.itemId);
      perItemIds.push(it.itemId);
      fromNewArr.push(Math.round((fromAtT - it.quantity) * 1000) / 1000);
      toNewArr.push(Math.round((toAtT + it.quantity) * 1000) / 1000);
      unitIdArr.push(unitSnap.unitId);
      unitNameArr.push(unitSnap.unitName);
      unitFactorArr.push(unitSnap.unitFactor);
    }

    // Atomic write: a single SQL statement with CTEs that inserts both
    // operation rows and all inventory_items rows. Either everything
    // commits or nothing — eliminates the partial-write state where
    // opOut was inserted but opIn (or inventory_items) failed, leaving
    // an orphan leg behind. Race against concurrent transfers is still
    // possible (no FOR UPDATE on the read above) but the data this
    // request *does* write is now consistent within itself.
    const [opPair] = await sql(
      `
      -- Storage = real moment. The user-supplied $6 is a Riyadh
      -- wall-clock string from the picker, so we pin it to
      -- Asia/Riyadh on the cast to record the correct moment. Display
      -- reads the moment back in Asia/Riyadh in the frontend.
      WITH op_out AS (
        INSERT INTO inventory_operations (
          inventory_number, branch_id, employee_id, inventory_type, status,
          transfer_branch_id, transfer_direction, note, operation_date, created_at
        )
        VALUES (
          $1, $2, $3, 'Transfer', 'Completed',
          $4, 'out', $5,
          COALESCE($6::timestamp AT TIME ZONE 'Asia/Riyadh', NOW()),
          NOW()
        )
        RETURNING id, branch_id, created_at, operation_date
      ),
      op_in AS (
        INSERT INTO inventory_operations (
          inventory_number, branch_id, employee_id, inventory_type, status,
          transfer_branch_id, transfer_direction, note, operation_date, created_at
        )
        VALUES (
          $1, $4, $3, 'Transfer', 'Completed',
          $2, 'in', $5,
          COALESCE($6::timestamp AT TIME ZONE 'Asia/Riyadh', NOW()),
          NOW()
        )
        RETURNING id, branch_id, created_at, operation_date
      ),
      items_data AS (
        SELECT
          unnest($7::int[])     AS item_id,
          unnest($8::numeric[]) AS from_new,
          unnest($9::numeric[]) AS to_new,
          unnest($10::numeric[]) AS moved,
          unnest($11::int[]) AS unit_id,
          unnest($12::text[]) AS unit_name,
          unnest($13::numeric[]) AS unit_factor
      ),
      ins_out AS (
        INSERT INTO inventory_items (
          operation_id, item_id, quantity, branch_id, transfer_quantity,
          unit_id, unit_name, unit_factor
        )
        SELECT
          op_out.id, items_data.item_id, items_data.from_new, op_out.branch_id,
          items_data.moved, items_data.unit_id, items_data.unit_name,
          items_data.unit_factor
        FROM op_out, items_data
        RETURNING 1
      ),
      ins_in AS (
        INSERT INTO inventory_items (
          operation_id, item_id, quantity, branch_id, transfer_quantity,
          unit_id, unit_name, unit_factor
        )
        SELECT
          op_in.id, items_data.item_id, items_data.to_new, op_in.branch_id,
          items_data.moved, items_data.unit_id, items_data.unit_name,
          items_data.unit_factor
        FROM op_in, items_data
        RETURNING 1
      )
      SELECT
        (SELECT id FROM op_out)             AS out_id,
        (SELECT id FROM op_in)              AS in_id,
        (SELECT created_at FROM op_out)     AS out_created_at,
        (SELECT created_at FROM op_in)      AS in_created_at,
        (SELECT operation_date FROM op_out) AS out_operation_date,
        (SELECT operation_date FROM op_in)  AS in_operation_date,
        (SELECT COUNT(*) FROM ins_out)      AS out_inserted_count,
        (SELECT COUNT(*) FROM ins_in)       AS in_inserted_count
      `,
      [
        transferNumber,
        fromId,
        actingEmployeeId,
        toId,
        note || null,
        parsedDate,
        perItemIds,
        fromNewArr,
        toNewArr,
        cleanedItems.map((it) => Number(it.quantity) || 0),
        unitIdArr,
        unitNameArr,
        unitFactorArr,
      ],
    );

    const opOut = {
      id: opPair.out_id,
      inventory_number: transferNumber,
      branch_id: fromId,
      employee_id: actingEmployeeId,
      inventory_type: "Transfer",
      status: "Completed",
      created_at: opPair.out_created_at,
      transfer_branch_id: toId,
      transfer_direction: "out",
      note: note || null,
      operation_date: opPair.out_operation_date,
    };
    const opIn = {
      id: opPair.in_id,
      inventory_number: transferNumber,
      branch_id: toId,
      employee_id: actingEmployeeId,
      inventory_type: "Transfer",
      status: "Completed",
      created_at: opPair.in_created_at,
      transfer_branch_id: fromId,
      transfer_direction: "in",
      note: note || null,
      operation_date: opPair.in_operation_date,
    };

    const resultItems = cleanedItems.map((it) => ({
      itemId: it.itemId,
      itemName: itemNameById.get(it.itemId) || "",
      unit: itemUnitById.get(it.itemId) || "",
      quantity: it.quantity,
    }));

    const result = {
      ok: true,
      transferNumber,
      fromBranch,
      toBranch,
      items: resultItems,
      operations: [opOut, opIn],
    };

    // Best-effort WhatsApp notify (never blocks saving)
    const actingId = Number(auth.user?.id);
    let employeeName = "";
    if (Number.isFinite(actingId) && actingId > 0) {
      const [emp] =
        await sql`SELECT id, name FROM employees WHERE id = ${actingId}`;
      employeeName = emp?.name || "";
    }

    notifyAdminsWhatsAppInventoryTransfer({
      fromBranchName: result?.fromBranch?.name || "—",
      toBranchName: result?.toBranch?.name || "—",
      employeeName,
      transferNumber: result.transferNumber,
      items: result.items,
      note: note || "",
    }).catch((e) => console.error("notify admins whatsapp error", e));

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating inventory transfer:", error);
    const detail = error?.message ? String(error.message).slice(0, 200) : "";
    return Response.json(
      { error: `فشل في تحويل المخزون${detail ? ": " + detail : ""}` },
      { status: 500 },
    );
  }
}
