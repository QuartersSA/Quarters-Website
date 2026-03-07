import { s as sql } from './sql-BfhTxwII.js';
import { e as ensureUploadTables } from './_utils-AGOnKbxp.js';
import '@neondatabase/serverless';

async function GET(request, {
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
    const [session] = await sql`
      SELECT id, file_name, mime_type, status
      FROM upload_sessions
      WHERE id = ${id}
    `;
    if (!session) {
      return Response.json({
        error: "الملف غير موجود"
      }, {
        status: 404
      });
    }
    if (session.status !== "completed") {
      return Response.json({
        error: "الملف غير جاهز بعد"
      }, {
        status: 409
      });
    }
    const chunks = await sql`
      SELECT chunk_index, data
      FROM upload_chunks
      WHERE session_id = ${id}
      ORDER BY chunk_index ASC
    `;
    if (!chunks?.length) {
      return Response.json({
        error: "الملف فارغ"
      }, {
        status: 404
      });
    }
    const mimeType = session.mime_type || "application/octet-stream";
    const fileName = session.file_name || "file";

    // Stream the chunks out in order to avoid creating a huge Buffer in memory.
    const stream = new ReadableStream({
      start(controller) {
        try {
          for (const c of chunks) {
            const v = c.data;
            const buf = Buffer.isBuffer(v) ? v : Buffer.from(v);
            controller.enqueue(new Uint8Array(buf));
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      }
    });

    // Basic content-disposition so the browser opens images inline but downloads
    // other files nicely when opened in a new tab.
    const escaped = String(fileName).replace(/"/g, "'");
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${escaped}"`,
        "Cache-Control": "private, max-age=31536000, immutable"
      }
    });
  } catch (e) {
    console.error("upload file get error", e);
    return Response.json({
      error: "فشل تحميل الملف"
    }, {
      status: 500
    });
  }
}

export { GET };
