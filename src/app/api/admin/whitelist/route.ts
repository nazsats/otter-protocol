import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

// GET — list all whitelisted users
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const db   = getAdminDb();
    const snap = await db.collection("otter_whitelist").orderBy("addedAt", "desc").get();

    const entries = snap.docs.map((d) => ({
      id:           d.id,
      uid:          d.data().uid,
      displayName:  d.data().displayName,
      walletAddress: d.data().walletAddress || null,
      email:        d.data().email || null,
      allocation:   d.data().allocation || 0,
      reason:       d.data().reason || "",
      status:       d.data().status || "pending",
      addedAt:      d.data().addedAt?.seconds || 0,
    }));

    return NextResponse.json({ entries });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/whitelist GET]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — add a user to the OTTER whitelist
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { uid, allocation, reason } = body as Record<string, unknown>;
    if (typeof uid !== "string") return NextResponse.json({ error: "uid required" }, { status: 400 });
    if (typeof allocation !== "number" || allocation <= 0) return NextResponse.json({ error: "allocation must be positive number" }, { status: 400 });

    const db       = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const userData = userSnap.data()!;

    // Idempotent — update if already exists
    await db.collection("otter_whitelist").doc(uid).set({
      uid,
      displayName:  userData.displayName || "Anonymous",
      walletAddress: userData.walletAddress || null,
      email:        userData.email || null,
      allocation:   allocation,
      reason:       typeof reason === "string" ? reason : "Admin approved",
      status:       "approved",
      addedAt:      FieldValue.serverTimestamp(),
    });

    // Mark on user doc
    await db.collection("users").doc(uid).update({
      otterWhitelisted: true,
      otterAllocation:  allocation,
      updatedAt:        FieldValue.serverTimestamp(),
    });

    await db.collection("admin_log").add({
      action:     "whitelist_add",
      targetUid:  uid,
      allocation,
      reason:     typeof reason === "string" ? reason : "",
      timestamp:  FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/whitelist POST]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE — remove a user from the whitelist
export async function DELETE(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const uid = req.nextUrl.searchParams.get("uid");
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

    const db = getAdminDb();
    await Promise.all([
      db.collection("otter_whitelist").doc(uid).delete(),
      db.collection("users").doc(uid).update({
        otterWhitelisted: false,
        otterAllocation:  0,
        updatedAt:        FieldValue.serverTimestamp(),
      }),
    ]);

    await db.collection("admin_log").add({
      action:    "whitelist_remove",
      targetUid: uid,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/whitelist DELETE]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
