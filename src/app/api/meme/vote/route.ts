import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ethers } from "ethers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid request", 400);

    const { memeId, voter, upvote, txHash, uid } = body as Record<string, unknown>;

    if (
      typeof memeId !== "string" ||
      typeof voter !== "string" ||
      typeof upvote !== "boolean" ||
      typeof txHash !== "string" ||
      typeof uid !== "string"
    ) return err("Missing fields", 400);

    if (!ethers.isAddress(voter)) return err("Invalid voter address", 400);

    // Rate limiting
    const ip = getClientIp(req);
    const [userRL, ipRL] = await Promise.all([
      checkRateLimit(`vote:uid:${uid}`, 50, 3600),
      checkRateLimit(`vote:ip:${ip}`,  100, 3600),
    ]);
    if (!userRL.allowed) return err(`Rate limit: retry in ${userRL.resetInSeconds}s`, 429);
    if (!ipRL.allowed)   return err(`Rate limit: retry in ${ipRL.resetInSeconds}s`, 429);

    const db = getAdminDb();

    // Verify uid
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return err("User not found", 404);

    // Prevent duplicate votes in Firestore
    const voteId  = `${memeId}_${voter.toLowerCase()}`;
    const voteRef = db.collection("meme_votes").doc(voteId);

    let alreadyVoted = false;
    await db.runTransaction(async (tx) => {
      const [voteSnap, memeSnap] = await Promise.all([
        tx.get(voteRef),
        tx.get(db.collection("memes").doc(memeId)),
      ]);

      if (voteSnap.exists) { alreadyVoted = true; return; }
      if (!memeSnap.exists) throw new Error("Meme not found");

      // Record the vote
      tx.set(voteRef, {
        memeId, voter: voter.toLowerCase(), upvote, txHash, uid,
        votedAt: FieldValue.serverTimestamp(),
      });

      // Update meme score + vote counts atomically
      tx.update(db.collection("memes").doc(memeId), {
        score:    FieldValue.increment(upvote ? 1 : -1),
        upvotes:  upvote   ? FieldValue.increment(1) : FieldValue.increment(0),
        downvotes: !upvote ? FieldValue.increment(1) : FieldValue.increment(0),
      });
    });

    if (alreadyVoted) return err("Already voted", 409);

    return NextResponse.json({ success: true, voteId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg.includes("Meme not found")) return err("Meme not found", 404);
    console.error("[meme/vote]", msg);
    return err("Internal error", 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
