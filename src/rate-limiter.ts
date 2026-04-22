// In-process rate limiter using a simple sliding-window counter stored in a
// Map keyed by client IP. Works for a single Worker instance; for multi-region
// or high-traffic deployments, replace with a Durable Object or Workers KV.
 
interface Bucket {
  count: number;
  windowStart: number;
}
 
const store = new Map<string, Bucket>();
 
// Clean up stale buckets every 500 requests to avoid unbounded memory growth.
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 500;
 
function cleanup(windowMs: number): void {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now - bucket.windowStart > windowMs) {
      store.delete(key);
    }
  }
}
 
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}
 
export function checkRateLimit(
  ip: string,
  windowMs: number,
  maxRequests: number
): RateLimitResult {
  const now = Date.now();
 
  if (++cleanupCounter >= CLEANUP_INTERVAL) {
    cleanupCounter = 0;
    cleanup(windowMs);
  }
 
  let bucket = store.get(ip);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { count: 0, windowStart: now };
    store.set(ip, bucket);
  }
 
  bucket.count += 1;
 
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetAt = bucket.windowStart + windowMs;
 
  return {
    allowed: bucket.count <= maxRequests,
    remaining,
    resetAt,
  };
}
 
/** Extract the best available client IP from Cloudflare request headers. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
