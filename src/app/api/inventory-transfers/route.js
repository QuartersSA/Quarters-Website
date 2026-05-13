import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { sendWhatsAppViaWasender } from "@/app/api/utils/wasender";
import { findDisabledItemsAtBranch } from "@/app/api/utils/branchVisibility";

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

async function getCurrentQuantitiesForBranch({ txn, branchId, itemIds }) {
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

  // current stock = last Daily/Weekly/Transfer/Opening inventory count + SUM(receipts after it)
  // Fixed: added io.id DESC to break ties when operation_date is the same
  const rows = await txn(
    `
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
            -- GREATEST(received_at, created_at): same backdated-row
            -- protection used by /api/items so transfer validation
            -- sees the same "available qty" as the items page.
            OR GREATEST(pr.received_at, pr.created_at) > last_inv.op_date
          )
      ) receipts_after ON true

      WHERE i.id = ANY($2::int[])
    `,
    [safeBranchId, uniqueIds],
  );

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
 * Preserves the user's local wall-clock time (no UTC shift) so what they typed
 * is what gets stored — matches the `TIMESTAMP without time zone` column.
 * Returns `YYYY-MM-DD HH:mm:ss` string or null.
 *
 * Rejects:
 *   - dates more than 1 day in the future
 *   - dates before 2020 (sanity floor for this business)
 */
function parseOperationDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Date-only input → append local midnight to avoid UTC interpretation
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    d = new Date(`${str}T00:00:00`);
  } else {
    d = new Date(str);
  }
  if (isNaN(d.getTime())) return null;

  // Sanity bounds — guard against bogus dates
  if (d.getFullYear() < 2020) return null;
  const maxFuture = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (d > maxFuture) return null;

  // Format as local wall-clock, no timezone marker
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mn}:${ss}`;
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
    const itemUnitById = new Map(
      itemRows.map((r) => [Number(r.id), String(r.unit || "")]),
    );

    for (const it of cleanedItems) {
      if (!itemNameById.has(it.itemId)) {
        return Response.json(
          { error: `الصنف غير موجود (id: ${it.itemId})` },
          { status: 400 },
        );
      }
    }

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

    const fromQtyMap = await getCurrentQuantitiesForBranch({
      txn: sql,
      branchId: fromId,
      itemIds,
    });
    const toQtyMap = await getCurrentQuantitiesForBranch({
      txn: sql,
      branchId: toId,
      itemIds,
    });

    // Validate available qty in from-branch
    for (const it of cleanedItems) {
      const current = Number(fromQtyMap.get(it.itemId) || 0);
      if (current < it.quantity) {
        const name = itemNameById.get(it.itemId) || "الصنف";
        return Response.json(
          {
            error: `كمية غير كافية في فرع المرسل للصنف: ${name} (المتاح: ${current})`,
          },
          { status: 400 },
        );
      }
    }

    // Parse operation date safely — if invalid, use current timestamp
    const parsedDate = parseOperationDate(operationDate);

    // Backdate guard: refuse to backdate behind the latest completed
    // inventory baseline (Daily/Weekly/Transfer/Opening) — but only at
    // branches that ACTUALLY have past activity. A branch with no
    // inventory_operations yet has no `last_inv` to displace, so the
    // transfer becomes its first row and current stock works
    // correctly regardless of the requested date.
    //
    // The comparison happens entirely in Postgres so wall-clock dates
    // stored as TIMESTAMP WITHOUT TIME ZONE stay consistent — pulling
    // them into JS Date objects mixes UTC ISO output ("…Z") with the
    // local-format `parsedDate` ("YYYY-MM-DD HH:MM:SS") and introduces
    // a TZ-offset bug that blocked even forward-dated transfers.
    if (parsedDate) {
      const conflicts = await sql(
        `SELECT
           io.branch_id,
           MAX(COALESCE(io.operation_date, io.created_at)) AS latest_date,
           b.name AS branch_name
         FROM inventory_operations io
         JOIN branches b ON b.id = io.branch_id
         WHERE io.status = 'Completed'
           AND io.inventory_type IN ('Daily','Weekly','Transfer','Opening')
           AND io.branch_id = ANY($1::int[])
         GROUP BY io.branch_id, b.name
         HAVING MAX(COALESCE(io.operation_date, io.created_at)) > $2::timestamp`,
        [[fromId, toId], parsedDate],
      );
      if (conflicts.length > 0) {
        const detail = conflicts
          .map((r) => {
            const dt =
              r.latest_date instanceof Date
                ? r.latest_date.toISOString().slice(0, 16).replace("T", " ")
                : String(r.latest_date).slice(0, 16).replace("T", " ");
            return `${r.branch_name} (${dt})`;
          })
          .join("، ");
        return Response.json(
          {
            error: `تاريخ التحويل أقدم من آخر جرد مكتمل في: ${detail}. التواريخ المسبقة تُفقد التأثير على المخزون. اختر تاريخاً أحدث أو ساوي.`,
          },
          { status: 400 },
        );
      }
    }

    // Pre-compute the new absolute quantities for both branches per item.
    // The math is done in JS here (rather than in SQL) because the source
    // qty depends on the current stock which we already fetched above.
    // Quantity column is NUMERIC(12,3) — preserves up to 3 decimal places.
    const perItemIds = [];
    const fromNewArr = [];
    const toNewArr = [];
    for (const it of cleanedItems) {
      const fromCurrent = Number(fromQtyMap.get(it.itemId) || 0);
      const toCurrent = Number(toQtyMap.get(it.itemId) || 0);
      perItemIds.push(it.itemId);
      fromNewArr.push(Math.round((fromCurrent - it.quantity) * 1000) / 1000);
      toNewArr.push(Math.round((toCurrent + it.quantity) * 1000) / 1000);
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
      WITH op_out AS (
        INSERT INTO inventory_operations (
          inventory_number, branch_id, employee_id, inventory_type, status,
          transfer_branch_id, transfer_direction, note, operation_date
        )
        VALUES (
          $1, $2, $3, 'Transfer', 'Completed',
          $4, 'out', $5, COALESCE($6::timestamp, CURRENT_TIMESTAMP)
        )
        RETURNING id, branch_id, created_at, operation_date
      ),
      op_in AS (
        INSERT INTO inventory_operations (
          inventory_number, branch_id, employee_id, inventory_type, status,
          transfer_branch_id, transfer_direction, note, operation_date
        )
        VALUES (
          $1, $4, $3, 'Transfer', 'Completed',
          $2, 'in', $5, COALESCE($6::timestamp, CURRENT_TIMESTAMP)
        )
        RETURNING id, branch_id, created_at, operation_date
      ),
      items_data AS (
        SELECT
          unnest($7::int[])     AS item_id,
          unnest($8::numeric[]) AS from_new,
          unnest($9::numeric[]) AS to_new
      ),
      ins_out AS (
        INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
        SELECT op_out.id, items_data.item_id, items_data.from_new, op_out.branch_id
        FROM op_out, items_data
        RETURNING 1
      ),
      ins_in AS (
        INSERT INTO inventory_items (operation_id, item_id, quantity, branch_id)
        SELECT op_in.id, items_data.item_id, items_data.to_new, op_in.branch_id
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
