import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ethers } from "ethers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid request", 400);

    const { memeId, contentHash, title, imageUrl, creator, uid, epoch, txHash } =
      body as Record<string, unknown>;

    if (
      typeof memeId !== "string" ||
      typeof contentHash !== "string" ||
      typeof title !== "string" ||
      typeof imageUrl !== "string" ||
      typeof creator !== "string" ||
      typeof uid !== "string" ||
      typeof txHash !== "string"
    ) return err("Missing fields", 400);

    if (!ethers.isAddress(creator)) return err("Invalid creator address", 400);
    if (title.length > 100 || title.length < 1) return err("Invalid title", 400);
    // Basic URL validation — allow http/https only
    if (!/^https?:\/\/.+/.test(imageUrl)) return err("Invalid image URL (must be http/https)", 400);

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
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[meme/submit]", msg);
    return err("Internal error", 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
