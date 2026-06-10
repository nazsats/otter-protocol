"use client";
import { useState, useEffect, useCallback } from "react";
import { Check, Lock, ChevronRight, Trophy, Zap, Gift, Star, ArrowRight, Flame } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MISSIONS, CATEGORY_META, getUserMissions, completeMission, calcProgress, MissionCategory } from "@/lib/missions";
import { useToast } from "@/context/ToastContext";
import { authFetch } from "@/lib/api";

const C = {
  bg:     "#000",
  card:   "#0D0B07",
  card2:  "#0A0800",
  border: "#1E1A10",
  borderH:"#2A2310",
  gold:   "#C9A84C",
  goldL:  "#E2BF6E",
  text:   "#E8DFC8",
  muted:  "#8C7A5C",
  mutedL: "#5C4A2A",
  green:  "#00C896",
  red:    "#FF4545",
  purple: "#A78BFA",
  orange: "#F5A623",
};
const FONT = "var(--font-cinzel, Georgia, serif)";
const MONO = "var(--font-geist-mono, monospace)";

export default function MissionBoard({ uid, walletAddress, referralCount, isOnSepolia, onComplete }: {
  uid: string;
  walletAddress?: string | null;
  referralCount?: number;
  isOnSepolia?: boolean;
  onComplete?: () => void;
}) {
  const toast = useToast();
  const [completed,     setCompleted]     = useState<Record<string, boolean>>({});
  const [claimed,       setClaimed]       = useState<Record<string, boolean>>({});
  const [filter,        setFilter]        = useState<MissionCategory | "all">("all");
  const [loading,       setLoading]       = useState(true);
  const [claiming,      setClaiming]      = useState<string | null>(null);
  const [claimingOtter, setClaimingOtter] = useState<string | null>(null);
  const [claimAllBusy,  setClaimAllBusy]  = useState(false);
  const [claimedTxs,    setClaimedTxs]    = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [mData, cData] = await Promise.all([
      getUserMissions(uid),
      fetchClaimed(uid),
    ]);
    setCompleted(mData);
    setClaimed(cData.flags);
    setClaimedTxs(cData.txs);
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  // ── Step 1: Complete mission (earn points) ─────────────────────────────
  const handleComplete = async (missionId: string, action: string, link?: string) => {
    if (completed[missionId]) return;

    if (action === "link" && link) {
      window.open(link, "_blank");
      setTimeout(async () => {
        setClaiming(missionId);
        await completeMission(uid, missionId);
        setCompleted((c) => ({ ...c, [missionId]: true }));
        const m = MISSIONS.find((m) => m.id === missionId);
        toast(`+${m?.points} pts — ${m?.title} complete!`, "success");
        onComplete?.();
        setClaiming(null);
      }, 1500);
      return;
    }
    if (action === "wallet" && !walletAddress) {
      toast("Connect your wallet first", "error"); return;
    }
    if (action === "referral") {
      toast("Completes automatically when your referrals sign up", "info"); return;
    }
    setClaiming(missionId);
    await completeMission(uid, missionId);
    setCompleted((c) => ({ ...c, [missionId]: true }));
    const m = MISSIONS.find((m) => m.id === missionId);
    toast(`+${m?.points} pts — ${m?.title} complete!`, "success");
    onComplete?.();
    setClaiming(null);
  };

  // ── Step 2: Claim OTTER tokens (precious on-chain) ─────────────────────
  const handleClaimOtter = async (missionId: string) => {
    if (!walletAddress) { toast("Connect wallet to claim OTTER tokens", "error"); return; }
    if (claimed[missionId]) return;
    setClaimingOtter(missionId);
    try {
      const res  = await authFetch("/api/claim-mission", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid, missionId, walletAddress }),
      });
      const data = await res.json();

      // 409 = already claimed — mark as claimed in UI without error
      if (res.status === 409) {
        setClaimed((c) => ({ ...c, [missionId]: true }));
        toast("OTTER already received for this mission ✓", "success");
        return;
      }

      if (!res.ok) throw new Error(data.error || "Claim failed");
      setClaimed((c) => ({ ...c, [missionId]: true }));
      if (data.txHash) setClaimedTxs((t) => ({ ...t, [missionId]: data.txHash }));
      const m = MISSIONS.find((m) => m.id === missionId);
      toast(`${m?.otterAmount} OTTER sent to your wallet!`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      toast(msg, "error");
    }
    setClaimingOtter(null);
  };

  // ── Claim all unclaimed ────────────────────────────────────────────────
  const handleClaimAll = async () => {
    if (!walletAddress) { toast("Connect wallet to claim OTTER tokens", "error"); return; }
    setClaimAllBusy(true);
    try {
      const res  = await authFetch("/api/claim-all", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      if (data.totalOtter === 0) {
        toast("No unclaimed OTTER available", "info");
      } else {
        const newClaimed = { ...claimed };
        const newTxs    = { ...claimedTxs };
        data.claimed.forEach((r: { missionId: string; txHash?: string }) => {
          newClaimed[r.missionId] = true;
          if (r.txHash) newTxs[r.missionId] = r.txHash;
        });
        setClaimed(newClaimed);
        setClaimedTxs(newTxs);
        toast(`${data.totalOtter} OTTER claimed across ${data.claimed.length} missions!`, "success");
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Claim all failed", "error");
    }
    setClaimAllBusy(false);
  };

  const progress       = calcProgress(completed);
  const filtered       = filter === "all" ? MISSIONS : MISSIONS.filter((m) => m.category === filter);
  const categories: (MissionCategory | "all")[] = ["all", "onboarding", "social", "onchain", "community"];
  const claimableCount = MISSIONS.filter((m) => completed[m.id] && !claimed[m.id]).length;
  const claimableOtter = MISSIONS.filter((m) => completed[m.id] && !claimed[m.id]).reduce((s, m) => s + m.otterAmount, 0);
  const totalOtterClaimed = MISSIONS.filter((m) => claimed[m.id]).reduce((s, m) => s + m.otterAmount, 0);

  if (loading) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "48px", textAlign: "center" }}>
      <div style={{ display: "inline-block", width: "24px", height: "24px", border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontFamily: FONT, color: C.muted, fontSize: "11px", letterSpacing: "0.14em", marginTop: "12px" }}>LOADING MISSIONS…</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ── Hero progress card ── */}
      <div style={{ background: "linear-gradient(135deg, #0D0A04 0%, #060400 100%)", border: `1px solid rgba(201,168,76,0.2)`, borderRadius: "16px", padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        {/* Gold glow */}
        <div style={{ position: "absolute", top: 0, right: 0, width: "300px", height: "300px", background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        {/* Hebrew watermark */}
        <span style={{ position: "absolute", right: "16px", bottom: "8px", fontFamily: MONO, fontSize: "60px", color: "rgba(201,168,76,0.04)", userSelect: "none", pointerEvents: "none" }}>מ</span>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.2em", marginBottom: "6px" }}>⟦ MISSION CODEX — SEASON I ⟧</div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Trophy size={18} color={C.gold} />
              <h2 style={{ fontFamily: FONT, fontSize: "16px", fontWeight: 900, color: C.text, letterSpacing: "0.06em", margin: 0 }}>MISSION BOARD</h2>
            </div>
            <div style={{ fontFamily: FONT, color: C.muted, fontSize: "11px", letterSpacing: "0.06em", marginTop: "4px" }}>
              {progress.done}/{progress.total} sealed · {progress.pct}% complete
            </div>
          </div>

          {/* Stats cluster */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: "10px", padding: "12px 16px", textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: "22px", fontWeight: 900, background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1 }}>
                {progress.pts.toLocaleString()}
              </div>
              <div style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.12em", marginTop: "4px" }}>POINTS</div>
            </div>
            <div style={{ background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.15)", borderRadius: "10px", padding: "12px 16px", textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: "22px", fontWeight: 900, color: C.green, lineHeight: 1 }}>
                {totalOtterClaimed.toLocaleString()}
              </div>
              <div style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.12em", marginTop: "4px" }}>OTTER HELD</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" }}>
          <div style={{ height: "100%", width: `${progress.pct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldL})`, borderRadius: "4px", transition: "width 0.6s ease", boxShadow: `0 0 10px rgba(201,168,76,0.4)` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: FONT, color: C.mutedL, fontSize: "10px", letterSpacing: "0.08em" }}>{progress.pct}% complete</span>
          <span style={{ fontFamily: FONT, color: C.gold, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>{progress.total - progress.done} remaining</span>
        </div>

        {/* Claim all banner */}
        {claimableCount > 0 && (
          <div style={{ marginTop: "16px", background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "10px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F4DC8A, #C9A84C 50%, #8B6000)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(201,168,76,0.4)", flexShrink: 0 }}>
                <Gift size={14} color="#000" />
              </div>
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "13px", color: C.gold, letterSpacing: "0.04em" }}>{claimableOtter} OTTER ready to claim</div>
                <div style={{ fontFamily: FONT, color: C.muted, fontSize: "10px", marginTop: "2px", letterSpacing: "0.04em" }}>{claimableCount} completed mission{claimableCount > 1 ? "s" : ""} — connect wallet to receive</div>
              </div>
            </div>
            <button onClick={handleClaimAll} disabled={claimAllBusy || !walletAddress}
              style={{ background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, fontSize: "11px", cursor: claimAllBusy || !walletAddress ? "not-allowed" : "pointer", opacity: claimAllBusy ? 0.7 : 1, display: "flex", alignItems: "center", gap: "6px", fontFamily: FONT, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
              {claimAllBusy ? <><Spin />CLAIMING…</> : <><Gift size={12} />CLAIM ALL OTTER</>}
            </button>
          </div>
        )}
      </div>

      {/* ── Flow explanation ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: "0", alignItems: "center" }}>
        {[
          { n: "①", label: "COMPLETE", sub: "Do the mission", color: C.purple, icon: <Zap size={14} /> },
          null,
          { n: "②", label: "EARN POINTS", sub: "Infinite activity tokens", color: C.orange, icon: <Flame size={14} /> },
          null,
          { n: "③", label: "CLAIM OTTER", sub: "Precious · on-chain", color: C.gold, icon: <Star size={14} /> },
        ].map((step, i) =>
          step === null ? (
            <div key={i} style={{ display: "flex", justifyContent: "center" }}>
              <ArrowRight size={14} color={C.mutedL} />
            </div>
          ) : (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: "14px", color: step.color, marginBottom: "6px" }}>{step.n}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginBottom: "3px" }}>
                <span style={{ color: step.color }}>{step.icon}</span>
                <span style={{ fontFamily: FONT, fontSize: "10px", fontWeight: 700, color: C.text, letterSpacing: "0.1em" }}>{step.label}</span>
              </div>
              <div style={{ fontFamily: FONT, fontSize: "9px", color: C.muted, letterSpacing: "0.06em" }}>{step.sub}</div>
            </div>
          )
        )}
      </div>

      {/* ── Category filter ── */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {categories.map((cat) => {
          const meta   = cat === "all" ? null : CATEGORY_META[cat];
          const active = filter === cat;
          const count  = cat === "all"
            ? MISSIONS.filter((m) => completed[m.id]).length
            : MISSIONS.filter((m) => m.category === cat && completed[m.id]).length;
          const total  = cat === "all" ? MISSIONS.length : MISSIONS.filter((m) => m.category === cat).length;
          return (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{
                padding: "6px 14px", borderRadius: "20px", cursor: "pointer", transition: "all 0.15s",
                border: `1px solid ${active ? (meta?.color || C.gold) + "60" : C.border}`,
                background: active ? `${meta?.color || C.gold}10` : "transparent",
                color: active ? (meta?.color || C.gold) : C.muted,
                fontFamily: FONT, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
              {cat === "all" ? "ALL" : meta?.label?.toUpperCase()}
              <span style={{ fontFamily: MONO, fontSize: "9px", opacity: 0.7 }}>{count}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* ── Mission list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filtered.map((mission) => {
          const done        = !!completed[mission.id];
          const otterClaimed = !!claimed[mission.id];
          const txHash      = claimedTxs[mission.id];
          const busy        = claiming === mission.id;
          const otterBusy   = claimingOtter === mission.id;
          const catMeta     = CATEGORY_META[mission.category];
          const diffColor   = { easy: C.green, medium: C.orange, hard: C.purple }[mission.difficulty];
          const blocked     = mission.action === "referral" && !done;
          const refProgress = mission.threshold ? Math.min(referralCount || 0, mission.threshold) : 0;

          // Card state
          const cardBg     = otterClaimed ? "rgba(0,200,150,0.03)" : done ? "rgba(201,168,76,0.02)" : C.card;
          const cardBorder = otterClaimed ? "rgba(0,200,150,0.15)" : done ? "rgba(201,168,76,0.15)" : C.border;

          return (
            <div key={mission.id}
              style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: "14px", overflow: "hidden", transition: "border-color 0.2s" }}
              onMouseEnter={(e) => { if (!otterClaimed) e.currentTarget.style.borderColor = done ? "rgba(201,168,76,0.3)" : C.borderH; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
            >
              {/* Main row */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "14px" }}>

                {/* Badge icon */}
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0, position: "relative",
                  background: otterClaimed ? "rgba(0,200,150,0.08)" : done ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${otterClaimed ? "rgba(0,200,150,0.2)" : done ? "rgba(201,168,76,0.2)" : C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {otterClaimed
                    ? <Check size={18} color={C.green} />
                    : done
                      ? <span style={{ fontSize: "20px" }}>{mission.badge}</span>
                      : <span style={{ fontSize: "20px", filter: "grayscale(0.5)", opacity: 0.6 }}>{mission.badge}</span>
                  }
                  {/* Difficulty dot */}
                  <div style={{ position: "absolute", top: "3px", right: "3px", width: "6px", height: "6px", borderRadius: "50%", background: diffColor }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: "13px", color: otterClaimed ? C.muted : C.text, letterSpacing: "0.04em", textDecoration: otterClaimed ? "line-through" : "none" }}>
                      {mission.title}
                    </span>
                    <span style={{ background: `${catMeta.color}12`, color: catMeta.color, border: `1px solid ${catMeta.color}25`, borderRadius: "20px", padding: "1px 8px", fontSize: "9px", fontFamily: FONT, fontWeight: 700, letterSpacing: "0.08em" }}>
                      {catMeta.label.toUpperCase()}
                    </span>
                    {otterClaimed && (
                      <span style={{ background: "rgba(0,200,150,0.1)", color: C.green, border: "1px solid rgba(0,200,150,0.2)", borderRadius: "20px", padding: "1px 8px", fontSize: "9px", fontFamily: FONT, fontWeight: 700, letterSpacing: "0.08em" }}>
                        ✓ OTTER CLAIMED
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: FONT, color: C.muted, fontSize: "11px", lineHeight: 1.6, margin: 0, letterSpacing: "0.02em" }}>{mission.desc}</p>

                  {/* Referral progress bar */}
                  {mission.threshold && !done && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                      <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.04)", borderRadius: "2px" }}>
                        <div style={{ height: "100%", width: `${(refProgress / mission.threshold) * 100}%`, background: catMeta.color, borderRadius: "2px", transition: "width 0.4s" }} />
                      </div>
                      <span style={{ fontFamily: MONO, color: C.muted, fontSize: "10px", whiteSpace: "nowrap" }}>{refProgress}/{mission.threshold}</span>
                    </div>
                  )}

                  {/* TX hash if claimed */}
                  {txHash && (
                    <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "6px", fontFamily: MONO, fontSize: "9px", color: C.mutedL, textDecoration: "none", letterSpacing: "0.04em" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = C.green)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.mutedL)}>
                      ↗ {txHash.slice(0, 8)}…{txHash.slice(-6)}
                    </a>
                  )}
                </div>

                {/* Right side: rewards + actions */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                  {/* Reward display */}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: MONO, color: otterClaimed ? C.mutedL : C.gold, fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "10px" }}>◈</span>
                      {mission.otterAmount}
                      <span style={{ fontSize: "10px", fontFamily: FONT, letterSpacing: "0.06em" }}>OTTER</span>
                    </div>
                    <div style={{ fontFamily: FONT, color: C.mutedL, fontSize: "10px", letterSpacing: "0.06em", marginTop: "2px" }}>
                      +{mission.points} pts
                    </div>
                  </div>

                  {/* Action buttons */}
                  <ActionButtons
                    done={done}
                    otterClaimed={otterClaimed}
                    busy={busy}
                    otterBusy={otterBusy}
                    blocked={blocked}
                    walletAddress={walletAddress}
                    onComplete={() => handleComplete(mission.id, mission.action, mission.link)}
                    onClaimOtter={() => handleClaimOtter(mission.id)}
                  />
                </div>
              </div>

              {/* Progress strip at bottom for completed-but-unclaimed */}
              {done && !otterClaimed && (
                <div style={{ height: "3px", background: `linear-gradient(90deg, ${C.gold}, ${C.goldL})`, opacity: 0.6 }} />
              )}
              {otterClaimed && (
                <div style={{ height: "3px", background: `linear-gradient(90deg, ${C.green}, rgba(0,200,150,0.5))`, opacity: 0.7 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── OTTER precious footnote ── */}
      <div style={{ background: "linear-gradient(135deg, #080500, #060400)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: "12px", padding: "18px 22px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F4DC8A, #C9A84C 50%, #8B6000)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 10px rgba(201,168,76,0.3)" }}>
            <span style={{ fontFamily: MONO, fontSize: "10px", color: "#000", fontWeight: 900 }}>◈</span>
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "12px", color: C.gold, letterSpacing: "0.06em", marginBottom: "4px" }}>OTTER IS PRECIOUS · LIMITED SUPPLY</div>
            <div style={{ fontFamily: FONT, color: C.muted, fontSize: "10px", lineHeight: 1.8, letterSpacing: "0.04em" }}>
              Beta OTTER earned on Sepolia will be snapshotted at mainnet launch. Only true OG supporters — those who completed missions, referred others, and held — will receive the final mainnet allocation. Points are infinite. OTTER is not.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Action button component ───────────────────────────────────────────────
function ActionButtons({
  done, otterClaimed, busy, otterBusy, blocked, walletAddress, onComplete, onClaimOtter,
}: {
  done: boolean;
  otterClaimed: boolean;
  busy: boolean;
  otterBusy: boolean;
  blocked: boolean;
  walletAddress?: string | null;
  onComplete: () => void;
  onClaimOtter: () => void;
}) {
  if (otterClaimed) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(0,200,150,0.07)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "8px", padding: "6px 12px" }}>
        <Check size={11} color="#00C896" />
        <span style={{ fontFamily: FONT, color: "#00C896", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>RECEIVED</span>
      </div>
    );
  }

  if (done) {
    // Completed but OTTER not yet claimed
    return (
      <button onClick={onClaimOtter} disabled={otterBusy || !walletAddress}
        style={{
          background: walletAddress ? "linear-gradient(135deg, #C9A84C, #E2BF6E)" : "rgba(201,168,76,0.1)",
          color: walletAddress ? "#000" : C.gold,
          border: walletAddress ? "none" : "1px solid rgba(201,168,76,0.2)",
          borderRadius: "8px", padding: "7px 14px", fontWeight: 700, fontSize: "10px",
          cursor: otterBusy || !walletAddress ? "not-allowed" : "pointer",
          opacity: otterBusy ? 0.7 : 1, display: "flex", alignItems: "center", gap: "5px",
          fontFamily: FONT, letterSpacing: "0.08em", whiteSpace: "nowrap",
        }}>
        {otterBusy ? <><Spin />SENDING…</> : !walletAddress ? <><Lock size={10} />NEED WALLET</> : <><Gift size={10} />CLAIM OTTER</>}
      </button>
    );
  }

  // Not yet completed
  return (
    <button onClick={onComplete} disabled={busy || blocked}
      style={{
        background: "transparent",
        color: blocked ? C.mutedL : C.gold,
        border: `1px solid ${blocked ? C.mutedL + "30" : "rgba(201,168,76,0.25)"}`,
        borderRadius: "8px", padding: "7px 14px", fontWeight: 700, fontSize: "10px",
        cursor: busy || blocked ? "not-allowed" : "pointer",
        opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", gap: "5px",
        fontFamily: FONT, letterSpacing: "0.08em", whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { if (!busy && !blocked) { e.currentTarget.style.background = "rgba(201,168,76,0.08)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      {busy
        ? <><Spin />SEALING…</>
        : blocked
          ? <><Lock size={10} />AUTO</>
          : <>COMPLETE <ChevronRight size={10} /></>
      }
    </button>
  );
}

// ── Fetch claimed OTTER missions ──────────────────────────────────────────
async function fetchClaimed(uid: string): Promise<{ flags: Record<string, boolean>; txs: Record<string, string> }> {
  const flags: Record<string, boolean> = {};
  const txs:   Record<string, string>  = {};
  try {
    await Promise.all(
      MISSIONS.map(async (m) => {
        try {
          const snap = await getDoc(doc(db, "otter_claims", `${uid}_${m.id}`));
          if (snap.exists()) {
            const d = snap.data();
            // Only mark as claimed if the transfer actually completed
            if (d?.status === "complete" || d?.txHash) {
              flags[m.id] = true;
              if (d?.txHash) txs[m.id] = d.txHash as string;
            }
          }
        } catch {
          // Individual doc read failed — skip silently (permission issue / not exists)
        }
      })
    );
  } catch {
    // Outer failure (e.g. network) — return whatever we collected
  }
  return { flags, txs };
}

function Spin() {
  return <span style={{ width: "11px", height: "11px", border: "2px solid rgba(201,168,76,0.2)", borderTopColor: C.gold, borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}
