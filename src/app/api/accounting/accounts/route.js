import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  ensureAccountsSchema,
  nextChildCode,
} from "@/app/api/utils/accountsTree";

// Full accounting admins OR admins limited to قسم المشتريات only
// (شجرة الحسابات is a tab inside the purchases section).
const REQUIRE_ACCOUNTING = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
  ],
};

// Reading the tree is also allowed for the field purchase-invoice
// entry flow (رفع فاتورة مشتريات) — lines classify on expense accounts.
const REQUIRE_PURCHASES_READ = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
    { permission: "can_add_purchase_invoices" },
    { permission: "can_manage_suppliers" },
  ],
};

// Usage counts come from tables owned by other routes, so they may not
// exist yet on a fresh database. Query each defensively and merge in
// JS instead of joining (a missing table would fail the whole SELECT).
async function fetchUsageCounts() {
  const invoiceCounts = new Map();
  const bankCounts = new Map();
  const spendTotals = new Map();
  try {
    const rows = await sql`
      SELECT expense_account_id AS id, COUNT(*)::int AS count
      FROM accounting_purchase_invoices
      WHERE expense_account_id IS NOT NULL
      GROUP BY expense_account_id
    `;
    for (const row of rows) invoiceCounts.set(Number(row.id), row.count);
  } catch {
    // table not created yet — no invoices, no counts
  }
  try {
    // Real spend per account comes from the invoice LINES (each line
    // carries its own tree account) on active invoices.
    const rows = await sql`
      SELECT item.account_id AS id,
             COUNT(DISTINCT item.invoice_id)::int AS invoices,
             COALESCE(SUM(item.line_total), 0)::float AS total
      FROM accounting_purchase_invoice_items item
      JOIN accounting_purchase_invoices inv ON inv.id = item.invoice_id
      WHERE item.account_id IS NOT NULL AND inv.is_active
      GROUP BY item.account_id
    `;
    for (const row of rows) {
      const id = Number(row.id);
      spendTotals.set(id, row.total);
      // Lines are more precise than the header column — prefer them.
      invoiceCounts.set(id, Math.max(invoiceCounts.get(id) || 0, row.invoices));
    }
  } catch {
    // items table not created yet
  }
  try {
    const rows = await sql`
      SELECT account_id AS id, COUNT(*)::int AS count
      FROM accounting_bank_accounts
      WHERE account_id IS NOT NULL
      GROUP BY account_id
    `;
    for (const row of rows) bankCounts.set(Number(row.id), row.count);
  } catch {
    // table not created yet
  }
  return { invoiceCounts, bankCounts, spendTotals };
}

// وحدة الشراء الافتراضية for accounts mirrored from inventory items:
// the item's default purchase unit, falling back to its base unit,
// then the legacy free-text unit. Defensive — items tables may not
// exist on a fresh database.
async function fetchPurchaseUnits() {
  const units = new Map();
  try {
    const rows = await sql`
      SELECT a.id,
             COALESCE(dmu.name_ar, bmu.name_ar, NULLIF(TRIM(i.unit), '')) AS unit
      FROM accounting_accounts a
      JOIN items i ON i.id = a.source_item_id
      LEFT JOIN item_units diu ON diu.id = i.default_purchase_unit_id
      LEFT JOIN measurement_units dmu ON dmu.id = diu.unit_id
      LEFT JOIN item_units bu ON bu.item_id = i.id AND bu.is_base
      LEFT JOIN measurement_units bmu ON bmu.id = bu.unit_id
      WHERE a.source_item_id IS NOT NULL
    `;
    for (const row of rows) {
      if (row.unit) units.set(Number(row.id), row.unit);
    }
  } catch {
    // items tables not created yet
  }
  return units;
}

