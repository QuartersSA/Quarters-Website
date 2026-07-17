const WASENDER_SEND_MESSAGE_URL =
  "https://www.wasenderapi.com/api/send-message";

// Wasender accounts with "Account Protection" enabled cap sending at
// 1 message every 5 seconds. Hitting that cap returns 429 with a
// retry_after hint, and on a deploy that posts to several recipients
// in parallel (a bonus/deduction round, a multi-admin inventory
// transfer notification) the bulk of those calls used to fail.
//
// We serialize every send through a single in-process chain that
// holds a minimum interval between consecutive calls. Slightly above
// the documented 5s window so clock drift between us and Wasender
// can't push us back under the gate.
const MIN_INTERVAL_MS = 5500;
let chain = Promise.resolve();
let lastSentAt = 0;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Append `fn` to the global send chain, gated by MIN_INTERVAL_MS
// since the previous send completed. Errors don't break the chain;
// the next caller still proceeds.
function paceSend(fn) {
  const next = chain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastSentAt));
    if (wait > 0) await sleep(wait);
    try {
      return await fn();
    } finally {
      lastSentAt = Date.now();
    }
  });
  chain = next.catch(() => {});
  return next;
}

function digitsOnly(input) {
  return String(input || "")
    .replace(/\s+/g, "")
    .replace(/[^0-9]/g, "");
}

// WasenderAPI docs show numbers like: 212612345678 (no +)
// We normalize common KSA formats:
// - 05XXXXXXXX -> 9665XXXXXXXX
// - +9665XXXXXXXX -> 9665XXXXXXXX
// - 009665XXXXXXXX -> 9665XXXXXXXX
export function normalizeWasenderPhone(raw) {
  const d = digitsOnly(raw);
  if (!d) return null;

  if (d.startsWith("00")) {
    const without00 = d.slice(2);
    return normalizeWasenderPhone(without00);
  }

  // KSA local mobile
  if (d.length === 10 && d.startsWith("05")) {
    return `966${d.slice(1)}`;
  }

  // KSA local without leading 0
  if (d.length === 9 && d.startsWith("5")) {
    return `966${d}`;
  }

  // already international
  if (d.length >= 9) {
    return d;
  }

  return null;
}

// سجل تسليم: كل محاولة إرسال تُدوَّن بنتيجتها (نجاح/فشل/سبب) —
// أداة تشخيص حاسمة لحالات «الرسالة ما وصلت» بدل التخمين.
async function logWaSend(to, ok, error, queued, jid = null) {
  try {
    const sql = (await import("@/app/api/utils/sql")).default;
    await sql`
      CREATE TABLE IF NOT EXISTS wa_send_log (
        id SERIAL PRIMARY KEY,
        phone TEXT,
        ok BOOLEAN NOT NULL,
        error TEXT,
        queued BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      ALTER TABLE wa_send_log ADD COLUMN IF NOT EXISTS jid TEXT
    `;
    await sql`
      INSERT INTO wa_send_log (phone, ok, error, queued, jid)
      VALUES (${to}, ${!!ok}, ${error || null}, ${!!queued}, ${jid})
    `;
  } catch {
    // التشخيص لا يعطل الإرسال أبداً
  }
}

// صندوق صادر للرسائل الفاشلة بسبب انقطاع الاتصال — تُعاد تلقائياً
// من مؤقّت الأتمتة (كل 5 دقائق) حتى النجاح أو استنفاد المحاولات.
async function enqueueWaOutbox(to, text, lastError) {
  const sql = (await import("@/app/api/utils/sql")).default;
  await sql`
    CREATE TABLE IF NOT EXISTS wa_outbox (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      text TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
    )
  `;
  await sql`
    INSERT INTO wa_outbox (phone, text, last_error)
    VALUES (${to}, ${text}, ${lastError || null})
  `;
  console.log("wa outbox: queued message for", to);
}

