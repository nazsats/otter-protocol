"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authFetch } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useCelebration } from "@/context/CelebrationContext";
import {
  PRIZES, EMPTY_DAILY, utcDateString, streakMultiplier, DailyState,
} from "@/lib/daily";
import { Flame, Check, Gift, Sparkles, Clock } from "lucide-react";

const C = {
  card:   "#0D0B07", card2: "#0A0800", border: "#1E1A10", borderH: "#2A2418",
  gold:   "#C9A84C", goldL: "#E2BF6E", text: "#E8DFC8",
  muted:  "#8C7A5C", mutedL: "#5C4A2A", green: "#00C896",
};
const FONT = "var(--font-cinzel, Georgia, serif)";
const MONO = "var(--font-geist-mono, monospace)";
const SEG  = 360 / PRIZES.length;

/** Rotation that lands segment `index` under the top pointer, spinning forward. */
function targetRotation(prev: number, index: number): number {
  const base    = 360 - (index * SEG + SEG / 2);           // seg center → top
  const jitter  = (Math.random() - 0.5) * (SEG * 0.55);    // land off-center, feels real
  const desired = ((base + jitter) % 360 + 360) % 360;
  const prevMod = ((prev % 360) + 360) % 360;
  let delta = desired - prevMod;
  if (delta < 0) delta += 360;
  return prev + 360 * 5 + delta;                           // 5 full turns + settle
}

