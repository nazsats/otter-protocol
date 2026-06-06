import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

// GET — list all mission overrides
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const snap = await getAdminDb().collection("mission_overrides").get();
    const overrides: Record<string, unknown> = {};
    snap.docs.forEach((d) => { overrides[d.id] = d.data(); });
    return NextResponse.json({ overrides });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 403 });
  }
}

// POST — save a mission override
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const body = await req.json().catch(() => null);
    if (!body?.missionId) return NextResponse.json({ error: "Missing missionId" }, { status: 400 });

    const { missionId, title, desc, link, points, active } = body;
    const update: Record<string, unknown> = { missionId, updatedAt: FieldValue.serverTimestamp() };
    if (title   !== undefined) update.title   = title;
    if (desc    !== undefined) update.desc    = desc;
    if (link    !== undefined) update.link    = link;
    if (points  !== undefined) update.points  = Number(points);
    if (active  !== undefined) update.active  = active;

    await getAdminDb().collection("mission_overrides").doc(missionId).set(update, { merge: true });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 403 });
  }
}

// DELETE — remove an override (restore to default)
export async function DELETE(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const { missionId } = await req.json();
    await getAdminDb().collection("mission_overrides").doc(missionId as string).delete();
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 403 });
  }
}
