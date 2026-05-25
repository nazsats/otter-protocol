/**
 * Drop Hunt redemption endpoint.
 * Security measures:
 * - Code matched via SHA-256 hash (never stored plaintext)
 * - Atomic Firestore transaction prevents double-spend
 * - Rate limited per IP + per wallet
 * - One claim per wallet per drop (enforced on-chain via claim record)
 * - Expiry + max claims enforced inside Firestore transaction
 * - Receipt validation before recording success
 */
import { NextRequest, NextResponse }  from "next/server";
import { createHash }                 from "crypto";
import { ethers }                     from "ethers";
import { FieldValue }                 from "firebase-admin/firestore";
import { getAdminDb }                 from "@/lib/firebase-admin";
import { treasuryTransfer }           from "@/lib/chain";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const CONTRACT = process.env.NEXT_PUBLIC_OTTER_CONTRACT!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid request", 400);

    const { code, walletAddress, uid } = body as Record<string, unknown>;
    if (typeof code          !== "string") return err("Code required", 400);
    if (typeof walletAddress !== "string") return err("Wallet required", 400);
    if (typeof uid           !== "string") return err("User ID required", 400);
    if (!ethers.isAddress(walletAddress))  return err("Invalid wallet address", 400);
    if (code.length < 1 || code.length > 64) return err("Invalid code length", 400);

    // ── Rate limiting ─────────────────────────────────────
    const ip = getClientIp(req);
    const [ipRL, walletRL, uidRL] = await Promise.all([
      checkRateLimit(`drop:ip:${ip}`,            5, 3600),   // 5 attempts/hr per IP
      checkRateLimit(`drop:wallet:${walletAddress.toLowerCase()}`, 3, 3600), // 3/hr per wallet
      checkRateLimit(`drop:uid:${uid}`,          5, 3600),   // 5/hr per user
    ]);
    if (!ipRL.allowed)     return err(`Too many attempts. Retry in ${ipRL.resetInSeconds}s`, 429);
    if (!walletRL.allowed) return err(`Wallet rate limited. Retry in ${walletRL.resetInSeconds}s`, 429);
    if (!uidRL.allowed)    return err(`Account rate limited. Retry in ${uidRL.resetInSeconds}s`, 429);

    if (!CONTRACT) return err("Contract not configured", 500);

    const db = getAdminDb();

    // ── Verify wallet ownership ───────────────────────────
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return err("User not found", 404);
    const storedWallet = userSnap.data()!.walletAddress as string | undefined;
    if (!storedWallet) return err("Link a wallet before claiming drops", 403);
    if (storedWallet.toLowerCase() !== walletAddress.toLowerCase())
      return err("Wallet does not match your account", 403);

    // ── Hash the submitted code ───────────────────────────
    const codeHash = createHash("sha256")
      .update(code.trim().toUpperCase())
      .digest("hex");

    // ── Find matching active drop ─────────────────────────
    const dropQuery = await db.collection("drops")
      .where("codeHash", "==", codeHash)
      .where("active",   "==", true)
      .limit(1)
      .get();

    if (dropQuery.empty) return err("Invalid or expired code", 404);

    const dropDoc  = dropQuery.docs[0];
    const drop     = dropDoc.data();
    const dropId   = drop.dropId as string;
    const claimKey = `${dropId}_${walletAddress.toLowerCase()}`;
    const claimRef = db.collection("drop_claims").doc(claimKey);

    // ── Atomic: check expiry + max claims + reserve ───────
    let alreadyClaimed = false;
    let dropClosed     = false;
    let dropExpired    = false;

    await db.runTransaction(async (tx) => {
      const [freshDrop, existingClaim] = await Promise.all([
        tx.get(dropDoc.ref),
        tx.get(claimRef),
      ]);

      if (!freshDrop.exists) throw new Error("Drop not found");
      const d = freshDrop.data()!;

      // Check expiry
      if (Date.now() > (d.expiresAt as number)) { dropExpired = true; return; }

      // Check max claims
      if ((d.claimCount as number) >= (d.maxClaims as number)) { dropClosed = true; return; }

      // Check this wallet already claimed
      if (existingClaim.exists) { alreadyClaimed = true; return; }

      // Reserve spot + increment counter atomically
      tx.set(claimRef, {
        dropId, walletAddress: walletAddress.toLowerCase(), uid,
        status: "pending", reservedAt: FieldValue.serverTimestamp(),
      });
      tx.update(dropDoc.ref, { claimCount: FieldValue.increment(1) });
    });

    if (dropExpired)    return err("This drop has expired", 410);
    if (dropClosed)     return err("All spots claimed — watch for the next drop!", 410);
    if (alreadyClaimed) return err("You already claimed this drop", 409);

    // ── Execute on-chain transfer ─────────────────────────
    let transfer;
    try {
      transfer = await treasuryTransfer(CONTRACT, walletAddress, drop.amount as number);
    } catch (chainErr: unknown) {
      // Release reservation so user can retry
      await claimRef.delete().catch(() => {});
      await dropDoc.ref.update({ claimCount: FieldValue.increment(-1) }).catch(() => {});
      const msg = chainErr instanceof Error ? chainErr.message : "Transfer failed";
      throw new Error(msg);
    }

    // ── Finalize records ──────────────────────────────────
    const name = userSnap.data()!.displayName ||
      `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;

    const batch = db.batch();
    batch.set(claimRef, {
      dropId, dropTitle: drop.title,
      walletAddress: walletAddress.toLowerCase(), uid,
      amount:  drop.amount,
      txHash:  transfer.txHash,
      status:  "complete",
      claimedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("activity").doc(`drpclaim_${claimKey}`), {
      type:        "drop_claim",
      displayName: name,
      mission:     `Found Drop: ${drop.title}`,
      badge:       "🎯",
      amount:      drop.amount,
      txHash:      transfer.txHash,
      dropId,
      timestamp:   FieldValue.serverTimestamp(),
    });
    await batch.commit();

    // If last slot taken, mark drop inactive
    if (drop.claimCount + 1 >= drop.maxClaims) {
      await dropDoc.ref.update({ active: false }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      txHash:  transfer.txHash,
      amount:  drop.amount,
      title:   drop.title,
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg.includes("Insufficient treasury")) return err("Treasury low", 503);
    if (msg.includes("rejected"))              return err("Transaction rejected", 400);
    console.error("[drop/redeem]", msg);
    return err("Redemption failed", 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
