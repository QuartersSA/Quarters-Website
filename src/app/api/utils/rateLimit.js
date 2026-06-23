const buckets = new Map();
const MAX_BUCKETS = 10_000;

function clientAddress(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    request.headers.get("cf-connecting-ip") ||
    forwarded?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function prune(now) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_BUCKETS) {
    buckets.delete(buckets.keys().next().value);
  }
}

export function consumeRateLimit(
  request,
  scope,
  { limit = 10, windowMs = 15 * 60_000, identity = "" } = {},
) {
  const now = Date.now();
  prune(now);
  const key = `${scope}:${clientAddress(request)}:${String(identity).toLowerCase()}`;
  const previous = buckets.get(key);
  const bucket =
    !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : previous;

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function clearRateLimit(request, scope, identity = "") {
  buckets.delete(
    `${scope}:${clientAddress(request)}:${String(identity).toLowerCase()}`,
  );
}
