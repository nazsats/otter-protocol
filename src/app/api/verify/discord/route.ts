import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyUser, AuthError } from "@/lib/auth-verify";

const CLIENT_ID    = process.env.DISCORD_CLIENT_ID!;
const ADMIN_SECRET = process.env.ADMIN_SECRET!;
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Signs { uid, ts } into a tamper-proof state param
function makeState(uid: string): string {
  const payload = Buffer.from(JSON.stringify({ uid, ts: Date.now() })).toString("base64url");
  const sig     = crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex").slice(0, 20);
  return `${payload}.${sig}`;
}

// Client calls this with `Authorization: Bearer <idToken>` and receives the
// OAuth URL to navigate to. The uid is taken from the verified token — never
// from the query string — so signal can only be awarded to the real account.
export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyUser(req.headers.get("Authorization"));
    if (!CLIENT_ID) return NextResponse.json({ error: "Discord not configured" }, { status: 503 });

    const redirectUri = `${APP_URL}/api/verify/discord/callback`;
    const state       = makeState(decoded.uid);

    const discordUrl = new URL("https://discord.com/api/oauth2/authorize");
    discordUrl.searchParams.set("client_id",    CLIENT_ID);
    discordUrl.searchParams.set("redirect_uri", redirectUri);
    discordUrl.searchParams.set("response_type","code");
    discordUrl.searchParams.set("scope",        "identify guilds");
    discordUrl.searchParams.set("state",        state);
    discordUrl.searchParams.set("prompt",       "consent");

    return NextResponse.json({ url: discordUrl.toString() });
  } catch (e: unknown) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
