/**
 * Shared input-validation helpers for API routes.
 */

// Hosts we trust to serve meme images. Anything else is rejected to prevent
// SSRF (pointing the URL at internal services), stored-XSS via javascript:/data:
// URIs, and phishing/malware links in the public feed.
const ALLOWED_IMAGE_HOSTS = [
  "ipfs.io",
  "gateway.pinata.cloud",
  "cloudflare-ipfs.com",
  "nftstorage.link",
  "i.imgur.com",
  "imgur.com",
  "firebasestorage.googleapis.com",
  "lh3.googleusercontent.com",
  "pbs.twimg.com",
];

/**
 * True only for https:// URLs whose host is in the allow-list.
 * Rejects http, javascript:, data:, blob:, and untrusted hosts.
 */
export function isAllowedImageUrl(raw: string): boolean {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** A 0x-prefixed 32-byte tx hash. */
export function isTxHash(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
}
