import { NextRequest, NextResponse } from "next/server";

// Public paths that bypass the access-code gate
const PUBLIC_PATHS = new Set(["/", "/api/auth/access", "/admin"]);

// Paths that are always allowed (static assets, Next.js internals)
function isInternalPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots") ||
    pathname.startsWith("/sitemap")
  );
}

// ── Edge burst throttle ─────────────────────────────────────────────────────
// Best-effort, per-instance, in-memory sliding window applied to /api/* before
// any route handler (and therefore before any Firestore/RPC work) runs. This is
// the cheap first line against naive floods; it is NOT a substitute for a real
// WAF. Each Edge isolate has its own counter, so the effective global limit is
// (LIMIT × #isolates) — fine as a coarse circuit-breaker. Turn on Vercel's
// Attack Challenge Mode / WAF for distributed L7 attacks.
const WINDOW_MS = 10_000; // 10s window
const MAX_HITS  = 60;     // per IP per window on API paths
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function throttled(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now >= rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic cleanup so the Map can't grow unbounded under a spoofed-IP flood
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }
    return false;
  }
  rec.count++;
  return rec.count > MAX_HITS;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow internal/static paths
  if (isInternalPath(pathname)) return NextResponse.next();

  // Coarse per-IP burst limit on API routes
  if (pathname.startsWith("/api/") && throttled(clientIp(req))) {
    return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "10" },
    });
  }

  // Always allow the gate page and the access API
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Admin page handles its own auth via Firebase token verification
  if (pathname.startsWith("/admin")) return NextResponse.next();

  // API routes enforce their own auth/rate-limits; don't gate them on the cookie
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // Check for the access cookie
  const access = req.cookies.get("otter_access");
  if (!access || access.value !== "1") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all paths except static files handled by Next.js automatically
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
