/**
 * Server-side Firebase ID-token verification.
 *
 * Every authenticated API route must call verifyUser() and use the RETURNED
 * uid — never a uid taken from the request body/query. A uid in the body is
 * attacker-controlled; a verified ID token is not.
 *
 * NEVER import this file from client-side components.
 */
import { getAdminDb } from "./firebase-admin";
import { getApp } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Verifies the `Authorization: Bearer <idToken>` header.
 * @returns the decoded token (use `.uid`, `.email`).
 * @throws  AuthError(401) when the header is missing or the token is invalid/expired.
 */
export async function verifyUser(authHeader: string | null): Promise<DecodedIdToken> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing authorization token", 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) throw new AuthError("Empty token", 401);

  // getAdminDb() has the side-effect of initializing the "admin" app.
  getAdminDb();
  try {
    // checkRevoked=true rejects tokens from sessions that have been revoked
    // (e.g. after logout-everywhere / password reset). Slightly slower but safer.
    return await getAuth(getApp("admin")).verifyIdToken(token, true);
  } catch {
    throw new AuthError("Invalid or expired session", 401);
  }
}

/**
 * Verifies the token AND asserts the caller is the uid they claim to act as.
 * Use in routes that still receive a `uid` in the body for backward-compat:
 * the body uid must equal the verified uid, otherwise it's an impersonation attempt.
 */
export async function verifyUserMatches(
  authHeader: string | null,
  claimedUid: unknown
): Promise<string> {
  const decoded = await verifyUser(authHeader);
  if (typeof claimedUid === "string" && claimedUid !== decoded.uid) {
    throw new AuthError("Token does not match the requested account", 403);
  }
  return decoded.uid;
}
