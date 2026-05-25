/**
 * Firebase Admin SDK — server-side only.
 * Bypasses Firestore security rules entirely (full admin access).
 * NEVER import this file from client-side components.
 */
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let adminApp: App;
let adminDb: Firestore;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existing = getApps().find((a) => a.name === "admin");
  if (existing) { adminApp = existing; return adminApp; }

  // Preferred: base64-encoded service account JSON (no newline/quote issues in .env.local)
  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountB64) {
    const sa = JSON.parse(Buffer.from(serviceAccountB64, "base64").toString("utf-8"));
    adminApp = initializeApp({ credential: cert(sa) }, "admin");
    return adminApp;
  }

  // Fallback: individual env vars
  const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")   // handle escaped newlines
    .replace(/\\r/g, "");     // strip any carriage returns

  if (!clientEmail || !privateKey) {
    adminApp = initializeApp({ projectId }, "admin");
  } else {
    adminApp = initializeApp(
      { credential: cert({ projectId, clientEmail, privateKey }) },
      "admin"
    );
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp());
  return adminDb;
}
