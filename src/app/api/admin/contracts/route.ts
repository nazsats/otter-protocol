import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const snap = await getAdminDb().collection("admin_settings").doc("contracts").get();
    const defaults = {
      otterContract:      process.env.NEXT_PUBLIC_OTTER_CONTRACT      ?? "",
      initiationContract: process.env.NEXT_PUBLIC_INITIATION_CONTRACT ?? "",
      network:            "sepolia",
    };
    return NextResponse.json(snap.exists ? { ...defaults, ...snap.data() } : defaults);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const allowed = ["otterContract", "initiationContract", "network"];
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of allowed) {
      if (key in body) update[key] = (body as Record<string, unknown>)[key];
    }

    const db = getAdminDb();
    await db.collection("admin_settings").doc("contracts").set(update, { merge: true });
    await db.collection("admin_log").add({ action: "contracts_update", changes: update, timestamp: FieldValue.serverTimestamp() });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 403 });
  }
}
