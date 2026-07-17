import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// Purchase-side contacts (جهات الاتصال).
//
// One row per business contact (supplier, partner, office, …).
// Used by the purchases section to pick a payee on invoices, sync
// to beneficiaries, etc.


// Reading contacts is also allowed for the field purchase-invoice
// entry flow (رفع فاتورة مشتريات) — employees with the dedicated
// permission need the supplier list to file an invoice.
const REQUIRE_PURCHASES_READ = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }, {
    permission: "can_add_purchase_invoices"
  }, {
    permission: "can_manage_suppliers"
  }]
};

// Creating/editing suppliers from the field flow needs its own
// permission (إضافة مورد) — separate from filing invoices.
const REQUIRE_SUPPLIERS_WRITE = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }, {
    permission: "can_manage_suppliers"
  }]
};
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT,
      vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
      vat_number TEXT,
      default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
  // Default شجرة الحسابات expense account for this supplier —
  // purchase-invoice lines inherit it when the contact is picked.
  await sql`
    ALTER TABLE accounting_contacts
      ADD COLUMN IF NOT EXISTS default_account_id INTEGER
  `;
}

// GET /api/accounting/contacts
//   ?includeInactive=1   include archived contacts
//   ?q=...               case-insensitive name search
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_PURCHASES_READ);
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
    const includeInactive = url.searchParams.get("includeInactive") === "1";
    const q = (url.searchParams.get("q") || "").trim();
    const conditions = [];
    const values = [];
    let idx = 1;
    if (!includeInactive) {
      conditions.push("is_active = TRUE");
    }
    if (q) {
      conditions.push(`(LOWER(name) LIKE $${idx} OR vat_number LIKE $${idx})`);
      values.push(`%${q.toLowerCase()}%`);
      idx += 1;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT id, name, country, vat_registered, vat_number,
             default_tax_rate, default_account_id, notes, is_active,
             created_at, updated_at,
             created_by_employee_id, created_by_employee_name
      FROM accounting_contacts
      ${where}
      ORDER BY is_active DESC, name ASC, id DESC
    `;
    const rows = await sql(query, values);
    return Response.json({
      contacts: rows
    });
  } catch (error) {
    console.error("contacts GET error", error);
    return Response.json({
      error: "فشل تحميل جهات الاتصال",
      details: error.message
    }, {
      status: 500
    });
  }
}

// POST /api/accounting/contacts
// body: {
//   name (required),
//   country?, vat_registered?, vat_number?,
//   default_tax_rate?, notes?
// }
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_SUPPLIERS_WRITE);
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
    if (!name) {
      return Response.json({
        error: "اسم المنشأة مطلوب"
      }, {
        status: 400
      });
    }
    const country = body.country ? String(body.country).trim() : null;
    const vatRegistered = !!body.vat_registered;
    const vatNumber = body.vat_number ? String(body.vat_number).trim() : null;
    if (vatRegistered && !vatNumber) {
      // Tax-registered contacts MUST carry a tax number.
      // Form-level validation handles this too; backend enforces.
      return Response.json({
        error: "رقم التسجيل الضريبي مطلوب عندما تكون جهة الاتصال مسجلة في ضريبة القيمة المضافة"
      }, {
        status: 400
      });
    }
    const rawRate = body.default_tax_rate;
    const defaultTaxRate = rawRate === undefined || rawRate === null || rawRate === "" ? 0 : Number(rawRate);
    if (!Number.isFinite(defaultTaxRate) || defaultTaxRate < 0) {
      return Response.json({
        error: "معدل الضريبة الافتراضي غير صحيح"
      }, {
        status: 400
      });
    }
    const notes = body.notes ? String(body.notes).trim() : null;
    const defaultAccountRaw = Number(body.default_account_id);
    const defaultAccountId = Number.isInteger(defaultAccountRaw) && defaultAccountRaw > 0 ? defaultAccountRaw : null;
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;
    const [created] = await sql`
      INSERT INTO accounting_contacts (
        name, country, vat_registered, vat_number, default_tax_rate,
        default_account_id, notes,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${name}, ${country}, ${vatRegistered}, ${vatNumber}, ${defaultTaxRate},
        ${defaultAccountId}, ${notes},
        ${createdById}, ${createdByName}
      )
      RETURNING *
    `;
    return Response.json({
      ok: true,
      contact: created
    });
  } catch (error) {
    console.error("contacts POST error", error);
    return Response.json({
      error: "فشل إضافة جهة الاتصال",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { GET, POST };
