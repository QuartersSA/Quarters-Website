import sql from "@/app/api/utils/sql";
import { ensureUploadTables } from "../_utils";

export async function DELETE(_request, { params: { sessionId } }) {
  try {
    await ensureUploadTables();

    const id = Number(sessionId);
    if (!Number.isFinite(id)) {
      return Response.json({ error: "معرّف الرفع غير صحيح" }, { status: 400 });
    }

    await sql`DELETE FROM upload_sessions WHERE id = ${id}`;
    return Response.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("upload abort error", e);
    return Response.json({ error: "فشل إلغاء الرفع" }, { status: 500 });
  }
}
