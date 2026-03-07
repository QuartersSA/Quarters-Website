import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-Bl92ibIS.js';
import '@neondatabase/serverless';
import 'crypto';

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
    const types = await sql`SELECT * FROM accounting_expense_types ORDER BY name ASC`;
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
// body: { name }
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
    const body = await request.json().catch(() => ({}));
    const name = body.name ? String(body.name).trim() : "";
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
      INSERT INTO accounting_expense_types (name) VALUES (${name}) RETURNING *
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
