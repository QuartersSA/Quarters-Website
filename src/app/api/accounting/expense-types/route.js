import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// Idempotent: scope tells the UI whether this category belongs in the
// fixed-expenses panel, the variable-expenses panel, or both. is_active
// soft-toggles a category so it disappears from the entry surfaces
// without breaking historical accounting_expenses rows that still
// reference it. Existing rows default to scope='both', is_active=true
// so nothing disappears after the migration.
async function ensureSchema() {
  await sql`
    ALTER TABLE accounting_expense_types
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'both'
  `;
  await sql`
    ALTER TABLE accounting_expense_types
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE
  `;
  // expected_amount = the default "إجمالي المبلغ المتوقع" the admin
  // sets when adding a variable template. Used as the placeholder
  // value when a month hasn't been filled in yet.
  await sql`
    ALTER TABLE accounting_expense_types
    ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(12, 2)
  `;
  // is_template = whether this category should appear as a row in
  // the variable-expenses grid. Bare categories created from the
  // البنود tab default to FALSE (catalog-only); rows created via the
  // "إضافة قالب" flow on the variable grid set it to TRUE.
  //
  // We track whether the column existed before this request so we
  // can backfill legacy rows once — without this, every existing
  // category would disappear from the variable grid the moment the
  // column is added with its FALSE default.
  const [{ existed_before }] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'accounting_expense_types'
        AND column_name = 'is_template'
    ) AS existed_before
  `;
  await sql`
    ALTER TABLE accounting_expense_types
    ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT FALSE
  `;
  if (!existed_before) {
    await sql`
      UPDATE accounting_expense_types
         SET is_template = TRUE
       WHERE scope IN ('variable', 'both')
    `;
  }
  // Tighten with a check constraint via a guard so re-runs don't fail
  // on the duplicate-constraint error.
  try {
    await sql`
      ALTER TABLE accounting_expense_types
      ADD CONSTRAINT accounting_expense_types_scope_chk
      CHECK (scope IN ('fixed', 'variable', 'both'))
    `;
  } catch (e) {
    // already exists
  }
}

const VALID_SCOPES = new Set(["fixed", "variable", "both"]);

// GET /api/accounting/expense-types
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

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    // ?template=1 restricts the result to categories that the admin
    // explicitly created as variable templates (appear in the
    // variable grid). ?template=0 returns only catalog-only entries.
    // Omitting the param returns everything.
    const templateParam = url.searchParams.get("template");
    const onlyTemplates = templateParam === "1";
    const onlyNonTemplates = templateParam === "0";

    const conditions = [];
    if (!includeInactive) conditions.push("is_active = TRUE");
    if (scope && VALID_SCOPES.has(scope) && scope !== "both") {
      conditions.push(`scope IN ('${scope}', 'both')`);
    }
    if (onlyTemplates) conditions.push("is_template = TRUE");
    if (onlyNonTemplates) conditions.push("is_template = FALSE");

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const orderClause = includeInactive
      ? "ORDER BY is_active DESC, name ASC"
      : "ORDER BY name ASC";

    const types = await sql(
      `SELECT id, name, scope, is_active, expected_amount, is_template
         FROM accounting_expense_types
         ${whereClause}
         ${orderClause}`,
    );
    return Response.json({ types });
  } catch (error) {
    console.error("expense-types GET error", error);
    return Response.json(
      { error: "فشل تحميل أنواع المصروفات" },
      { status: 500 },
    );
  }
}

// POST /api/accounting/expense-types
// body: { name, scope? }
export async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();

    const body = await request.json().catch(() => ({}));
    const name = body.name ? String(body.name).trim() : "";
    const scope = body.scope && VALID_SCOPES.has(body.scope) ? body.scope : "both";
    const isTemplate = !!body.is_template;
    const expectedRaw =
      body.expected_amount === null ||
      body.expected_amount === undefined ||
      body.expected_amount === ""
        ? null
        : Number(body.expected_amount);
    const expectedAmount =
      expectedRaw !== null && Number.isFinite(expectedRaw) && expectedRaw >= 0
        ? expectedRaw
        : null;

    if (!name) {
      return Response.json({ error: "اسم النوع مطلوب" }, { status: 400 });
    }

    const [existing] =
      await sql`SELECT id FROM accounting_expense_types WHERE name = ${name}`;
    if (existing) {
      return Response.json(
        { error: "هذا النوع موجود بالفعل" },
        { status: 409 },
      );
    }

    const [created] = await sql`
      INSERT INTO accounting_expense_types (name, scope, expected_amount, is_template)
      VALUES (${name}, ${scope}, ${expectedAmount}, ${isTemplate})
      RETURNING id, name, scope, is_active, expected_amount, is_template
    `;

    return Response.json({ ok: true, type: created });
  } catch (error) {
    console.error("expense-types POST error", error);
    return Response.json(
      { error: "فشل إضافة نوع المصروف", details: error.message },
      { status: 500 },
    );
  }
}
