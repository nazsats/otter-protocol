import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const db = getAdminDb();

    const [usersSnap, claimsSnap, whitelistSnap, activitySnap, settingsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("otter_claims").where("status", "==", "complete").get(),
      db.collection("otter_whitelist").get(),
      db.collection("activity").orderBy("timestamp", "desc").limit(1).get(),
      db.collection("admin_settings").doc("season").get(),
    ]);

    const users       = usersSnap.docs.map((d) => d.data());
    const totalUsers  = users.length;
    const totalPoints = users.reduce((s, u) => s + (u.points || 0), 0);
    const totalOtter  = claimsSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
    const walletCount = users.filter((u) => u.walletAddress).length;

    const tiers = { NEWCOMER: 0, MEMBER: 0, OG: 0 };
    users.forEach((u) => {
      const t = (u.tier as keyof typeof tiers) || "NEWCOMER";
      if (t in tiers) tiers[t]++;
    });

    return NextResponse.json({
      totalUsers,
      totalPoints,
      totalOtterClaimed: totalOtter,
      totalClaims:    claimsSnap.size,
      whitelistCount: whitelistSnap.size,
      walletCount,
      tiers,
      season: settingsSnap.exists ? settingsSnap.data() : { active: true, name: "Season I", number: 1 },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/stats]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
