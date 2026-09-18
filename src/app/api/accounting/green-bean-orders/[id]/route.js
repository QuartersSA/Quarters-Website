import sql from "@/app/api/utils/sql";
import { legacyGone } from "@/app/api/utils/legacyGreenBean";
import { requireAuth } from "@/app/api/utils/sessionToken";

const VAT_MULTIPLIER = 1.15;

function toId(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toDateOnly(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

function cleanText(value) {
  const t = value === null || value === undefined ? "" : String(value);
  return t.trim();
}

function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}

function round4(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 10000) / 10000;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(max, Math.max(min, x));
}

function validateNonNegative(n, label) {
  if (n === null || n === undefined) {
    return { ok: false, error: `${label} مطلوب` };
  }
  if (typeof n !== "number" || !Number.isFinite(n)) {
    return { ok: false, error: `قيمة غير صحيحة: ${label}` };
  }
  if (n < 0) {
    return { ok: false, error: `${label} يجب أن يكون 0 أو أكثر` };
  }
  return { ok: true };
}

// GET /api/accounting/green-bean-orders/:id
export async function GET(request, { params }) {
  const auth = requireAuth(request, {
    role: "Admin",
    permission: "can_manage_accounting",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const id = toId(params?.id);
  if (!id) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const [order] = await sql(
      `SELECT * FROM accounting_green_bean_orders WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!order) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const items = await sql(
      `
        SELECT
          i.*,
          b.name AS bean_name_current
        FROM accounting_green_bean_order_items i
        LEFT JOIN accounting_green_beans b
          ON b.id = i.bean_id
        WHERE i.order_id = $1
        ORDER BY i.id ASC
      `,
      [id],
    );

    return Response.json({ order, items: items || [] });
  } catch (error) {
    console.error("green bean order GET(id) error", error);
    return Response.json({ error: "فشل تحميل الطلب" }, { status: 500 });
  }
}

// DELETE — مؤرشف (410): تعديل/حذف طلب توريد قديم
export async function DELETE(request, { params }) {
  void params;
  return legacyGone();
}

// PUT — مؤرشف (410): تعديل/حذف طلب توريد قديم
export async function PUT(request, { params }) {
  void params;
  return legacyGone();
}
