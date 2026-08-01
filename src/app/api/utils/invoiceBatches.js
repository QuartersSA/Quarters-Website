import sql from "@/app/api/utils/sql";

// دفعات الرفع الجماعي لفواتير المشتريات: الدفعة أم، وكل فاتورة
// مرفوعة بند فيها يحمل حالته ونتيجة تحليله ومسودته القابلة للتعديل.
//
// حالات البند (status):
//   uploaded        مرفوعة بانتظار التحليل
//   analyzing       قيد التحليل الذكي
//   ready           جاهزة للمراجعة (استخراج مكتمل)
//   needs_attention تحتاج انتباهاً (نقص/تكرار/ثقة منخفضة)
//   approved        معتمدة بانتظار الإرسال
//   submitted       أُرسلت لمسار الفواتير (invoice_id يشير للفاتورة)
//   failed          فشل التحليل (قابلة لإعادة المحاولة)
//
// analysis = ناتج الذكاء الخام (سجل ثابت للتدقيق)؛ draft = المسودة
// الحية التي يعدلها المستخدم — الفصل بينهما يوثق «ماذا استخرج الذكاء
// وماذا عدّل الإنسان».

export const BATCH_ITEM_STATUSES = new Set([
  "uploaded",
  "analyzing",
  "ready",
  "needs_attention",
  "approved",
  "submitted",
  "failed",
]);

export const MAX_BATCH_ITEMS = 50;

export async function ensureInvoiceBatchSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_invoice_batches (
      id SERIAL PRIMARY KEY,
      created_by_employee_id INTEGER,
      created_by_employee_name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_invoice_batch_items (
      id SERIAL PRIMARY KEY,
      batch_id INTEGER NOT NULL,
      file_name TEXT,
      file_url TEXT,
      media_type TEXT,
      upload_session_id BIGINT,
      status TEXT NOT NULL DEFAULT 'uploaded',
      analysis JSONB,
      draft JSONB,
      flags JSONB,
      error TEXT,
      edited_manually BOOLEAN NOT NULL DEFAULT FALSE,
      duplicate_invoice_id INTEGER,
      duplicate_item_id INTEGER,
      invoice_id INTEGER,
      analyzed_at TIMESTAMP,
      approved_at TIMESTAMP,
      approved_by_employee_id INTEGER,
      approved_by_employee_name TEXT,
      submitted_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh'),
      updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_invoice_batch_items_batch
      ON accounting_invoice_batch_items (batch_id, id)
  `;
}

// سقف التحليل الذكي: base64 بحد 4MiB ⇒ الملف الخام ~3MB. نفحص
// size_bytes قبل قراءة القطع حتى لا نبني في الذاكرة ملفاً ضخماً
// (حد الرفع العام 90MB) لمجرد رفضه بعد سطر.
const MAX_ANALYSIS_RAW_BYTES = 3 * 1024 * 1024;

// التحقق من ملكية جلسة الرفع قبل ربطها ببند دفعة: رابط الملف يجب أن
// يحمل access_token الجلسة نفسها (المصدر الوحيد له هو رد إكمال الرفع
// للرافع الشرعي) — يمنع تمرير معرف جلسة تخص مستخدماً آخر واستخراج
// محتواها عبر التحليل الذكي.
export async function verifyUploadSessionForItem({ fileUrl, uploadSessionId }) {
  const id = Number(uploadSessionId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const urlMatch = /\/api\/uploads\/(\d+)\/file/.exec(String(fileUrl || ""));
  if (!urlMatch || Number(urlMatch[1]) !== id) return null;
  let urlToken = "";
  try {
    urlToken =
      new URL(String(fileUrl), "http://local").searchParams.get("t") || "";
  } catch {
    return null;
  }
  const [session] = await sql`
    SELECT id, mime_type, status, access_token, size_bytes
    FROM upload_sessions WHERE id = ${id}
  `;
  if (!session || session.status !== "completed") return null;
  if (!session.access_token || session.access_token !== urlToken) return null;
  return session;
}

// قراءة ملف مرفوع من مخزن القطع في القاعدة وإرجاعه base64 —
// التحليل الجماعي يجري على الخادم فلا يعيد المتصفح رفع الملف.
export async function readUploadBase64(uploadSessionId) {
  const id = Number(uploadSessionId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const [session] = await sql`
    SELECT id, mime_type, status, size_bytes
    FROM upload_sessions WHERE id = ${id}
  `;
  if (!session || session.status !== "completed") return null;
  if (Number(session.size_bytes) > MAX_ANALYSIS_RAW_BYTES) {
    return { tooLarge: true };
  }
  const chunks = await sql`
    SELECT chunk_index, data FROM upload_chunks
    WHERE session_id = ${id}
    ORDER BY chunk_index ASC
  `;
  if (!chunks?.length) return null;
  const buffers = chunks.map((chunk) =>
    Buffer.isBuffer(chunk.data) ? chunk.data : Buffer.from(chunk.data),
  );
  return {
    base64: Buffer.concat(buffers).toString("base64"),
    mimeType: session.mime_type || "application/octet-stream",
  };
}
