import { s as sql } from './sql-BfhTxwII.js';
import { e as ensureUploadTables } from './_utils-AGOnKbxp.js';
import '@neondatabase/serverless';

async function POST(request, {
  params: {
    sessionId
  }
}) {
  try {
    await ensureUploadTables();
    const id = Number(sessionId);
    if (!Number.isFinite(id)) {
      return Response.json({
        error: "معرّف الرفع غير صحيح"
      }, {
        status: 400
      });
    }
    const body = await request.json().catch(() => ({}));
    const totalChunksClient = Number(body?.totalChunks);
    const [session] = await sql`SELECT * FROM upload_sessions WHERE id = ${id}`;
    if (!session) {
      return Response.json({
        error: "جلسة الرفع غير موجودة"
      }, {
        status: 404
      });
    }
    if (session.status !== "in_progress") {
      return Response.json({
        error: "جلسة الرفع ليست قيد التنفيذ"
      }, {
        status: 409
      });
    }
    const totalChunks = Number.isFinite(totalChunksClient) ? totalChunksClient : Number(session.total_chunks);
    if (!Number.isFinite(totalChunks) || totalChunks <= 0) {
      return Response.json({
        error: "عدد الأجزاء غير صحيح"
      }, {
        status: 400
      });
    }
    const [{
      count: countRaw
    } = {
      count: 0
    }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM upload_chunks
      WHERE session_id = ${id}
    `;
    const uploadedChunks = Number(countRaw) || 0;
    if (uploadedChunks !== totalChunks) {
      return Response.json({
        error: `لم يكتمل رفع الملف (${uploadedChunks}/${totalChunks}). جرّب مرة ثانية.`
      }, {
        status: 400
      });
    }

    // Mark completed. IMPORTANT: we keep the chunks in Postgres and serve the file
    // from /api/uploads/:id/file. This avoids hitting Anything's upload payload limits.
    await sql`UPDATE upload_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    const fileUrl = `/api/uploads/${id}/file`;
    return Response.json({
      url: fileUrl,
      mimeType: session.mime_type || null,
      name: session.file_name
    }, {
      status: 200
    });
  } catch (e) {
    console.error("upload complete error", e);
    return Response.json({
      error: "فشل إنهاء رفع الملف"
    }, {
      status: 500
    });
  }
}

export { POST };
