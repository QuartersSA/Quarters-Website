import sql from './sql-CSDV1lSC.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// PUT    /api/accounting/contacts/:id   update fields
// DELETE /api/accounting/contacts/:id   soft delete (is_active=false)
//                                       ?force=1 hard delete


// Full accounting admins OR admins limited to قسم المشتريات only.
const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};

// Editing suppliers is also allowed for the field flow permission
// (إضافة مورد). Deletion stays admin-only.
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

// PUT can be the first contacts endpoint a session hits — make sure
// the newer columns exist before updating.
async function ensureSchema() {
  await sql`
    ALTER TABLE accounting_contacts
      ADD COLUMN IF NOT EXISTS default_account_id INTEGER
  `;
}
async function PUT(request, {
  params
}) {
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
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({
        error: "Invalid ID"
      }, {
        status: 400
      });
    }
    const body = await request.json().catch(() => ({}));
    const sets = [];
    const values = [];
    let idx = 1;
    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (!v) {
        return Response.json({
          error: "اسم المنشأة مطلوب"
        }, {
          status: 400
        });
      }
      sets.push(`name = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.country !== undefined) {
      sets.push(`country = $${idx}`);
      values.push(body.country ? String(body.country).trim() : null);
      idx += 1;
    }
    if (body.vat_registered !== undefined) {
      sets.push(`vat_registered = $${idx}`);
      values.push(!!body.vat_registered);
      idx += 1;
    }
    if (body.vat_number !== undefined) {
      sets.push(`vat_number = $${idx}`);
      values.push(body.vat_number ? String(body.vat_number).trim() : null);
      idx += 1;
    }
    if (body.default_tax_rate !== undefined) {
      const v = Number(body.default_tax_rate);
      if (!Number.isFinite(v) || v < 0) {
        return Response.json({
          error: "معدل الضريبة الافتراضي غير صحيح"
        }, {
          status: 400
        });
      }
      sets.push(`default_tax_rate = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.notes !== undefined) {
      sets.push(`notes = $${idx}`);
      values.push(body.notes ? String(body.notes).trim() : null);
      idx += 1;
    }
    if (body.default_account_id !== undefined) {
      const v = Number(body.default_account_id);
      sets.push(`default_account_id = $${idx}`);
      values.push(Number.isInteger(v) && v > 0 ? v : null);
      idx += 1;
    }
    if (body.is_active !== undefined) {
      sets.push(`is_active = $${idx}`);
      values.push(!!body.is_active);
      idx += 1;
    }
    if (sets.length === 0) {
      return Response.json({
        error: "لا توجد حقول للتعديل"
      }, {
        status: 400
      });
    }
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const query = `
      UPDATE accounting_contacts
         SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING *
    `;
    const [updated] = await sql(query, values);
    if (!updated) {
      return Response.json({
        error: "غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      contact: updated
    });
  } catch (error) {
    console.error("contacts PUT error", error);
    return Response.json({
      error: "فشل التعديل",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request, {
  params
}) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    const resolved = await params;
    const id = Number(resolved?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({
        error: "Invalid ID"
      }, {
        status: 400
      });
    }
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    if (force) {
      const [deleted] = await sql`
        DELETE FROM accounting_contacts WHERE id = ${id} RETURNING id
      `;
      if (!deleted) {
        return Response.json({
          error: "غير موجود"
        }, {
          status: 404
        });
      }
      return Response.json({
        ok: true,
        hard: true
      });
    }
    const [updated] = await sql`
      UPDATE accounting_contacts
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = ${id}
       RETURNING *
    `;
    if (!updated) {
      return Response.json({
        error: "غير موجود"
      }, {
        status: 404
      });
    }
    return Response.json({
      ok: true,
      contact: updated
    });
  } catch (error) {
    console.error("contacts DELETE error", error);
    return Response.json({
      error: "فشل الحذف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, PUT };
