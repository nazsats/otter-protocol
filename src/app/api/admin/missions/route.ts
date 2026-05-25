import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";
import { MISSIONS } from "@/lib/missions";

// POST — complete or revoke a mission for a user
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { uid, missionId, action } = body as Record<string, unknown>;
    if (typeof uid       !== "string") return NextResponse.json({ error: "uid required" }, { status: 400 });
    if (typeof missionId !== "string") return NextResponse.json({ error: "missionId required" }, { status: 400 });
    if (action !== "complete" && action !== "revoke") return NextResponse.json({ error: 'action must be "complete" or "revoke"' }, { status: 400 });

    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return NextResponse.json({ error: "Unknown mission" }, { status: 400 });

    const db        = getAdminDb();
    const userRef   = db.collection("users").doc(uid);
    const missRef   = db.collection("user_missions").doc(uid);

    await db.runTransaction(async (tx) => {
      const [userSnap, missSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(missRef),
      ]);

      if (!userSnap.exists) throw new Error("User not found");

      const currentPoints  = (userSnap.data()!.points as number) || 0;
      const missionsDone   = missSnap.exists ? (missSnap.data() as Record<string, boolean>) : {};
      const alreadyDone    = !!missionsDone[missionId];

      if (action === "complete") {
        if (!alreadyDone) {
          tx.set(missRef, { [missionId]: true }, { merge: true });
          tx.update(userRef, {
            points:    currentPoints + mission.points,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } else {
        // revoke
        if (alreadyDone) {
          tx.set(missRef, { [missionId]: false }, { merge: true });
          tx.update(userRef, {
            points:    Math.max(0, currentPoints - mission.points),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    await db.collection("admin_log").add({
      action:    `mission_${action}`,
      targetUid: uid,
      missionId,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg.includes("User not found")) return NextResponse.json({ error: "User not found" }, { status: 404 });
    console.error("[admin/missions]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
