import sql from "@/app/api/utils/sql";
import { hash } from "argon2";

// Setup endpoint - Creates initial admin account
// WARNING: This should be disabled in production after first setup!
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password, name, secretKey } = body;

    // Security check - require secret key
    // Change this to your own secret!
    if (secretKey !== "SETUP_2024_INVENTORY") {
      return Response.json({ error: "رمز الإعداد غير صحيح" }, { status: 403 });
    }

    // Check if username already exists
    const existingUser = await sql`
      SELECT id FROM employees WHERE LOWER(username) = LOWER(${username})
    `;

    if (existingUser.length > 0) {
      return Response.json(
        { error: "اسم المستخدم موجود بالفعل" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await hash(password);

    // Create admin user
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

// GET endpoint to check if any admin exists
export async function GET() {
  try {
    const admins = await sql`
      SELECT COUNT(*) as count FROM employees WHERE role = 'Admin'
    `;

    const hasAdmin = parseInt(admins[0].count) > 0;

    return Response.json({
      hasAdmin,
      adminCount: parseInt(admins[0].count),
    });
  } catch (error) {
    console.error("Check admin error:", error);
    return Response.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
