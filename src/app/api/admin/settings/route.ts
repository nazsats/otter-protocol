import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

// GET — retrieve current season/admin settings
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const db   = getAdminDb();
    const snap = await db.collection("admin_settings").doc("season").get();

    const defaults = {
      active:          true,
      name:            "Season I",
      number:          1,
      startDate:       null,
      endDate:         null,
      otterPrecious:   true,
      otterMinMissions: 8,
      otterMinReferrals: 3,
      otterMinTier:    "OG",
      requireManualApproval: true,
      activityPointsEnabled: true,
      memeArenaEnabled:      true,
      dropHuntEnabled:       true,
    };

    return NextResponse.json(snap.exists ? { ...defaults, ...snap.data() } : defaults);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/settings GET]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — update season/admin settings
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    // Whitelist allowed fields
    const allowed = [
      "active", "name", "number", "startDate", "endDate",
      "otterPrecious", "otterMinMissions", "otterMinReferrals", "otterMinTier",
      "requireManualApproval", "activityPointsEnabled", "memeArenaEnabled", "dropHuntEnabled",
    ];

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of allowed) {
      if (key in body) update[key] = (body as Record<string, unknown>)[key];
    }

    const db = getAdminDb();
    await db.collection("admin_settings").doc("season").set(update, { merge: true });

    await db.collection("admin_log").add({
      action:  "settings_update",
      changes: update,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Not authorized") || msg.includes("Missing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[admin/settings POST]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
