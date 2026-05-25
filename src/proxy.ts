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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow internal/static paths
  if (isInternalPath(pathname)) return NextResponse.next();

  // Always allow the gate page and the access API
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Admin page handles its own auth via Firebase token verification
  if (pathname.startsWith("/admin")) return NextResponse.next();

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
