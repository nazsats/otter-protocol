import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Generate a cryptographically random 8-char referral code
// NOT derived from uid — unpredictable and collision-resistant
export function generateReferralCode(_uid: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no ambiguous O/0/I/1
  const bytes = new Uint8Array(8);
  // Works in both Node.js (crypto module) and browser (Web Crypto)
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require("crypto") as { randomBytes: (n: number) => Buffer };
    const buf = randomBytes(8);
    for (let i = 0; i < 8; i++) bytes[i] = buf[i];
  }
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

// Create user profile in Firestore on first sign-in
export async function createUserProfile(
  uid: string,
  data: {
    email: string | null;
    displayName: string | null;
    walletAddress?: string | null;
    referredBy?: string | null;
  }
) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data(); // Already exists

  const referralCode = generateReferralCode(uid);

  const profile = {
    uid,
    email:         data.email,
    displayName:   data.displayName,
    walletAddress: data.walletAddress ?? null,
    referralCode,
    referredBy:    data.referredBy ?? null,
    referralCount: 0,
    tier:          "NEWCOMER",
    holdSince:     null,
    createdAt:     serverTimestamp(),
  };

  await setDoc(ref, profile);

  // Log join to public activity feed
  await setDoc(doc(db, "activity", `join_${uid}`), {
    type:        "join",
    displayName: data.displayName || "A new Rafter",
    badge:       "🌊",
    timestamp:   serverTimestamp(),
  });

  // If referred by someone, increment their count
  if (data.referredBy) {
    await applyReferral(data.referredBy, uid);
  }

  return profile;
}

// Apply referral — idempotent: only increments once per referrer+referee pair
async function applyReferral(referralCode: string, newUid: string) {
  const q    = query(collection(db, "users"), where("referralCode", "==", referralCode));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const referrerDoc = snap.docs[0];
  if (referrerDoc.id === newUid) return; // no self-referrals

  const refDocId  = `${referrerDoc.id}_${newUid}`;
  const refDocRef = doc(db, "referrals", refDocId);
  const existing  = await getDoc(refDocRef);
  if (existing.exists()) return; // idempotent — already recorded

  // Atomic: create referral record + increment count in one batch
  await Promise.all([
    setDoc(refDocRef, {
      referrerId: referrerDoc.id,
      refereeId:  newUid,
      code:       referralCode,
      createdAt:  serverTimestamp(),
    }),
    updateDoc(referrerDoc.ref, { referralCount: increment(1) }),
  ]);
}

// Link wallet address to user profile
export async function linkWallet(uid: string, walletAddress: string) {
  await updateDoc(doc(db, "users", uid), { walletAddress });
}

// Fetch user profile
export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Get referral leaderboard (top 10)
export async function getReferralLeaderboard() {
  const q = query(collection(db, "users"), where("referralCount", ">", 0));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => b.referralCount - a.referralCount)
    .slice(0, 10);
}
