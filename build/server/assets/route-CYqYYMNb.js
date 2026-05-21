import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Idempotent: scope tells the UI whether this category belongs in the
// fixed-expenses panel, the variable-expenses panel, or both. Existing
// rows default to 'both' so nothing disappears after the migration.
async function ensureSchema() {
  await sql`
    ALTER TABLE accounting_expense_types
    ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'both'
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
async function GET(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    let types;
    if (scope && VALID_SCOPES.has(scope) && scope !== "both") {
      // Filter to categories that are 'scope' OR 'both' so a category
      // tagged as 'both' shows up under either panel.
      types = await sql`
        SELECT id, name, scope
        FROM accounting_expense_types
        WHERE scope IN (${scope}, 'both')
        ORDER BY name ASC
      `;
    } else {
      types = await sql`
        SELECT id, name, scope
        FROM accounting_expense_types
        ORDER BY name ASC
      `;
    }
    return Response.json({
      types
    });
  } catch (error) {
    console.error("expense-types GET error", error);
    return Response.json({
      error: "فشل تحميل أنواع المصروفات"
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/expense-types
// body: { name, scope? }
async function POST(request) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));
    const name = body.name ? String(body.name).trim() : "";
    const scope = body.scope && VALID_SCOPES.has(body.scope) ? body.scope : "both";
    if (!name) {
      return Response.json({
        error: "اسم النوع مطلوب"
      }, {
        status: 400
      });
    }
    const [existing] = await sql`SELECT id FROM accounting_expense_types WHERE name = ${name}`;
    if (existing) {
      return Response.json({
        error: "هذا النوع موجود بالفعل"
      }, {
        status: 409
      });
    }
    const [created] = await sql`
      INSERT INTO accounting_expense_types (name, scope)
      VALUES (${name}, ${scope})
      RETURNING id, name, scope
    `;
    return Response.json({
      ok: true,
      type: created
    });
  } catch (error) {
    console.error("expense-types POST error", error);
    return Response.json({
      error: "فشل إضافة نوع المصروف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
