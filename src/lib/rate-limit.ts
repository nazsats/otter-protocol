/**
 * Server-side rate limiting using Firestore as backend.
 * No Redis required. Works on Vercel serverless.
 */
import { getAdminDb } from "./firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// `expireAt` is a real Timestamp so a Firestore TTL policy on the
// `rate_limits` collection (field: expireAt) can auto-delete stale counters.
// Keep a small buffer past the window so an in-flight window isn't purged early.
function ttl(windowSec: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + (windowSec + 60) * 1000);
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Check and increment rate limit counter.
 * @param key      Unique key (e.g. "claim:uid:abc123" or "redeem:ip:1.2.3.4")
 * @param max      Max requests allowed in window
 * @param windowSec Window size in seconds
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSec: number
): Promise<RateLimitResult> {
  const db      = getAdminDb();
  const now     = Math.floor(Date.now() / 1000);
  const windowEnd = now + windowSec;
  const docRef  = db.collection("rate_limits").doc(
    // Sanitize key to valid Firestore doc ID
    key.replace(/[^a-zA-Z0-9_:-]/g, "_").slice(0, 1500)
  );

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);

      if (!snap.exists) {
        tx.set(docRef, { count: 1, resetAt: windowEnd, expireAt: ttl(windowSec) });
        return { count: 1, resetAt: windowEnd };
      }

      const data     = snap.data()!;
      const resetAt  = data.resetAt as number;
      const expired  = now >= resetAt;

      if (expired) {
        // Window expired — reset
        tx.set(docRef, { count: 1, resetAt: windowEnd, expireAt: ttl(windowSec) });
        return { count: 1, resetAt: windowEnd };
      }

      const newCount = (data.count as number) + 1;
      tx.update(docRef, { count: FieldValue.increment(1) });
      return { count: newCount, resetAt };
    });

    return {
      allowed:        result.count <= max,
      remaining:      Math.max(0, max - result.count),
      resetInSeconds: Math.max(0, result.resetAt - now),
    };
  } catch {
    // On error, allow the request through (fail open for availability)
    return { allowed: true, remaining: 1, resetInSeconds: windowSec };
  }
}

/** Get client IP from Next.js request headers */
export function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
