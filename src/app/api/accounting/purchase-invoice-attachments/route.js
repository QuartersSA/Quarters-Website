import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { logPurchaseAudit } from "@/app/api/utils/purchaseAudit";

const REQUIRE_ACCOUNTING = {
  anyOf: [
    { role: "Admin", permission: "can_manage_accounting" },
    { role: "Admin", permission: "can_manage_purchases" },
  ],
};

// مرفقات إضافية على فاتورة قائمة — عرض سعر، فاتورة ضريبية لاحقة،
// سند استلام… إلخ. كل مرفق بمسمّاه ويوثَّق في سجل التدقيق.

export async function POST(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const invoiceId = Number(body.invoice_id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return Response.json({ error: "معرف الفاتورة غير صحيح" }, { status: 400 });
    }
    const url = body.url ? String(body.url).trim() : "";
    if (!url) {
      return Response.json({ error: "رابط المرفق مطلوب" }, { status: 400 });
    }
    const label = body.label ? String(body.label).trim() : null;

    const [invoice] = await sql`
      SELECT id, invoice_number FROM accounting_purchase_invoices
      WHERE id = ${invoiceId}
    `;
    if (!invoice) {
      return Response.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
    }

    const [created] = await sql`
      INSERT INTO accounting_purchase_invoice_attachments (
        invoice_id, url, label,
        created_by_employee_id, created_by_employee_name
      )
      VALUES (
        ${invoiceId}, ${url}, ${label},
        ${auth.user?.id ? Number(auth.user.id) : null},
        ${auth.user?.name ? String(auth.user.name) : null}
      )
      RETURNING *
    `;

    await logPurchaseAudit({
      entityType: "invoice",
      entityId: invoiceId,
      action: "attachment",
      summary: `إرفاق «${label || "مستند"}» على الفاتورة ${invoice.invoice_number}`,
      actor: auth.user,
    });

    return Response.json({ ok: true, attachment: created }, { status: 201 });
  } catch (error) {
    console.error("invoice attachments POST error", error);
    return Response.json(
      { error: "فشل إضافة المرفق", details: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  const auth = requireAuth(request, REQUIRE_ACCOUNTING);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "معرف المرفق غير صحيح" }, { status: 400 });
    }
    const [deleted] = await sql`
      DELETE FROM accounting_purchase_invoice_attachments
      WHERE id = ${id}
      RETURNING invoice_id, label
    `;
    if (!deleted) {
      return Response.json({ error: "المرفق غير موجود" }, { status: 404 });
    }
    await logPurchaseAudit({
      entityType: "invoice",
      entityId: Number(deleted.invoice_id),
      action: "attachment_removed",
      summary: `حذف المرفق «${deleted.label || "مستند"}» من الفاتورة`,
      actor: auth.user,
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("invoice attachments DELETE error", error);
    return Response.json(
      { error: "فشل حذف المرفق", details: error.message },
      { status: 500 },
    );
  }
}
