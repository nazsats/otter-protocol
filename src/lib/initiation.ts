import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp, query, orderBy, limit, addDoc, increment } from "firebase/firestore";
import { db } from "./firebase";
import { ethers } from "ethers";

// ─── CONTRACT ABI ─────────────────────────────────────────────────────────────

export const INITIATION_ABI = [
  // Views
  "function getSignalWeight(address) view returns (uint256)",
  "function getTier(address) view returns (uint8)",
  "function getTierLabel(address) view returns (string)",
  "function isTaskCompleted(address, bytes32) view returns (bool)",
  "function getNodeStreak(address) view returns (uint256)",
  "function getNodePresenceCooldownRemaining(address) view returns (uint256)",
  "function getHolderCount() view returns (uint256)",
  "function holders(address) view returns (uint256 signalWeight, uint256 lastNodePresence, uint256 nodeStreak, uint256 tasksCompleted, uint256 joinedAt)",
  "function tasks(bytes32) view returns (bytes32 id, string title, uint256 signalReward, uint8 category, bool active, bool requiresApproval, bool repeatable, uint256 createdAt)",
  "function getAllTaskIds() view returns (bytes32[])",
  "function guardian() view returns (address)",
  // Mutations
  "function claimTask(bytes32 taskId)",
  "function recordNodePresence()",
  // Guardian
  "function addTask(bytes32 id, string title, uint256 signalReward, uint8 category, bool requiresApproval, bool repeatable)",
  "function updateTask(bytes32 id, string title, uint256 signalReward, bool active)",
  "function setTaskActive(bytes32 id, bool active)",
  "function approveTask(address holder, bytes32 taskId)",
  // Events
  "event TaskClaimed(address indexed holder, bytes32 indexed taskId, uint256 signalAwarded, uint256 newTotal, uint8 newTier)",
  "event NodePresenceRecorded(address indexed holder, uint256 streak, uint256 signalAwarded, uint256 timestamp)",
  "event TierAscended(address indexed holder, uint8 oldTier, uint8 newTier, uint256 signalWeight)",
  "event TaskApproved(address indexed holder, bytes32 indexed taskId, address approvedBy)",
];

export const INITIATION_CONTRACT = process.env.NEXT_PUBLIC_INITIATION_CONTRACT || null;

// ─── TIER SYSTEM ──────────────────────────────────────────────────────────────

export type TierName = "SEEKER" | "HOLDER" | "MEMBER" | "ARCHIVIST" | "OG";

export const TIERS: Record<TierName, { threshold: number; color: string; bg: string; desc: string; glyph: string }> = {
  SEEKER:    { threshold: 0,     color: "#8C7A5C", bg: "rgba(140,122,92,0.08)",    desc: "Protocol initiate. Begin your journey.",               glyph: "א" },
  HOLDER:    { threshold: 500,   color: "#60A5FA", bg: "rgba(96,165,250,0.08)",    desc: "Signal received. The network knows you.",               glyph: "ב" },
  MEMBER:    { threshold: 2500,  color: "#A78BFA", bg: "rgba(167,139,250,0.08)",   desc: "Integrated into the protocol. Voice amplified.",        glyph: "ג" },
  ARCHIVIST: { threshold: 7500,  color: "#C9A84C", bg: "rgba(201,168,76,0.08)",    desc: "Keeper of protocol knowledge. Governance unlocked.",    glyph: "ד" },
  OG:        { threshold: 15000, color: "#E2BF6E", bg: "rgba(226,191,110,0.12)",   desc: "Protocol genesis contributor. The network remembers.", glyph: "ה" },
};

export function getTierFromWeight(weight: number): TierName {
  if (weight >= 15000) return "OG";
  if (weight >= 7500)  return "ARCHIVIST";
  if (weight >= 2500)  return "MEMBER";
  if (weight >= 500)   return "HOLDER";
  return "SEEKER";
}

export function getNextTier(current: TierName): { name: TierName; threshold: number; remaining: number } | null {
  const order: TierName[] = ["SEEKER", "HOLDER", "MEMBER", "ARCHIVIST", "OG"];
  const idx = order.indexOf(current);
  if (idx === order.length - 1) return null;
  const next = order[idx + 1];
  return { name: next, threshold: TIERS[next].threshold, remaining: 0 };
}

// ─── TASK DEFINITIONS ─────────────────────────────────────────────────────────

