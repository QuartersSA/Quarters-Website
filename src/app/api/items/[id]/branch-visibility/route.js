import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// Per-branch visibility for a single item.
//   GET  /api/items/[id]/branch-visibility
//     → { disabled_branches: [branch_id, ...] }
//   PATCH /api/items/[id]/branch-visibility
//     body: { branchId: number, enabled: boolean }
//     - enabled=false → INSERT into item_branch_disabled (idempotent)
//     - enabled=true  → DELETE from item_branch_disabled (idempotent)
//
// Sparse model: a row in `item_branch_disabled` means the item is HIDDEN
// at that branch. Absence = default behaviour (item visible). New rows
// are recorded with the acting admin's id + name for an audit trail.

async function ensureTable() {
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
    // حد أدنى للتنبيه لكل (صنف، فرع) — يتجاوز الحد الافتراضي في
    // items.min_stock_threshold. نموذج متفرق: لا صف = استخدم الافتراضي.
    await sql`
      CREATE TABLE IF NOT EXISTS item_branch_min_stock (
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
        branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        min_stock NUMERIC(14, 3) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_by_employee_name TEXT,
        PRIMARY KEY (item_id, branch_id)
      )
    `;
  } catch (e) {
    console.error("ensureTable item_branch_disabled:", e?.message);
  }
}

export async function GET(request, { params }) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureTable();
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return Response.json({ error: "معرّف الصنف غير صالح" }, { status: 400 });
    }

    const rows = await sql`
      SELECT branch_id, disabled_at, disabled_by_employee_name
      FROM item_branch_disabled
      WHERE item_id = ${itemId}
      ORDER BY branch_id ASC
    `;
    const minRows = await sql`
      SELECT branch_id, min_stock
      FROM item_branch_min_stock
      WHERE item_id = ${itemId}
      ORDER BY branch_id ASC
    `;

    return Response.json({
      item_id: itemId,
      disabled_branches: rows.map((r) => Number(r.branch_id)),
      branch_min_stock: minRows.map((r) => ({
        branch_id: Number(r.branch_id),
        min_stock: Number(r.min_stock),
      })),
      details: rows,
    });
  } catch (error) {
    console.error("branch-visibility GET error:", error);
    return Response.json(
      { error: "فشل جلب حالة الفروع للصنف", details: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_inventory",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureTable();
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return Response.json({ error: "معرّف الصنف غير صالح" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const branchId = Number(body?.branchId);
    const enabled = body?.enabled === true;

    if (!Number.isFinite(branchId) || branchId <= 0) {
      return Response.json({ error: "معرّف الفرع غير صالح" }, { status: 400 });
    }

    // Confirm both rows exist — surfaces 404 nicely instead of trampling
    // FK errors from the constraint.
    const [item] = await sql`SELECT id FROM items WHERE id = ${itemId}`;
    if (!item) {
      return Response.json({ error: "الصنف غير موجود" }, { status: 404 });
    }
    const [branch] = await sql`SELECT id FROM branches WHERE id = ${branchId}`;
    if (!branch) {
      return Response.json({ error: "الفرع غير موجود" }, { status: 404 });
    }

    // تحديث الحد الأدنى الخاص بالفرع: قيمة رقمية ≥ 0 تُثبَّت،
    // وقيمة فارغة/null تحذف الصف فيرجع الفرع للحد الافتراضي للصنف.
    if (Object.prototype.hasOwnProperty.call(body, "minStock")) {
      const raw = body.minStock;
      if (raw === null || raw === "" || raw === undefined) {
        await sql`
          DELETE FROM item_branch_min_stock
          WHERE item_id = ${itemId} AND branch_id = ${branchId}
        `;
        return Response.json({ ok: true, itemId, branchId, minStock: null });
      }
      const minStock = Number(raw);
      if (!Number.isFinite(minStock) || minStock < 0) {
        return Response.json(
          { error: "قيمة الحد الأدنى غير صالحة" },
          { status: 400 },
        );
      }
      await sql`
        INSERT INTO item_branch_min_stock
          (item_id, branch_id, min_stock, updated_by_employee_name)
        VALUES (${itemId}, ${branchId}, ${minStock}, ${auth.user?.name || null})
        ON CONFLICT (item_id, branch_id) DO UPDATE
        SET min_stock = EXCLUDED.min_stock,
            updated_at = CURRENT_TIMESTAMP,
            updated_by_employee_name = EXCLUDED.updated_by_employee_name
      `;
      return Response.json({ ok: true, itemId, branchId, minStock });
    }

    if (enabled) {
      // Re-enable: remove the disabled row if present (idempotent).
      await sql`
        DELETE FROM item_branch_disabled
        WHERE item_id = ${itemId} AND branch_id = ${branchId}
      `;
    } else {
      // Disable: upsert. ON CONFLICT DO NOTHING keeps the original
      // disabled_at / disabled_by audit fields stable across repeated
      // toggle-off clicks.
      const actingId = Number(auth.user?.id) || null;
      const actingName = auth.user?.name || null;
      await sql`
        INSERT INTO item_branch_disabled
          (item_id, branch_id, disabled_by_employee_id, disabled_by_employee_name)
        VALUES (${itemId}, ${branchId}, ${actingId}, ${actingName})
        ON CONFLICT (item_id, branch_id) DO NOTHING
      `;
    }

    return Response.json({ ok: true, itemId, branchId, enabled });
  } catch (error) {
    console.error("branch-visibility PATCH error:", error);
    return Response.json(
      { error: "فشل تحديث حالة الفرع للصنف", details: error.message },
      { status: 500 },
    );
  }
}
