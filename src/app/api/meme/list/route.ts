import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const epochParam = searchParams.get("epoch");

    const db = getAdminDb();
    let query = db.collection("memes").orderBy("score", "desc").limit(50);

    // Filter by epoch if provided
    if (epochParam !== null && !isNaN(Number(epochParam))) {
      query = db
        .collection("memes")
        .where("epoch", "==", Number(epochParam))
        .orderBy("score", "desc")
        .limit(50) as typeof query;
    }

    const snap = await query.get();
    const memes = snap.docs.map((d) => {
      const data = d.data();
      return {
        ...data,
        // Convert Firestore Timestamps to epoch ms for the client
        submittedAt: data.submittedAt?.toMillis?.() ?? Date.now(),
      } as Record<string, unknown>;
    });

    // Return the current max epoch so the client can display it
    const maxEpoch = memes.reduce((max, m) => Math.max(max, (m.epoch as number) ?? 0), 0);

    return NextResponse.json({ memes, epoch: maxEpoch });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[meme/list]", msg);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