export type TaskCategory =
  | "SIGNAL_ACQUISITION"
  | "KNOWLEDGE_ARCHIVE"
  | "CONTRIBUTION"
  | "CIPHER_HUNT"
  | "SIGNAL_RELAY"
  | "GOVERNANCE"
  | "NODE_PRESENCE";

export type TaskAction = "auto" | "link" | "wallet" | "onchain" | "manual" | "quiz" | "node";

export interface InitiationTask {
  id:               string;      // human-readable slug
  contractId:       string;      // keccak256 hash — matches contract bytes32
  category:         TaskCategory;
  title:            string;
  desc:             string;
  signal:           number;      // SIGNAL WEIGHT reward
  action:           TaskAction;
  link?:            string;
  requiresApproval: boolean;
  repeatable:       boolean;
  hidden?:          boolean;     // hidden until unlocked
  unlockCondition?: string;      // e.g. "MEMBER tier required"
  badge?:           string;      // badge glyph/emoji
  difficulty:       "initiate" | "seeker" | "archivist" | "guardian";
}

// keccak256 of string slug — must match contract _seedTasks()
function taskId(slug: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(slug));
}

export const INITIATION_TASKS: InitiationTask[] = [
  // ── SIGNAL ACQUISITION ──────────────────────────────────────────────────────
  {
    id: "join_discord",    contractId: taskId("join_discord"),
    category: "SIGNAL_ACQUISITION", difficulty: "initiate",
    title: "Join the Discord Den",
    desc: "Connect to the primary signal channel. The Den is where the protocol breathes.",
    signal: 100, action: "link", link: "https://discord.gg/EGzu4NHqP",
    requiresApproval: false, repeatable: false, badge: "◆",
  },
  {
    id: "join_telegram",   contractId: taskId("join_telegram"),
    category: "SIGNAL_ACQUISITION", difficulty: "initiate",
    title: "Join Telegram Channel",
    desc: "Tune to Frequency 02. Secondary signal source for protocol broadcasts.",
    signal: 100, action: "link", link: "https://t.me/otterprotocol",
    requiresApproval: false, repeatable: false, badge: "◈",
  },
  {
    id: "follow_x",        contractId: taskId("follow_x"),
    category: "SIGNAL_ACQUISITION", difficulty: "initiate",
    title: "Follow on X",
    desc: "Intercept the primary signal stream. Protocol updates broadcast here first.",
    signal: 150, action: "link", link: "https://x.com/otter_protocol1",
    requiresApproval: false, repeatable: false, badge: "✕",
  },
  {
    id: "follow_farcaster", contractId: taskId("follow_farcaster"),
    category: "SIGNAL_ACQUISITION", difficulty: "initiate",
    title: "Follow on Farcaster",
    desc: "Decentralized signal relay. The protocol exists beyond centralized networks.",
    signal: 150, action: "link", link: "https://warpcast.com/otterprotocol",
    requiresApproval: false, repeatable: false, badge: "⬡",
  },
  {
    id: "connect_wallet",  contractId: taskId("connect_wallet"),
    category: "SIGNAL_ACQUISITION", difficulty: "initiate",
    title: "Link Wallet to Protocol",
    desc: "Establish your cryptographic identity. Required for all on-chain actions.",
    signal: 200, action: "wallet",
    requiresApproval: false, repeatable: false, badge: "🔗",
  },
  {
    id: "verify_identity", contractId: taskId("verify_identity"),
    category: "SIGNAL_ACQUISITION", difficulty: "initiate",
    title: "Verify Identity",
    desc: "Prove you are a unique signal source. Protocol integrity depends on it.",
    signal: 100, action: "auto",
    requiresApproval: false, repeatable: false, badge: "✓",
  },

  // ── KNOWLEDGE ARCHIVE ────────────────────────────────────────────────────────
  {
    id: "read_medium",     contractId: taskId("read_medium"),
    category: "KNOWLEDGE_ARCHIVE", difficulty: "seeker",
    title: "Read Medium Introduction",
    desc: "The first inscription. Understand what OTTER Protocol is building and why.",
    signal: 300, action: "link", link: "https://medium.com/@protocolotter",
    requiresApproval: false, repeatable: false, badge: "📜",
  },
  {
    id: "read_abstract",   contractId: taskId("read_abstract"),
    category: "KNOWLEDGE_ARCHIVE", difficulty: "seeker",
    title: "Study the ERC-OTTER Abstract",
    desc: "Four novel protocol primitives. Understand what has never existed before.",
    signal: 400, action: "link", link: "/eip#abstract",
    requiresApproval: false, repeatable: false, badge: "◈",
  },
  {
    id: "read_eip",        contractId: taskId("read_eip"),
    category: "KNOWLEDGE_ARCHIVE", difficulty: "archivist",
    title: "Read Full EIP Draft",
    desc: "The complete protocol specification. 11 sections. Every word is a protocol truth.",
    signal: 1000, action: "link", link: "/eip",
    requiresApproval: false, repeatable: false, badge: "⟦",
  },
  {
    id: "read_governance", contractId: taskId("read_governance"),
    category: "KNOWLEDGE_ARCHIVE", difficulty: "seeker",
    title: "Read Governance Model",
    desc: "Community powers, Guardian constraints, path to full decentralization.",
    signal: 500, action: "link", link: "/eip#governance",
    requiresApproval: false, repeatable: false, badge: "🏛",
  },
  {
    id: "read_guardian",   contractId: taskId("read_guardian"),
    category: "KNOWLEDGE_ARCHIVE", difficulty: "archivist",
    title: "Study Guardian Constraints",
    desc: "What the Guardian CAN and CANNOT do. Power defined by its limits.",
    signal: 600, action: "link", link: "/eip#governance",
    requiresApproval: false, repeatable: false, badge: "⚔",
  },
  {
    id: "pass_quiz",       contractId: taskId("pass_quiz"),
    category: "KNOWLEDGE_ARCHIVE", difficulty: "archivist",
    title: "Pass EIP Protocol Quiz",
    desc: "Prove your knowledge. Answer correctly to claim 1500 SIGNAL on-chain.",
    signal: 1500, action: "quiz",
    requiresApproval: true, repeatable: false, badge: "🎯",
  },

  // ── CONTRIBUTION ─────────────────────────────────────────────────────────────
  {
    id: "like_post",       contractId: taskId("like_post"),
    category: "CONTRIBUTION", difficulty: "initiate",
    title: "Like Protocol Post",
    desc: "Amplify the signal. Each resonance strengthens the network.",
    signal: 50, action: "link", link: "https://x.com/otter_protocol1",
    requiresApproval: false, repeatable: true, badge: "◉",
  },
  {
    id: "retweet_post",    contractId: taskId("retweet_post"),
    category: "CONTRIBUTION", difficulty: "initiate",
    title: "Retweet Protocol Post",
    desc: "Relay the signal. You extend the protocol's reach with every broadcast.",
    signal: 120, action: "link", link: "https://x.com/otter_protocol1",
    requiresApproval: false, repeatable: true, badge: "↺",
  },
  {
    id: "reply_post",      contractId: taskId("reply_post"),
    category: "CONTRIBUTION", difficulty: "seeker",
    title: "Thoughtful Reply",
    desc: "Engage with depth. The protocol values signal quality over noise.",
    signal: 200, action: "manual",
    requiresApproval: true, repeatable: true, badge: "💬",
  },
  {
    id: "tweet_otter",     contractId: taskId("tweet_otter"),
    category: "CONTRIBUTION", difficulty: "seeker",
    title: "Tweet About OTTER",
    desc: "Broadcast your own signal. Explain what you understand. Tag @OTTERProtocol.",
    signal: 500, action: "manual",
    requiresApproval: true, repeatable: false, badge: "📡",
  },
  {
    id: "create_thread",   contractId: taskId("create_thread"),
    category: "CONTRIBUTION", difficulty: "archivist",
    title: "Create X Thread",
    desc: "A thread about ERC-OTTER. Educate the uninitiated. This is how protocols grow.",
    signal: 1000, action: "manual",
    requiresApproval: true, repeatable: false, badge: "📖",
  },
  {
    id: "create_meme",     contractId: taskId("create_meme"),
    category: "CONTRIBUTION", difficulty: "archivist",
    title: "Submit Meme to Archive",
    desc: "Meme culture IS the protocol culture. Create something worthy of inscription.",
    signal: 1500, action: "manual",
    requiresApproval: true, repeatable: false, badge: "🎭",
  },
  {
    id: "edu_video",       contractId: taskId("edu_video"),
    category: "CONTRIBUTION", difficulty: "guardian",
    title: "Create Educational Video",
    desc: "The most powerful signal relay. Video education reaches those the text cannot.",
    signal: 3000, action: "manual",
    requiresApproval: true, repeatable: false, badge: "📹",
  },
  {
    id: "write_article",   contractId: taskId("write_article"),
    category: "CONTRIBUTION", difficulty: "guardian",
    title: "Write Medium Article",
    desc: "Inscribe your knowledge permanently. A well-written article outlasts any tweet.",
    signal: 5000, action: "manual",
    requiresApproval: true, repeatable: false, badge: "✍",
  },

  // ── CIPHER HUNT ──────────────────────────────────────────────────────────────
  {
    id: "cipher_i",        contractId: taskId("cipher_i"),
    category: "CIPHER_HUNT", difficulty: "seeker",
    title: "Find Fragment I",
    desc: "The first fragment is scattered across the primary signal source. Look closer.",
    signal: 500, action: "manual",
    requiresApproval: true, repeatable: false, badge: "I", hidden: false,
    unlockCondition: "Follow on X to begin the hunt",
  },
  {
    id: "cipher_ii",       contractId: taskId("cipher_ii"),
    category: "CIPHER_HUNT", difficulty: "archivist",
    title: "Find Fragment II",
    desc: "Fragment II is buried in the den. Those who listen carefully will hear it.",
    signal: 750, action: "manual",
    requiresApproval: true, repeatable: false, badge: "II", hidden: false,
    unlockCondition: "Join Discord to locate Fragment II",
  },
  {
    id: "cipher_iii",      contractId: taskId("cipher_iii"),
    category: "CIPHER_HUNT", difficulty: "archivist",
    title: "Find Fragment III",
    desc: "The third fragment lies dormant on Frequency 03. Only the persistent find it.",
    signal: 1000, action: "manual",
    requiresApproval: true, repeatable: false, badge: "III", hidden: false,
    unlockCondition: "Join Telegram to discover Fragment III",
  },
  {
    id: "gate_unlock",     contractId: taskId("gate_unlock"),
    category: "CIPHER_HUNT", difficulty: "guardian",
    title: "Unlock the Cipher Gate",
    desc: "Assemble the fragments. Enter the cipher. Become part of the record.",
    signal: 2500, action: "onchain",
    requiresApproval: false, repeatable: false, badge: "⟦⟧",
  },
  {
    id: "hidden_puzzle",   contractId: taskId("hidden_puzzle"),
    category: "CIPHER_HUNT", difficulty: "guardian",
    title: "Solve Hidden Protocol Puzzle",
    desc: "// ACCESS RESTRICTED — SIGNAL WEIGHT THRESHOLD NOT MET",
    signal: 5000, action: "manual",
    requiresApproval: true, repeatable: false, badge: "?", hidden: true,
    unlockCondition: "Reach ARCHIVIST tier to reveal this task",
  },

  // ── SIGNAL RELAY ─────────────────────────────────────────────────────────────
  {
    id: "relay_discord",   contractId: taskId("relay_discord"),
    category: "SIGNAL_RELAY", difficulty: "initiate",
    title: "Relay: Discord Join",
    desc: "Your signal caused another to join the Den. The network expands.",
    signal: 200, action: "auto",
    requiresApproval: false, repeatable: true, badge: "◆",
  },
  {
    id: "relay_telegram",  contractId: taskId("relay_telegram"),
    category: "SIGNAL_RELAY", difficulty: "initiate",
    title: "Relay: Telegram Join",
    desc: "Another node joins Frequency 02 through your relay.",
    signal: 200, action: "auto",
    requiresApproval: false, repeatable: true, badge: "◈",
  },
  {
    id: "relay_x",         contractId: taskId("relay_x"),
    category: "SIGNAL_RELAY", difficulty: "initiate",
    title: "Relay: X Follow",
    desc: "Your broadcast brought another seeker to the signal.",
    signal: 250, action: "auto",
    requiresApproval: false, repeatable: true, badge: "✕",
  },
  {
    id: "relay_onboarding",contractId: taskId("relay_onboarding"),
    category: "SIGNAL_RELAY", difficulty: "seeker",
    title: "Relay: Full Onboarding Complete",
    desc: "Someone you relayed completed full protocol initiation.",
    signal: 500, action: "auto",
    requiresApproval: false, repeatable: true, badge: "⚡",
  },
  {
    id: "relay_member",    contractId: taskId("relay_member"),
    category: "SIGNAL_RELAY", difficulty: "archivist",
    title: "Relay: Invite Reaches MEMBER Tier",
    desc: "Your relay became a MEMBER. Rare. Significant. Remembered on-chain.",
    signal: 1500, action: "manual",
    requiresApproval: true, repeatable: true, badge: "🦦",
  },
  {
    id: "relay_content",   contractId: taskId("relay_content"),
    category: "SIGNAL_RELAY", difficulty: "guardian",
    title: "Relay: Invite Creates Content",
    desc: "Someone you brought in contributed content to the protocol archive.",
    signal: 3000, action: "manual",
    requiresApproval: true, repeatable: true, badge: "👑",
  },

  // ── GOVERNANCE ───────────────────────────────────────────────────────────────
  {
    id: "read_proposal",   contractId: taskId("read_proposal"),
    category: "GOVERNANCE", difficulty: "seeker",
    title: "Read Governance Proposal",
    desc: "Stay informed. The protocol is shaped by those who pay attention.",
    signal: 200, action: "link", link: "/dapp#governance",
    requiresApproval: false, repeatable: true, badge: "📋",
  },
  {
    id: "cast_vote",       contractId: taskId("cast_vote"),
    category: "GOVERNANCE", difficulty: "archivist",
    title: "Participate in Vote",
    desc: "On-chain governance participation. Your signal weight determines your voice.",
    signal: 500, action: "onchain",
    requiresApproval: false, repeatable: true, badge: "⚖",
  },
  {
    id: "discuss_proposal",contractId: taskId("discuss_proposal"),
    category: "GOVERNANCE", difficulty: "seeker",
    title: "Discuss a Proposal",
    desc: "Thoughtful discussion shapes better governance. Say something worth reading.",
    signal: 300, action: "manual",
    requiresApproval: true, repeatable: true, badge: "🗿",
  },
  {
    id: "submit_feedback", contractId: taskId("submit_feedback"),
    category: "GOVERNANCE", difficulty: "archivist",
    title: "Submit Governance Feedback",
    desc: "Direct protocol feedback. The Guardian reads everything submitted here.",
    signal: 400, action: "manual",
    requiresApproval: true, repeatable: false, badge: "◈",
  },
];