export default function DailyStreak({ uid, onReward, compact }: {
  uid?: string;
  onReward?: () => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const [state,    setState]    = useState<DailyState>(EMPTY_DAILY);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [reveal,   setReveal]   = useState<{ awarded: number; jackpot: boolean } | null>(null);
  const [float,    setFloat]    = useState<{ key: number; text: string } | null>(null);
  const [now,      setNow]      = useState(() => Date.now());
  const floatKey = useRef(0);

  const today = utcDateString();
  const checkedInToday = state.lastCheckIn === today;

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, "daily_streaks", uid));
      setState({ ...EMPTY_DAILY, ...(snap.exists() ? (snap.data() as DailyState) : {}) });
    } catch { /* read failed — keep empty */ }
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // Tick once a minute for the "next check-in" countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const showFloat = (text: string) => {
    floatKey.current += 1;
    setFloat({ key: floatKey.current, text });
    setTimeout(() => setFloat((f) => (f && f.key === floatKey.current ? null : f)), 1500);
  };

  // ── CHECK IN ──────────────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!uid || busy) return;
    setBusy(true);
    try {
      const res  = await authFetch("/api/daily", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check-in failed");

      setState((s) => ({
        ...s,
        streak:        data.streak ?? s.streak,
        longestStreak: data.longestStreak ?? Math.max(s.longestStreak, data.streak ?? 0),
        lastCheckIn:   today,
        spinPending:   true,
      }));

      if (data.already) {
        toast("Already checked in today — spin your wheel!", "info");
      } else {
        const milestone = data.milestoneBonus > 0
          ? ` · +${data.milestoneBonus} day-${data.milestoneDay} bonus!`
          : "";
        toast(`Day ${data.streak} streak sealed${milestone}`, "success");
        if (data.milestoneBonus > 0) { showFloat(`+${data.milestoneBonus} pts`); celebrate(1.5); }
        onReward?.();
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Check-in failed", "error");
    }
    setBusy(false);
  };

  // ── SPIN ──────────────────────────────────────────────────────────────────
  const handleSpin = async () => {
    if (!uid || busy || spinning || !state.spinPending) return;
    setBusy(true); setReveal(null);
    try {
      const res  = await authFetch("/api/daily", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "spin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Spin failed");

      setSpinning(true);
      setRotation((r) => targetRotation(r, data.prizeIndex));

      // Reveal after the wheel settles (matches the 4.2s CSS transition).
      setTimeout(() => {
        setSpinning(false);
        setReveal({ awarded: data.awarded, jackpot: data.jackpot });
        setState((s) => ({
          ...s, spinPending: false, lastSpinDate: today,
          totalPointsWon: s.totalPointsWon + data.awarded,
          totalSpins: s.totalSpins + 1,
        }));
        showFloat(`+${data.awarded} pts`);
        toast(
          data.jackpot ? `JACKPOT! +${data.awarded} points 🎉` : `+${data.awarded} points won!`,
          "success"
        );
        celebrate(data.jackpot ? 2 : 1);
        onReward?.();
        setBusy(false);
      }, 4300);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Spin failed", "error");
      setBusy(false);
    }
  };

  // ── Countdown to next UTC day ───────────────────────────────────────────────
  const msToTomorrow = (() => {
    const d = new Date(now);
    const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    return Math.max(0, next - now);
  })();
  const hrs  = Math.floor(msToTomorrow / 3_600_000);
  const mins = Math.floor((msToTomorrow % 3_600_000) / 60_000);

  const mult = streakMultiplier(Math.max(state.streak, 1));

  if (!uid) {
    return (
      <Shell compact={compact}>
        <div style={{ textAlign: "center", padding: compact ? "8px 0" : "24px 0" }}>
          <Flame size={compact ? 22 : 30} color={C.gold} style={{ marginBottom: "10px" }} />
          <div style={{ fontFamily: FONT, color: C.text, fontWeight: 700, fontSize: compact ? "13px" : "15px", marginBottom: "4px" }}>
            Daily Streak & Spin
          </div>
          <div style={{ fontFamily: FONT, color: C.muted, fontSize: "11px" }}>
            Sign in to claim your daily spin and build a streak.
          </div>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell compact={compact}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <span style={{ display: "inline-block", width: "22px", height: "22px", border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      </Shell>
    );
  }

  const conic = `conic-gradient(${PRIZES.map((p, i) =>
    `${p.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(", ")})`;

  const wheelSize = compact ? 150 : 230;
  const radius    = wheelSize / 2;

  return (
    <Shell compact={compact}>
      {/* ── Streak header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: compact ? "12px" : "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className={checkedInToday ? "streak-flame-live" : ""} style={{
            width: compact ? "34px" : "42px", height: compact ? "34px" : "42px", borderRadius: "12px", flexShrink: 0,
            background: "radial-gradient(circle at 35% 30%, rgba(244,220,138,0.25), rgba(201,168,76,0.08))",
            border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Flame size={compact ? 16 : 20} color={state.streak > 0 ? C.goldL : C.mutedL} />
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: compact ? "16px" : "20px", color: C.text, lineHeight: 1, display: "flex", alignItems: "baseline", gap: "6px" }}>
              {state.streak}
              <span style={{ fontSize: "11px", color: C.muted, fontWeight: 700, letterSpacing: "0.08em" }}>DAY STREAK</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: "10px", color: C.mutedL, letterSpacing: "0.06em", marginTop: "3px" }}>
              Best: {state.longestStreak} · Spin ×{mult.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 7-day flame row */}
        <div style={{ display: "flex", gap: "4px" }}>
          {Array.from({ length: 7 }).map((_, i) => {
            const filled = i < Math.min(state.streak, 7);
            return (
              <div key={i} title={`Day ${i + 1}`} style={{
                width: "9px", height: "9px", borderRadius: "50%",
                background: filled ? `linear-gradient(135deg, ${C.gold}, ${C.goldL})` : "#19150C",
                border: `1px solid ${filled ? "rgba(201,168,76,0.5)" : C.border}`,
                boxShadow: filled ? "0 0 6px rgba(201,168,76,0.4)" : "none",
              }} />
            );
          })}
        </div>
      </div>

      {/* ── Wheel ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        {/* floating reward */}
        {float && (
          <div key={float.key} className="reward-float" style={{ top: compact ? "8px" : "16px", color: C.goldL, fontFamily: MONO, fontSize: compact ? "18px" : "24px" }}>
            {float.text}
          </div>
        )}

        <div style={{ position: "relative", width: wheelSize, height: wheelSize, marginBottom: "16px" }}>
          {/* pointer */}
          <div style={{
            position: "absolute", top: "-4px", left: "50%", transform: "translateX(-50%)", zIndex: 5,
            width: 0, height: 0, borderLeft: "9px solid transparent", borderRight: "9px solid transparent",
            borderTop: `16px solid ${C.goldL}`, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
          }} />
          {/* wheel face */}
          <div className="spin-wheel" style={{
            width: "100%", height: "100%", borderRadius: "50%", background: conic,
            transform: `rotate(${rotation}deg)`,
            boxShadow: "0 0 0 4px #0A0800, 0 0 0 6px rgba(201,168,76,0.35), 0 10px 40px rgba(0,0,0,0.6)",
            position: "relative",
          }}>
            {PRIZES.map((p, i) => (
              <div key={p.id} style={{
                position: "absolute", top: "50%", left: "50%",
                transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-${radius - (compact ? 22 : 32)}px)`,
                transformOrigin: "0 0",
              }}>
                <span style={{
                  display: "inline-block", transform: "translate(-50%,-50%)",
                  fontFamily: MONO, fontWeight: 800, fontSize: compact ? "11px" : "14px",
                  color: p.jackpot ? "#000" : (i >= 5 ? "#0A0800" : C.goldL),
                  textShadow: p.jackpot ? "none" : "0 1px 2px rgba(0,0,0,0.5)",
                }}>{p.label}</span>
              </div>
            ))}
          </div>
          {/* hub */}
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 4,
            width: compact ? "30px" : "44px", height: compact ? "30px" : "44px", borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #F4DC8A, #C9A84C 55%, #8B6000)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 14px rgba(201,168,76,0.5), inset 0 2px 4px rgba(255,255,255,0.3)",
          }}>
            <span style={{ fontFamily: MONO, fontSize: compact ? "12px" : "16px", color: "#000", fontWeight: 900 }}>◈</span>
          </div>
        </div>

        {/* ── Action area ── */}
        {!checkedInToday ? (
          <button onClick={handleCheckIn} disabled={busy} className="btn-press"
            style={primaryBtn(busy)}>
            {busy ? "Sealing…" : <><Check size={15} /> Check in for Day {state.streak + 1}</>}
          </button>
        ) : state.spinPending ? (
          <button onClick={handleSpin} disabled={busy || spinning} className="btn-press"
            style={primaryBtn(busy || spinning)}>
            {spinning ? <><Sparkles size={15} /> Spinning…</> : <><Gift size={15} /> Spin the wheel</>}
          </button>
        ) : (
          <div style={{ textAlign: "center" }}>
            {reveal && (
              <div className="prize-pop" style={{
                fontFamily: MONO, fontWeight: 900, fontSize: compact ? "20px" : "26px",
                color: reveal.jackpot ? C.goldL : C.gold, marginBottom: "6px",
                textShadow: "0 0 18px rgba(201,168,76,0.5)",
              }}>
                {reveal.jackpot ? "🎉 JACKPOT " : "+"}{reveal.awarded} pts
              </div>
            )}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontFamily: FONT, color: C.muted, fontSize: "12px", letterSpacing: "0.04em" }}>
              <Clock size={13} color={C.mutedL} />
              Next spin in {hrs}h {mins}m
            </div>
          </div>
        )}

        {!compact && (
          <div style={{ fontFamily: FONT, color: C.mutedL, fontSize: "10px", letterSpacing: "0.05em", marginTop: "12px", textAlign: "center", lineHeight: 1.7 }}>
            Check in daily to grow your streak — longer streaks boost every spin.<br />
            Total won: <span style={{ color: C.gold, fontWeight: 700 }}>{state.totalPointsWon.toLocaleString()}</span> pts across {state.totalSpins} spins.
          </div>
        )}
      </div>
    </Shell>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    background: disabled ? "rgba(201,168,76,0.15)" : "linear-gradient(135deg, #C9A84C, #E2BF6E)",
    color: disabled ? C.gold : "#000", border: "none", borderRadius: "10px",
    padding: "12px 24px", fontWeight: 700, fontSize: "13px", fontFamily: FONT,
    letterSpacing: "0.06em", cursor: disabled ? "not-allowed" : "pointer",
    minWidth: "200px", opacity: disabled ? 0.85 : 1,
  };
}

function Shell({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, ${C.card2} 100%)`,
      border: "1px solid rgba(201,168,76,0.2)", borderRadius: "16px",
      padding: compact ? "16px" : "24px", position: "relative", overflow: "hidden",
    }}>
      <span style={{ position: "absolute", right: "14px", top: "8px", fontFamily: MONO, fontSize: "46px", color: "rgba(201,168,76,0.04)", userSelect: "none", pointerEvents: "none" }}>ל</span>
      {children}
    </div>
  );
}
