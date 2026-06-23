import sql from "@/app/api/utils/sql";
import { hashPassword } from "@/utils/passwordHash";
import { constantTimeEqual } from "@/app/api/utils/cronAuth";

/**
 * One-shot bootstrap endpoint for the first Admin account.
 *
 * Security model:
 *   - Caller must provide `secretKey` matching env `SETUP_SECRET_KEY`. No
 *     fallback default — if the env var isn't set, /setup is closed.
 *   - The endpoint refuses to run if any Admin already exists (prevents
 *     a leaked secret from being used to create extra admins).
 *   - GET returns only `{ hasAdmin: boolean }` — no count, no employee
 *     metadata — to avoid letting unauthenticated callers enumerate the
 *     account database.
 */
export async function POST(request) {
  const SETUP_SECRET_KEY = process.env.SETUP_SECRET_KEY;
  if (!SETUP_SECRET_KEY) {
    return Response.json(
      { error: "نقطة الإعداد معطّلة (SETUP_SECRET_KEY غير مضبوط)." },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { username, password, name, secretKey } = body || {};

    if (!constantTimeEqual(SETUP_SECRET_KEY, secretKey)) {
      return Response.json({ error: "رمز الإعداد غير صحيح" }, { status: 403 });
    }

    // Re-setup protection: once an Admin exists, /setup is sealed. Adding
    // more admins must happen through /api/employees with proper auth.
    const [{ count: adminCount }] = await sql`
      SELECT COUNT(*)::int AS count FROM employees WHERE role = 'Admin'
    `;
    if (Number(adminCount) > 0) {
      return Response.json(
        {
          error:
            "تم إعداد النظام مسبقاً. أضف المدراء الجدد من شاشة الموظفين بحساب إداري.",
        },
        { status: 409 },
      );
    }

    if (!username || !password || !name) {
      return Response.json(
        { error: "الاسم واسم المستخدم وكلمة المرور مطلوبة" },
        { status: 400 },
      );
    }

    const existingUser = await sql`
      SELECT id FROM employees WHERE LOWER(username) = LOWER(${username})
    `;
    if (existingUser.length > 0) {
      return Response.json(
        { error: "اسم المستخدم موجود بالفعل" },
        { status: 400 },
      );
    }

    const hashedPassword = await hashPassword(password);

    const [newAdmin] = await sql`
      INSERT INTO employees (name, username, password, role)
      VALUES (${name}, ${username}, ${hashedPassword}, 'Admin')
      RETURNING id, name, username, role, created_at
    `;

    return Response.json({
      success: true,
      message: "تم إنشاء حساب المدير بنجاح",
      admin: {
        id: newAdmin.id,
        name: newAdmin.name,
        username: newAdmin.username,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return Response.json({ error: "حدث خطأ أثناء الإعداد" }, { status: 500 });
  }
}

// GET — returns the minimal signal the setup screen needs. No count,
// no metadata. Anyone can call this; it only reveals one bit ("admin
// exists yes/no") which is already inferable from whether /setup
// returns 409.
export async function GET() {
  try {
    const [{ count: adminCount }] = await sql`
      SELECT COUNT(*)::int AS count FROM employees WHERE role = 'Admin'
    `;
    return Response.json({ hasAdmin: Number(adminCount) > 0 });
  } catch (error) {
    console.error("Check admin error:", error);
    return Response.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