export const CATEGORY_META: Record<TaskCategory, { label: string; glyph: string; color: string; desc: string; contractEnum: number }> = {
  SIGNAL_ACQUISITION: { label: "SIGNAL ACQUISITION", glyph: "א", color: "#00C896", desc: "Establish your presence in the network",           contractEnum: 0 },
  KNOWLEDGE_ARCHIVE:  { label: "KNOWLEDGE ARCHIVE",  glyph: "ב", color: "#60A5FA", desc: "Study the inscriptions. Know the protocol.",        contractEnum: 1 },
  CONTRIBUTION:       { label: "CONTRIBUTION LAYER", glyph: "ג", color: "#A78BFA", desc: "Create signal. Contribute to the archive.",          contractEnum: 2 },
  CIPHER_HUNT:        { label: "CIPHER HUNTS",       glyph: "ד", color: "#C9A84C", desc: "Explore. Discover. Unlock hidden knowledge.",        contractEnum: 3 },
  SIGNAL_RELAY:       { label: "SIGNAL RELAYS",      glyph: "ה", color: "#F5A623", desc: "Expand the network. Relay brings more nodes online.", contractEnum: 4 },
  GOVERNANCE:         { label: "GOVERNANCE",          glyph: "ו", color: "#E2BF6E", desc: "Shape the protocol. Govern what you own.",           contractEnum: 5 },
  NODE_PRESENCE:      { label: "NODE PRESENCE",      glyph: "ז", color: "#FF5B5B", desc: "Stay online. The network tracks your presence.",     contractEnum: 6 },
};

