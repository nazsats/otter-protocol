import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyUser, AuthError } from "@/lib/auth-verify";
import {
  PRIZES, EMPTY_DAILY, utcDateString, resolveCheckIn,
  pickPrizeIndex, streakMultiplier, milestoneBonus, DailyState,
} from "@/lib/daily";

/**
 * Daily Streak + Spin-to-Win.
 *
 * POST { action: "checkin" | "spin" }
 *
 * Everything value-bearing is server-authoritative:
 *  - identity from the verified Firebase ID token (never the body)
 *  - streak + prize computed here, written via the Admin SDK
 *  - the prize index is chosen on the server; the client only animates to it
 *  - rewards are POINTS, so there is no treasury / token-faucet exposure
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid request", 400);

    const decoded = await verifyUser(req.headers.get("Authorization"));
    const uid     = decoded.uid;

    const action = body.action;
    if (action !== "checkin" && action !== "spin")
      return err("Unknown action", 400);

    // Rate limit — generous, just abuse protection (legit use is ~2 calls/day).
    const ip = getClientIp(req);
    const [userRL, ipRL] = await Promise.all([
      checkRateLimit(`daily:uid:${uid}`, 30, 3600),
      checkRateLimit(`daily:ip:${ip}`,   60, 3600),
    ]);
    if (!userRL.allowed) return err(`Slow down — retry in ${userRL.resetInSeconds}s`, 429);
    if (!ipRL.allowed)   return err(`Slow down — retry in ${ipRL.resetInSeconds}s`, 429);

    const db    = getAdminDb();
    const ref   = db.collection("daily_streaks").doc(uid);
    const today = utcDateString();

    if (action === "checkin") return await handleCheckIn(db, ref, uid, today);
    return await handleSpin(db, ref, uid, today);

  } catch (e: unknown) {
    if (e instanceof AuthError) return err(e.message, e.status);
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[daily] uid redacted —", msg);
    return err("Something went wrong", 500);
  }
}

type DocRef = FirebaseFirestore.DocumentReference;
type DB     = FirebaseFirestore.Firestore;

async function handleCheckIn(db: DB, ref: DocRef, uid: string, today: string) {
  const result = await db.runTransaction(async (tx) => {
    const snap  = await tx.get(ref);
    const cur   = (snap.exists ? snap.data() : {}) as Partial<DailyState>;
    const state: DailyState = { ...EMPTY_DAILY, ...cur };

    const { outcome } = resolveCheckIn(state.lastCheckIn, today);

    if (outcome === "already") {
      return { already: true, state };
    }

    const newStreak =
      outcome === "continue" ? state.streak + 1 : 1;

    const bonus = milestoneBonus(newStreak);

    const next: DailyState = {
      ...state,
      streak:        newStreak,
      longestStreak: Math.max(state.longestStreak, newStreak),
      lastCheckIn:   today,
      spinPending:   true,
    };

    tx.set(ref, next, { merge: true });

    // Milestone bonus points are credited immediately.
    if (bonus > 0) {
      tx.set(
        db.collection("users").doc(uid),
        { points: FieldValue.increment(bonus), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    return { already: false, state: next, bonus, milestone: bonus > 0 ? newStreak : 0 };
  });

  if (result.already) {
    return NextResponse.json({
      ok: true, already: true,
      streak: result.state.streak,
      spinPending: result.state.spinPending,
    });
  }

  return NextResponse.json({
    ok: true,
    already: false,
    streak: result.state.streak,
    longestStreak: result.state.longestStreak,
    spinPending: true,
    milestoneBonus: result.bonus ?? 0,
    milestoneDay: result.milestone ?? 0,
  });
}

async function handleSpin(db: DB, ref: DocRef, uid: string, today: string) {
  // Choose the prize OUTSIDE the transaction so the random value is fixed,
  // then commit atomically (spinPending guards against double-spin).
  const prizeIndex = pickPrizeIndex(Math.random());

  const out = await db.runTransaction(async (tx) => {
    const snap  = await tx.get(ref);
    const state = { ...EMPTY_DAILY, ...(snap.exists ? snap.data() : {}) } as DailyState;

    if (!state.spinPending) {
      return { noSpin: true as const, state };
    }

    const prize   = PRIZES[prizeIndex];
    const mult    = streakMultiplier(state.streak);
    const awarded = Math.round(prize.points * mult);

    tx.set(ref, {
      ...state,
      spinPending:    false,
      lastSpinDate:   today,
      totalPointsWon: state.totalPointsWon + awarded,
      totalSpins:     state.totalSpins + 1,
    }, { merge: true });

    tx.set(
      db.collection("users").doc(uid),
      { points: FieldValue.increment(awarded), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return { noSpin: false as const, awarded, mult, streak: state.streak };
  });

  if (out.noSpin) {
    return err("No spin available — check in first", 409);
  }

  return NextResponse.json({
    ok: true,
    prizeIndex,
    basePoints: PRIZES[prizeIndex].points,
    multiplier: out.mult,
    awarded:    out.awarded,
    jackpot:    !!PRIZES[prizeIndex].jackpot,
  });
}

function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