// تفريغ الصندوق — يستدعيه مؤقّت الأتمتة. يتخطى بصمت إن لا رسائل،
// ويحذف ما نجح أو تجاوز 10 محاولات (مع تسجيله).
export async function flushWaOutbox() {
  try {
    const sql = (await import("@/app/api/utils/sql")).default;
    await sql`
      CREATE TABLE IF NOT EXISTS wa_outbox (
        id SERIAL PRIMARY KEY,
        phone TEXT NOT NULL,
        text TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Riyadh')
      )
    `;
    const rows = await sql`
      SELECT id, phone, text, attempts FROM wa_outbox
      ORDER BY id ASC
      LIMIT 20
    `;
    for (const row of rows) {
      if (Number(row.attempts) >= 10) {
        console.error("wa outbox: dropping message after 10 attempts", row.id);
        await sql`DELETE FROM wa_outbox WHERE id = ${row.id}`;
        continue;
      }
      const result = await sendWhatsAppViaWasender({
        to: row.phone,
        text: row.text,
      });
      // queued=true يعني ما زال غير متصل وأُعيد إدراجها — احذف
      // النسخة القديمة وحدّث عداد الجديدة لاحقاً... الأبسط: لو ما
      // زال غير متصل نبقيها ونزيد العداد بلا إدراج مكرر.
      if (result.ok) {
        await sql`DELETE FROM wa_outbox WHERE id = ${row.id}`;
      } else {
        await sql`
          UPDATE wa_outbox
          SET attempts = attempts + 1, last_error = ${result.error || null}
          WHERE id = ${row.id}
        `;
        if (result.queued) {
          // أُدرجت نسخة جديدة من داخل الإرسال — احذفها لأن الأصل باقٍ.
          await sql`
            DELETE FROM wa_outbox
            WHERE id = (SELECT MAX(id) FROM wa_outbox WHERE phone = ${row.phone} AND id <> ${row.id} AND text = ${row.text})
          `;
        }
        // غير متصل؟ لا فائدة من محاولة البقية الآن.
        if (/غير متصل/.test(result.error || "")) break;
      }
    }
  } catch (error) {
    console.error("flushWaOutbox error", error);
  }
}

// نقطة الإرسال الموحدة لكل النظام (تذكيرات المشتريات، التقارير
// المجدولة، الرواتب، الجرد…). المزود يتحدد بمتغير البيئة:
//   WHATSAPP_PROVIDER=baileys  → استضافة ذاتية داخل الخادم (مجاني)
//   غير ذلك                    → WasenderAPI الخارجي (الوضع القديم)
// كلا المسارين يمران بسلسلة التهدئة (رسالة كل 5.5 ثانية).
export async function sendWhatsAppViaWasender({ to, text }) {
  const provider = (process.env.WHATSAPP_PROVIDER || "wasender").toLowerCase();

  const normalizedTo = normalizeWasenderPhone(to);
  if (!normalizedTo) {
    return { ok: false, error: "Invalid recipient phone" };
  }

  const payload = {
    to: normalizedTo,
    text: String(text || "").trim(),
  };

  if (!payload.text) {
    return { ok: false, error: "Empty message" };
  }

  if (provider === "baileys") {
    return paceSend(async () => {
      const { sendViaBaileys } = await import(
        "@/app/api/utils/whatsappBaileys"
      );
      const result = await sendViaBaileys({
        to: normalizedTo,
        text: payload.text,
      });
      // انقطاع الاتصال لا يُضيع الرسالة: تدخل صندوق الصادر ويعيد
      // المجدول إرسالها تلقائياً بعد عودة الاتصال.
      if (!result.ok && /غير متصل/.test(result.error || "")) {
        enqueueWaOutbox(normalizedTo, payload.text, result.error).catch(
          () => {},
        );
        logWaSend(normalizedTo, false, result.error, true, result.jid || null);
        return { ...result, queued: true };
      }
      logWaSend(normalizedTo, result.ok, result.error, false, result.jid || null);
      return result;
    });
  }

  const apiKey = process.env.WASENDER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Missing API key (WASENDER_API_KEY)" };
  }

  return paceSend(async () => {
    const doFetch = async () => {
      const res = await fetch(WASENDER_SEND_MESSAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      let json = null;
      try {
        json = await res.json();
      } catch (e) {
        // ignore
      }
      return { res, json };
    };

    let { res, json } = await doFetch();

    // If the gate still tripped (e.g. another process is sharing the
    // same Wasender session), respect retry_after and try one more
    // time inside this slot. One retry only — keeps the chain moving.
    if (res.status === 429) {
      const retryAfter = Number(json?.retry_after);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000 + 500
        : MIN_INTERVAL_MS;
      await sleep(waitMs);
      ({ res, json } = await doFetch());
    }

    if (!res.ok) {
      const details = json
        ? JSON.stringify(json)
        : await res.text().catch(() => "");
      return {
        ok: false,
        error: `WasenderAPI error: [${res.status}] ${res.statusText}`,
        details,
      };
    }

    return { ok: true, data: json };
  });
}
