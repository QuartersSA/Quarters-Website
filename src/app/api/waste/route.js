import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// Waste / spoilage logging (تسجيل الهدر).
//
//   waste_operations — one submission (branch + employee + time + note)
//   waste_items      — the per-item quantities, each snapshotting the
//                      item's cost at submit time so the accounting
//                      report's cost figure stays correct even if the
//                      item's cost changes later.
//
// Quantities are stored as recorded (the employee waste page locks the
// unit, same as the inventory flow). cost = quantity × unit_cost.

async function ensureSchema() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS waste_operations (
        id              SERIAL PRIMARY KEY,
        branch_id       INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        branch_name     TEXT,
        employee_id     INTEGER,
        employee_name   TEXT,
        note            TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  } catch (e) {
    console.error("ensureSchema waste_operations:", e?.message);
  }
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS waste_items (
        id            SERIAL PRIMARY KEY,
        operation_id  INTEGER NOT NULL REFERENCES waste_operations(id) ON DELETE CASCADE,
        item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        item_name     TEXT,
        quantity      NUMERIC(12, 3) NOT NULL,
        unit_cost     NUMERIC(14, 4)
      )
    `;
  } catch (e) {
    console.error("ensureSchema waste_items:", e?.message);
  }
}

// ── POST: employee (or admin) submits a waste log ──
export async function POST(request) {
  const auth = requireAuth(request, {
    anyOf: [
      { role: "Employee", permission: "can_log_waste" },
      { role: "Admin", permission: "can_manage_accounting" },
      { role: "Admin", permission: "can_manage_inventory" },
    ],
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const body = await request.json();
    const branchId = Number(body?.branchId);
    const note = body?.note ? String(body.note) : null;
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!Number.isFinite(branchId) || branchId <= 0) {
      return Response.json({ error: "معرف الفرع مطلوب" }, { status: 400 });
    }

    // Employees may only log waste for a branch they're assigned to.
    if (auth.user?.role === "Employee") {
      const allowed = Array.isArray(auth.user?.branchIds)
        ? auth.user.branchIds
        : [];
      if (!allowed.includes(branchId)) {
        return Response.json(
          { error: "لا تملك صلاحية على هذا الفرع" },
          { status: 403 },
        );
      }
    }

    // Normalize + drop zero/empty rows.
    const clean = items
      .map((it) => ({
        itemId: Number(it?.itemId),
        quantity: Number(it?.quantity),
      }))
      .filter(
        (it) =>
          Number.isFinite(it.itemId) &&
          it.itemId > 0 &&
          Number.isFinite(it.quantity) &&
          it.quantity > 0,
      );

    if (clean.length === 0) {
      return Response.json(
        { error: "أضف صنف واحد على الأقل بكمية أكبر من صفر" },
        { status: 400 },
      );
    }

    // Resolve branch name + each item's name + current cost (snapshot).
    const [branch] = await sql`SELECT name FROM branches WHERE id = ${branchId}`;
    const itemIds = clean.map((c) => c.itemId);
    const itemRows = await sql(
      `SELECT id, name, COALESCE(base_purchase_cost, cost) AS unit_cost
       FROM items WHERE id = ANY($1::bigint[])`,
      [itemIds],
    );
    const itemMap = new Map();
    for (const r of itemRows) {
      itemMap.set(Number(r.id), {
        name: r.name,
        unit_cost: r.unit_cost == null ? null : Number(r.unit_cost),
      });
    }

    const [op] = await sql`
      INSERT INTO waste_operations (branch_id, branch_name, employee_id, employee_name, note)
      VALUES (
        ${branchId},
        ${branch?.name || null},
        ${auth.user?.id || null},
        ${auth.user?.name || null},
        ${note}
      )
      RETURNING id, created_at
    `;

    for (const c of clean) {
      const meta = itemMap.get(c.itemId) || {};
      await sql`
        INSERT INTO waste_items (operation_id, item_id, item_name, quantity, unit_cost)
        VALUES (${op.id}, ${c.itemId}, ${meta.name || null}, ${c.quantity}, ${meta.unit_cost ?? null})
      `;
    }

    return Response.json(
      { ok: true, operationId: op.id, created_at: op.created_at },
      { status: 201 },
    );
  } catch (error) {
    console.error("waste POST error", error);
    return Response.json(
      { error: "فشل تسجيل الهدر", details: error.message },
      { status: 500 },
    );
  }
}

// ── GET: accounting report — every waste operation with full details ──
export async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const bFilter =
      branchId && Number.isFinite(Number(branchId)) && Number(branchId) > 0
        ? Number(branchId)
        : null;

    const ops = await sql(
      `
        SELECT
          o.id,
          o.branch_id,
          o.branch_name,
          o.employee_id,
          o.employee_name,
          o.note,
          o.created_at,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', wi.id,
                'item_id', wi.item_id,
                'item_name', wi.item_name,
                'quantity', wi.quantity,
                'unit_cost', wi.unit_cost,
                'cost', ROUND(COALESCE(wi.quantity, 0) * COALESCE(wi.unit_cost, 0), 2)
              )
              ORDER BY wi.id
            ) FILTER (WHERE wi.id IS NOT NULL),
            '[]'::jsonb
          ) AS items,
          COUNT(wi.id)::int AS items_count,
          ROUND(SUM(COALESCE(wi.quantity, 0) * COALESCE(wi.unit_cost, 0)), 2) AS total_cost
        FROM waste_operations o
        LEFT JOIN waste_items wi ON wi.operation_id = o.id
        WHERE ($1::int IS NULL OR o.branch_id = $1::int)
          AND ($2::timestamptz IS NULL OR o.created_at >= $2::timestamptz)
          AND ($3::timestamptz IS NULL OR o.created_at <= $3::timestamptz)
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 500
      `,
      [bFilter, from || null, to || null],
    );

    const grandTotal = ops.reduce(
      (s, o) => s + (Number(o.total_cost) || 0),
      0,
    );

    return Response.json({
      operations: ops,
      summary: {
        operations_count: ops.length,
        total_cost: Math.round(grandTotal * 100) / 100,
      },
    });
  } catch (error) {
    console.error("waste GET error", error);
    return Response.json(
      { error: "فشل تحميل تقارير الهدر", details: error.message },
      { status: 500 },
    );
  }
}
