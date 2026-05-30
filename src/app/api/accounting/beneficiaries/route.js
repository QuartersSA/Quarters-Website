// Payment beneficiaries. Each row = a bank payee that money can
// be transferred to. Optionally linked to a contact so the same
// supplier's bank details surface automatically when a purchase
// invoice is paid.

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

const REQUIRE_ACCOUNTING = {
  role: "Admin",
  permission: "can_manage_accounting",
};

async function ensureSchema() {
  // accounting_contacts is created by /api/accounting/contacts on
  // first call; bootstrap the FK target here too so the
  // beneficiaries route can be the first one hit.
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
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_beneficiaries (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      iban TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'SAR',
      bank_name TEXT,
      swift TEXT,
      contact_id INTEGER REFERENCES accounting_contacts(id) ON DELETE SET NULL,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
}

// GET /api/accounting/beneficiaries
//   ?q=               name / IBAN / bank search
//   ?contact_id=N     only beneficiaries linked to a contact
//   ?includeInactive=1
export async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureSchema();
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim();
    const contactIdRaw = url.searchParams.get("contact_id");
    const includeInactive =
      url.searchParams.get("includeInactive") === "1";

    const conditions = [];
    const values = [];
    let idx = 1;

    if (!includeInactive) {
      conditions.push("b.is_active = TRUE");
    }
    if (contactIdRaw) {
      const cid = Number(contactIdRaw);
      if (Number.isFinite(cid) && cid > 0) {
        conditions.push(`b.contact_id = $${idx}`);
        values.push(cid);
        idx += 1;
      }
    }
    if (q) {
      conditions.push(
        `(LOWER(b.name) LIKE $${idx} OR LOWER(b.iban) LIKE $${idx} OR LOWER(COALESCE(b.bank_name,'')) LIKE $${idx})`,
      );
      values.push(`%${q.toLowerCase()}%`);
      idx += 1;
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const query = `
      SELECT b.id, b.name, b.iban, b.currency, b.bank_name, b.swift,
             b.contact_id, b.notes, b.is_active,
             b.created_at, b.updated_at,
             b.created_by_employee_id, b.created_by_employee_name,
             c.name AS contact_name
      FROM accounting_beneficiaries b
      LEFT JOIN accounting_contacts c ON c.id = b.contact_id
      ${where}
      ORDER BY b.is_active DESC, b.name ASC, b.id DESC
    `;
    const rows = await sql(query, values);
    return Response.json({ beneficiaries: rows });
  } catch (error) {
    console.error("beneficiaries GET error", error);
    return Response.json(
      { error: "فشل تحميل المستفيدين", details: error.message },
      { status: 500 },
    );
  }
}

// POST /api/accounting/beneficiaries
// body: {
//   name, iban (required),
//   currency?, bank_name?, swift?, contact_id?, notes?
// }
export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    await ensureSchema();
    const body = await request.json().catch(() => ({}));

    const name = body.name ? String(body.name).trim() : "";
    if (!name) {
      return Response.json({ error: "اسم المستفيد مطلوب" }, { status: 400 });
    }
    const iban = body.iban
      ? String(body.iban).replace(/\s+/g, "").toUpperCase()
      : "";
    if (!iban) {
      return Response.json({ error: "رقم الآيبان مطلوب" }, { status: 400 });
    }

    const currency = body.currency
      ? String(body.currency).trim().toUpperCase()
      : "SAR";
    const bankName = body.bank_name
      ? String(body.bank_name).trim()
      : null;
    const swift = body.swift
      ? String(body.swift).trim().toUpperCase()
      : null;
    const contactId =
      body.contact_id === null ||
      body.contact_id === undefined ||
      body.contact_id === ""
        ? null
        : Number(body.contact_id);
    if (
      body.contact_id !== null &&
      body.contact_id !== undefined &&
      body.contact_id !== "" &&
      (!Number.isFinite(contactId) || contactId <= 0)
    ) {
      return Response.json({ error: "جهة الاتصال غير صحيحة" }, { status: 400 });
    }
    const notes = body.notes ? String(body.notes).trim() : null;
    const createdById = auth.user?.id ? Number(auth.user.id) : null;
    const createdByName = auth.user?.name ? String(auth.user.name) : null;

    const [created] = await sql`
      INSERT INTO accounting_beneficiaries (
        name, iban, currency, bank_name, swift, contact_id, notes,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${name}, ${iban}, ${currency}, ${bankName}, ${swift}, ${contactId}, ${notes},
        ${createdById}, ${createdByName}
      )
      RETURNING *
    `;
    return Response.json({ ok: true, beneficiary: created });
  } catch (error) {
    console.error("beneficiaries POST error", error);
    return Response.json(
      { error: "فشل إضافة المستفيد", details: error.message },
      { status: 500 },
    );
  }
}
