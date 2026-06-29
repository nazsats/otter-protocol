import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

const CLIENT_ID     = process.env.DISCORD_CLIENT_ID!;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const GUILD_ID      = process.env.DISCORD_GUILD_ID!;
const ADMIN_SECRET  = process.env.ADMIN_SECRET!;
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const TASK_ID  = "join_discord";
const SIGNAL   = 100;
const REDIRECT_URI = `${APP_URL}/api/verify/discord/callback`;

function verifyState(state: string): string {
  const dot = state.lastIndexOf(".");
  if (dot < 0) throw new Error("malformed state");
  const payload = state.slice(0, dot);
  const sig     = state.slice(dot + 1);
  const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex").slice(0, 20);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error("invalid state");
  const { uid, ts } = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (Date.now() - ts > 10 * 60 * 1000) throw new Error("state expired");
  return uid as string;
}

function fail(msg: string) {
  const url = new URL(`${APP_URL}/dapp`);
  url.searchParams.set("verify_error",  msg);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return fail("Discord authorisation denied");
  if (!code || !state) return fail("Missing OAuth params");

  // ── 1. Verify state (CSRF protection) ────────────────────────────────────
  let uid: string;
  try { uid = verifyState(state); }
  catch { return fail("Invalid or expired session — please try again"); }

  // ── 2. Exchange code for access token ────────────────────────────────────
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) throw new Error(tokenData.error_description || "Token exchange failed");
    accessToken = tokenData.access_token as string;
  } catch {
    return fail("Token exchange failed — try again");
  }

  // ── 3. Fetch user's guilds and check membership ────────────────────────────
  let isMember = false;
  let discordUsername = "";
  let discordId = "";
  try {
    const [userRes, guildsRes] = await Promise.all([
      fetch("https://discord.com/api/users/@me",         { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch("https://discord.com/api/users/@me/guilds",  { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    const [userData, guildsData] = await Promise.all([userRes.json(), guildsRes.json()]);

    discordId       = String(userData.id || "");
    discordUsername = userData.username ? `${userData.username}#${userData.discriminator || "0"}` : userData.global_name || "";

    if (Array.isArray(guildsData)) {
      isMember = guildsData.some((g: { id: string }) => g.id === GUILD_ID);
    }
  } catch {
    return fail("Could not fetch Discord data — try again");
  }

  if (!isMember) {
    const inviteUrl = `${APP_URL}/dapp?verify_error=not_member`;
    return NextResponse.redirect(inviteUrl);
  }

  // ── 4. Bind identity + mark verified ──────────────────────────────────────
  const db = getAdminDb();
  const userRef       = db.collection("users").doc(uid);
  const initiationRef = db.collection("user_initiation").doc(uid);
  const [iniSnap, userSnap] = await Promise.all([initiationRef.get(), userRef.get()]);

  // Lock: this OTTER account is already bound to a DIFFERENT Discord account.
  const boundDiscordId = userSnap.data()?.discordId as string | undefined;
  if (boundDiscordId && discordId && boundDiscordId !== discordId) {
    return fail("Your account is already linked to a different Discord. Unlink it in Profile first.");
  }

  const alreadyDone = iniSnap.exists && !!iniSnap.data()?.[TASK_ID];
  const batch = db.batch();

  // Always (re)bind the identity so a re-link after unlink works.
  batch.set(userRef, {
    discordVerified: true,
    discordUsername,
    discordId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  // Award signal only the first time the task is completed.
  if (!alreadyDone) {
    batch.set(initiationRef, {
      [TASK_ID]: {
        taskId:    TASK_ID,
        signal:    SIGNAL,
        txHash:    null,
        timestamp: Date.now(),
        approved:  true,
        method:    "discord_oauth",
        discordUsername,
      },
    }, { merge: true });
    batch.set(userRef, { signalWeight: FieldValue.increment(SIGNAL) }, { merge: true });
    batch.set(db.collection("activity").doc(`verify_discord_${uid}`), {
      type:        "initiation",
      uid,
      displayName: userSnap.data()?.displayName || discordUsername || "A Rafter",
      mission:     "Joined the Discord Den",
      taskId:      TASK_ID,
      signal:      SIGNAL,
      timestamp:   FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  // ── 5. Redirect back with success ────────────────────────────────────────
  const success = new URL(`${APP_URL}/dapp`);
  success.searchParams.set("verified", "discord");
  return NextResponse.redirect(success.toString());
}
