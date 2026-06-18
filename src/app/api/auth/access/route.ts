import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { signAccessToken, ACCESS_COOKIE, ACCESS_MAX_AGE_SEC } from "@/lib/access-token";

const FALLBACK_CODE = process.env.ACCESS_CODE;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.code !== "string") {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const submitted = body.code.replace(/-/g, "").toUpperCase().trim();

  // 1. Check Firestore access_codes collection (supports multiple codes)
  try {
    const db   = getAdminDb();
    const snap = await db.collection("access_codes")
      .where("code",   "==", submitted)
      .where("active", "==", true)
      .limit(1)
      .get();

    if (!snap.empty) {
      // Increment uses counter (fire-and-forget, don't block the response)
      snap.docs[0].ref.update({ uses: FieldValue.increment(1) }).catch(() => {});
      return setAccessCookie();
    }
  } catch {
    // Firestore unavailable — fall through to env var fallback
  }

  // 2. Fallback: single code from env var (backwards-compat)
  const expected = (FALLBACK_CODE ?? "").replace(/-/g, "").toUpperCase().trim();
  if (expected && submitted === expected) {
    return setAccessCookie();
  }

  return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
}

async function setAccessCookie() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ACCESS_COOKIE, await signAccessToken(), {
    httpOnly: true,
    sameSite: "strict",
    maxAge:   ACCESS_MAX_AGE_SEC,
    path:     "/",
    secure:   process.env.NODE_ENV === "production",
  });
  return res;
}
