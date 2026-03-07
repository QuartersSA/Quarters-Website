import sql from "@/app/api/utils/sql";
import { ensureUploadTables, MAX_UPLOAD_BYTES } from "../_utils";

export async function POST(request) {
  try {
    await ensureUploadTables();

    const body = await request.json().catch(() => ({}));
    const fileName = body?.fileName ? String(body.fileName) : null;
    const mimeType = body?.mimeType ? String(body.mimeType) : null;
    const sizeBytes = Number(body?.sizeBytes);
    const totalChunks = Number(body?.totalChunks);

    if (
      !fileName ||
      !Number.isFinite(sizeBytes) ||
      !Number.isFinite(totalChunks)
    ) {
      return Response.json(
        { error: "بيانات الرفع غير صحيحة" },
        { status: 400 },
      );
    }

    if (sizeBytes <= 0 || totalChunks <= 0) {
      return Response.json(
        { error: "بيانات الرفع غير صحيحة" },
        { status: 400 },
      );
    }

    if (sizeBytes > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error: `حجم الملف كبير جدًا. الحد الأقصى ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`,
        },
        { status: 413 },
      );
    }

    const [row] = await sql`
      INSERT INTO upload_sessions (file_name, mime_type, size_bytes, total_chunks)
      VALUES (${fileName}, ${mimeType}, ${sizeBytes}, ${totalChunks})
      RETURNING id
    `;

    return Response.json({ uploadId: row.id }, { status: 200 });
  } catch (e) {
    console.error("upload init error", e);
    return Response.json({ error: "فشل بدء رفع الملف" }, { status: 500 });
  }
}
