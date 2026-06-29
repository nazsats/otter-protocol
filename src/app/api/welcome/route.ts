import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyUser, AuthError } from "@/lib/auth-verify";

/**
 * One-time "Claim OTTER" welcome bonus.
 *
 * Awards a fixed POINTS bonus the first time a signed-in user claims it. This is
 * the primary first-interaction CTA on the simplified dashboard — points only,
 * no wallet/gas/treasury, so onboarding stays frictionless. Real OTTER tokens
 * stay precious and are handled by the on-chain claim flow in later phases.
 *
 * Server-authoritative + idempotent: the `welcomeClaimed` flag is checked and
 * set inside a transaction so a double-click or replay can't double-credit.
 */
export const WELCOME_POINTS = 1000;

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyUser(req.headers.get("Authorization"));
    const uid     = decoded.uid;

    const ip = getClientIp(req);
    const [userRL, ipRL] = await Promise.all([
      checkRateLimit(`welcome:uid:${uid}`, 10, 3600),
      checkRateLimit(`welcome:ip:${ip}`,   30, 3600),
    ]);
    if (!userRL.allowed) return err(`Slow down — retry in ${userRL.resetInSeconds}s`, 429);
    if (!ipRL.allowed)   return err(`Slow down — retry in ${ipRL.resetInSeconds}s`, 429);

    const db  = getAdminDb();
    const ref = db.collection("users").doc(uid);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("User not found");
      const data = snap.data()!;

      if (data.welcomeClaimed) {
        return { already: true, points: (data.points as number) || 0 };
      }

      tx.set(ref, {
        welcomeClaimed: true,
        points:         FieldValue.increment(WELCOME_POINTS),
        updatedAt:      FieldValue.serverTimestamp(),
      }, { merge: true });

      return { already: false, points: ((data.points as number) || 0) + WELCOME_POINTS };
    });

    if (result.already) {
      return NextResponse.json({ ok: true, alreadyClaimed: true, awarded: 0, points: result.points });
    }

    // Public activity entry (Admin SDK bypasses the client "join-only" rule).
    const name = (await ref.get()).data()?.displayName || "A Rafter";
    await db.collection("activity").add({
      type:        "welcome",
      displayName: name,
      amount:      WELCOME_POINTS,
      timestamp:   FieldValue.serverTimestamp(),
    }).catch(() => {});

    return NextResponse.json({ ok: true, alreadyClaimed: false, awarded: WELCOME_POINTS, points: result.points });

  } catch (e: unknown) {
    if (e instanceof AuthError) return err(e.message, e.status);
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg.includes("User not found")) return err("User not found", 404);
    console.error("[welcome] uid redacted —", msg);
    return err("Something went wrong", 500);
  }
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
