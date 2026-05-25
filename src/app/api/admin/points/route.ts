import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

// POST — manually give or take points from a user
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { uid, delta, reason } = body as Record<string, unknown>;
    if (typeof uid    !== "string") return NextResponse.json({ error: "uid required" }, { status: 400 });
    if (typeof delta  !== "number") return NextResponse.json({ error: "delta must be a number" }, { status: 400 });
    if (delta === 0) return NextResponse.json({ error: "delta cannot be zero" }, { status: 400 });

    const db  = getAdminDb();
    const ref = db.collection("users").doc(uid);

    let newPoints = 0;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("User not found");

      const current = (snap.data()!.points as number) || 0;
      newPoints     = Math.max(0, current + delta);
      tx.update(ref, { points: newPoints, updatedAt: FieldValue.serverTimestamp() });
    });

    const userData = (await ref.get()).data()!;

    // Log activity
    await db.collection("activity").add({
      type:        "admin_points",
      displayName: userData.displayName || "User",
      amount:      delta,
      reason:      typeof reason === "string" ? reason : "Admin adjustment",
      timestamp:   FieldValue.serverTimestamp(),
    });

    await db.collection("admin_log").add({
      action:    "points_adjust",
      targetUid: uid,
      delta,
      newPoints,
      reason:    typeof reason === "string" ? reason : "",
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, newPoints });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg.includes("User not found")) return NextResponse.json({ error: "User not found" }, { status: 404 });
    console.error("[admin/points]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
