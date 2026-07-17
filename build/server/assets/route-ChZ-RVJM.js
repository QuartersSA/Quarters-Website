import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureRecurringSchema } from './purchaseAutomation-9x1ih-XM.js';
import { l as logPurchaseAudit } from './purchaseAudit-DX8U_Szq.js';
import '@neondatabase/serverless';
import 'crypto';
import './wasender-CtjKFWCW.js';
import './waNotify-B7OcatGW.js';

const REQUIRE_ACCOUNTING = {
  anyOf: [{
    role: "Admin",
    permission: "can_manage_accounting"
  }, {
    role: "Admin",
    permission: "can_manage_purchases"
  }]
};
function parseMoney(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 100) / 100;
}

// اليوم يُحصر في 1..28 حتى لا يسقط قالب فبراير.
function parsePayload(body = {}) {
  const dayRaw = Number(body.day_of_month);
  const contactId = Number(body.contact_id);
  const branchId = Number(body.branch_id);
  const accountId = Number(body.expense_account_id);
  const rateRaw = Number(body.tax_rate);
  return {
    name: body.name ? String(body.name).trim() : "",
    contactId: Number.isInteger(contactId) && contactId > 0 ? contactId : null,
    supplierName: body.supplier_name ? String(body.supplier_name).trim() : null,
    branchId: Number.isInteger(branchId) && branchId > 0 ? branchId : null,
    expenseAccountId: Number.isInteger(accountId) && accountId > 0 ? accountId : null,
    description: body.description ? String(body.description).trim() : null,
    amount: parseMoney(body.amount, 0),
    taxRate: Number.isFinite(rateRaw) ? Math.min(Math.max(rateRaw, 0), 100) : 15,
    amountIncludesTax: body.amount_includes_tax !== false,
    dayOfMonth: Number.isInteger(dayRaw) && dayRaw >= 1 ? Math.min(dayRaw, 28) : 1,
    isActive: body.is_active !== false
  };
}
function validatePayload(payload) {
  if (!payload.name) return "اسم القالب مطلوب";
  if (!payload.supplierName && !payload.contactId) return "المورد مطلوب";
  if (payload.amount <= 0) return "المبلغ مطلوب";
  return null;
}
async function GET(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureRecurringSchema();
    const rows = await sql`
      SELECT r.*, c.name AS contact_name, b.name AS branch_name,
             acc.code AS account_code, acc.name AS account_name
      FROM accounting_recurring_purchase_invoices r
      LEFT JOIN accounting_contacts c ON c.id = r.contact_id
      LEFT JOIN branches b ON b.id = r.branch_id
      LEFT JOIN accounting_accounts acc ON acc.id = r.expense_account_id
      ORDER BY r.is_active DESC, r.id DESC
    `;
    return Response.json({
      templates: rows
    });
  } catch (error) {
    console.error("recurring purchase invoices GET error", error);
    return Response.json({
      error: "فشل تحميل الفواتير المتكررة",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureRecurringSchema();
    const body = await request.json().catch(() => ({}));
    const payload = parsePayload(body);
    const validationError = validatePayload(payload);
    if (validationError) {
      return Response.json({
        error: validationError
      }, {
        status: 400
      });
    }
    const [created] = await sql`
      INSERT INTO accounting_recurring_purchase_invoices (
        name, contact_id, supplier_name, branch_id, expense_account_id,
        description, amount, tax_rate, amount_includes_tax,
        day_of_month, is_active,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${payload.name}, ${payload.contactId}, ${payload.supplierName},
        ${payload.branchId}, ${payload.expenseAccountId},
        ${payload.description}, ${payload.amount}, ${payload.taxRate},
        ${payload.amountIncludesTax}, ${payload.dayOfMonth},
        ${payload.isActive},
        ${auth.user?.id ? Number(auth.user.id) : null},
        ${auth.user?.name ? String(auth.user.name) : null}
      )
      RETURNING *
    `;
    await logPurchaseAudit({
      entityType: "recurring",
      entityId: created.id,
      action: "created",
      summary: `إنشاء قالب فاتورة متكررة «${payload.name}» — ${payload.amount.toFixed(2)} SAR يوم ${payload.dayOfMonth} من كل شهر`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      template: created
    }, {
      status: 201
    });
  } catch (error) {
    console.error("recurring purchase invoices POST error", error);
    return Response.json({
      error: "فشل إضافة القالب",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function PUT(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureRecurringSchema();
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف القالب غير صحيح"
      }, {
        status: 400
      });
    }
    const payload = parsePayload(body);
    const validationError = validatePayload(payload);
    if (validationError) {
      return Response.json({
        error: validationError
      }, {
        status: 400
      });
    }
    const [updated] = await sql`
      UPDATE accounting_recurring_purchase_invoices
      SET name = ${payload.name},
          contact_id = ${payload.contactId},
          supplier_name = ${payload.supplierName},
          branch_id = ${payload.branchId},
          expense_account_id = ${payload.expenseAccountId},
          description = ${payload.description},
          amount = ${payload.amount},
          tax_rate = ${payload.taxRate},
          amount_includes_tax = ${payload.amountIncludesTax},
          day_of_month = ${payload.dayOfMonth},
          is_active = ${payload.isActive}
      WHERE id = ${id}
      RETURNING *
    `;
    if (!updated) {
      return Response.json({
        error: "القالب غير موجود"
      }, {
        status: 404
      });
    }
    await logPurchaseAudit({
      entityType: "recurring",
      entityId: id,
      action: "updated",
      summary: `تعديل قالب الفاتورة المتكررة «${payload.name}»${payload.isActive ? "" : " (موقوف)"}`,
      actor: auth.user
    });
    return Response.json({
      ok: true,
      template: updated
    });
  } catch (error) {
    console.error("recurring purchase invoices PUT error", error);
    return Response.json({
      error: "فشل تعديل القالب",
      details: error.message
    }, {
      status: 500
    });
  }
}
async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  try {
    await ensureRecurringSchema();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({
        error: "معرف القالب غير صحيح"
      }, {
        status: 400
      });
    }
    const [deleted] = await sql`
      DELETE FROM accounting_recurring_purchase_invoices
      WHERE id = ${id}
      RETURNING id, name
    `;
    if (!deleted) {
      return Response.json({
        error: "القالب غير موجود"
      }, {
        status: 404
      });
    }
    await logPurchaseAudit({
      entityType: "recurring",
      entityId: id,
      action: "deleted",
      summary: `حذف قالب الفاتورة المتكررة «${deleted.name}»`,
      actor: auth.user
    });
    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error("recurring purchase invoices DELETE error", error);
    return Response.json({
      error: "فشل حذف القالب",
      details: error.message
    }, {
      status: 500
    });
  }
}

export { DELETE, GET, POST, PUT };
