import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ethers } from "ethers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyUserMatches, AuthError } from "@/lib/auth-verify";
import { isAllowedImageUrl } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid request", 400);

    const uid = await verifyUserMatches(req.headers.get("Authorization"), body.uid);

    const { memeId, contentHash, title, imageUrl, creator, epoch, txHash } =
      body as Record<string, unknown>;

    if (
      typeof memeId !== "string" ||
      typeof contentHash !== "string" ||
      typeof title !== "string" ||
      typeof imageUrl !== "string" ||
      typeof creator !== "string" ||
      typeof txHash !== "string"
    ) return err("Missing fields", 400);

    if (!ethers.isAddress(creator)) return err("Invalid creator address", 400);
    if (title.length > 100 || title.length < 1) return err("Invalid title", 400);
    if (memeId.length > 128 || contentHash.length > 128 || txHash.length > 80)
      return err("Invalid field length", 400);
    // Only allow image URLs from trusted hosts (blocks SSRF / javascript: / data: / internal IPs)
    if (!isAllowedImageUrl(imageUrl)) return err("Image URL must be on an allowed host (ipfs/imgur/etc.)", 400);

    // Rate limit submissions — 10/hr per user, 20/hr per IP
    const ip = getClientIp(req);
    const [userRL, ipRL] = await Promise.all([
      checkRateLimit(`memesubmit:uid:${uid}`, 10, 3600),
      checkRateLimit(`memesubmit:ip:${ip}`,   20, 3600),
    ]);
    if (!userRL.allowed) return err(`Rate limit: retry in ${userRL.resetInSeconds}s`, 429);
    if (!ipRL.allowed)   return err(`Rate limit: retry in ${ipRL.resetInSeconds}s`, 429);

    const db = getAdminDb();

    // Verify uid matches a real user
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return err("User not found", 404);

    // Prevent duplicate memeId submissions
    const existing = await db.collection("memes").doc(memeId).get();
    if (existing.exists) return err("Meme already recorded", 409);

    const creatorName =
      userSnap.data()?.displayName ||
      `${creator.slice(0, 6)}…${creator.slice(-4)}`;

    await db.collection("memes").doc(memeId).set({
      memeId,
      contentHash,
      title,
      imageUrl,
      creator,
      creatorName,
      uid,
      epoch:       epoch ?? 0,
      score:       0,
      upvotes:     0,
      downvotes:   0,
      txHash,
      submittedAt: FieldValue.serverTimestamp(),
    });

    // Log to activity feed
    await db.collection("activity").add({
      type:        "meme_submit",
      displayName: creatorName,
      mission:     `Submitted meme: "${title.slice(0, 40)}"`,
      badge:       "🎭",
      amount:      0,
      txHash,
      timestamp:   FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, memeId });
  } catch (e: unknown) {
    if (e instanceof AuthError) return err(e.message, e.status);
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[meme/submit]", msg);
    return err("Internal error", 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
