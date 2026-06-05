import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyAdminRequest } from "@/lib/admin-auth";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
  let out = "";
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// GET — list all codes
export async function GET(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const db   = getAdminDb();
    const snap = await db.collection("access_codes").orderBy("createdAt", "desc").get();
    const codes = snap.docs.map((d) => ({
      id:        d.id,
      code:      d.data().code      ?? "",
      label:     d.data().label     ?? "",
      uses:      d.data().uses      ?? 0,
      active:    d.data().active    !== false,
      createdAt: d.data().createdAt?.toMillis?.() ?? 0,
    }));
    return NextResponse.json({ codes });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 401 });
  }
}

// POST — create a new code
export async function POST(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const body  = await req.json().catch(() => ({}));
    const label = (body.label as string) || "Manual";
    const code  = generateCode();
    const db    = getAdminDb();
    const ref   = await db.collection("access_codes").add({
      code, label, uses: 0, active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, code, label, uses: 0, active: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 401 });
  }
}

// PATCH — toggle active on / off
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const { id, active } = await req.json();
    await getAdminDb().collection("access_codes").doc(id as string).update({ active });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 401 });
  }
}

// DELETE — remove a code
export async function DELETE(req: NextRequest) {
  try {
    await verifyAdminRequest(req.headers.get("Authorization"));
    const { id } = await req.json();
    await getAdminDb().collection("access_codes").doc(id as string).delete();
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 401 });
  }
}
