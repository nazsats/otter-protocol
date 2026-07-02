"use client";
import { useState, useEffect, useCallback } from "react";
import { authFetch } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { useCelebration } from "@/context/CelebrationContext";
import { useAuth } from "@/context/AuthContext";
import DailyStreak from "@/components/DailyStreak";
import TelegramVerifyModal from "@/components/TelegramVerifyModal";
import { STARTER_TASKS, getStarterState, completeStarterTask, StarterState, StarterTask } from "@/lib/starter";
import { Check, ExternalLink, ShieldCheck, Gift, ArrowRight, Sparkles, Lock, Copy, Users } from "lucide-react";

const C = {
  black: "#000", card: "#0D0B07", card2: "#0A0800", border: "#1E1A10", borderH: "#2A2418",
  gold: "#C9A84C", goldL: "#E2BF6E", text: "#E8DFC8", muted: "#8C7A5C", mutedL: "#5C4A2A",
  green: "#00C896", blue: "#60A5FA",
};
const FONT = "var(--font-cinzel, Georgia, serif)";
const MONO = "var(--font-geist-mono, monospace)";

export default function StarterDashboard({ uid, onPointsChange, onUnlockPhase2, openAuthModal }: {
  uid?: string;
  onPointsChange?: () => void;
  onUnlockPhase2?: () => void;
  openAuthModal?: () => void;
}) {
  const toast = useToast();
  const { celebrate } = useCelebration();
  const { profile } = useAuth();
  const [state,       setState]       = useState<StarterState | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [taskBusy,    setTaskBusy]    = useState<string | null>(null);
  const [verifyBusy,  setVerifyBusy]  = useState<string | null>(null);
  // Telegram modal
  const [showTg,  setShowTg]  = useState(false);
  const [tgBot,   setTgBot]   = useState<string | null>(null);
  const [tgState, setTgState] = useState<"idle" | "success" | "error" | "not_member">("idle");
  const [tgErr,   setTgErr]   = useState("");

  const load = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try { setState(await getStarterState(uid)); } catch { /* keep prior */ }
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // ── Claim welcome bonus ─────────────────────────────────────────────────────
  const claimWelcome = async () => {
    if (!uid) { openAuthModal?.(); return; }
    if (state?.welcomeClaimed || welcomeBusy) return;
    setWelcomeBusy(true);
    try {
      const res  = await authFetch("/api/welcome", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      if (data.alreadyClaimed) toast("Welcome bonus already claimed", "info");
      else { toast(`+${data.awarded} points — welcome to the Raft! 🦦`, "success"); celebrate(1.5); }
      setState((s) => (s ? { ...s, welcomeClaimed: true } : s));
      onPointsChange?.();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Claim failed", "error");
    }
    setWelcomeBusy(false);
  };

  // ── Click-to-complete link tasks (X follow / repost / comment) ──────────────
  const doLinkTask = (task: StarterTask) => {
    if (!uid) { openAuthModal?.(); return; }
    if (state?.done[task.id] || taskBusy) return;
    if (task.link) window.open(task.link, "_blank", "noopener,noreferrer");
    setTaskBusy(task.id);
    setTimeout(async () => {
      try {
        await completeStarterTask(uid, task.id);
        toast(`+${task.points} points — ${task.label}`, "success");
        celebrate();
        await load();
        onPointsChange?.();
      } catch {
        toast("Could not record — try again", "error");
      }
      setTaskBusy(null);
    }, 1500);
  };

  // ── Share referral link (click-to-complete, first share earns points) ───────
  const shareReferral = async () => {
    if (!uid) { openAuthModal?.(); return; }
    if (state?.done["starter_share_referral"]) return;
    try {
      await completeStarterTask(uid, "starter_share_referral");
      const t = STARTER_TASKS.find((t) => t.id === "starter_share_referral");
      toast(`+${t?.points} points — referral link shared!`, "success");
      celebrate();
      await load();
      onPointsChange?.();
    } catch {
      // non-blocking — the link was still copied/shared
    }
  };

  // ── Discord verification (OAuth redirect) ───────────────────────────────────
  const verifyDiscord = async () => {
    if (!uid) { openAuthModal?.(); return; }
    setVerifyBusy("join_discord");
    try {
      const res  = await authFetch("/api/verify/discord");
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start Discord verification");
      window.location.href = data.url;
    } catch (e: unknown) {
      setVerifyBusy(null);
      toast(e instanceof Error ? e.message : "Discord verification failed", "error");
    }
  };

  // ── Telegram verification (login widget modal) ──────────────────────────────
  const verifyTelegram = async () => {
    if (!uid) { openAuthModal?.(); return; }
    setTgState("idle"); setTgErr("");
    if (!tgBot) {
      try {
        const r = await fetch("/api/verify/telegram/botinfo");
        const d = await r.json();
        if (d.username) setTgBot(d.username);
      } catch { /* modal still opens */ }
    }
    setShowTg(true);
  };

  const onTgAuth = useCallback(async (tgData: Record<string, unknown>) => {
    if (!uid) return;
    setVerifyBusy("join_telegram"); setTgState("idle");
    try {
      const res  = await authFetch("/api/verify/telegram", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, ...tgData }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTgState("success");
        toast(`+${data.signal} signal — Telegram verified`, "success");
        celebrate(1.4);
        await load(); onPointsChange?.();
        setTimeout(() => setShowTg(false), 1500);
      } else if (res.status === 403 && data.status) {
        setTgState("not_member");
        setTgErr("You haven't joined the channel yet. Join first, then verify.");
      } else {
        setTgState("error");
        setTgErr(data.error || "Verification failed");
      }
    } catch {
      setTgState("error");
      setTgErr("Network error — please try again");
    }
    setVerifyBusy(null);
  }, [uid, load, onPointsChange, toast, celebrate]);

  // ── Signed-out state ────────────────────────────────────────────────────────
  if (!uid) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <WelcomeHero claimed={false} busy={false} onClaim={() => openAuthModal?.()} signedOut />
        <div style={{ background: "rgba(201,168,76,0.04)", border: `1px solid rgba(201,168,76,0.12)`, borderRadius: "14px", padding: "24px", textAlign: "center" }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "15px", color: C.text, marginBottom: "6px" }}>Sign in to begin</div>
          <div style={{ color: C.muted, fontSize: "13px", marginBottom: "16px" }}>Claim your welcome bonus and complete 5 quick tasks to join the Raft.</div>
          <button onClick={openAuthModal}
            style={{ background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "11px 26px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
            Sign In / Register
          </button>
        </div>
      </div>
    );
  }

  const count   = state?.count ?? 0;
  const total   = state?.total ?? STARTER_TASKS.length;
  const pct      = Math.round((count / total) * 100);
  const allDone = !!state?.allDone;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {showTg && (
        <TelegramVerifyModal
          botUsername={tgBot}
          verifyState={tgState}
          errorMsg={tgErr}
          onAuth={onTgAuth}
          onClose={() => { setShowTg(false); setTgState("idle"); }}
        />
      )}

      {/* STEP 1 — Claim OTTER (primary CTA) */}
      <WelcomeHero claimed={!!state?.welcomeClaimed} busy={welcomeBusy} onClaim={claimWelcome} />

      {/* STEP 2 — Daily spin */}
      <DailyStreak uid={uid} onReward={onPointsChange} />

      {/* STEP 3 — Five social tasks */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: "15px", color: C.text, letterSpacing: "0.04em" }}>Complete your first tasks</div>
            <div style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, marginTop: "3px" }}>
              {loading ? "loading…" : `${count} of ${total} done`}
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: "18px", fontWeight: 800, color: allDone ? C.green : C.gold }}>
            {count}/{total}
          </div>
        </div>

        {/* progress bar */}
        <div style={{ height: "7px", background: "#19150C", borderRadius: "4px", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: allDone ? `linear-gradient(90deg,${C.green},#34e0b0)` : `linear-gradient(90deg,${C.gold},${C.goldL})`, borderRadius: "4px", transition: "width 0.5s", boxShadow: "0 0 10px rgba(201,168,76,0.4)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {STARTER_TASKS.filter((t) => t.id !== "starter_share_referral").map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              done={!!state?.done[task.id]}
              busy={taskBusy === task.id}
              verifying={verifyBusy === task.id}
              onLink={() => doLinkTask(task)}
              onVerifyDiscord={verifyDiscord}
              onVerifyTelegram={verifyTelegram}
            />
          ))}
        </div>
      </div>

      {/* Referral — invite via X (counts as a task) */}
      {profile?.referralCode && (
        <ReferralCard
          referralCode={profile.referralCode}
          referralCount={profile.referralCount ?? 0}
          handle={profile.displayName}
          done={!!state?.done["starter_share_referral"]}
          points={STARTER_TASKS.find((t) => t.id === "starter_share_referral")?.points ?? 0}
          onShared={shareReferral}
        />
      )}

      {/* STEP 4 — Phase 2 unlock */}
      <div style={{
        background: allDone
          ? "linear-gradient(120deg, #12200F 0%, #0A0F08 60%, #0A0800 100%)"
          : "linear-gradient(120deg, #0D0A04 0%, #0A0800 100%)",
        border: `1px solid ${allDone ? "rgba(0,200,150,0.4)" : "rgba(201,168,76,0.18)"}`,
        borderRadius: "16px", padding: "20px 22px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
            background: allDone ? "rgba(0,200,150,0.12)" : "rgba(201,168,76,0.08)",
            border: `1px solid ${allDone ? "rgba(0,200,150,0.3)" : "rgba(201,168,76,0.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {allDone ? <Sparkles size={20} color={C.green} /> : <Lock size={18} color={C.muted} />}
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: "15px", color: C.text, letterSpacing: "0.04em" }}>
              {allDone ? "Initiation Unlocked" : "Phase 2 — Initiation"}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, marginTop: "3px", maxWidth: "420px" }}>
              {allDone
                ? "You've completed the basics. Explore missions, Meme Arena, Drop Hunts, the on-chain hub and the leaderboard."
                : `Finish all ${total} tasks above to unlock advanced missions, Meme Arena, Drop Hunts & more.`}
            </div>
          </div>
        </div>
        <button onClick={onUnlockPhase2}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: allDone ? "linear-gradient(135deg,#00C896,#34e0b0)" : "transparent",
            color: allDone ? "#000" : C.muted,
            border: allDone ? "none" : `1px solid ${C.border}`,
            borderRadius: "10px", padding: "10px 18px", fontWeight: 800, fontSize: "12px",
            fontFamily: FONT, letterSpacing: "0.06em", whiteSpace: "nowrap",
            cursor: "pointer",
          }}>
          {allDone ? "Enter Initiation" : "Explore anyway"} <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Referral — invite via X ──────────────────────────────────────────────────
function ReferralCard({ referralCode, referralCount, handle, done, points, onShared }: {
  referralCode: string; referralCount: number; handle?: string | null;
  done: boolean; points: number; onShared: () => void;
}) {
  const toast = useToast();
  const APP   = process.env.NEXT_PUBLIC_APP_URL || "https://otterprotocol.xyz";
  const link  = `${APP}/?ref=${referralCode}`;
  const text  = "Join me on @otter_protocol1 🦦 — claim your OTTER and build the Raft 👇";
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
  const xHandle = handle ? (handle.startsWith("@") ? handle : `@${handle}`) : null;
  const copy  = () => { navigator.clipboard.writeText(link); toast("Referral link copied", "success"); onShared(); };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: "15px", color: C.text, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "8px" }}>
            Invite friends on X
            {done
              ? <span style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 700, color: C.green, background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.25)", borderRadius: "20px", padding: "2px 8px" }}>✓ +{points} EARNED</span>
              : <span style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 700, color: C.gold, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "20px", padding: "2px 8px" }}>+{points} PTS</span>}
          </div>
          <div style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, marginTop: "3px" }}>
            {xHandle ? <>Sharing as <span style={{ color: C.gold }}>{xHandle}</span> · </> : null}
            {done ? "each friend who joins earns you more" : "share once to earn points · friends earn you more"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(201,168,76,0.06)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "4px 12px" }}>
          <Users size={13} color={C.gold} />
          <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: "13px", color: C.gold }}>{referralCount}</span>
          <span style={{ fontFamily: FONT, fontSize: "10px", color: C.mutedL, letterSpacing: "0.06em" }}>joined</span>
        </div>
      </div>

      {/* link + copy */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <div style={{ flex: 1, minWidth: 0, background: "#080600", border: `1px solid ${C.border}`, borderRadius: "9px", padding: "11px 12px", fontFamily: MONO, fontSize: "11px", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {link}
        </div>
        <button onClick={copy} className="btn-press"
          style={{ flexShrink: 0, background: "transparent", border: `1px solid rgba(201,168,76,0.3)`, color: C.gold, borderRadius: "9px", padding: "0 14px", fontWeight: 700, fontSize: "11px", fontFamily: FONT, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
          <Copy size={13} /> Copy
        </button>
      </div>

      {/* primary: share on X */}
      <a href={tweet} target="_blank" rel="noopener noreferrer" className="btn-press" onClick={onShared}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", background: "linear-gradient(135deg,#0A0A0A,#18181B)", border: `1px solid ${C.borderH}`, color: C.text, borderRadius: "11px", padding: "13px", textDecoration: "none", fontWeight: 800, fontSize: "14px", fontFamily: FONT, letterSpacing: "0.04em" }}>
        <span style={{ fontWeight: 900, fontSize: "16px" }}>𝕏</span> Share my invite on X
      </a>
    </div>
  );
}

// ── Welcome / Claim OTTER hero ───────────────────────────────────────────────
function WelcomeHero({ claimed, busy, onClaim, signedOut }: {
  claimed: boolean; busy: boolean; onClaim: () => void; signedOut?: boolean;
}) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #14100A 0%, #0B0805 60%, #0A0800 100%)",
      border: `1px solid ${claimed ? "rgba(0,200,150,0.3)" : "rgba(201,168,76,0.35)"}`,
      borderRadius: "18px", padding: "28px 26px", position: "relative", overflow: "hidden",
      boxShadow: claimed ? "none" : "0 0 36px rgba(201,168,76,0.1)",
    }}>
      <div style={{ position: "absolute", top: "-40px", right: "-30px", width: "220px", height: "220px", background: "radial-gradient(circle, rgba(201,168,76,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "18px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className={claimed ? "" : "coin-glow-anim"} style={{
            width: "56px", height: "56px", borderRadius: "50%", flexShrink: 0,
            background: "radial-gradient(circle at 35% 30%, #F4DC8A, #C9A84C 55%, #8B6000)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 18px rgba(201,168,76,0.45)",
          }}>
            <span style={{ fontFamily: MONO, fontSize: "22px", color: "#000", fontWeight: 900 }}>◈</span>
          </div>
          <div>
            <div style={{ fontFamily: MONO, color: claimed ? C.green : "rgba(201,168,76,0.6)", fontSize: "10px", letterSpacing: "0.16em", marginBottom: "4px" }}>
              {claimed ? "◈ BONUS CLAIMED" : "◈ STEP ONE"}
            </div>
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: "22px", color: C.text, lineHeight: 1.1 }}>
              {claimed ? "Welcome, Rafter" : "Claim your OTTER"}
            </div>
            <div style={{ fontFamily: FONT, color: C.muted, fontSize: "12px", marginTop: "4px" }}>
              {claimed ? "Your 1,000-point welcome bonus is in." : "Grab your 1,000-point welcome bonus to get started."}
            </div>
          </div>
        </div>

        {claimed ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.3)", color: C.green, borderRadius: "12px", padding: "12px 20px", fontFamily: FONT, fontWeight: 800, fontSize: "13px", letterSpacing: "0.06em" }}>
            <Check size={16} /> +1,000 claimed
          </div>
        ) : (
          <button onClick={onClaim} disabled={busy}
            className="dapp-cta dapp-cta-green"
            aria-label="Claim your 1,000 OTTER welcome bonus"
            style={{ border: "none", background: "transparent", cursor: busy ? "wait" : "pointer", fontFamily: FONT, opacity: busy ? 0.85 : 1 }}>
            <span className="dapp-cta-inner is-green" style={{ fontSize: "15px", fontWeight: 900, padding: "15px 28px", borderRadius: "11px" }}>
              <Gift size={17} /> {busy ? "Claiming…" : signedOut ? "Claim OTTER" : "Claim 1,000 OTTER"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Single task card ─────────────────────────────────────────────────────────
function TaskCard({ task, done, busy, verifying, onLink, onVerifyDiscord, onVerifyTelegram }: {
  task: StarterTask;
  done: boolean;
  busy: boolean;
  verifying: boolean;
  onLink: () => void;
  onVerifyDiscord: () => void;
  onVerifyTelegram: () => void;
}) {
  const isVerify = task.action !== "link";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "14px",
      background: done ? "rgba(0,200,150,0.04)" : C.card2,
      border: `1px solid ${done ? "rgba(0,200,150,0.22)" : C.border}`,
      borderRadius: "12px", padding: "14px 16px",
    }}>
      {/* icon / check */}
      <div style={{
        width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0,
        background: done ? "rgba(0,200,150,0.1)" : "rgba(201,168,76,0.06)",
        border: `1px solid ${done ? "rgba(0,200,150,0.3)" : C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: MONO, fontSize: "16px", color: done ? C.green : C.gold,
      }}>
        {done ? <Check size={18} color={C.green} /> : task.icon}
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "13px", color: done ? C.muted : C.text, letterSpacing: "0.03em" }}>
          {task.label}
        </div>
        <div style={{ fontFamily: FONT, fontSize: "11px", color: C.mutedL, marginTop: "2px", lineHeight: 1.4 }}>
          {task.desc}
        </div>
      </div>

      {/* reward */}
      <div style={{ textAlign: "right", flexShrink: 0, marginRight: "2px" }}>
        <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: "13px", color: done ? C.mutedL : C.gold }}>+{task.points}</div>
        <div style={{ fontFamily: FONT, fontSize: "8px", color: C.mutedL, letterSpacing: "0.1em" }}>{isVerify ? "SIGNAL" : "POINTS"}</div>
      </div>

      {/* action */}
      {done ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: C.green, fontFamily: FONT, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", flexShrink: 0 }}>
          DONE
        </span>
      ) : isVerify ? (
        <button onClick={task.action === "verify_discord" ? onVerifyDiscord : onVerifyTelegram} disabled={verifying} className="btn-press"
          style={{
            display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0,
            background: verifying ? C.border : (task.action === "verify_discord" ? "linear-gradient(135deg,#5865F2,#7289DA)" : "linear-gradient(135deg,#0088cc,#29b6f6)"),
            color: verifying ? C.mutedL : "#fff", border: "none", borderRadius: "9px",
            padding: "9px 14px", fontWeight: 700, fontSize: "11px", fontFamily: FONT,
            letterSpacing: "0.04em", cursor: verifying ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>
          <ShieldCheck size={12} /> {verifying ? "…" : "Verify"}
        </button>
      ) : (
        <button onClick={onLink} disabled={busy} className="btn-press"
          style={{
            display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0,
            background: busy ? C.border : "transparent",
            color: busy ? C.mutedL : C.gold, border: `1px solid ${busy ? C.border : "rgba(201,168,76,0.3)"}`,
            borderRadius: "9px", padding: "9px 14px", fontWeight: 700, fontSize: "11px", fontFamily: FONT,
            letterSpacing: "0.04em", cursor: busy ? "wait" : "pointer", whiteSpace: "nowrap",
          }}>
          {busy ? "Verifying…" : <>Go <ExternalLink size={11} /></>}
        </button>
      )}
    </div>
  );
}
