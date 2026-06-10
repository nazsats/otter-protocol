import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { AggregateField } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const db = getAdminDb();

    const users  = db.collection("users");
    const claims = db.collection("otter_claims").where("status", "==", "complete");

    // Aggregation queries run server-side in Firestore — they DON'T download
    // every document, so this stays cheap at 10k+ users (the old code loaded
    // the entire users collection into memory on every admin page load).
    const [
      usersAgg, claimsAgg, walletAgg,
      newcomerAgg, memberAgg, ogAgg,
      whitelistAgg, settingsSnap,
    ] = await Promise.all([
      users.aggregate({ count: AggregateField.count(), totalPoints: AggregateField.sum("points") }).get(),
      claims.aggregate({ count: AggregateField.count(), totalOtter: AggregateField.sum("amount") }).get(),
      users.where("walletAddress", "!=", null).count().get(),
      users.where("tier", "==", "NEWCOMER").count().get(),
      users.where("tier", "==", "MEMBER").count().get(),
      users.where("tier", "==", "OG").count().get(),
      db.collection("otter_whitelist").count().get(),
      db.collection("admin_settings").doc("season").get(),
    ]);

    return NextResponse.json({
      totalUsers:        usersAgg.data().count,
      totalPoints:       usersAgg.data().totalPoints ?? 0,
      totalOtterClaimed: claimsAgg.data().totalOtter ?? 0,
      totalClaims:       claimsAgg.data().count,
      whitelistCount:    whitelistAgg.data().count,
      walletCount:       walletAgg.data().count,
      tiers: {
        NEWCOMER: newcomerAgg.data().count,
        MEMBER:   memberAgg.data().count,
        OG:       ogAgg.data().count,
      },
      season: settingsSnap.exists ? settingsSnap.data() : { active: true, name: "Season I", number: 1 },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/stats]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
