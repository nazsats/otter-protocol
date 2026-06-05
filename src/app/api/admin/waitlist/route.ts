import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const db   = getAdminDb();
    const snap = await db.collection("waitlist").orderBy("createdAt", "desc").limit(500).get();
    const entries = snap.docs.map((d) => ({
      id:        d.id,
      email:     d.data().email    ?? "",
      createdAt: d.data().createdAt?.toMillis?.() ?? 0,
    }));
    return NextResponse.json({ entries, total: entries.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 401 });
  }
}
