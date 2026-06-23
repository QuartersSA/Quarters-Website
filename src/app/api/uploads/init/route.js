import crypto from "node:crypto";
import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/sessionToken";
import {
  ensureUploadTables,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNKS,
} from "../_utils";

export async function POST(request) {
  const auth = requireAuth(request, { role: "Admin" });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const userId = Number(auth.user?.id) || null;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUploadTables();

    const body = await request.json().catch(() => ({}));
    const fileName = body?.fileName ? String(body.fileName).trim() : null;
    const mimeType = body?.mimeType ? String(body.mimeType).trim() : null;
    const sizeBytes = Number(body?.sizeBytes);
    const totalChunks = Number(body?.totalChunks);

    if (
      !fileName ||
      !Number.isFinite(sizeBytes) ||
      !Number.isInteger(totalChunks)
    ) {
      return Response.json(
        { error: "بيانات الرفع غير صحيحة" },
        { status: 400 },
      );
    }

    if (
      sizeBytes <= 0 ||
      !Number.isInteger(sizeBytes) ||
      totalChunks <= 0 ||
      totalChunks > MAX_UPLOAD_CHUNKS ||
      fileName.length > 255 ||
      (mimeType && mimeType.length > 120)
    ) {
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

    const accessToken = crypto.randomUUID().replace(/-/g, "");

    const [row] = await sql`
      INSERT INTO upload_sessions (
        file_name, mime_type, size_bytes, total_chunks,
        created_by_employee_id, access_token
      )
      VALUES (
        ${fileName}, ${mimeType}, ${sizeBytes}, ${totalChunks},
        ${userId}, ${accessToken}
      )
      RETURNING id
    `;

    return Response.json({ uploadId: row.id }, { status: 200 });
  } catch (e) {
    console.error("upload init error", e);
    return Response.json({ error: "فشل بدء رفع الملف" }, { status: 500 });
  }
}