export const DIFFICULTY_META = {
  initiate:  { label: "INITIATE",  color: "#8C7A5C" },
  seeker:    { label: "SEEKER",    color: "#60A5FA" },
  archivist: { label: "ARCHIVIST", color: "#C9A84C" },
  guardian:  { label: "GUARDIAN",  color: "#E2BF6E" },
};

// ─── TASK OVERRIDES (admin-editable fields stored in Firestore) ───────────────

export interface TaskOverride {
  taskId:    string;
  title?:    string;
  desc?:     string;
  link?:     string;
  signal?:   number;
  active?:   boolean;
  updatedAt: number;
}

/** Save admin edits for a task to Firestore. Overrides the static definition. */
export async function saveTaskOverride(taskId: string, fields: Partial<Omit<TaskOverride, "taskId" | "updatedAt">>): Promise<void> {
  await setDoc(
    doc(db, "task_overrides", taskId),
    { taskId, ...fields, updatedAt: Date.now() },
    { merge: true }
  );
}

/** Load all admin overrides and return as a map keyed by taskId. */
export async function getTaskOverrides(): Promise<Record<string, TaskOverride>> {
  const snap = await getDocs(collection(db, "task_overrides"));
  const out: Record<string, TaskOverride> = {};
  snap.docs.forEach((d) => { out[d.id] = d.data() as TaskOverride; });
  return out;
}

