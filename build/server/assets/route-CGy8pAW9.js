import crypto from 'node:crypto';
import { s as sql } from './sql-BfhTxwII.js';
import { r as requireAuth } from './sessionToken-DDNn6nuk.js';
import { e as ensureUploadTables } from './_utils-Bbv0EQLW.js';
import '@neondatabase/serverless';
import 'crypto';

/**
 * Two auth paths for downloading a file:
 *
 *  1. `Authorization: Bearer <token>` header — used by Workspace/admin pages
 *     that fetch the file via `authedFetch` and convert to a blob.
 *
 *  2. `?t=<access_token>` query parameter — per-file token generated at
 *     `/api/uploads/init`, returned by `/api/uploads/:id/complete` baked
 *     into the URL. This lets plain `<img src=...>` and `<a href=...>`
 *     work without a header, since browsers don't send Bearer tokens for
 *     navigation/image loads.
 *
 *  Legacy sessions (rows without an access_token, from before this rollout)
 *  are reachable only via path (1).
 */
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
      SELECT id, file_name, mime_type, status,
             created_by_employee_id, access_token
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

    // Path 2: query token.
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("t");
    const expectedToken = Buffer.from(String(session.access_token || ""));
    const suppliedToken = Buffer.from(String(queryToken || ""));
    const tokenOK = expectedToken.length > 0 && expectedToken.length === suppliedToken.length && crypto.timingSafeEqual(expectedToken, suppliedToken);

    // Path 1: Authorization header, optionally + ownership.
    if (!tokenOK) {
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
      const owner = session.created_by_employee_id;
      // Legacy NULL-owner rows: any authenticated user can fetch.
      // Owner-tagged rows: only the owner.
      if (owner !== null && owner !== undefined && Number(owner) !== Number(userId)) {
        return Response.json({
          error: "ليست لديك صلاحية تنزيل هذا الملف"
        }, {
          status: 403
        });
      }
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
    const inlineSafe = /^image\/(png|jpeg|gif|webp)$/i.test(mimeType);

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
        "Content-Disposition": `${inlineSafe ? "inline" : "attachment"}; filename="${escaped}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
        // Don't leak the access token through Referer.
        "Referrer-Policy": "no-referrer"
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
