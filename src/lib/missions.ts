import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// ─── MISSION DEFINITIONS ─────────────────────────────────────────────────────
export type MissionCategory = "onboarding" | "social" | "onchain" | "community";
export type MissionAction    = "auto" | "link" | "wallet" | "referral" | "onchain" | "manual";

export interface Mission {
  id:           string;
  category:     MissionCategory;
  title:        string;
  desc:         string;
  points:       number;
  otterAmount:  number;      // Real OTTER tokens dispensed from treasury
  action:       MissionAction;
  link?:        string;
  threshold?:   number;      // for referral missions
  badge?:       string;
  difficulty:   "easy" | "medium" | "hard";
}

export const MISSIONS: Mission[] = [
  // ── ONBOARDING ──────────────────────────────────────────
  {
    id: "create_account", category: "onboarding", difficulty: "easy",
    title: "Join the Raft",
    desc: "Create your OTTER Protocol account and secure your spot in the community.",
    points: 100, otterAmount: 100, action: "auto", badge: "🌊",
  },
  {
    id: "connect_wallet", category: "onboarding", difficulty: "easy",
    title: "Link Your Wallet",
    desc: "Connect your wallet. Required to receive OTTER tokens and interact on-chain.",
    points: 200, otterAmount: 200, action: "wallet", badge: "🔗",
  },
  {
    id: "switch_sepolia", category: "onboarding", difficulty: "easy",
    title: "Enter Testnet",
    desc: "Switch to Sepolia testnet — where the OTTER beta lives.",
    points: 100, otterAmount: 100, action: "onchain", badge: "🧪",
  },

  // ── SOCIAL ──────────────────────────────────────────────
  {
    id: "follow_twitter", category: "social", difficulty: "easy",
    title: "Follow on X",
    desc: "Follow @OTTERProtocol on X (Twitter) for real-time updates.",
    points: 150, otterAmount: 150, action: "link", link: "https://x.com", badge: "𝕏",
  },
  {
    id: "share_referral", category: "social", difficulty: "easy",
    title: "Spread the Word",
    desc: "Share your unique referral link. First share earns you 150 OTTER.",
    points: 150, otterAmount: 150, action: "manual", badge: "📢",
  },
  {
    id: "post_thread", category: "social", difficulty: "medium",
    title: "Write a Thread",
    desc: "Post an X thread explaining the ERC-OTTER standard. Tag us to verify.",
    points: 400, otterAmount: 400, action: "manual", badge: "✍️",
  },

  // ── ON-CHAIN ────────────────────────────────────────────
  {
    id: "get_sepolia_eth", category: "onchain", difficulty: "easy",
    title: "Get Test ETH",
    desc: "Claim Sepolia ETH from a faucet. You need it for gas.",
    points: 100, otterAmount: 100, action: "onchain", badge: "⛽",
  },
  {
    id: "first_transfer", category: "onchain", difficulty: "medium",
    title: "First Transaction",
    desc: "Execute your first on-chain OTTER transfer on Sepolia testnet.",
    points: 300, otterAmount: 300, action: "onchain", badge: "⚡",
  },
  {
    id: "hold_7_days", category: "onchain", difficulty: "medium",
    title: "Diamond Paws",
    desc: "Hold $OTTER for 7 consecutive days. Your tier counter starts ticking.",
    points: 250, otterAmount: 250, action: "auto", badge: "💎",
  },
  {
    id: "reach_member", category: "onchain", difficulty: "hard",
    title: "Earn MEMBER Tier",
    desc: "Hold $OTTER for 30 days to reach MEMBER status and unlock meme submissions.",
    points: 500, otterAmount: 500, action: "auto", badge: "🦦",
  },

  // ── COMMUNITY ───────────────────────────────────────────
  {
    id: "invite_1", category: "community", difficulty: "easy",
    title: "Recruit a Rafter",
    desc: "Invite 1 person who signs up using your referral code.",
    points: 300, otterAmount: 300, action: "referral", threshold: 1, badge: "🤝",
  },
  {
    id: "invite_5", category: "community", difficulty: "medium",
    title: "Raft Builder",
    desc: "Invite 5 people. You're growing the community.",
    points: 800, otterAmount: 800, action: "referral", threshold: 5, badge: "⚓",
  },
  {
    id: "invite_10", category: "community", difficulty: "hard",
    title: "Raft Captain",
    desc: "Invite 10 people. You're a core pillar of the OTTER community.",
    points: 2000, otterAmount: 2000, action: "referral", threshold: 10, badge: "👑",
  },
  {
    id: "submit_meme", category: "community", difficulty: "medium",
    title: "Meme Lord",
    desc: "Submit your first meme for community voting (MEMBER tier required).",
    points: 200, otterAmount: 200, action: "onchain", badge: "🎭",
  },
];

