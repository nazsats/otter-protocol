/**
 * Client-side fetch helper that attaches the current user's Firebase ID token.
 *
 * All authenticated API calls must go through authFetch() so the server can
 * verify identity from the token instead of trusting a uid in the body.
 */
import { auth } from "./firebase";

/** Returns the current user's ID token, or null if not signed in. */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

/**
 * fetch() wrapper that injects `Authorization: Bearer <idToken>`.
 * Throws if the user is not signed in (no token available).
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  if (!token) throw new Error("Not signed in");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
