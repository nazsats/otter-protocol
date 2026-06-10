import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

// Cache the username so we don't call Telegram API on every page load
let cachedUsername: string | null = null;

export async function GET() {
  if (!BOT_TOKEN) {
    return NextResponse.json({ error: "Telegram not configured" }, { status: 503 });
  }

  if (cachedUsername) {
    return NextResponse.json({ username: cachedUsername });
  }

  try {
    const res  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok || !data.result?.username) {
      return NextResponse.json({ error: "Could not fetch bot info" }, { status: 502 });
    }
    cachedUsername = data.result.username as string;
    return NextResponse.json({ username: cachedUsername });
  } catch {
    return NextResponse.json({ error: "Telegram API unreachable" }, { status: 502 });
  }
}
