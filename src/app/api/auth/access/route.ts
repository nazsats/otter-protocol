import { NextRequest, NextResponse } from "next/server";

// ACCESS_CODE is a server-only env var (no NEXT_PUBLIC_ prefix).
// Set it in your .env.local: ACCESS_CODE=YOURCODEHERE
const ACCESS_CODE = process.env.ACCESS_CODE;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.code !== "string") {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const submitted = body.code.replace(/-/g, "").toUpperCase().trim();
  const expected  = (ACCESS_CODE ?? "").replace(/-/g, "").toUpperCase().trim();

  if (!expected || submitted !== expected) {
    // Constant-time-ish: don't short-circuit on empty
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("otter_access", "1", {
    httpOnly: true,
    sameSite: "strict",
    maxAge:   30 * 24 * 60 * 60, // 30 days
    path:     "/",
    secure:   process.env.NODE_ENV === "production",
  });
  return res;
}