// Total OTTER earnable: 5550 per user

export const CATEGORY_META: Record<MissionCategory, { label: string; color: string; desc: string }> = {
  onboarding: { label: "Onboarding",  color: "#00C896", desc: "Get set up in the Raft" },
  social:     { label: "Social",      color: "#A78BFA", desc: "Spread the word"        },
  onchain:    { label: "On-Chain",    color: "#C9A84C", desc: "Interact with the protocol" },
  community:  { label: "Community",   color: "#F5A623", desc: "Grow the Raft"          },
};

// ─── FIRESTORE OPS ───────────────────────────────────────────────────────────

export async function getUserMissions(uid: string): Promise<Record<string, boolean>> {
  const snap = await getDoc(doc(db, "user_missions", uid));
  return snap.exists() ? (snap.data() as Record<string, boolean>) : {};
}

export async function completeMission(uid: string, missionId: string): Promise<void> {
  const ref      = doc(db, "user_missions", uid);
  const snap     = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};
  if (existing[missionId]) return;

  await Promise.all([
    setDoc(ref, { ...existing, [missionId]: true }, { merge: true }),
    addPointsToUser(uid, missionId),
  ]);
}

async function addPointsToUser(uid: string, missionId: string) {
  const mission = MISSIONS.find((m) => m.id === missionId);
  if (!mission) return;

  const userRef = doc(db, "users", uid);
  const snap    = await getDoc(userRef);
  if (!snap.exists()) return;

  const current = snap.data().points || 0;
  await setDoc(userRef, { points: current + mission.points, updatedAt: serverTimestamp() }, { merge: true });
}

export function calcProgress(completed: Record<string, boolean>) {
  const done  = Object.values(completed).filter(Boolean).length;
  const total = MISSIONS.length;
  const pts   = MISSIONS.filter((m) => completed[m.id]).reduce((s, m) => s + m.points, 0);
  const otter = MISSIONS.filter((m) => completed[m.id]).reduce((s, m) => s + m.otterAmount, 0);
  return { done, total, pct: Math.round((done / total) * 100), pts, otter };
}

export async function autoCompleteMissions(uid: string, context: {
  hasWallet:      boolean;
  referralCount:  number;
  isOnSepolia:    boolean;
  hasTx:          boolean;
}) {
  const { hasWallet, referralCount, isOnSepolia, hasTx } = context;
  const completed = await getUserMissions(uid);
  const toComplete: string[] = [];

  if (!completed["create_account"])  toComplete.push("create_account");
  if (hasWallet   && !completed["connect_wallet"])  toComplete.push("connect_wallet");
  if (isOnSepolia && !completed["switch_sepolia"])  toComplete.push("switch_sepolia");
  if (hasTx       && !completed["first_transfer"])  toComplete.push("first_transfer");
  if (referralCount >= 1  && !completed["invite_1"])   toComplete.push("invite_1");
  if (referralCount >= 5  && !completed["invite_5"])   toComplete.push("invite_5");
  if (referralCount >= 10 && !completed["invite_10"])  toComplete.push("invite_10");

  await Promise.all(toComplete.map((id) => completeMission(uid, id)));
  return toComplete;
}

export async function getLeaderboard() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs
    .map((d) => d.data())
    .filter((u) => (u.points || 0) > 0)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 10)
    .map((u, i) => ({
      rank:      i + 1,
      name:      u.displayName || "Anonymous",
      points:    u.points       || 0,
      referrals: u.referralCount || 0,
      tier:      u.tier          || "NEWCOMER",
    }));
}

// Get recent activity feed
export async function getActivityFeed(limit = 20) {
  const snap = await getDocs(collection(db, "activity"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const at = (a.timestamp as { seconds?: number })?.seconds ?? 0;
      const bt = (b.timestamp as { seconds?: number })?.seconds ?? 0;
      return bt - at;
    })
    .slice(0, limit) as ActivityEntry[];
}

export interface ActivityEntry {
  id:          string;
  type:        "join" | "mission" | "claim" | "referral" | "transfer";
  displayName: string;
  mission?:    string;
  badge?:      string;
  amount?:     number;
  txHash?:     string;
  timestamp?:  { seconds: number };
}
