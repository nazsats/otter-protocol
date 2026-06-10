"use client";
import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  INITIATION_TASKS, INITIATION_ABI, INITIATION_CONTRACT,
  CATEGORY_META, DIFFICULTY_META, TIERS, getTierFromWeight, getNextTier,
  getUserInitiation, recordTaskOffchain, submitManualTask, calcInitiationProgress,
  nodePresenceReward, getTaskOverrides, applyTaskOverrides,
  type InitiationTask, type TaskCategory, type TierName, type CompletedTask,
} from "@/lib/initiation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useWallet } from "@/hooks/useWallet";
import { authFetch } from "@/lib/api";
import { ExternalLink, Lock, Check, ChevronRight, Zap, Activity, Eye, EyeOff, ShieldCheck, X } from "lucide-react";

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  black:  "#000000", deep:  "#050400", card:  "#0D0B07", card2: "#0A0800",
  border: "#1E1A10", borderG: "rgba(201,168,76,0.2)",
  gold:   "#C9A84C", goldL: "#E2BF6E",
  text:   "#E8DFC8", muted: "#8C7A5C", mutedL: "#5C4A2A",
  green:  "#00C896", red:  "#FF5B5B", amber: "#F5A623",
  purple: "#A78BFA", blue: "#60A5FA",
};
const MONO = "var(--font-geist-mono, monospace)";
const FONT = "var(--font-cinzel, Georgia, serif)";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface OnChainState {
  signalWeight: number;
  tier:         TierName;
  nodeStreak:   number;
  nodeCooldown: number; // seconds remaining
  tasksOnChain: number;
}

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────
function TerminalLine({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: "10px", color, letterSpacing: "0.06em", lineHeight: 1.8 }}>
      {children}
    </div>
  );
}

