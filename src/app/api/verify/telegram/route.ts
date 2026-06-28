import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyUserMatches, AuthError } from "@/lib/auth-verify";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN!;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID!;
const TASK_ID    = "join_telegram";
const SIGNAL     = 100;

interface TelegramAuthData {
  id:         number;
  first_name: string;
  last_name?: string;
  username?:  string;
  photo_url?: string;
  auth_date:  number;
  hash:       string;
}

// Validates Telegram Login Widget data using the bot token as secret
function validateTelegramHash(data: TelegramAuthData): boolean {
  const { hash, ...fields } = data;
  const dataCheckStr = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey    = crypto.createHash("sha256").update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckStr).digest("hex");
  return computedHash === hash;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    const uid = await verifyUserMatches(req.headers.get("Authorization"), body.uid);
    const { uid: _ignored, ...tgData } = body as { uid: string } & TelegramAuthData;
    void _ignored;

    if (!BOT_TOKEN)  return NextResponse.json({ error: "Telegram not configured" }, { status: 503 });
    if (!CHANNEL_ID) return NextResponse.json({ error: "Channel not configured" },  { status: 503 });

    // ── 1. Validate hash (prevents forged requests) ───────────────────────
    if (!validateTelegramHash(tgData)) {
      return NextResponse.json({ error: "Invalid Telegram auth data" }, { status: 403 });
    }

    // ── 2. Check auth_date freshness (within 24h) ─────────────────────────
    if (Math.floor(Date.now() / 1000) - tgData.auth_date > 86400) {
      return NextResponse.json({ error: "Auth data expired — please retry" }, { status: 403 });
    }

    // ── 3. Check channel membership via Bot API ───────────────────────────
    const memberRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${CHANNEL_ID}&user_id=${tgData.id}`
    );
    const memberData = await memberRes.json();

    // FAIL CLOSED: if the bot cannot read membership (it must be an admin of the
    // channel, and TELEGRAM_CHANNEL_ID must be correct), we must NOT credit the
    // task — otherwise non-members get marked complete without joining.
    if (!memberData.ok) {
      console.error("[verify/telegram] getChatMember failed:", memberData.description);
      return NextResponse.json({
        error: "Membership check unavailable — make sure you've joined, then try again.",
      }, { status: 503 });
    }

    const status   = memberData.result?.status as string;
    const isMember = ["creator", "administrator", "member"].includes(status);
    if (!isMember) {
      return NextResponse.json({
        error: "You have not joined the channel yet. Join first, then verify.",
        status,
      }, { status: 403 });
    }

    // ── 4. Bind identity + mark verified ──────────────────────────────────
    const db = getAdminDb();
    const userRef       = db.collection("users").doc(uid);
    const initiationRef = db.collection("user_initiation").doc(uid);
    const [iniSnap, userSnap] = await Promise.all([initiationRef.get(), userRef.get()]);

    const tgUserId   = String(tgData.id);
    const tgUsername = tgData.username || `${tgData.first_name}${tgData.last_name ? " " + tgData.last_name : ""}`;

    // Lock: this OTTER account is already bound to a DIFFERENT Telegram account.
    const boundTgId = userSnap.data()?.telegramId as string | undefined;
    if (boundTgId && boundTgId !== tgUserId) {
      return NextResponse.json({
        error: "Your account is already linked to a different Telegram. Unlink it in Profile first.",
      }, { status: 409 });
    }

    const alreadyDone = iniSnap.exists && !!iniSnap.data()?.[TASK_ID];
    const batch = db.batch();

    // Always (re)bind identity so a re-link after unlink works.
    batch.set(userRef, {
      telegramVerified: true,
      telegramUsername: tgUsername,
      telegramId:       tgUserId,
      updatedAt:        FieldValue.serverTimestamp(),
    }, { merge: true });

    // Award signal only the first time.
    if (!alreadyDone) {
      batch.set(initiationRef, {
        [TASK_ID]: {
          taskId:      TASK_ID,
          signal:      SIGNAL,
          txHash:      null,
          timestamp:   Date.now(),
          approved:    true,
          method:      "telegram_widget",
          tgUserId,
          tgUsername,
        },
      }, { merge: true });
      batch.set(userRef, { signalWeight: FieldValue.increment(SIGNAL) }, { merge: true });
      batch.set(db.collection("activity").doc(`verify_telegram_${uid}`), {
        type:        "initiation",
        uid,
        displayName: userSnap.data()?.displayName || tgUsername || "A Rafter",
        mission:     "Joined the Telegram Channel",
        taskId:      TASK_ID,
        signal:      SIGNAL,
        timestamp:   FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return NextResponse.json({ success: true, signal: SIGNAL });

  } catch (e: unknown) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[verify/telegram]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
