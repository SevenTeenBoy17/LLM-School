interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;
const configuredBucketLimit = Number(process.env.EDUAI_RATE_LIMIT_MAX_BUCKETS ?? 10_000);
const MAX_BUCKETS = Number.isFinite(configuredBucketLimit)
  ? Math.min(100_000, Math.max(1_000, Math.floor(configuredBucketLimit)))
  : 10_000;

function makeBucketRoom() {
  if (buckets.size < MAX_BUCKETS) return;
  for (const bucketKey of buckets.keys()) {
    if (bucketKey === "auth:login:global") continue;
    buckets.delete(bucketKey);
    return;
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export function clientIp(req: Request): string {
  if (process.env.EDUAI_TRUST_PROXY !== "true") return "direct";
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "proxy-unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
  }
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (!existing) makeBucketRoom();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: Math.max(0, limit - existing.count), retryAfter: 0 };
}

export function rateLimitedResponse(retryAfter: number): Response {
  return Response.json(
    { error: "rate_limited", retryAfter },
    { status: 429, headers: { "retry-after": String(retryAfter) } }
  );
}
