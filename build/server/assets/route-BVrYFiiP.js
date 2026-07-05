import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import '@neondatabase/serverless';
import 'crypto';

// PUT    /api/accounting/beneficiaries/:id   partial update
// DELETE /api/accounting/beneficiaries/:id   soft delete (?force=1 hard)


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

// The field supplier flow (إضافة مورد) edits/links beneficiaries too.
// Deletion stays admin-only.
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
          error: "اسم المستفيد مطلوب"
        }, {
          status: 400
        });
      }
      sets.push(`name = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.iban !== undefined) {
      const v = String(body.iban).replace(/\s+/g, "").toUpperCase();
      if (!v) {
        return Response.json({
          error: "رقم الآيبان مطلوب"
        }, {
          status: 400
        });
      }
      sets.push(`iban = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.currency !== undefined) {
      sets.push(`currency = $${idx}`);
      values.push(body.currency ? String(body.currency).trim().toUpperCase() : "SAR");
      idx += 1;
    }
    if (body.bank_name !== undefined) {
      sets.push(`bank_name = $${idx}`);
      values.push(body.bank_name ? String(body.bank_name).trim() : null);
      idx += 1;
    }
    if (body.swift !== undefined) {
      sets.push(`swift = $${idx}`);
      values.push(body.swift ? String(body.swift).trim().toUpperCase() : null);
      idx += 1;
    }
    if (body.contact_id !== undefined) {
      const v = body.contact_id === null || body.contact_id === "" ? null : Number(body.contact_id);
      if (body.contact_id !== null && body.contact_id !== "" && (!Number.isFinite(v) || v <= 0)) {
        return Response.json({
          error: "جهة الاتصال غير صحيحة"
        }, {
          status: 400
        });
      }
      sets.push(`contact_id = $${idx}`);
      values.push(v);
      idx += 1;
    }
    if (body.notes !== undefined) {
      sets.push(`notes = $${idx}`);
      values.push(body.notes ? String(body.notes).trim() : null);
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
      UPDATE accounting_beneficiaries
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
      beneficiary: updated
    });
  } catch (error) {
    console.error("beneficiaries PUT error", error);
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
        DELETE FROM accounting_beneficiaries WHERE id = ${id} RETURNING id
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
      UPDATE accounting_beneficiaries
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
      beneficiary: updated
    });
  } catch (error) {
    console.error("beneficiaries DELETE error", error);
    return Response.json({
      error: "فشل الحذف",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, PUT };
