import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  // Rate limit public feed: 30 req/min per IP
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`activity:ip:${ip}`, 30, 60);
  if (!rl.allowed)
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  try {
    const db   = getAdminDb();
    const snap = await db.collection("activity")
      .orderBy("timestamp", "desc")
      .limit(30)
      .get();

    const feed = snap.docs.map((d) => {
      const data = d.data();
      // Strip any internal fields before sending to client
      return {
        id:          d.id,
        type:        data.type,
        displayName: data.displayName,
        mission:     data.mission,
        badge:       data.badge,
        amount:      data.amount,
        txHash:      data.txHash,
        timestamp:   data.timestamp?._seconds
          ? { seconds: data.timestamp._seconds }
          : null,
      };
    });

    return NextResponse.json({ feed }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
    });
  } catch {
    return NextResponse.json({ feed: [] });
  }
}
