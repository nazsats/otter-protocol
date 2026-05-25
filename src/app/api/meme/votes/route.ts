import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { ethers } from "ethers";

// GET /api/meme/votes?voter=0x...
// Returns a map of { [memeId]: "up" | "down" } for the given voter address
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const voter = searchParams.get("voter");
    if (!voter || !ethers.isAddress(voter)) {
      return NextResponse.json({ votes: {} });
    }

    const db   = getAdminDb();
    const snap = await db
      .collection("meme_votes")
      .where("voter", "==", voter.toLowerCase())
      .limit(200)
      .get();

    const votes: Record<string, "up" | "down"> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      votes[data.memeId] = data.upvote ? "up" : "down";
    });

    return NextResponse.json({ votes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[meme/votes]", msg);
    return NextResponse.json({ votes: {} });
  }
}
