import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureUploadTables, g as getOwnedSession } from './_utils-Bbv0EQLW.js';
import '@neondatabase/serverless';
import 'crypto';

async function POST(request, {
  params: {
    sessionId
  }
}) {
  const auth = requireAuth(request, {
    role: "Admin"
  });
  if (!auth.ok) {
    return Response.json({
      error: auth.error
    }, {
      status: auth.status
    });
  }
  const userId = Number(auth.user?.id) || null;
  if (!userId) {
    return Response.json({
      error: "Unauthorized"
    }, {
      status: 401
    });
  }
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
    const owned = await getOwnedSession(id, userId);
    if (owned.error) {
      const msg = owned.error === "forbidden" ? "ليست لديك صلاحية إنهاء هذه الجلسة" : "جلسة الرفع غير موجودة";
      return Response.json({
        error: msg
      }, {
        status: owned.status
      });
    }
    const session = owned.session;
    if (session.status !== "in_progress") {
      return Response.json({
        error: "جلسة الرفع ليست قيد التنفيذ"
      }, {
        status: 409
      });
    }
    const totalChunks = Number(session.total_chunks);
    if (!Number.isFinite(totalChunks) || totalChunks <= 0) {
      return Response.json({
        error: "عدد الأجزاء غير صحيح"
      }, {
        status: 400
      });
    }
    const [integrity = {}] = await sql`
      SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(OCTET_LENGTH(data)), 0)::bigint AS total_bytes,
        MIN(chunk_index)::int AS min_index,
        MAX(chunk_index)::int AS max_index
      FROM upload_chunks
      WHERE session_id = ${id}
    `;
    const uploadedChunks = Number(integrity.count) || 0;
    const uploadedBytes = Number(integrity.total_bytes) || 0;
    const indexesComplete = Number(integrity.min_index) === 0 && Number(integrity.max_index) === totalChunks - 1;
    if (uploadedChunks !== totalChunks || !indexesComplete || uploadedBytes !== Number(session.size_bytes)) {
      return Response.json({
        error: `لم يكتمل رفع الملف (${uploadedChunks}/${totalChunks}). جرّب مرة ثانية.`
      }, {
        status: 400
      });
    }

    // Mark completed. IMPORTANT: we keep the chunks in Postgres and serve the file
    // from /api/uploads/:id/file. This avoids hitting Anything's upload payload limits.
    await sql`UPDATE upload_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ${id}`;

    // Embed the per-file access token so <img src=...> / <a href=...> work
    // without a Bearer header. Legacy sessions without a token are still
    // reachable by sending Authorization, but those URLs won't be re-emitted.
    const fileUrl = session.access_token ? `/api/uploads/${id}/file?t=${encodeURIComponent(session.access_token)}` : `/api/uploads/${id}/file`;
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
