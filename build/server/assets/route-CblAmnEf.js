import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureUploadTables, g as getOwnedSession, M as MAX_CHUNK_BYTES } from './_utils-Bbv0EQLW.js';
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
    const url = new URL(request.url);
    const chunkIndex = Number(url.searchParams.get("index"));
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return Response.json({
        error: "chunk index غير صحيح"
      }, {
        status: 400
      });
    }
    const owned = await getOwnedSession(id, userId);
    if (owned.error) {
      const msg = owned.error === "forbidden" ? "ليست لديك صلاحية الرفع لهذه الجلسة" : "جلسة الرفع غير موجودة";
      return Response.json({
        error: msg
      }, {
        status: owned.status
      });
    }
    if (owned.session.status !== "in_progress") {
      return Response.json({
        error: "جلسة الرفع ليست قيد التنفيذ"
      }, {
        status: 409
      });
    }
    if (chunkIndex >= Number(owned.session.total_chunks)) {
      return Response.json({
        error: "chunk index out of range"
      }, {
        status: 400
      });
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_CHUNK_BYTES) {
      return Response.json({
        error: "chunk too large"
      }, {
        status: 413
      });
    }
    const arrayBuffer = await request.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (!buf?.length) {
      return Response.json({
        error: "chunk فارغ"
      }, {
        status: 400
      });
    }
    if (buf.length > MAX_CHUNK_BYTES) {
      return Response.json({
        error: "chunk too large"
      }, {
        status: 413
      });
    }
    const stored = await sql(`WITH locked AS (
         SELECT size_bytes
         FROM upload_sessions
         WHERE id = $1
         FOR UPDATE
       ), used AS (
         SELECT COALESCE(SUM(OCTET_LENGTH(data)), 0)::bigint AS bytes
         FROM upload_chunks
         WHERE session_id = $1 AND chunk_index <> $2
       )
       INSERT INTO upload_chunks (session_id, chunk_index, data)
       SELECT $1, $2, $3
       FROM locked, used
       WHERE used.bytes + OCTET_LENGTH($3::bytea) <= locked.size_bytes
       ON CONFLICT (session_id, chunk_index)
       DO UPDATE SET data = EXCLUDED.data
       RETURNING chunk_index`, [id, chunkIndex, buf]);
    if (!stored.length) {
      return Response.json({
        error: "uploaded bytes exceed declared file size"
      }, {
        status: 413
      });
    }
    return Response.json({
      ok: true
    }, {
      status: 200
    });
  } catch (e) {
    console.error("upload chunk error", e);
    return Response.json({
      error: "فشل رفع جزء من الملف"
    }, {
      status: 500
    });
  }
}

export { POST };
