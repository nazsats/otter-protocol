/**
 * Starter tasks — the 5 essential social tasks shown on the simplified
 * onboarding dashboard. Deliberately tiny and flat; the full mission/initiation
 * systems live behind the Phase 2 unlock.
 *
 * Completion sources:
 *  - "link" tasks (X follow / repost / comment) can't be API-verified, so they
 *    are click-to-complete and tracked in `user_missions` (client-owned writes,
 *    same trust model as the existing points missions).
 *  - "verify_*" tasks (Telegram / Discord) are REALLY verified by the existing
 *    /api/verify/* endpoints, which record them in `user_initiation` under the
 *    keys `join_telegram` / `join_discord`. We derive their done-state from there.
 */
import { doc, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type StarterAction = "link" | "verify_telegram" | "verify_discord";

export interface StarterTask {
  id:     string;
  label:  string;
  desc:   string;
  action: StarterAction;
  link?:  string;
  points: number;   // reward shown on the card (points for link tasks; verify
                    // tasks award the same amount as on-chain/off-chain SIGNAL)
  icon:   string;
}

export const STARTER_TASKS: StarterTask[] = [
  {
    id: "starter_follow_x", action: "link", icon: "𝕏",
    label: "Follow on X",
    desc:  "Follow @otter_protocol1 for protocol updates.",
    link:  "https://x.com/otter_protocol1", points: 100,
  },
  {
    id: "starter_repost", action: "link", icon: "↻",
    label: "Like & Repost",
    desc:  "Boost our launch announcement on X.",
    link:  "https://x.com/otter_protocol1", points: 100,
  },
  {
    id: "starter_comment", action: "link", icon: "💬",
    label: "Comment on the post",
    desc:  "Drop a comment on the launch announcement.",
    link:  "https://x.com/otter_protocol1", points: 100,
  },
  {
    id: "join_telegram", action: "verify_telegram", icon: "✈",
    label: "Join Telegram",
    desc:  "Join the Telegram channel, then verify your membership.",
    link:  "https://t.me/otterprotocol", points: 100,
  },
  {
    id: "join_discord", action: "verify_discord", icon: "◆",
    label: "Join Discord",
    desc:  "Join the Discord server, then verify your membership.",
    link:  "https://discord.gg/EGzu4NHqP", points: 100,
  },
  {
    id: "starter_share_referral", action: "link", icon: "🔗",
    label: "Share your referral link",
    desc:  "Invite friends with your unique link. First share earns points.",
    points: 150,
  },
];

export interface StarterState {
  done:            Record<string, boolean>;
  count:           number;
  total:           number;
  allDone:         boolean;
  welcomeClaimed:  boolean;
}

/** Read all task completion + welcome-claim state for a user in one shot. */
export async function getStarterState(uid: string): Promise<StarterState> {
  const [missionsSnap, initSnap, userSnap] = await Promise.all([
    getDoc(doc(db, "user_missions", uid)),
    getDoc(doc(db, "user_initiation", uid)),
    getDoc(doc(db, "users", uid)),
  ]);
  const missions = missionsSnap.exists() ? missionsSnap.data() : {};
  const init     = initSnap.exists()     ? initSnap.data()     : {};

  const done: Record<string, boolean> = {};
  for (const t of STARTER_TASKS) {
    done[t.id] = t.action === "link" ? !!missions[t.id] : !!init[t.id];
  }
  const count = STARTER_TASKS.filter((t) => done[t.id]).length;

  return {
    done,
    count,
    total:          STARTER_TASKS.length,
    allDone:        count === STARTER_TASKS.length,
    welcomeClaimed: !!userSnap.data()?.welcomeClaimed,
  };
}

/**
 * Complete a click-to-complete "link" task (X follow / repost / comment).
 * Writes the user's own docs only (allowed by Firestore rules); verify tasks are
 * completed server-side by the /api/verify endpoints, not here.
 */
export async function completeStarterTask(uid: string, taskId: string): Promise<void> {
  const task = STARTER_TASKS.find((t) => t.id === taskId);
  if (!task || task.action !== "link") return;

  const ref  = doc(db, "user_missions", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  if (data[taskId]) return;

  await setDoc(ref, { [taskId]: true }, { merge: true });
  await setDoc(doc(db, "users", uid), { points: increment(task.points), updatedAt: serverTimestamp() }, { merge: true });
}
