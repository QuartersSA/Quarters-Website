const WASENDER_SEND_MESSAGE_URL = "https://www.wasenderapi.com/api/send-message";

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
  return new Promise(resolve => {
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
  return String(input || "").replace(/\s+/g, "").replace(/[^0-9]/g, "");
}

// WasenderAPI docs show numbers like: 212612345678 (no +)
// We normalize common KSA formats:
// - 05XXXXXXXX -> 9665XXXXXXXX
// - +9665XXXXXXXX -> 9665XXXXXXXX
// - 009665XXXXXXXX -> 9665XXXXXXXX
function normalizeWasenderPhone(raw) {
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

// نقطة الإرسال الموحدة لكل النظام (تذكيرات المشتريات، التقارير
// المجدولة، الرواتب، الجرد…). المزود يتحدد بمتغير البيئة:
//   WHATSAPP_PROVIDER=baileys  → استضافة ذاتية داخل الخادم (مجاني)
//   غير ذلك                    → WasenderAPI الخارجي (الوضع القديم)
// كلا المسارين يمران بسلسلة التهدئة (رسالة كل 5.5 ثانية).
async function sendWhatsAppViaWasender({
  to,
  text
}) {
  const provider = (process.env.WHATSAPP_PROVIDER || "wasender").toLowerCase();
  const normalizedTo = normalizeWasenderPhone(to);
  if (!normalizedTo) {
    return {
      ok: false,
      error: "Invalid recipient phone"
    };
  }
  const payload = {
    to: normalizedTo,
    text: String(text || "").trim()
  };
  if (!payload.text) {
    return {
      ok: false,
      error: "Empty message"
    };
  }
  if (provider === "baileys") {
    return paceSend(async () => {
      const {
        sendViaBaileys
      } = await import('./whatsappBaileys-BtCrqvwt.js');
      return sendViaBaileys({
        to: normalizedTo,
        text: payload.text
      });
    });
  }
  const apiKey = process.env.WASENDER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Missing API key (WASENDER_API_KEY)"
    };
  }
  return paceSend(async () => {
    const doFetch = async () => {
      const res = await fetch(WASENDER_SEND_MESSAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      let json = null;
      try {
        json = await res.json();
      } catch (e) {
        // ignore
      }
      return {
        res,
        json
      };
    };
    let {
      res,
      json
    } = await doFetch();

    // If the gate still tripped (e.g. another process is sharing the
    // same Wasender session), respect retry_after and try one more
    // time inside this slot. One retry only — keeps the chain moving.
    if (res.status === 429) {
      const retryAfter = Number(json?.retry_after);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 + 500 : MIN_INTERVAL_MS;
      await sleep(waitMs);
      ({
        res,
        json
      } = await doFetch());
    }
    if (!res.ok) {
      const details = json ? JSON.stringify(json) : await res.text().catch(() => "");
      return {
        ok: false,
        error: `WasenderAPI error: [${res.status}] ${res.statusText}`,
        details
      };
    }
    return {
      ok: true,
      data: json
    };
  });
}

export { normalizeWasenderPhone as n, sendWhatsAppViaWasender as s };
