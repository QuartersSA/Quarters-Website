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

    let types;
    if (scope && VALID_SCOPES.has(scope) && scope !== "both") {
      // Filter to categories that are 'scope' OR 'both' so a category
      // tagged as 'both' shows up under either panel.
      types = includeInactive
        ? await sql`
            SELECT id, name, scope, is_active
            FROM accounting_expense_types
            WHERE scope IN (${scope}, 'both')
            ORDER BY is_active DESC, name ASC
          `
        : await sql`
            SELECT id, name, scope, is_active
            FROM accounting_expense_types
            WHERE scope IN (${scope}, 'both')
              AND is_active = TRUE
            ORDER BY name ASC
          `;
    } else {
      types = includeInactive
        ? await sql`
            SELECT id, name, scope, is_active
            FROM accounting_expense_types
            ORDER BY is_active DESC, name ASC
          `
        : await sql`
            SELECT id, name, scope, is_active
            FROM accounting_expense_types
            WHERE is_active = TRUE
            ORDER BY name ASC
          `;
    }
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
      INSERT INTO accounting_expense_types (name, scope)
      VALUES (${name}, ${scope})
      RETURNING id, name, scope, is_active
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
