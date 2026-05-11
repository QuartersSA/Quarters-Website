import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import { ensureUploadTables, getOwnedSession } from "../../_utils";

export async function POST(request, { params: { sessionId } }) {
  const auth = requireAuth(request);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const userId = Number(auth.user?.id) || null;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUploadTables();

    const id = Number(sessionId);
    if (!Number.isFinite(id)) {
      return Response.json({ error: "معرّف الرفع غير صحيح" }, { status: 400 });
    }

    const url = new URL(request.url);
    const chunkIndex = Number(url.searchParams.get("index"));

    if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
      return Response.json({ error: "chunk index غير صحيح" }, { status: 400 });
    }

    const owned = await getOwnedSession(id, userId);
    if (owned.error) {
      const msg =
        owned.error === "forbidden"
          ? "ليست لديك صلاحية الرفع لهذه الجلسة"
          : "جلسة الرفع غير موجودة";
      return Response.json({ error: msg }, { status: owned.status });
    }

    if (owned.session.status !== "in_progress") {
      return Response.json(
        { error: "جلسة الرفع ليست قيد التنفيذ" },
        { status: 409 },
      );
    }

    const arrayBuffer = await request.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    if (!buf?.length) {
      return Response.json({ error: "chunk فارغ" }, { status: 400 });
    }

    await sql(
      "INSERT INTO upload_chunks (session_id, chunk_index, data) VALUES ($1, $2, $3) ON CONFLICT (session_id, chunk_index) DO UPDATE SET data = EXCLUDED.data",
      [id, chunkIndex, buf],
    );

    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("upload chunk error", e);
    return Response.json({ error: "فشل رفع جزء من الملف" }, { status: 500 });
  }
}
