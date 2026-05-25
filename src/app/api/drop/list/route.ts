import { NextRequest, NextResponse } from "next/server";
import { getAdminDb }                from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`droplist:ip:${ip}`, 30, 60);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  try {
    const db   = getAdminDb();
    const snap = await db.collection("drops")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const drops = snap.docs.map((d) => {
      const data = d.data();
      const now  = Date.now();
      return {
        dropId:     data.dropId,
        title:      data.title,
        hint:       data.hint,
        amount:     data.amount,
        maxClaims:  data.maxClaims,
        claimCount: data.claimCount,
        expiresAt:  data.expiresAt,
        active:     data.active && now < (data.expiresAt as number),
        expired:    now >= (data.expiresAt as number),
        full:       (data.claimCount as number) >= (data.maxClaims as number),
        // NEVER expose codeHash to client
      };
    });

    return NextResponse.json({ drops }, {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json({ drops: [] });
  }
}
