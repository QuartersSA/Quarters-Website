import crypto from 'crypto';

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecodeToString(b64url) {
  const b64 = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  return Buffer.from(padded, "base64").toString("utf8");
}
function hmacSha256Base64Url(secret, message) {
  const h = crypto.createHmac("sha256", secret);
  h.update(message);
  return base64UrlEncode(h.digest());
}
function getSigningSecret() {
  // In Anything, production + development environments sometimes differ.
  // Prefer AUTH_SECRET, but fall back to DATABASE_URL so logins don't break
  // if AUTH_SECRET isn't injected in a given environment.
  const secret = process.env.AUTH_SECRET || process.env.DATABASE_URL;
  if (!secret) {
    throw new Error("Missing signing secret");
  }
  return secret;
}
function signSessionToken(payload, {
  ttlSeconds = 60 * 60 * 24 * 7
} = {}) {
  const secret = getSigningSecret();
  const now = Math.floor(Date.now() / 1000);
  const safePayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds
  };
  const json = JSON.stringify(safePayload);
  const body = base64UrlEncode(json);
  const sig = hmacSha256Base64Url(secret, body);
  return `${body}.${sig}`;
}
function verifySessionToken(token) {
  try {
    const secret = process.env.AUTH_SECRET || process.env.DATABASE_URL;
    if (!secret) {
      return {
        ok: false,
        error: "missing_secret",
        payload: null
      };
    }
    const raw = String(token || "").trim();
    const parts = raw.split(".");
    if (parts.length !== 2) {
      return {
        ok: false,
        error: "bad_format",
        payload: null
      };
    }
    const [body, sig] = parts;
    const expected = hmacSha256Base64Url(secret, body);

    // constant-time compare
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return {
        ok: false,
        error: "bad_signature",
        payload: null
      };
    }
    const json = base64UrlDecodeToString(body);
    const payload = JSON.parse(json);
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && Number(payload.exp) < now) {
      return {
        ok: false,
        error: "expired",
        payload: null
      };
    }
    return {
      ok: true,
      error: null,
      payload
    };
  } catch (e) {
    console.error("verifySessionToken error", e);
    return {
      ok: false,
      error: "verify_failed",
      payload: null
    };
  }
}
function getBearerTokenFromRequest(request) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth) return null;
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim();
}
function requireAuth(request, {
  role,
  permission,
  anyOf
} = {}) {
  const token = getBearerTokenFromRequest(request);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      user: null
    };
  }
  const verified = verifySessionToken(token);
  if (!verified.ok) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
      user: null,
      details: verified.error
    };
  }
  const user = verified.payload;
  const checkPermission = perm => {
    if (!perm) return true;

    // Backward compat: older deployments used can_manage_employees to gate HR.
    if (perm === "can_access_hr") {
      return !!(user?.can_access_hr || user?.can_manage_employees);
    }
    return !!user?.[perm];
  };
  const checkOne = rule => {
    if (!rule) return true;
    if (rule.role && user?.role !== rule.role) return false;
    if (rule.permission && !checkPermission(rule.permission)) return false;
    return true;
  };
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    const ok = anyOf.some(r => checkOne(r));
    if (!ok) {
      return {
        ok: false,
        status: 403,
        error: "Forbidden",
        user: null
      };
    }
    return {
      ok: true,
      status: 200,
      error: null,
      user
    };
  }
  if (role && user?.role !== role) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      user: null
    };
  }
  if (permission && !checkPermission(permission)) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden",
      user: null
    };
  }
  return {
    ok: true,
    status: 200,
    error: null,
    user
  };
}

export { requireAuth as r, signSessionToken as s };
