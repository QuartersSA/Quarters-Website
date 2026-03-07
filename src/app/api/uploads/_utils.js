import sql from "@/app/api/utils/sql";

export const MAX_UPLOAD_BYTES = 90 * 1024 * 1024; // 90MB

export async function ensureUploadTables() {
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
