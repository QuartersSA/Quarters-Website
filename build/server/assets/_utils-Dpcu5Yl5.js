import sql from './sql-CSDV1lSC.js';

const MAX_UPLOAD_BYTES = 90 * 1024 * 1024; // 90MB
const MAX_UPLOAD_CHUNKS = 1_000;
const MAX_CHUNK_BYTES = 256 * 1024;
async function ensureUploadTables() {
  // sessions
  await sql`
    CREATE TABLE IF NOT EXISTS upload_sessions (
      id BIGSERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      size_bytes BIGINT NOT NULL,
      total_chunks INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITHOUT TIME ZONE
    )
  `;

  // Idempotent column add: ownership for access control.
  // Pre-existing rows have NULL owner (legacy) and stay readable to keep
  // attachments on old tasks working; write paths require ownership for
  // any row that does have an owner.
  await sql`
    ALTER TABLE upload_sessions
    ADD COLUMN IF NOT EXISTS created_by_employee_id INTEGER
  `;

  // Per-file access token. Returned in the completed-file URL as `?t=<token>`
  // so that <img src=...> and <a href=...> work without an Authorization
  // header. Legacy rows have NULL — they remain reachable via Authorization
  // header only (the file GET endpoint accepts either).
  await sql`
    ALTER TABLE upload_sessions
    ADD COLUMN IF NOT EXISTS access_token TEXT
  `;

  // chunks
  await sql`
    CREATE TABLE IF NOT EXISTS upload_chunks (
      session_id BIGINT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, chunk_index)
    )
  `;
}

/**
 * Fetch a session and check the authenticated user owns it (or it's a
 * legacy row with no owner). Returns `{ session, error, status }`.
 *   - `{ session: row }` on success
 *   - `{ error: "not_found", status: 404 }` if no row
 *   - `{ error: "forbidden", status: 403 }` if owner != user
 */
async function getOwnedSession(id, userId) {
  const [row] = await sql`
    SELECT id, file_name, mime_type, size_bytes, total_chunks, status,
           created_by_employee_id, access_token
    FROM upload_sessions
    WHERE id = ${id}
  `;
  if (!row) return {
    session: null,
    error: "not_found",
    status: 404
  };
  const owner = row.created_by_employee_id;
  if (owner !== null && owner !== undefined && Number(owner) !== Number(userId)) {
    return {
      session: null,
      error: "forbidden",
      status: 403
    };
  }
  return {
    session: row,
    error: null,
    status: 200
  };
}

export { MAX_CHUNK_BYTES as M, MAX_UPLOAD_CHUNKS as a, MAX_UPLOAD_BYTES as b, ensureUploadTables as e, getOwnedSession as g };
