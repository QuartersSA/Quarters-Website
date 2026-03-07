const WASENDER_SEND_MESSAGE_URL = "https://www.wasenderapi.com/api/send-message";
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
async function sendWhatsAppViaWasender({
  to,
  text
}) {
  const apiKey = process.env.WASENDER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Missing API key (WASENDER_API_KEY)"
    };
  }
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
}

export { sendWhatsAppViaWasender as s };
