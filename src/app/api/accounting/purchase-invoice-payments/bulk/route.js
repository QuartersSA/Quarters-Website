// POST /api/accounting/purchase-invoice-payments/bulk
//
// دفعة جماعية: سداد أكثر من فاتورة دفعة واحدة — بشرط نفس المورد
// ونفس العملة — بإيصال سداد واحد وحساب بنكي واحد. كل فاتورة تُسدَّد
// بكامل رصيدها المتبقي: سطر في سجل دفعاتها + تحديث رأسها، فيبقى
// مجموع السجل مطابقاً للرأس الذي تُحسب منه الحالة.

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";
import { notifyByPref } from "@/app/api/utils/waNotify";

const REQUIRE_ACCOUNTING = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
  ],
};

function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

const MAX_BULK = 50;

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const ids = [
      ...new Set(
        (Array.isArray(body.invoice_ids) ? body.invoice_ids : [])
          .map(Number)
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
    if (ids.length === 0) {
      return Response.json({ error: "حدد فاتورة واحدة على الأقل" }, { status: 400 });
    }
    if (ids.length > MAX_BULK) {
      return Response.json(
        { error: `الحد الأقصى ${MAX_BULK} فاتورة في الدفعة الواحدة` },
        { status: 400 },
      );
    }

    const invoices = await sql`
      SELECT inv.id, inv.invoice_number, inv.currency,
             inv.total_amount, inv.paid_amount,
             inv.contact_id, inv.created_by_employee_id,
             COALESCE(NULLIF(c.name, ''), NULLIF(inv.supplier_name, '')) AS supplier
      FROM accounting_purchase_invoices inv
      LEFT JOIN accounting_contacts c ON c.id = inv.contact_id
      WHERE inv.id = ANY(${ids}) AND inv.is_active = TRUE
    `;
    if (invoices.length !== ids.length) {
      return Response.json(
        { error: "بعض الفواتير المحددة غير موجودة أو موقوفة" },
        { status: 404 },
      );
    }

    // نفس المورد: جهة الاتصال إن وُجدت وإلا الاسم الحر.
    const supplierKey = (inv) =>
      inv.contact_id
        ? `c:${inv.contact_id}`
        : `s:${String(inv.supplier || "").trim().toLowerCase()}`;
    const keys = new Set(invoices.map(supplierKey));
    if (keys.size > 1) {
      return Response.json(
        { error: "الدفع الجماعي متاح لفواتير نفس المورد فقط" },
        { status: 400 },
      );
    }
    const currencies = new Set(
      invoices.map((inv) => (inv.currency || "SAR").toUpperCase()),
    );
    if (currencies.size > 1) {
      return Response.json(
        { error: "كل الفواتير يجب أن تكون بنفس العملة" },
        { status: 400 },
      );
    }
    const currency = [...currencies][0];

    const rows = invoices.map((inv) => ({
      ...inv,
      balance: round2(
        Math.max(Number(inv.total_amount || 0) - Number(inv.paid_amount || 0), 0),
      ),
    }));
    const zero = rows.find((inv) => inv.balance <= 0);
    if (zero) {
      return Response.json(
        { error: `الفاتورة ${zero.invoice_number} مدفوعة بالكامل بالفعل` },
        { status: 400 },
      );
    }

    const paymentDate = parseDate(body.payment_date) || todayRiyadh();
    const bankIdRaw = Number(body.bank_account_id);
    const bankAccountId =
      Number.isInteger(bankIdRaw) && bankIdRaw > 0 ? bankIdRaw : null;
    const receiptUrl = body.receipt_url ? String(body.receipt_url).trim() : null;
    const extraNotes = body.notes ? String(body.notes).trim() : null;
    const actorId = auth.user?.id ? Number(auth.user.id) : null;
    const actorName = auth.user?.name ? String(auth.user.name) : null;

    const numbers = rows.map((inv) => inv.invoice_number).join("، ");
    const total = round2(rows.reduce((sum, inv) => sum + inv.balance, 0));
    const paymentNote = [
      `دفعة جماعية (${rows.length} فاتورة): ${numbers}`,
      extraNotes,
    ]
      .filter(Boolean)
      .join(" — ");

    for (const inv of rows) {
      await sql`
        INSERT INTO accounting_purchase_invoice_payments (
          invoice_id, amount, payment_date, bank_account_id,
          receipt_url, notes,
          created_by_employee_id, created_by_employee_name
        )
        VALUES (
          ${inv.id}, ${inv.balance}, ${paymentDate}, ${bankAccountId},
          ${receiptUrl}, ${paymentNote}, ${actorId}, ${actorName}
        )
      `;
      await sql`
        UPDATE accounting_purchase_invoices
        SET paid_amount = total_amount,
            paid_bank_account_id = COALESCE(${bankAccountId}, paid_bank_account_id),
            payment_receipt_url = COALESCE(${receiptUrl}, payment_receipt_url),
            updated_at = (NOW() AT TIME ZONE 'Asia/Riyadh')
        WHERE id = ${inv.id}
      `;
      await logPurchaseAudit({
        entityType: "invoice",
        entityId: inv.id,
        action: "payment",
        summary: `سداد كامل ${inv.balance.toFixed(2)} ${currency} بتاريخ ${paymentDate} ضمن دفعة جماعية (${rows.length} فاتورة بإجمالي ${total.toFixed(2)})`,
        actor: auth.user,
      });
    }

    // إشعار واحد مجمّع لكل منشئ فواتير مشترك في «إيصال التحويل» —
    // لا رسالة لكل فاتورة.
    let bankName = null;
    if (bankAccountId) {
      const [bank] = await sql`
        SELECT name, bank_name FROM accounting_bank_accounts
        WHERE id = ${bankAccountId}
      `;
      bankName = bank
        ? `${bank.name}${bank.bank_name ? ` — ${bank.bank_name}` : ""}`
        : null;
    }
    const byCreator = new Map();
    for (const inv of rows) {
      if (!inv.created_by_employee_id) continue;
      const key = Number(inv.created_by_employee_id);
      if (!byCreator.has(key)) byCreator.set(key, []);
      byCreator.get(key).push(inv);
    }
    for (const [creatorId, creatorRows] of byCreator) {
      const lines = [
        `💳 دفعة جماعية سدّدت ${creatorRows.length} من فواتيرك`,
        rows[0].supplier ? `المورد: ${rows[0].supplier}` : null,
        ...creatorRows.map(
          (inv) => `• ${inv.invoice_number}: ${inv.balance.toFixed(2)} ${currency}`,
        ),
        `التاريخ: ${paymentDate}`,
        bankName ? `البنك: ${bankName}` : null,
        actorName ? `سجلها: ${actorName}` : null,
        receiptUrl ? `الإيصال: ${receiptUrl}` : null,
      ].filter(Boolean);
      notifyByPref("acc_payment_receipt", lines.join("\n"), {
        onlyEmployeeId: creatorId,
      });
    }

    return Response.json(
      { ok: true, count: rows.length, total, currency },
      { status: 201 },
    );
  } catch (error) {
    console.error("bulk invoice payments POST error", error);
    return Response.json(
      { error: "فشل تسجيل الدفعة الجماعية", details: error.message },
      { status: 500 },
    );
  }
}