export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_READ);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureAccountsSchema();
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "1";

    const rows = includeInactive
      ? await sql`
          SELECT
            id, code, name, name_en, account_type, parent_id,
            is_postable, is_system, source_category_id,
            source_item_id, source_bank_account_id, notes, is_active
          FROM accounting_accounts
          ORDER BY code ASC, id ASC
        `
      : await sql`
          SELECT
            id, code, name, name_en, account_type, parent_id,
            is_postable, is_system, source_category_id,
            source_item_id, source_bank_account_id, notes, is_active
          FROM accounting_accounts
          WHERE is_active
          ORDER BY code ASC, id ASC
        `;

    const { invoiceCounts, bankCounts, spendTotals } =
      await fetchUsageCounts();
    const purchaseUnits = await fetchPurchaseUnits();
    const accounts = rows.map((row) => ({
      ...row,
      invoice_count: invoiceCounts.get(Number(row.id)) || 0,
      bank_count: bankCounts.get(Number(row.id)) || 0,
      purchases_total: spendTotals.get(Number(row.id)) || 0,
      purchase_unit: purchaseUnits.get(Number(row.id)) || null,
    }));

    return Response.json({ accounts });
  } catch (error) {
    console.error("accounts GET error", error);
    return Response.json(
      { error: "فشل تحميل شجرة الحسابات", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureAccountsSchema();
    const body = await request.json().catch(() => ({}));

    const parentId = Number(body?.parent_id);
    if (!Number.isInteger(parentId) || parentId <= 0) {
      return Response.json(
        { error: "اختر الحساب الأب من الشجرة" },
        { status: 400 },
      );
    }
    const name = body?.name ? String(body.name).trim() : "";
    if (!name) {
      return Response.json({ error: "اسم الحساب مطلوب" }, { status: 400 });
    }
    const nameEn = body?.name_en ? String(body.name_en).trim() : null;
    const isPostable = body?.is_postable === undefined ? true : !!body.is_postable;
    const notes = body?.notes ? String(body.notes).trim() : null;

    const [parent] = await sql`
      SELECT id, code, account_type
      FROM accounting_accounts
      WHERE id = ${parentId} AND is_active
    `;
    if (!parent) {
      return Response.json(
        { error: "الحساب الأب غير موجود" },
        { status: 400 },
      );
    }

    // The tree stays type-consistent: children always inherit their
    // root's account_type.
    const code = body?.code
      ? String(body.code).trim()
      : await nextChildCode(parent.id, parent.code);
    if (!/^\d+$/.test(code)) {
      return Response.json(
        { error: "رقم الحساب يجب أن يكون أرقاماً فقط" },
        { status: 400 },
      );
    }

    const [dup] = await sql`
      SELECT id FROM accounting_accounts
      WHERE code = ${code} AND is_active
    `;
    if (dup) {
      return Response.json(
        { error: `رقم الحساب ${code} مستخدم بالفعل` },
        { status: 400 },
      );
    }

    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;

    const [created] = await sql`
      INSERT INTO accounting_accounts (
        code, name, name_en, account_type, parent_id,
        is_postable, is_system, notes,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${code}, ${name}, ${nameEn}, ${parent.account_type}, ${parent.id},
        ${isPostable}, FALSE, ${notes},
        ${createdById}, ${createdByName}
      )
      RETURNING *
    `;

    return Response.json({ ok: true, account: created }, { status: 201 });
  } catch (error) {
    console.error("accounts POST error", error);
    return Response.json(
      { error: "فشل إضافة الحساب", details: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureAccountsSchema();
    const body = await request.json().catch(() => ({}));
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "معرّف الحساب غير صحيح" }, { status: 400 });
    }

    const [existing] = await sql`
      SELECT id, code, is_system FROM accounting_accounts WHERE id = ${id}
    `;
    if (!existing) {
      return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
    }
    if (existing.is_system) {
      return Response.json(
        { error: "حسابات النظام الأساسية لا يمكن تعديلها" },
        { status: 400 },
      );
    }

    const name = body?.name ? String(body.name).trim() : "";
    if (!name) {
      return Response.json({ error: "اسم الحساب مطلوب" }, { status: 400 });
    }
    const nameEn = body?.name_en ? String(body.name_en).trim() : null;
    const code = body?.code ? String(body.code).trim() : existing.code;
    const isPostable = body?.is_postable === undefined ? true : !!body.is_postable;
    const notes = body?.notes ? String(body.notes).trim() : null;

    if (!/^\d+$/.test(code)) {
      return Response.json(
        { error: "رقم الحساب يجب أن يكون أرقاماً فقط" },
        { status: 400 },
      );
    }
    const [dup] = await sql`
      SELECT id FROM accounting_accounts
      WHERE code = ${code} AND is_active AND id <> ${id}
    `;
    if (dup) {
      return Response.json(
        { error: `رقم الحساب ${code} مستخدم بالفعل` },
        { status: 400 },
      );
    }

    const [updated] = await sql`
      UPDATE accounting_accounts
      SET
        code = ${code},
        name = ${name},
        name_en = ${nameEn},
        is_postable = ${isPostable},
        notes = ${notes},
        updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
      RETURNING *
    `;

    return Response.json({ ok: true, account: updated });
  } catch (error) {
    console.error("accounts PUT error", error);
    return Response.json(
      { error: "فشل تعديل الحساب", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureAccountsSchema();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "معرّف الحساب غير صحيح" }, { status: 400 });
    }

    const [existing] = await sql`
      SELECT id, is_system, source_bank_account_id
      FROM accounting_accounts
      WHERE id = ${id}
    `;
    if (!existing) {
      return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
    }
    if (existing.is_system) {
      return Response.json(
        { error: "حسابات النظام الأساسية لا يمكن إيقافها" },
        { status: 400 },
      );
    }
    if (existing.source_bank_account_id) {
      return Response.json(
        {
          error:
            "هذا الحساب مرتبط بحساب بنكي — أوقف الحساب البنكي من تبويب الحسابات البنكية",
        },
        { status: 400 },
      );
    }

    const [child] = await sql`
      SELECT id FROM accounting_accounts
      WHERE parent_id = ${id} AND is_active
      LIMIT 1
    `;
    if (child) {
      return Response.json(
        { error: "لا يمكن إيقاف حساب لديه حسابات فرعية نشطة" },
        { status: 400 },
      );
    }

    // Block deactivation while invoices still classify against it —
    // otherwise those invoices silently lose their reporting bucket.
    try {
      const [used] = await sql`
        SELECT id FROM accounting_purchase_invoices
        WHERE expense_account_id = ${id}
        LIMIT 1
      `;
      if (used) {
        return Response.json(
          {
            error:
              "لا يمكن إيقاف الحساب — توجد فواتير مشتريات مصنّفة عليه. انقل الفواتير لحساب آخر أولاً",
          },
          { status: 400 },
        );
      }
    } catch {
      // invoices table not created yet — nothing references the account
    }

    const [updated] = await sql`
      UPDATE accounting_accounts
      SET is_active = FALSE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
      WHERE id = ${id}
      RETURNING id
    `;
    if (!updated) {
      return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("accounts DELETE error", error);
    return Response.json(
      { error: "فشل إيقاف الحساب", details: error.message },
      { status: 500 },
    );
  }
}
