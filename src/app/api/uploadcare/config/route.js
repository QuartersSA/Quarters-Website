export async function GET() {
  try {
    const publicKey = process.env.EXPO_PUBLIC_UPLOADCARE_PUBLIC_KEY || null;

    // Public key is safe to expose (Uploadcare uses it client-side).
    if (!publicKey) {
      return Response.json({ error: "Uploadcare غير مفعّل" }, { status: 500 });
    }

    return Response.json(
      {
        publicKey,
        cdnBaseUrl: "https://ucarecdn.com",
      },
      { status: 200 },
    );
  } catch (e) {
    console.error("uploadcare config error", e);
    return Response.json({ error: "فشل تحميل إعدادات الرفع" }, { status: 500 });
  }
}
