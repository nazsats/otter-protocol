/**
 * Server-side admin authentication helper.
 * Verifies Firebase ID token and checks for admin credentials.
 * NEVER import from client-side components.
 */
import { getAdminDb } from "./firebase-admin";
import { getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export const ADMIN_EMAIL  = "nazsats@gmail.com";
export const ADMIN_WALLET = "0x6d54ef5fa17d69717ff96d2d868e040034f26024";

/**
 * Verifies the Bearer token from Authorization header and confirms admin status.
 * Throws with descriptive message on failure.
 */
export async function verifyAdminRequest(authHeader: string | null): Promise<{ uid: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing authorization token");
  }

  const token = authHeader.slice(7);

  // Ensure admin app is initialized (getAdminDb has the side-effect)
  getAdminDb();
  const adminApp  = getApp("admin");
  const decoded   = await getAuth(adminApp).verifyIdToken(token);

  // Check by email
  if (decoded.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return { uid: decoded.uid };
  }

  // Check by linked wallet
  const db   = getAdminDb();
  const snap = await db.collection("users").doc(decoded.uid).get();
  const wallet = (snap.data()?.walletAddress as string | undefined)?.toLowerCase();

  if (wallet === ADMIN_WALLET) {
    return { uid: decoded.uid };
  }

  throw new Error("Not authorized as admin");
}