/** Merge Firestore overrides into the static task list. Returns patched tasks. */
export function applyTaskOverrides(tasks: InitiationTask[], overrides: Record<string, TaskOverride>): InitiationTask[] {
  return tasks.map((t) => {
    const ov = overrides[t.id];
    if (!ov) return t;
    return {
      ...t,
      ...(ov.title  !== undefined && { title:  ov.title  }),
      ...(ov.desc   !== undefined && { desc:   ov.desc   }),
      ...(ov.link   !== undefined && { link:   ov.link   }),
      ...(ov.signal !== undefined && { signal: ov.signal }),
    };
  }).filter((t) => {
    const ov = overrides[t.id];
    return !ov || ov.active !== false;
  });
}

// ─── FIRESTORE OPS ─────────────────────────────────────────────────────────────

export interface CompletedTask {
  taskId:    string;
  signal:    number;
  txHash?:   string;
  timestamp: number;
  approved?: boolean;
}

export async function getUserInitiation(uid: string): Promise<Record<string, CompletedTask>> {
  const snap = await getDoc(doc(db, "user_initiation", uid));
  return snap.exists() ? (snap.data() as Record<string, CompletedTask>) : {};
}

export async function recordTaskOffchain(
  uid: string, taskId: string, signal: number, txHash?: string
): Promise<void> {
  const ref   = doc(db, "user_initiation", uid);
  const snap  = await getDoc(ref);
  const data  = snap.exists() ? snap.data() : {};
  if (data[taskId]) return;

  await setDoc(ref, {
    ...data,
    [taskId]: { taskId, signal, txHash: txHash || null, timestamp: Date.now(), approved: true },
  });

  // Update total signal weight — atomic increment, works even if field doesn't exist yet
  await setDoc(doc(db, "users", uid), { signalWeight: increment(signal), updatedAt: serverTimestamp() }, { merge: true });

  // Log to activity feed
  await addDoc(collection(db, "activity"), {
    type: "initiation", uid, taskId, signal, txHash: txHash || null,
    timestamp: serverTimestamp(),
  });
}