function SectionHeader({ glyph, label, color, count, total }: {
  glyph: string; label: string; color: string; count: number; total: number;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "14px",
      padding: "16px 20px", marginBottom: "2px",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{ fontFamily: MONO, color, fontSize: "20px", opacity: 0.7 }}>{glyph}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT, color: C.text, fontWeight: 700, fontSize: "12px", letterSpacing: "0.16em" }}>
          {label}
        </div>
      </div>
      <div style={{
        fontFamily: MONO, fontSize: "9px", color: C.mutedL,
        background: color + "10", border: `1px solid ${color}25`,
        padding: "3px 10px", borderRadius: "3px", letterSpacing: "0.1em",
      }}>
        {count}/{total} INSCRIBED
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: TierName }) {
  const t = TIERS[tier];
  return (
    <span style={{
      fontFamily: FONT, fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em",
      color: t.color, background: t.bg, border: `1px solid ${t.color}30`,
      padding: "3px 10px", borderRadius: "3px",
    }}>
      {t.glyph} {tier}
    </span>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────
function TaskCard({
  task, completed, onChainDone, signal, onClaim, busy, isHidden, tierName,
  onVerifyDiscord, onVerifyTelegram, verifyBusy,
}: {
  task:              InitiationTask;
  completed:         boolean;
  onChainDone:       boolean;
  signal:            number;
  onClaim:           (task: InitiationTask) => void;
  busy:              string | null;
  isHidden:          boolean;
  tierName:          TierName;
  onVerifyDiscord?:  () => void;
  onVerifyTelegram?: () => void;
  verifyBusy?:       string | null;
}) {
  const [showProof, setShowProof] = useState(false);
  const [proof, setProof] = useState("");
  const [note, setNote] = useState("");
  const { user } = useAuth();
  const toast = useToast();

  const diff  = DIFFICULTY_META[task.difficulty];
  const isBusy = busy === task.id;
  const locked = isHidden;

  const handleManualSubmit = async () => {
    if (!user) { toast("Sign in to submit", "error"); return; }
    if (!proof.trim()) { toast("Paste a proof URL", "error"); return; }
    await submitManualTask(user.uid, task.id, proof, note);
    toast("Submission sent — awaiting guardian approval", "info");
    setShowProof(false);
    setProof(""); setNote("");
  };

  if (locked) {
    return (
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: "6px", padding: "16px 18px",
        opacity: 0.5, marginBottom: "6px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Lock size={12} color={C.mutedL} />
          <span style={{ fontFamily: FONT, color: C.mutedL, fontSize: "11px", letterSpacing: "0.1em" }}>
            {task.unlockCondition || "LOCKED — Advance to unlock"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: completed ? "rgba(0,200,150,0.03)" : C.card,
      border: `1px solid ${completed ? "rgba(0,200,150,0.2)" : C.border}`,
      borderLeft: `3px solid ${completed ? C.green : onChainDone ? C.gold : C.border}`,
      borderRadius: "6px", padding: "16px 18px",
      marginBottom: "6px",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        {/* Badge */}
        <div style={{
          width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
          background: completed ? "rgba(0,200,150,0.1)" : "rgba(201,168,76,0.06)",
          border: `1px solid ${completed ? "rgba(0,200,150,0.3)" : C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontSize: "12px",
          color: completed ? C.green : C.gold,
        }}>
          {completed ? <Check size={14} color={C.green} /> : task.badge}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: FONT, color: completed ? C.muted : C.text, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em" }}>
              {task.title}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: "8px", color: diff.color,
              background: diff.color + "12", border: `1px solid ${diff.color}25`,
              padding: "1px 6px", borderRadius: "2px", letterSpacing: "0.1em",
            }}>{diff.label}</span>
            {task.requiresApproval && (
              <span style={{
                fontFamily: MONO, fontSize: "8px", color: C.amber,
                background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)",
                padding: "1px 6px", borderRadius: "2px", letterSpacing: "0.1em",
              }}>MANUAL</span>
            )}
            {onChainDone && !completed && (
              <span style={{
                fontFamily: MONO, fontSize: "8px", color: C.gold,
                background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)",
                padding: "1px 6px", borderRadius: "2px",
              }}>ON-CHAIN ✓</span>
            )}
          </div>
          <p style={{ fontFamily: FONT, color: C.muted, fontSize: "11px", lineHeight: 1.7, margin: "0 0 10px" }}>
            {task.desc}
          </p>

          {/* Actions */}
          {!completed && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>

              {/* ── Discord verification ── */}
              {task.action === "verify_discord" && (
                <>
                  <a href={task.link} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      fontFamily: MONO, fontSize: "9px", color: C.blue,
                      background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)",
                      padding: "5px 12px", borderRadius: "4px", textDecoration: "none", letterSpacing: "0.08em",
                    }}>
                    JOIN SERVER <ExternalLink size={9} />
                  </a>
                  <button
                    onClick={onVerifyDiscord}
                    disabled={verifyBusy === task.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                      color: verifyBusy === task.id ? C.mutedL : "#000",
                      background: verifyBusy === task.id ? C.border : "linear-gradient(135deg,#5865F2,#7289DA)",
                      border: "none", padding: "6px 14px", borderRadius: "4px",
                      cursor: verifyBusy === task.id ? "not-allowed" : "pointer",
                      letterSpacing: "0.1em", transition: "all 0.15s",
                    }}>
                    <ShieldCheck size={9} />
                    {verifyBusy === task.id ? "VERIFYING…" : "VERIFY DISCORD"}
                  </button>
                </>
              )}

              {/* ── Telegram verification ── */}
              {task.action === "verify_telegram" && (
                <>
                  <a href={task.link} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      fontFamily: MONO, fontSize: "9px", color: C.blue,
                      background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)",
                      padding: "5px 12px", borderRadius: "4px", textDecoration: "none", letterSpacing: "0.08em",
                    }}>
                    JOIN CHANNEL <ExternalLink size={9} />
                  </a>
                  <button
                    onClick={onVerifyTelegram}
                    disabled={verifyBusy === task.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                      color: verifyBusy === task.id ? C.mutedL : "#fff",
                      background: verifyBusy === task.id ? C.border : "linear-gradient(135deg,#0088cc,#29b6f6)",
                      border: "none", padding: "6px 14px", borderRadius: "4px",
                      cursor: verifyBusy === task.id ? "not-allowed" : "pointer",
                      letterSpacing: "0.1em", transition: "all 0.15s",
                    }}>
                    <ShieldCheck size={9} />
                    {verifyBusy === task.id ? "VERIFYING…" : "VERIFY TELEGRAM"}
                  </button>
                </>
              )}

              {/* Link tasks (non-verify) */}
              {task.link && task.action !== "verify_discord" && task.action !== "verify_telegram" && (
                <a href={task.link} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    fontFamily: MONO, fontSize: "9px", color: C.blue,
                    background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)",
                    padding: "5px 12px", borderRadius: "4px", textDecoration: "none", letterSpacing: "0.08em",
                  }}>
                  OPEN SOURCE <ExternalLink size={9} />
                </a>
              )}

              {/* Claim button — not for verify actions */}
              {!task.requiresApproval && task.action !== "verify_discord" && task.action !== "verify_telegram" && (
                <button
                  onClick={() => onClaim(task)}
                  disabled={!!isBusy}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                    color: isBusy ? C.mutedL : "#000",
                    background: isBusy ? C.border : `linear-gradient(135deg,${C.gold},${C.goldL})`,
                    border: "none", padding: "6px 14px", borderRadius: "4px",
                    cursor: isBusy ? "not-allowed" : "pointer",
                    letterSpacing: "0.1em", transition: "all 0.15s",
                  }}>
                  {isBusy ? "BROADCASTING…" : "CLAIM SIGNAL"} <Zap size={9} />
                </button>
              )}

              {/* Manual submit */}
              {task.requiresApproval && (
                <>
                  <button
                    onClick={() => setShowProof((v) => !v)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                      color: C.amber,
                      background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.25)",
                      padding: "6px 14px", borderRadius: "4px",
                      cursor: "pointer", letterSpacing: "0.1em",
                    }}>
                    {showProof ? <EyeOff size={9} /> : <Eye size={9} />}
                    {showProof ? "CANCEL" : "SUBMIT PROOF"}
                  </button>

                  {showProof && (
                    <div style={{
                      width: "100%", marginTop: "10px",
                      background: C.deep, border: `1px solid ${C.border}`,
                      borderRadius: "6px", padding: "14px",
                    }}>
                      <TerminalLine color={C.gold}>&gt; ATTACH PROOF OF WORK</TerminalLine>
                      <input
                        value={proof}
                        onChange={(e) => setProof(e.target.value)}
                        placeholder="Proof URL (tweet, article, screenshot link...)"
                        style={{
                          width: "100%", background: "transparent", border: `1px solid ${C.border}`,
                          borderRadius: "4px", padding: "8px 12px", marginTop: "8px",
                          fontFamily: MONO, fontSize: "11px", color: C.text, outline: "none",
                        }}
                      />
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Brief description of your contribution..."
                        rows={2}
                        style={{
                          width: "100%", background: "transparent", border: `1px solid ${C.border}`,
                          borderRadius: "4px", padding: "8px 12px", marginTop: "6px", resize: "vertical",
                          fontFamily: MONO, fontSize: "11px", color: C.text, outline: "none",
                        }}
                      />
                      <button
                        onClick={handleManualSubmit}
                        style={{
                          marginTop: "8px", fontFamily: MONO, fontSize: "9px", fontWeight: 700,
                          color: "#000", background: `linear-gradient(135deg,${C.gold},${C.goldL})`,
                          border: "none", padding: "7px 18px", borderRadius: "4px",
                          cursor: "pointer", letterSpacing: "0.1em",
                        }}>
                        TRANSMIT TO GUARDIAN →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Signal reward */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: MONO, color: completed ? C.green : C.gold, fontWeight: 700, fontSize: "13px" }}>
            +{task.signal.toLocaleString()}
          </div>
          <div style={{ fontFamily: MONO, color: C.mutedL, fontSize: "8px", letterSpacing: "0.12em" }}>
            SIGNAL
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function InitiationTerminal({ onTaskComplete, contractAddress }: { onTaskComplete?: () => void; contractAddress?: string | null }) {
  const { user, profile } = useAuth();
  // Use prop address first (from Firestore), fall back to env var
  const LIVE_CONTRACT = contractAddress ?? INITIATION_CONTRACT;
  const toast  = useToast();
  const wallet = useWallet();

  const [activeCategory, setActiveCategory] = useState<TaskCategory | "ALL" | "NODE">("ALL");
  const [completed,      setCompleted]       = useState<Record<string, CompletedTask>>({});
  const [onChain,        setOnChain]         = useState<OnChainState | null>(null);
  const [busy,           setBusy]            = useState<string | null>(null);
  const [log,            setLog]             = useState<string[]>([
    "> INITIATION TERMINAL v0.1",
    "> OTTER PROTOCOL // SEPOLIA TESTNET",
    "> AWAITING SIGNAL SOURCE…",
  ]);
  const [nodeLoading,    setNodeLoading]     = useState(false);
  const [showHidden,     setShowHidden]      = useState(false);
  const [tasks,          setTasks]           = useState(INITIATION_TASKS);
  const [verifyBusy,     setVerifyBusy]      = useState<string | null>(null);
  const [showTgModal,    setShowTgModal]     = useState(false);
  const [tgBotUsername,  setTgBotUsername]   = useState<string | null>(null);
  const [tgVerifyState,  setTgVerifyState]   = useState<"idle"|"success"|"error"|"not_member">("idle");
  const [tgErrorMsg,     setTgErrorMsg]      = useState("");

  useEffect(() => {
    getTaskOverrides()
      .then((ov) => setTasks(applyTaskOverrides(INITIATION_TASKS, ov)))
      .catch(() => {});
  }, []);

  const addLog = (line: string) => setLog((l) => [...l.slice(-8), line]);

  // ── Load off-chain completions ─────────────────────────────────────────────
  const loadCompleted = useCallback(async () => {
    if (!user) return;
    const data = await getUserInitiation(user.uid);
    setCompleted(data);
  }, [user]);

  useEffect(() => { loadCompleted(); }, [loadCompleted]);

  // ── Load on-chain state ────────────────────────────────────────────────────
  const loadOnChain = useCallback(async () => {
    if (!wallet.address || !wallet.isCorrectNetwork || !LIVE_CONTRACT) return;
    try {
      const provider = wallet.getProvider();
      if (!provider) return;
      const contract = new ethers.Contract(LIVE_CONTRACT!, INITIATION_ABI, provider);
      const [weight, tier, streak, cooldown, rec] = await Promise.all([
        contract.getSignalWeight(wallet.address),
        contract.getTier(wallet.address),
        contract.getNodeStreak(wallet.address),
        contract.getNodePresenceCooldownRemaining(wallet.address),
        contract.holders(wallet.address),
      ]);
      const w = Number(weight);
      setOnChain({
        signalWeight: w,
        tier:         getTierFromWeight(w),
        nodeStreak:   Number(streak),
        nodeCooldown: Number(cooldown),
        tasksOnChain: Number(rec.tasksCompleted),
      });
      addLog(`> ON-CHAIN SIGNAL WEIGHT: ${w.toLocaleString()}`);
    } catch {
      addLog("> CONTRACT NOT DEPLOYED — USING OFF-CHAIN MODE");
    }
  }, [wallet.address, wallet.isCorrectNetwork, wallet.getProvider]);

  useEffect(() => { loadOnChain(); }, [loadOnChain]);

  // ── Claim task ────────────────────────────────────────────────────────────
  const handleClaim = useCallback(async (task: InitiationTask) => {
    if (!user) { toast("Sign in to claim", "error"); return; }
    if (completed[task.id]) { toast("Already inscribed", "info"); return; }

    setBusy(task.id);
    addLog(`> INITIATING: ${task.id.toUpperCase()}`);

    // ── Try on-chain ────────────────────────────────────────────────────────
    if (wallet.isConnected && wallet.isCorrectNetwork && LIVE_CONTRACT) {
      try {
        const signer = await wallet.getSigner();
        if (!signer) throw new Error("No signer");
        const contract = new ethers.Contract(LIVE_CONTRACT!, INITIATION_ABI, signer);
        const tx = await contract.claimTask(task.contractId);
        addLog(`> TX BROADCAST: ${tx.hash.slice(0, 16)}…`);
        toast("Transaction broadcast — waiting…", "info");
        await tx.wait();
        addLog(`> SIGNAL CONFIRMED ON-CHAIN ✓`);
        addLog(`> +${task.signal} SIGNAL INSCRIBED`);
        await recordTaskOffchain(user.uid, task.id, task.signal, tx.hash);
        toast(`+${task.signal} SIGNAL — ${task.title}`, "success");
        await loadCompleted();
        await loadOnChain();
        onTaskComplete?.();
        setBusy(null);
        return;
      } catch (e: unknown) {
        const raw = e instanceof Error ? e.message : String(e);
        // User cancelled — stop here
        if (raw.toLowerCase().includes("rejected") || raw.toLowerCase().includes("denied") || raw.toLowerCase().includes("cancelled")) {
          addLog(`> TX CANCELLED BY USER`);
          toast("Transaction cancelled", "info");
          setBusy(null);
          return;
        }
        // Contract not deployed / call reverted — fall through to off-chain
        const readable = raw.includes("CALL_EXCEPTION") || raw.includes("UNPREDICTABLE_GAS") || raw.includes("BAD_DATA") || raw.includes("could not decode")
          ? "Contract not deployed at this address — recording off-chain"
          : raw.slice(0, 80);
        addLog(`> ON-CHAIN FAILED: ${readable}`);
        addLog(`> FALLING BACK TO OFF-CHAIN MODE`);
        toast("On-chain failed — recording off-chain instead", "info");
      }
    }

    // ── Off-chain fallback ──────────────────────────────────────────────────
    try {
      addLog(`> OFF-CHAIN MODE — RECORDING`);
      await recordTaskOffchain(user.uid, task.id, task.signal);
      addLog(`> SIGNAL RECORDED: +${task.signal}`);
      toast(`+${task.signal} SIGNAL — ${task.title}`, "success");
      await loadCompleted();
      onTaskComplete?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      addLog(`> FAILED: ${msg.slice(0, 50)}`);
      toast("Failed to record signal — please try again", "error");
    }
    setBusy(null);
  }, [user, completed, wallet, LIVE_CONTRACT, loadCompleted, loadOnChain, toast]);

  // ── Node presence ─────────────────────────────────────────────────────────
  const handleNodePresence = async () => {
    if (!user) { toast("Sign in first", "error"); return; }
    if (onChain && onChain.nodeCooldown > 0) {
      const hrs = Math.ceil(onChain.nodeCooldown / 3600);
      toast(`Node presence cooldown: ${hrs}h remaining`, "info");
      return;
    }
    setNodeLoading(true);
    addLog("> RECORDING NODE PRESENCE…");
    try {
      if (wallet.isConnected && wallet.isCorrectNetwork && LIVE_CONTRACT) {
        const signer   = await wallet.getSigner();
        if (!signer) throw new Error("No signer");
        const contract = new ethers.Contract(LIVE_CONTRACT!, INITIATION_ABI, signer);
        const tx = await contract.recordNodePresence();
        addLog(`> TX BROADCAST: ${tx.hash.slice(0, 16)}…`);
        await tx.wait();
        addLog(`> NODE PRESENCE ARCHIVED ON-CHAIN ✓`);
        toast("Node presence recorded on Sepolia", "success");
        await loadOnChain();
      } else {
        addLog(`> NODE PRESENCE ARCHIVED (OFF-CHAIN)`);
        toast("Node presence recorded", "success");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      addLog(`> ${msg.includes("TooEarly") ? "COOLDOWN ACTIVE — TRY AGAIN IN 24H" : "TX FAILED"}`);
      toast(msg.includes("TooEarly") ? "Already checked in today" : "Failed to record", "error");
    }
    setNodeLoading(false);
  };

  // ── Discord verification ──────────────────────────────────────────────────
  const handleVerifyDiscord = useCallback(async () => {
    if (!user) { toast("Sign in first", "error"); return; }
    setVerifyBusy("join_discord");
    addLog("> STARTING DISCORD OAUTH…");
    try {
      // Server verifies our ID token and returns the OAuth URL (uid is taken
      // from the token, not the query string — can't be spoofed).
      const res  = await authFetch("/api/verify/discord");
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start Discord verification");
      window.location.href = data.url;
    } catch (e: unknown) {
      setVerifyBusy(null);
      toast(e instanceof Error ? e.message : "Discord verification failed", "error");
      addLog("> DISCORD OAUTH FAILED");
    }
  }, [user, toast]);

  // ── Telegram verification ─────────────────────────────────────────────────
  const handleVerifyTelegram = useCallback(async () => {
    if (!user) { toast("Sign in first", "error"); return; }
    setTgVerifyState("idle");
    setTgErrorMsg("");
    // Fetch bot username if not cached
    if (!tgBotUsername) {
      try {
        const res  = await fetch("/api/verify/telegram/botinfo");
        const data = await res.json();
        if (data.username) setTgBotUsername(data.username);
      } catch { /* modal still opens, widget just won't load without username */ }
    }
    setShowTgModal(true);
  }, [user, tgBotUsername, toast]);

  // Called by the Telegram Login Widget via window.__tgOnAuth
  const handleTelegramAuth = useCallback(async (tgData: Record<string, unknown>) => {
    if (!user) return;
    setVerifyBusy("join_telegram");
    setTgVerifyState("idle");
    addLog("> VERIFYING TELEGRAM MEMBERSHIP…");
    try {
      const res  = await authFetch("/api/verify/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, ...tgData }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addLog(`> TELEGRAM VERIFIED — +${data.signal} SIGNAL ✓`);
        toast(`+${data.signal} SIGNAL — Telegram verified`, "success");
        setTgVerifyState("success");
        await loadCompleted();
        onTaskComplete?.();
        setTimeout(() => setShowTgModal(false), 1500);
      } else if (res.status === 403 && data.status) {
        setTgVerifyState("not_member");
        setTgErrorMsg("You haven't joined the channel yet. Join first, then come back.");
        addLog(`> NOT A MEMBER — JOIN THE CHANNEL FIRST`);
      } else {
        setTgVerifyState("error");
        setTgErrorMsg(data.error || "Verification failed");
        addLog(`> TELEGRAM VERIFY FAILED: ${data.error || "unknown"}`);
      }
    } catch {
      setTgVerifyState("error");
      setTgErrorMsg("Network error — please try again");
    }
    setVerifyBusy(null);
  }, [user, loadCompleted, onTaskComplete, toast]);

  // Handle ?verified=discord in URL after OAuth redirect
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "discord") {
      addLog("> DISCORD VERIFIED ✓");
      toast("Discord membership verified — +100 SIGNAL", "success");
      loadCompleted().then(() => onTaskComplete?.());
      // Clean up URL
      const clean = new URL(window.location.href);
      clean.searchParams.delete("verified");
      window.history.replaceState({}, "", clean.toString());
    }
    if (params.get("verify_error")) {
      const errMsg = params.get("verify_error") || "Verification failed";
      const readable = errMsg === "not_member"
        ? "You are not in the Discord server — join first"
        : errMsg;
      toast(readable, "error");
      const clean = new URL(window.location.href);
      clean.searchParams.delete("verify_error");
      window.history.replaceState({}, "", clean.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  // progress.signal is always fresh (recalculates from completed after every loadCompleted())
  // Use it as the source of truth when on-chain isn't available
  const progress    = calcInitiationProgress(completed);
  const signal      = onChain?.signalWeight ?? progress.signal;
  const tierName    = getTierFromWeight(signal);
  const tierMeta    = TIERS[tierName];
  const nextTier    = getNextTier(tierName);
  const pctToNext   = nextTier ? Math.min(100, Math.round((signal / nextTier.threshold) * 100)) : 100;
  const nodeStreak  = onChain?.nodeStreak ?? 0;
  const nodeReward  = nodePresenceReward(nodeStreak + 1);
  const canCheckIn  = !onChain || onChain.nodeCooldown === 0;

  const categories: (TaskCategory | "ALL" | "NODE")[] = [
    "ALL", "SIGNAL_ACQUISITION", "KNOWLEDGE_ARCHIVE", "CONTRIBUTION",
    "CIPHER_HUNT", "SIGNAL_RELAY", "GOVERNANCE", "NODE",
  ];

  const visibleTasks = tasks.filter((t) => {
    if (activeCategory === "NODE") return false;
    if (activeCategory !== "ALL" && t.category !== activeCategory) return false;
    if (t.hidden && !showHidden) {
      // Show if archivist+
      const tiers: TierName[] = ["SEEKER", "HOLDER", "MEMBER", "ARCHIVIST", "OG"];
      return tiers.indexOf(tierName) >= tiers.indexOf("ARCHIVIST");
    }
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative" }}>
    {/* ── Telegram verify modal ── */}
    {showTgModal && (
      <TelegramVerifyModal
        botUsername={tgBotUsername}
        verifyState={tgVerifyState}
        errorMsg={tgErrorMsg}
        onAuth={handleTelegramAuth}
        onClose={() => { setShowTgModal(false); setTgVerifyState("idle"); }}
      />
    )}

    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", alignItems: "start" }}
      className="initiation-grid">

      <style>{`
        @keyframes signal-pulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes tier-glow { 0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0.15)} 50%{box-shadow:0 0 20px 4px rgba(201,168,76,0.08)} }
        @keyframes scan-line { 0%{transform:translateY(-100%)} 100%{transform:translateY(200%)} }
        .task-card-hover:hover { border-color: rgba(201,168,76,0.25) !important; }
        .cat-btn:hover { background: rgba(201,168,76,0.06) !important; color: #C9A84C !important; }
        .claim-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        @media(max-width:900px){ .initiation-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* ── LEFT: MAIN PANEL ── */}
      <div>

        {/* Terminal log */}
        <div style={{
          background: "#020100", border: `1px solid ${C.border}`,
          borderRadius: "6px", padding: "12px 16px", marginBottom: "16px",
          minHeight: "80px", position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "1px",
            background: `linear-gradient(90deg,transparent,rgba(0,200,150,0.2),transparent)`,
          }} />
          {log.map((line, i) => (
            <TerminalLine key={i} color={
              line.includes("✓") || line.includes("CONFIRMED") ? C.green :
              line.includes("FAILED") || line.includes("ERROR")  ? C.red :
              line.includes("BROADCAST") || line.includes("TX")  ? C.amber :
              i === log.length - 1 ? C.text : C.muted
            }>{line}</TerminalLine>
          ))}
          <span style={{ color: C.gold, fontFamily: MONO, fontSize: "10px", animation: "signal-pulse 1s step-end infinite" }}>█</span>
        </div>

        {/* Category filter tabs */}
        <div style={{
          display: "flex", gap: "3px", flexWrap: "nowrap", overflow: "auto",
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: "6px", padding: "4px", marginBottom: "16px",
          scrollbarWidth: "none",
        }}>
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            const meta = cat === "ALL" ? null : cat === "NODE" ? null : CATEGORY_META[cat as TaskCategory];
            const color = meta?.color ?? C.gold;
            const label = cat === "ALL" ? "ALL" : cat === "NODE" ? "◈ NODE" : meta?.glyph + " " + cat.replace(/_/g, " ").slice(0, 8);
            return (
              <button key={cat} className="cat-btn"
                onClick={() => setActiveCategory(cat as TaskCategory | "ALL" | "NODE")}
                style={{
                  fontFamily: MONO, fontSize: "8px", fontWeight: 700,
                  padding: "6px 10px", borderRadius: "4px", border: "none",
                  cursor: "pointer", letterSpacing: "0.1em", whiteSpace: "nowrap",
                  background: isActive ? color + "15" : "transparent",
                  color: isActive ? color : C.mutedL,
                  borderBottom: isActive ? `2px solid ${color}` : "2px solid transparent",
                  transition: "all 0.15s",
                }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* NODE PRESENCE tab */}
        {activeCategory === "NODE" && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: "8px", overflow: "hidden", marginBottom: "12px",
          }}>
            <SectionHeader glyph="ז" label="NODE PRESENCE" color={C.red} count={nodeStreak} total={90} />
            <div style={{ padding: "24px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "20px" }}>
                {[
                  { label: "CURRENT STREAK", value: `${nodeStreak} DAYS`, color: nodeStreak >= 7 ? C.green : C.muted },
                  { label: "NEXT REWARD",    value: `+${nodeReward} SIGNAL`, color: C.gold },
                  { label: "COOLDOWN",       value: canCheckIn ? "READY" : `${Math.ceil((onChain?.nodeCooldown ?? 0) / 3600)}H LEFT`, color: canCheckIn ? C.green : C.amber },
                ].map((s) => (
                  <div key={s.label} style={{
                    background: C.card2, border: `1px solid ${C.border}`,
                    borderRadius: "6px", padding: "12px 14px",
                  }}>
                    <div style={{ fontFamily: MONO, color: C.mutedL, fontSize: "8px", letterSpacing: "0.14em", marginBottom: "6px" }}>{s.label}</div>
                    <div style={{ fontFamily: MONO, color: s.color, fontWeight: 700, fontSize: "14px" }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "20px", fontFamily: FONT, color: C.muted, fontSize: "12px", lineHeight: 1.8 }}>
                {">"} Check in daily. Your node presence is recorded on-chain.<br />
                {">"} Streak Day 7: +50 SIGNAL · Day 30: +100 SIGNAL · Day 90: +500 SIGNAL + OG badge<br />
                {">"} Missing a day resets your streak. The protocol does not forget.
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={handleNodePresence}
                  disabled={nodeLoading || !canCheckIn}
                  style={{
                    fontFamily: MONO, fontSize: "10px", fontWeight: 700,
                    color: (!canCheckIn || nodeLoading) ? C.mutedL : "#000",
                    background: (!canCheckIn || nodeLoading)
                      ? C.border
                      : `linear-gradient(135deg,${C.gold},${C.goldL})`,
                    border: "none", padding: "12px 24px", borderRadius: "6px",
                    cursor: (!canCheckIn || nodeLoading) ? "not-allowed" : "pointer",
                    letterSpacing: "0.12em", display: "flex", alignItems: "center", gap: "8px",
                  }}>
                  <Activity size={12} />
                  {nodeLoading ? "BROADCASTING…" : canCheckIn ? "RECORD NODE PRESENCE" : "COOLDOWN ACTIVE"}
                </button>
                {wallet.isConnected && LIVE_CONTRACT && (
                  <span style={{ fontFamily: MONO, fontSize: "8px", color: C.green }}>
                    ● ON-CHAIN TX WILL EXECUTE ON SEPOLIA
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Task sections */}
        {activeCategory !== "NODE" && (
          Object.entries(CATEGORY_META).map(([cat, meta]) => {
            if (activeCategory !== "ALL" && activeCategory !== cat) return null;
            const catTasks = visibleTasks.filter((t) => t.category === cat);
            if (catTasks.length === 0) return null;
            const catDone = catTasks.filter((t) => completed[t.id]).length;

            return (
              <div key={cat} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: "8px", overflow: "hidden", marginBottom: "12px",
              }}>
                <SectionHeader
                  glyph={meta.glyph} label={meta.label} color={meta.color}
                  count={catDone} total={catTasks.length}
                />
                <div style={{ padding: "12px" }}>
                  {catTasks.map((task) => {
                    const isHidden = !!(task.hidden && !showHidden && ["SEEKER", "HOLDER", "MEMBER"].includes(tierName));
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        completed={!!completed[task.id]}
                        onChainDone={false}
                        signal={task.signal}
                        onClaim={handleClaim}
                        busy={busy}
                        isHidden={isHidden}
                        tierName={tierName}
                        onVerifyDiscord={task.action === "verify_discord" ? handleVerifyDiscord : undefined}
                        onVerifyTelegram={task.action === "verify_telegram" ? handleVerifyTelegram : undefined}
                        verifyBusy={verifyBusy}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Show hidden toggle */}
        {tierName === "ARCHIVIST" || tierName === "OG" ? (
          <button
            onClick={() => setShowHidden((v) => !v)}
            style={{
              fontFamily: MONO, fontSize: "9px", color: C.mutedL,
              background: "transparent", border: `1px solid ${C.border}`,
              padding: "8px 16px", borderRadius: "4px", cursor: "pointer",
              letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "6px",
              marginTop: "8px",
            }}>
            {showHidden ? <EyeOff size={10} /> : <Eye size={10} />}
            {showHidden ? "CONCEAL HIDDEN TASKS" : "REVEAL HIDDEN ARCHIVE"}
          </button>
        ) : null}

      </div>

      {/* ── RIGHT: SIDEBAR ── */}
      <aside>

        {/* Holder status */}
        <div style={{
          background: C.card, border: `1px solid ${tierMeta.color}30`,
          borderRadius: "8px", overflow: "hidden", marginBottom: "12px",
          animation: "tier-glow 4s ease-in-out infinite",
        }}>
          <div style={{
            padding: "3px 0", textAlign: "center",
            background: `linear-gradient(90deg,transparent,${tierMeta.color}20,transparent)`,
            borderBottom: `1px solid ${tierMeta.color}20`,
            fontFamily: MONO, fontSize: "8px", color: tierMeta.color, letterSpacing: "0.18em",
          }}>
            ◈ INITIATION STATUS
          </div>
          <div style={{ padding: "20px" }}>
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <div style={{
                fontFamily: MONO, fontSize: "9px", color: C.mutedL, letterSpacing: "0.16em", marginBottom: "6px"
              }}>SIGNAL WEIGHT</div>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: "28px", color: tierMeta.color }}>
                {signal.toLocaleString()}
              </div>
              <div style={{ marginTop: "8px" }}><TierBadge tier={tierName} /></div>
              <div style={{ fontFamily: FONT, color: C.muted, fontSize: "10px", marginTop: "8px", lineHeight: 1.6 }}>
                {tierMeta.desc}
              </div>
            </div>

            {/* Progress to next tier */}
            {nextTier && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontFamily: MONO, fontSize: "8px", color: C.mutedL, marginBottom: "6px",
                }}>
                  <span>{tierName}</span>
                  <span>{nextTier.name} @ {nextTier.threshold.toLocaleString()}</span>
                </div>
                <div style={{ background: C.deep, borderRadius: "3px", height: "4px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "3px", transition: "width 0.5s",
                    width: `${pctToNext}%`,
                    background: `linear-gradient(90deg,${tierMeta.color},${C.goldL})`,
                  }} />
                </div>
                <div style={{ fontFamily: MONO, fontSize: "8px", color: C.mutedL, marginTop: "4px", textAlign: "right" }}>
                  {nextTier.threshold - signal > 0 ? `${(nextTier.threshold - signal).toLocaleString()} SIGNAL REMAINING` : "READY TO ASCEND"}
                </div>
              </div>
            )}

            {/* Quick stats */}
            {[
              { label: "TASKS INSCRIBED", value: `${progress.done}/${progress.total}` },
              { label: "NODE STREAK",     value: `${nodeStreak} DAYS` },
              { label: "COMPLETION",      value: `${progress.pct}%` },
            ].map((s) => (
              <div key={s.label} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 0", borderTop: `1px solid ${C.border}`,
                fontFamily: MONO, fontSize: "9px",
              }}>
                <span style={{ color: C.mutedL }}>{s.label}</span>
                <span style={{ color: C.text, fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contract info */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: "8px", padding: "16px", marginBottom: "12px",
        }}>
          <div style={{ fontFamily: MONO, color: C.mutedL, fontSize: "8px", letterSpacing: "0.16em", marginBottom: "12px" }}>
            ◈ CONTRACT STATUS
          </div>
          {[
            { label: "NETWORK",  value: "SEPOLIA", color: C.green },
            { label: "CONTRACT", value: LIVE_CONTRACT ? LIVE_CONTRACT.slice(0, 10) + "…" : "NOT DEPLOYED", color: LIVE_CONTRACT ? C.gold : C.amber },
            { label: "TX MODE",  value: wallet.isConnected && wallet.isCorrectNetwork ? "ON-CHAIN" : "OFF-CHAIN", color: wallet.isConnected && wallet.isCorrectNetwork ? C.green : C.amber },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex", justifyContent: "space-between",
              padding: "6px 0", borderTop: `1px solid ${C.border}`,
              fontFamily: MONO, fontSize: "9px",
            }}>
              <span style={{ color: C.mutedL }}>{row.label}</span>
              <span style={{ color: row.color, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
          {INITIATION_CONTRACT && (
            <a
              href={`https://sepolia.etherscan.io/address/${LIVE_CONTRACT}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: "5px",
                fontFamily: MONO, fontSize: "8px", color: C.blue,
                marginTop: "10px", textDecoration: "none", letterSpacing: "0.08em",
              }}>
              VIEW ON ETHERSCAN <ExternalLink size={8} />
            </a>
          )}
        </div>

        {/* Tier ladder */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: "8px", padding: "16px",
        }}>
          <div style={{ fontFamily: MONO, color: C.mutedL, fontSize: "8px", letterSpacing: "0.16em", marginBottom: "12px" }}>
            ◈ TIER LADDER
          </div>
          {(Object.entries(TIERS) as [TierName, typeof TIERS[TierName]][]).map(([name, t]) => {
            const isActive  = name === tierName;
            const isPassed  = Object.keys(TIERS).indexOf(name) < Object.keys(TIERS).indexOf(tierName);
            return (
              <div key={name} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "8px 10px", borderRadius: "5px", marginBottom: "4px",
                background: isActive ? t.bg : "transparent",
                border: `1px solid ${isActive ? t.color + "30" : "transparent"}`,
              }}>
                <span style={{ fontFamily: MONO, fontSize: "14px", color: isActive ? t.color : isPassed ? C.mutedL : C.mutedL, opacity: isPassed ? 0.5 : 1 }}>
                  {isPassed ? "✓" : t.glyph}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT, color: isActive ? t.color : isPassed ? C.mutedL : C.mutedL, fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }}>
                    {name}
                  </div>
                  <div style={{ fontFamily: MONO, color: C.mutedL, fontSize: "8px" }}>
                    {t.threshold.toLocaleString()} SIGNAL
                  </div>
                </div>
                {isActive && <ChevronRight size={10} color={t.color} />}
              </div>
            );
          })}
        </div>

      </aside>
    </div>
    </div>
  );
}

// ─── TELEGRAM VERIFY MODAL ────────────────────────────────────────────────────
declare global { interface Window { __tgOnAuth?: (u: Record<string, unknown>) => void; } }

function TelegramVerifyModal({ botUsername, verifyState, errorMsg, onAuth, onClose }: {
  botUsername:  string | null;
  verifyState:  "idle" | "success" | "error" | "not_member";
  errorMsg:     string;
  onAuth:       (data: Record<string, unknown>) => void;
  onClose:      () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;
    // Inject Telegram Login Widget script
    window.__tgOnAuth = onAuth;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login",  botUsername);
    script.setAttribute("data-size",            "large");
    script.setAttribute("data-onauth",          "__tgOnAuth(user)");
    script.setAttribute("data-request-access",  "write");
    script.async = true;
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);
    return () => { delete window.__tgOnAuth; };
  }, [botUsername, onAuth]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: C.card,
        border: `1px solid ${C.borderG}`,
        borderRadius: "10px",
        padding: "28px 32px",
        minWidth: "320px", maxWidth: "400px",
        width: "90%",
        position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: "14px", right: "14px",
          background: "transparent", border: "none",
          color: C.muted, cursor: "pointer", padding: "4px",
        }}><X size={16} /></button>

        <div style={{ fontFamily: FONT, fontSize: "11px", letterSpacing: "0.2em", color: C.gold, marginBottom: "6px" }}>
          ◈ TELEGRAM VERIFICATION
        </div>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, lineHeight: 1.7, margin: "0 0 20px" }}>
          Join our Telegram channel first, then click the button below to verify your membership.
        </p>

        {verifyState === "success" && (
          <div style={{
            padding: "12px 16px", borderRadius: "6px",
            background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.3)",
            fontFamily: MONO, fontSize: "11px", color: C.green,
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <Check size={14} /> VERIFIED — +100 SIGNAL AWARDED
          </div>
        )}

        {(verifyState === "error" || verifyState === "not_member") && (
          <div style={{
            padding: "12px 16px", borderRadius: "6px", marginBottom: "16px",
            background: "rgba(255,91,91,0.06)", border: "1px solid rgba(255,91,91,0.25)",
            fontFamily: MONO, fontSize: "10px", color: C.red, lineHeight: 1.6,
          }}>
            {errorMsg || "Verification failed — please try again."}{" "}
            {verifyState === "not_member" && (
              <a href="https://t.me/otterprotocol" target="_blank" rel="noopener noreferrer"
                style={{ color: C.gold }}>Join now →</a>
            )}
          </div>
        )}

        {verifyState !== "success" && (
          <div ref={containerRef} style={{ minHeight: "56px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!botUsername && (
              <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted }}>Loading widget…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
