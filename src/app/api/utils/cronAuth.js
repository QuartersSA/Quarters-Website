import crypto from "node:crypto";

export function constantTimeEqual(expected, supplied) {
  const a = Buffer.from(String(expected || ""));
  const b = Buffer.from(String(supplied || ""));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireCronSecret(request, envName) {
  const expected = process.env[envName];
  if (!expected) {
    return { ok: false, status: 503, error: `${envName} is not configured` };
  }

  const url = new URL(request.url);
  const supplied =
    request.headers.get("x-cron-secret") || url.searchParams.get("key") || "";

  if (!constantTimeEqual(expected, supplied)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, status: 200, error: null };
}
