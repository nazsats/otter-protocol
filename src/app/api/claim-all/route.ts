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
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const uid = await verifyUserMatches(req.headers.get("Authorization"), body.uid);

    const { walletAddress } = body as Record<string, unknown>;
    if (typeof walletAddress !== "string")
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (!ethers.isAddress(walletAddress))
      return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });

    // Rate limit: 1 claim-all per user per 10 minutes
    const ip = getClientIp(req);
    const [userRL, ipRL] = await Promise.all([
      checkRateLimit(`claimall:uid:${uid}`, 3, 600),
      checkRateLimit(`claimall:ip:${ip}`,   10, 600),
    ]);
    if (!userRL.allowed) return NextResponse.json({ error: `Rate limit: retry in ${userRL.resetInSeconds}s` }, { status: 429 });
    if (!ipRL.allowed)   return NextResponse.json({ error: `Rate limit: retry in ${ipRL.resetInSeconds}s` }, { status: 429 });

    if (!CONTRACT) return NextResponse.json({ error: "Contract not configured" }, { status: 500 });

    const db = getAdminDb();

    // Verify wallet ownership
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const storedWallet = userSnap.data()!.walletAddress as string | undefined;
    if (!storedWallet || storedWallet.toLowerCase() !== walletAddress.toLowerCase())
      return NextResponse.json({ error: "Wallet mismatch" }, { status: 403 });

    // Get completed missions + existing claims in parallel
    const [missionsSnap, claimsSnap] = await Promise.all([
      db.collection("user_missions").doc(uid).get(),
      db.collection("otter_claims")
        .where("uid", "==", uid)
        .where("status", "==", "complete")
        .get(),
    ]);

    const completed = missionsSnap.exists ? missionsSnap.data()! : {};
    const claimed   = new Set(claimsSnap.docs.map((d) => d.data().missionId as string));

    // Missions that are done but not yet claimed
    const toClaim = MISSIONS.filter((m) => completed[m.id] && !claimed.has(m.id));
    if (toClaim.length === 0)
      return NextResponse.json({ success: true, claimed: [], totalOtter: 0 });

    const name = userSnap.data()!.displayName || `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
    const results: { missionId: string; amount: number; txHash: string }[] = [];

    // Process sequentially — preserves nonce order, prevents double spend
    for (const mission of toClaim) {
      const claimId  = `${uid}_${mission.id}`;
      const claimRef = db.collection("otter_claims").doc(claimId);

      // Atomically reserve slot
      let reserved = false;
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(claimRef);
          if (snap.exists) return; // already claimed or reserved, skip
          tx.set(claimRef, {
            uid, missionId: mission.id, walletAddress,
            status: "pending", reservedAt: FieldValue.serverTimestamp(),
          });
          reserved = true;
        });
      } catch { continue; }

      if (!reserved) continue;

      // Transfer on-chain
      try {
        const transfer = await treasuryTransfer(CONTRACT, walletAddress, mission.otterAmount);

        // Commit final record
        const batch = db.batch();
        batch.set(claimRef, {
          uid, missionId: mission.id, missionTitle: mission.title,
          walletAddress, amount: mission.otterAmount,
          txHash: transfer.txHash, gasUsed: transfer.gasUsed,
          status: "complete", claimedAt: FieldValue.serverTimestamp(),
        });
        batch.set(db.collection("activity").doc(`claim_${claimId}`), {
          type: "claim", displayName: name,
          mission: mission.title, badge: mission.badge || "",
          amount: mission.otterAmount, txHash: transfer.txHash,
          timestamp: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        results.push({ missionId: mission.id, amount: mission.otterAmount, txHash: transfer.txHash });
      } catch {
        // Release reservation on chain failure
        await claimRef.delete().catch(() => {});
      }
    }

    const totalOtter = results.reduce((s, r) => s + r.amount, 0);
    return NextResponse.json({ success: true, claimed: results, totalOtter });

  } catch (e: unknown) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