export async function submitManualTask(
  uid: string, taskId: string, proofUrl: string, note: string
): Promise<void> {
  await addDoc(collection(db, "pending_approvals"), {
    uid, taskId, proofUrl, note,
    status: "pending",
    submittedAt: serverTimestamp(),
  });
}

export interface PendingApproval {
  id:          string;
  uid:         string;
  taskId:      string;
  proofUrl:    string;
  note:        string;
  status:      "pending" | "approved" | "rejected";
  submittedAt: { seconds: number };
  displayName?: string;
  walletAddress?: string;
}

export async function getPendingApprovals(): Promise<PendingApproval[]> {
  const snap = await getDocs(
    query(collection(db, "pending_approvals"), orderBy("submittedAt", "desc"), limit(100))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PendingApproval));
}

export async function approveManualTask(approvalId: string, uid: string, taskId: string): Promise<void> {
  const task = INITIATION_TASKS.find((t) => t.id === taskId);
  if (!task) return;

  await setDoc(doc(db, "pending_approvals", approvalId), { status: "approved" }, { merge: true });
  await recordTaskOffchain(uid, taskId, task.signal);
}

export async function rejectManualTask(approvalId: string): Promise<void> {
  await setDoc(doc(db, "pending_approvals", approvalId), { status: "rejected" }, { merge: true });
}

export function calcInitiationProgress(completed: Record<string, CompletedTask>) {
  const done  = Object.keys(completed).length;
  const total = INITIATION_TASKS.length;
  const signal = Object.values(completed).reduce((s, t) => s + (t.signal || 0), 0);
  const pct   = Math.round((done / total) * 100);
  return { done, total, signal, pct };
}

// ─── NODE PRESENCE REWARD SCALE ──────────────────────────────────────────────

export function nodePresenceReward(streak: number): number {
  if (streak >= 90) return 500;
  if (streak >= 30) return 100;
  if (streak >= 7)  return 50;
  return 20;
}
