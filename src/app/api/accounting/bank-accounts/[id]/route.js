import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";

// Full accounting admins OR admins limited to قسم المشتريات only.
const REQUIRE_ACCOUNTING = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
  ],
};

const ACCOUNT_TYPES = new Set(["bank", "credit_card", "petty_cash"]);

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_bank_accounts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'bank',
      currency TEXT NOT NULL DEFAULT 'SAR',
      bank_name TEXT,
      iban TEXT,
      account_number TEXT,
      book_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      statement_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT
    )
  `;
}

function parseMoney(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 100) / 100;
}

export async function PUT(request, { params }) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const id = Number(params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: "معرّف الحساب مطلوب" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const name = body?.name ? String(body.name).trim() : "";
    if (!name) {
      return Response.json({ error: "اسم الحساب مطلوب" }, { status: 400 });
    }

    const accountTypeRaw = body?.account_type
      ? String(body.account_type).trim()
      : "bank";
    const accountType = ACCOUNT_TYPES.has(accountTypeRaw)
      ? accountTypeRaw
      : "bank";
    const currency = body?.currency
      ? String(body.currency).trim().toUpperCase()
      : "SAR";
    const bankName = body?.bank_name ? String(body.bank_name).trim() : null;
    const iban = body?.iban
      ? String(body.iban).replace(/\s+/g, "").toUpperCase()
      : null;
    const accountNumber = body?.account_number
      ? String(body.account_number).trim()
      : null;
    const bookBalance = parseMoney(body?.book_balance, 0);
    const statementBalance = parseMoney(body?.statement_balance, 0);
    const notes = body?.notes ? String(body.notes).trim() : null;

    const updated = await sql`
      UPDATE accounting_bank_accounts
      SET
        name = ${name},
        account_type = ${accountType},
        currency = ${currency},
        bank_name = ${bankName},
        iban = ${iban},
        account_number = ${accountNumber},
        book_balance = ${bookBalance},
        statement_balance = ${statementBalance},
        notes = ${notes},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (updated.length === 0) {
      return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
    }

    // Keep the linked شجرة الحسابات node in sync with the bank name.
    try {
      await sql`
        UPDATE accounting_accounts
        SET
          name = ${name},
          name_en = ${bankName},
          updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE source_bank_account_id = ${id}
      `;
    } catch {
      // tree table not created yet — nothing to sync
    }

    return Response.json({ ok: true, account: updated[0] });
  } catch (error) {
    console.error("bank accounts PUT error", error);
    return Response.json(
      { error: "فشل تعديل الحساب البنكي", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await ensureSchema();
    const id = Number(params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ error: "معرّف الحساب مطلوب" }, { status: 400 });
    }

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";

    // Retire the linked شجرة الحسابات node together with the bank
    // account (soft in both cases — the node may carry history).
    const retireTreeNode = async () => {
      try {
        await sql`
          UPDATE accounting_accounts
          SET is_active = FALSE, updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
          WHERE source_bank_account_id = ${id}
        `;
      } catch {
        // tree table not created yet
      }
    };

    if (force) {
      const deleted = await sql`
        DELETE FROM accounting_bank_accounts
        WHERE id = ${id}
        RETURNING id
      `;
      if (deleted.length === 0) {
        return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
      }
      await retireTreeNode();
      return Response.json({ ok: true, hard: true });
    }

    const updated = await sql`
      UPDATE accounting_bank_accounts
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id
    `;
    if (updated.length === 0) {
      return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
    }
    await retireTreeNode();

    return Response.json({ ok: true, hard: false });
  } catch (error) {
    console.error("bank accounts DELETE error", error);
    return Response.json(
      { error: "فشل إيقاف الحساب البنكي", details: error.message },
      { status: 500 },
    );
  }
}
