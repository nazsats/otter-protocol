/**
 * Signed access-gate token.
 *
 * The gate cookie used to be the literal string "1", which anyone could forge
 * by setting `otter_access=1` in devtools/curl. This replaces it with an
 * HMAC-signed token: `<issuedAtMs>.<hmac>`. Forging it requires the server
 * secret, so the cookie can no longer be guessed or hand-crafted.
 *
 * Uses Web Crypto (`crypto.subtle`), which is a global in BOTH the Node route
 * runtime and the Edge middleware runtime — so this one module works in both.
 * The secret is ACCESS_GATE_SECRET (preferred) or ADMIN_SECRET (already set for
 * OAuth state signing).
 */
const ENC = new TextEncoder();
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches the cookie maxAge

export const ACCESS_COOKIE      = "otter_access";
export const ACCESS_MAX_AGE_SEC = MAX_AGE_MS / 1000;

function getSecret(): string {
  return process.env.ACCESS_GATE_SECRET || process.env.ADMIN_SECRET || "";
}

async function hmacHex(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENC.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, ENC.encode(payload));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mint a fresh signed token (called when a valid access code is accepted). */
export async function signAccessToken(): Promise<string> {
  const payload = String(Date.now());
  const sig = (await hmacHex(payload)).slice(0, 32);
  return `${payload}.${sig}`;
}

/** Verify a cookie value: correct signature AND not expired. */
export async function verifyAccessToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;

  const payload  = token.slice(0, dot);
  const sig      = token.slice(dot + 1);
  const expected = (await hmacHex(payload)).slice(0, 32);

  // constant-time-ish comparison
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return false;

  const ts = Number(payload);
  if (!Number.isFinite(ts)) return false;
  // reject expired tokens and absurd future timestamps
  return Date.now() - ts <= MAX_AGE_MS && ts <= Date.now() + 60_000;
}
