import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

// GET — list all users (optionally filter by search query)
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const db    = getAdminDb();
    const search = req.nextUrl.searchParams.get("q")?.toLowerCase();

    const [usersSnap, missionsSnap, claimsSnap] = await Promise.all([
      db.collection("users").orderBy("points", "desc").limit(200).get(),
      db.collection("user_missions").get(),
      db.collection("otter_claims").where("status", "==", "complete").get(),
    ]);

    // Build mission counts per user
    const missionCounts: Record<string, number> = {};
    missionsSnap.docs.forEach((d) => {
      const data = d.data() as Record<string, boolean>;
      missionCounts[d.id] = Object.values(data).filter(Boolean).length;
    });

    // Build claim counts per user
    const claimCounts: Record<string, number> = {};
    claimsSnap.docs.forEach((d) => {
      const uid = d.data().uid as string;
      claimCounts[uid] = (claimCounts[uid] || 0) + 1;
    });

    let users = usersSnap.docs.map((d) => ({
      uid:          d.id,
      email:        d.data().email || null,
      displayName:  d.data().displayName || "Anonymous",
      walletAddress: d.data().walletAddress || null,
      points:       d.data().points || 0,
      tier:         d.data().tier || "NEWCOMER",
      referralCount: d.data().referralCount || 0,
      missionsCompleted: missionCounts[d.id] || 0,
      claimCount:   claimCounts[d.id] || 0,
      createdAt:    d.data().createdAt?.seconds || 0,
    }));

    if (search) {
      users = users.filter(
        (u) =>
          u.email?.toLowerCase().includes(search) ||
          u.displayName.toLowerCase().includes(search) ||
          u.walletAddress?.toLowerCase().includes(search) ||
          u.uid.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ users });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/users GET]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PUT — update a user's points or tier
export async function PUT(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { uid, points, tier, note } = body as Record<string, unknown>;
    if (typeof uid !== "string") return NextResponse.json({ error: "uid required" }, { status: 400 });

    const db  = getAdminDb();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };

    if (typeof points === "number") update.points = Math.max(0, points);
    if (typeof tier === "string" && ["NEWCOMER","MEMBER","OG"].includes(tier)) update.tier = tier;

    await ref.update(update);

    // Log admin action
    await db.collection("admin_log").add({
      action:    "update_user",
      targetUid: uid,
      changes:   update,
      note:      typeof note === "string" ? note : "",
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/users PUT]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
