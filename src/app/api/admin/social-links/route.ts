import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const snap = await getAdminDb().collection("admin_settings").doc("social").get();
    const defaults = {
      twitter:  "https://x.com/otter_protocol1",
      discord:  "https://discord.gg/EGzu4NHqP",
      medium:   "https://medium.com/@protocolotter",
      telegram: "https://t.me/otterprotocol",
      website:  "https://otterprotocol.xyz",
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

    const allowed = ["twitter", "discord", "medium", "telegram", "website"];
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of allowed) {
      if (key in body) update[key] = (body as Record<string, unknown>)[key];
    }

    await getAdminDb().collection("admin_settings").doc("social").set(update, { merge: true });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 403 });
  }
}
