/**
 * Daily Streak + Spin-to-Win — shared, PURE module.
 *
 * Contains only data + pure functions so it can be imported from BOTH the
 * client component and the server route handler. It must NOT import the
 * client firebase SDK or firebase-admin (importing either would break the
 * other environment).
 *
 * Security model: the spin prize is decided SERVER-SIDE. The client only uses
 * PRIZES to render the wheel and to animate to the index the server returns.
 * Rewards are POINTS (the infinite currency) — real OTTER tokens stay precious
 * and are never dispensed from a free daily spin.
 */

export interface Prize {
  id:     number;
  label:  string;   // short label rendered on the wheel
  points: number;   // base points awarded (before streak multiplier)
  weight: number;   // relative probability weight (server-authoritative)
  color:  string;   // wheel segment color
  jackpot?: boolean;
}

/** 8 wheel segments. Weights sum to 100. */
export const PRIZES: Prize[] = [
  { id: 0, label: "25",   points: 25,  weight: 26, color: "#3A3320" },
  { id: 1, label: "50",   points: 50,  weight: 24, color: "#4A3F22" },
  { id: 2, label: "75",   points: 75,  weight: 18, color: "#5C4A2A" },
  { id: 3, label: "100",  points: 100, weight: 13, color: "#7A6230" },
  { id: 4, label: "150",  points: 150, weight: 9,  color: "#9C7E38" },
  { id: 5, label: "200",  points: 200, weight: 6,  color: "#C9A84C" },
  { id: 6, label: "350",  points: 350, weight: 3,  color: "#E2BF6E" },
  { id: 7, label: "500",  points: 500, weight: 1,  color: "#F4DC8A", jackpot: true },
];

/** Streak milestones grant a one-time bonus the day they're reached. */
export const MILESTONES: Record<number, number> = {
  3:  50,
  7:  200,
  14: 500,
  30: 1500,
  60: 3000,
  90: 6000,
};

export function milestoneBonus(streak: number): number {
  return MILESTONES[streak] ?? 0;
}

/**
 * Streak multiplier applied to the spin prize. Caps at 10 days.
 * Day 1 → 1.00×, Day 10+ → 1.45×.
 */
export function streakMultiplier(streak: number): number {
  const capped = Math.min(Math.max(streak - 1, 0), 9);
  return 1 + capped * 0.05;
}

/** Today's date as a UTC "YYYY-MM-DD" string. */
export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Whole-day difference (b - a) for two "YYYY-MM-DD" strings. */
export function dayDiff(a: string, b: string): number {
  const ta = new Date(a + "T00:00:00Z").getTime();
  const tb = new Date(b + "T00:00:00Z").getTime();
  return Math.round((tb - ta) / 86_400_000);
}

export type CheckInOutcome = "first" | "continue" | "reset" | "already";

/**
 * Decide what a check-in on `today` does given the last check-in date.
 * Pure — the route uses this to stay deterministic + testable.
 */
export function resolveCheckIn(lastCheckIn: string | null, today: string): {
  outcome: CheckInOutcome;
  streak: number;          // streak AFTER this check-in (unchanged if "already")
} {
  if (!lastCheckIn)            return { outcome: "first",    streak: 1 };
  if (lastCheckIn === today)   return { outcome: "already",  streak: 0 };
  const diff = dayDiff(lastCheckIn, today);
  if (diff === 1)              return { outcome: "continue", streak: 0 };  // caller adds prev+1
  return { outcome: "reset", streak: 1 };
}

/**
 * Server-authoritative weighted prize pick.
 * @param rand a uniform random in [0, 1)
 */
export function pickPrizeIndex(rand: number): number {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let roll = rand * total;
  for (let i = 0; i < PRIZES.length; i++) {
    roll -= PRIZES[i].weight;
    if (roll < 0) return i;
  }
  return PRIZES.length - 1;
}

/** Shape stored in Firestore `daily_streaks/{uid}` (read-own; server writes). */
export interface DailyState {
  streak:        number;
  longestStreak: number;
  lastCheckIn:   string | null;   // "YYYY-MM-DD" UTC
  spinPending:   boolean;         // true after check-in, false after spin
  lastSpinDate:  string | null;
  totalPointsWon: number;
  totalSpins:    number;
}

export const EMPTY_DAILY: DailyState = {
  streak: 0,
  longestStreak: 0,
  lastCheckIn: null,
  spinPending: false,
  lastSpinDate: null,
  totalPointsWon: 0,
  totalSpins: 0,
};
