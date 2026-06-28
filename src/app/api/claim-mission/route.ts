import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { treasuryTransfer } from "@/lib/chain";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyUserMatches, AuthError } from "@/lib/auth-verify";
import { MISSIONS } from "@/lib/missions";

const CONTRACT = process.env.NEXT_PUBLIC_OTTER_CONTRACT!;

export async function POST(req: NextRequest) {
  try {
    // ── 0. Verify identity from Firebase ID token (not the body) ──
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid request", 400);
    const uid = await verifyUserMatches(req.headers.get("Authorization"), body.uid);

    // ── 1. Basic validation ──────────────────────────────
    const { missionId, walletAddress } = body as Record<string, unknown>;
    if (typeof missionId !== "string" || typeof walletAddress !== "string")
      return err("Missing or invalid fields", 400);
    if (!ethers.isAddress(walletAddress)) return err("Invalid wallet address", 400);
    if (missionId.length > 64) return err("Invalid field length", 400);

    // ── 2. Find mission + contract readiness FIRST ───────
    // (checked before the rate limit so no-op clicks — unknown mission or a
    //  contract that isn't deployed yet — never burn the user's claim quota)
    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return err("Unknown mission", 400);
    if (!CONTRACT) return err("Contract not deployed yet — check back soon", 503);

    const db       = getAdminDb();
    const claimId  = `${uid}_${missionId}`;
    const claimRef = db.collection("otter_claims").doc(claimId);

    // ── 3. Fast duplicate short-circuit ──────────────────
    // Already-claimed clicks return 409 WITHOUT consuming the rate limit, so a
    // user re-clicking finished missions can't lock themselves out.
    const existing = await claimRef.get();
    if (existing.exists && existing.data()?.status === "complete")
      return err("Already claimed", 409);

    // ── 4. Rate limiting — only genuine new-claim attempts count ──
    // 14 missions exist, so the per-user cap has headroom for claiming them all
    // plus the odd retry. The atomic reservation below is the real double-spend
    // guard; this is just abuse protection.
    const ip = getClientIp(req);
    const [userRL, ipRL] = await Promise.all([
      checkRateLimit(`claim:uid:${uid}`, 25, 3600),   // 25 claims per hour per user
      checkRateLimit(`claim:ip:${ip}`,   50, 3600),   // 50 claims per hour per IP
    ]);
    if (!userRL.allowed) return err(`Too many claims — retry in ${userRL.resetInSeconds}s`, 429);
    if (!ipRL.allowed)   return err(`Too many claims — retry in ${ipRL.resetInSeconds}s`, 429);

    // ── 5. Atomic verification + claim prevention ────────
    // Use Firestore transaction to atomically check + reserve the claim
    // (fixes TOCTOU race condition)

    let alreadyClaimed = false;
    await db.runTransaction(async (tx) => {
      // Read all required docs inside transaction
      const [userSnap, missionsSnap, claimSnap] = await Promise.all([
        tx.get(db.collection("users").doc(uid)),
        tx.get(db.collection("user_missions").doc(uid)),
        tx.get(claimRef),
      ]);

      if (!userSnap.exists) throw new Error("User not found");

      // Verify wallet ownership — must match account
      const storedWallet = userSnap.data()!.walletAddress as string | undefined;
      if (!storedWallet) throw new Error("No wallet linked to account");
      if (storedWallet.toLowerCase() !== walletAddress.toLowerCase())
        throw new Error("Wallet does not match account");

      // Verify mission completed
      if (!missionsSnap.exists || !missionsSnap.data()![missionId])
        throw new Error("Mission not completed");

      // Check already claimed (complete) — pending means a stuck reservation, allow retry
      if (claimSnap.exists && claimSnap.data()?.status === "complete") {
        alreadyClaimed = true; return;
      }

      // Reserve the claim slot atomically (prevents double-spend)
      tx.set(claimRef, {
        uid,
        missionId,
        walletAddress,
        status:    "pending",   // will update to "complete" after tx
        reservedAt: FieldValue.serverTimestamp(),
      });
    });

    if (alreadyClaimed) return err("Already claimed", 409);

    // ── 5. Execute on-chain transfer (outside Firestore tx) ──
    let transfer;
    try {
      transfer = await treasuryTransfer(CONTRACT, walletAddress, mission.otterAmount);
    } catch (chainErr: unknown) {
      // Release the reservation so user can retry
      await claimRef.delete().catch(() => {});
      const msg = chainErr instanceof Error ? chainErr.message : "Transfer failed";
      throw new Error(msg);
    }

    // ── 6. Finalize claim record + activity (admin SDK, bypasses rules) ──
    const db2      = getAdminDb();
    const userSnap = await db2.collection("users").doc(uid).get();
    const name     = userSnap.data()?.displayName || `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

    const batch = db2.batch();

    batch.set(claimRef, {
      uid, missionId,
      missionTitle:  mission.title,
      walletAddress,
      amount:        mission.otterAmount,
      txHash:        transfer.txHash,
      gasUsed:       transfer.gasUsed,
      status:        "complete",
      claimedAt:     FieldValue.serverTimestamp(),
    });

    batch.set(db2.collection("activity").doc(`claim_${claimId}`), {
      type:        "claim",
      displayName: name,
      mission:     mission.title,
      badge:       mission.badge || "",
      amount:      mission.otterAmount,
      txHash:      transfer.txHash,
      timestamp:   FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      txHash:  transfer.txHash,
      amount:  mission.otterAmount,
    });

  } catch (e: unknown) {
    if (e instanceof AuthError) return err(e.message, e.status);
    const msg = e instanceof Error ? e.message : "Internal error";
    // Never expose stack traces or private details to client
    if (msg.includes("User not found"))         return err("User not found", 404);
    if (msg.includes("Wallet does not match"))  return err("Wallet mismatch", 403);
    if (msg.includes("Mission not completed"))  return err("Mission not completed", 403);
    if (msg.includes("Insufficient treasury"))  return err("Treasury low — contact admin", 503);
    if (msg.includes("DEPLOYER_PRIVATE_KEY"))   return err("Treasury wallet not configured — deploy contract first", 503);
    if (msg.includes("Invalid contract"))       return err("Contract not deployed yet — check back soon", 503);
    if (msg.includes("rejected") || msg.includes("denied")) return err("Transaction rejected", 400);
    // Log full error server-side only
    console.error("[claim-mission] uid redacted —", msg);
    return err("Transfer failed", 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
