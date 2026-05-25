/**
 * Admin-only endpoint to create a new OTTER Drop Hunt.
 * Codes are stored as SHA-256 hashes — plaintext never touches the database.
 * Protected by ADMIN_SECRET header.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash }                from "crypto";
import { FieldValue }                from "firebase-admin/firestore";
import { getAdminDb }                from "@/lib/firebase-admin";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(req: NextRequest) {
  // ── Auth: admin-only ─────────────────────────────────────
  const authHeader = req.headers.get("x-admin-secret");
  if (!ADMIN_SECRET || authHeader !== ADMIN_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    code,           // plaintext code (only you know it — stored as hash)
    title,          // "Drop #12"
    hint,           // "Check the latest tweet…"
    amount,         // OTTER per claim (e.g. 500)
    maxClaims,      // max number of winners (e.g. 50)
    expiresInHours, // how long until code expires
  } = body as Record<string, unknown>;

  if (typeof code !== "string"  || code.length < 6)   return NextResponse.json({ error: "Code too short (min 6 chars)" }, { status: 400 });
  if (typeof title !== "string" || !title)             return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (typeof hint  !== "string" || !hint)              return NextResponse.json({ error: "Hint required" }, { status: 400 });
  if (typeof amount !== "number"    || amount <= 0 || amount > 50_000) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (typeof maxClaims !== "number" || maxClaims < 1 || maxClaims > 10_000) return NextResponse.json({ error: "Invalid maxClaims" }, { status: 400 });
  if (typeof expiresInHours !== "number" || expiresInHours < 0.5 || expiresInHours > 168) return NextResponse.json({ error: "expiresInHours must be 0.5–168" }, { status: 400 });

  // Hash the code — never store plaintext
  const codeHash  = createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
  const expiresAt = Date.now() + expiresInHours * 3600 * 1000;
  const dropId    = `drop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const db = getAdminDb();

  // Check for duplicate code hash (prevent reuse)
  const existing = await db.collection("drops")
    .where("codeHash", "==", codeHash)
    .where("active", "==", true)
    .limit(1)
    .get();
  if (!existing.empty) return NextResponse.json({ error: "An active drop with this code already exists" }, { status: 409 });

  await db.collection("drops").doc(dropId).set({
    dropId,
    codeHash,             // SHA-256 hash only — plaintext never stored
    title:     String(title).slice(0, 100),
    hint:      String(hint).slice(0, 300),
    amount,
    maxClaims,
    claimCount: 0,
    expiresAt,
    active:     true,
    createdAt:  FieldValue.serverTimestamp(),
  });

  // Write announcement to activity feed
  await db.collection("activity").doc(`drop_announce_${dropId}`).set({
    type:        "drop_start",
    displayName: "OTTER Protocol",
    mission:     title,
    badge:       "🎯",
    amount,
    hint:        String(hint).slice(0, 300),
    dropId,
    timestamp:   FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    success:   true,
    dropId,
    expiresAt: new Date(expiresAt).toISOString(),
    // Return hint for confirmation — never return plaintext code
    hint,
  });
}
