"use client";
import { useState, useEffect, useCallback } from "react";
import { Zap, Clock, Users, ExternalLink, Trophy, AlertTriangle, Check, Search } from "lucide-react";
import { authFetch } from "@/lib/api";

const C = {
  card: "#111", card2: "#0D0D0D", border: "#1F1F1F", gold: "#C9A84C", goldL: "#E2BF6E",
  text: "#E8E8E8", muted: "#5C5C5C", green: "#00C896", red: "#FF4545", orange: "#F5A623", purple: "#A78BFA",
};

interface Drop {
  dropId:     string;
  title:      string;
  hint:       string;
  amount:     number;
  maxClaims:  number;
  claimCount: number;
  expiresAt:  number;
  active:     boolean;
  expired:    boolean;
  full:       boolean;
}

function useCountdown(expiresAt: number) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);
  const s   = Math.floor(remaining / 1000);
  const hrs = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { remaining, hrs, min, sec };
}

function DropCard({ drop, uid, walletAddress }: { drop: Drop; uid?: string; walletAddress?: string | null }) {
  const [code,      setCode]      = useState("");
  const [busy,      setBusy]      = useState(false);
  const [result,    setResult]    = useState<{ txHash: string; amount: number } | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const { remaining, hrs, min, sec } = useCountdown(drop.expiresAt);

  const pct      = Math.round((drop.claimCount / drop.maxClaims) * 100);
  const spotsLeft = drop.maxClaims - drop.claimCount;
  const isActive  = drop.active && !drop.expired && !drop.full;

  const handleRedeem = async () => {
    setError(null);
    if (!uid)           { setError("Sign in to claim drops"); return; }
    if (!walletAddress) { setError("Connect your wallet to claim"); return; }
    if (!code.trim())   { setError("Enter the code first"); return; }

    setBusy(true);
    try {
      const res  = await authFetch("/api/drop/redeem", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: code.trim(), walletAddress, uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Redemption failed");
      setResult({ txHash: data.txHash, amount: data.amount });
      setCode("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  };

  return (
    <div style={{
      background: isActive
        ? "linear-gradient(135deg,#0D0D0D,#12100A)"
        : C.card,
      border: `1px solid ${isActive ? "rgba(201,168,76,0.2)" : C.border}`,
      borderRadius: "16px", padding: "24px",
      position: "relative", overflow: "hidden",
    }}>
      {/* Glow for active drops */}
      {isActive && (
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "160px", height: "160px", background: "radial-gradient(circle,rgba(201,168,76,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "18px" }}>🎯</span>
            <span style={{ fontWeight: 800, fontSize: "16px" }}>{drop.title}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Zap size={12} color={C.gold} />
            <span style={{ color: C.gold, fontWeight: 700, fontSize: "14px" }}>{drop.amount} OTTER</span>
            <span style={{ color: C.muted, fontSize: "12px" }}>per finder</span>
          </div>
        </div>

        {/* Status badge */}
        {isActive && (
          <div style={{ background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "20px", padding: "4px 12px", display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: C.green, animation: "pulse 1.5s ease-in-out infinite" }} />
            <span style={{ color: C.green, fontSize: "11px", fontWeight: 700 }}>LIVE</span>
          </div>
        )}
        {drop.expired && !drop.full && (
          <div style={{ background: "rgba(255,69,69,0.08)", border: "1px solid rgba(255,69,69,0.2)", borderRadius: "20px", padding: "4px 12px" }}>
            <span style={{ color: C.red, fontSize: "11px", fontWeight: 700 }}>EXPIRED</span>
          </div>
        )}
        {drop.full && (
          <div style={{ background: "rgba(92,92,92,0.08)", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "4px 12px" }}>
            <span style={{ color: C.muted, fontSize: "11px", fontWeight: 700 }}>CLAIMED OUT</span>
          </div>
        )}
      </div>

      {/* Hint */}
      <div style={{ background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px" }}>
        <div style={{ color: C.muted, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "4px" }}>HINT</div>
        <div style={{ color: C.text, fontSize: "13px", lineHeight: 1.5 }}>{drop.hint}</div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
        {/* Claims progress */}
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
            <Users size={11} color={C.muted} />
            <span style={{ color: C.muted, fontSize: "10px", fontWeight: 600 }}>SPOTS</span>
          </div>
          <div style={{ height: "4px", background: "#1A1A1A", borderRadius: "2px", marginBottom: "4px" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? C.red : C.gold, borderRadius: "2px", transition: "width 0.3s" }} />
          </div>
          <div style={{ color: C.text, fontSize: "12px", fontWeight: 700 }}>
            {spotsLeft > 0 ? <span style={{ color: pct >= 90 ? C.orange : C.green }}>{spotsLeft} left</span> : <span style={{ color: C.red }}>Full</span>}
            <span style={{ color: C.muted, fontWeight: 400 }}> / {drop.maxClaims}</span>
          </div>
        </div>

        {/* Countdown */}
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
            <Clock size={11} color={C.muted} />
            <span style={{ color: C.muted, fontSize: "10px", fontWeight: 600 }}>TIME LEFT</span>
          </div>
          {isActive ? (
            <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "15px", color: remaining < 600_000 ? C.red : C.text }}>
              {String(hrs).padStart(2, "0")}:{String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
            </div>
          ) : (
            <div style={{ color: C.muted, fontSize: "13px" }}>{drop.expired ? "Expired" : "Closed"}</div>
          )}
        </div>
      </div>

      {/* Claim form — only for active drops */}
      {isActive && !result && (
        <div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE HERE"
              maxLength={32}
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
              style={{ flex: 1, background: "#080808", border: `1px solid ${code ? "rgba(201,168,76,0.3)" : C.border}`, borderRadius: "8px", padding: "12px 14px", color: C.gold, fontSize: "14px", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.1em", outline: "none", textTransform: "uppercase" }}
            />
            <button onClick={handleRedeem} disabled={busy || !code.trim()}
              style={{ background: code.trim() ? "linear-gradient(135deg,#C9A84C,#E2BF6E)" : "#1A1A1A", color: code.trim() ? "#000" : C.muted, border: "none", borderRadius: "8px", padding: "12px 18px", fontWeight: 700, fontSize: "13px", cursor: busy || !code.trim() ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
              {busy ? <><Spin />Claiming…</> : <><Search size={14} />Claim</>}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", color: C.red, fontSize: "12px" }}>
              <AlertTriangle size={12} />{error}
            </div>
          )}
        </div>
      )}

      {/* Success state */}
      {result && (
        <div style={{ background: "rgba(0,200,150,0.05)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "10px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Check size={16} color={C.green} />
            <div>
              <div style={{ color: C.green, fontWeight: 700, fontSize: "14px" }}>+{result.amount} OTTER sent!</div>
              <div style={{ color: C.muted, fontSize: "11px" }}>Check your wallet</div>
            </div>
          </div>
          <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" rel="noopener noreferrer"
            style={{ color: C.green, fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
            View tx <ExternalLink size={11} />
          </a>
        </div>
      )}

      {/* No wallet CTA */}
      {isActive && !result && !walletAddress && (
        <div style={{ marginTop: "10px", color: C.muted, fontSize: "12px", textAlign: "center" }}>
          Connect wallet + sign in to claim drops
        </div>
      )}
    </div>
  );
}

export default function DropHunt({ uid, walletAddress }: { uid?: string; walletAddress?: string | null }) {
  const [drops,   setDrops]   = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<"active" | "history">("active");

  const load = useCallback(async () => {
    try {
      const res  = await fetch("/api/drop/list");
      const data = await res.json();
      setDrops(data.drops || []);
    } catch { setDrops([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(iv);
  }, [load]);

  const activeDrops  = drops.filter((d) => d.active && !d.expired && !d.full);
  const historyDrops = drops.filter((d) => !d.active || d.expired || d.full);

  return (
    <div>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0D0D0D,#12100A)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: "16px", padding: "24px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top right,rgba(201,168,76,0.06) 0%,transparent 60%)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ fontSize: "24px" }}>🎯</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: "20px", background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              OTTER Drop Hunts
            </div>
            <div style={{ color: C.muted, fontSize: "13px" }}>Hidden codes. Real OTTER. First finders win.</div>
          </div>
        </div>
        <div style={{ color: C.text, fontSize: "13px", lineHeight: 1.6, marginBottom: "14px" }}>
          Codes are hidden across X posts, Discord, the EIP document, and on-chain transaction data.
          Find the code → enter it below → OTTER sent to your wallet instantly.
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[
            { icon: "𝕏", text: "Watch our X posts" },
            { icon: "💬", text: "Check Discord" },
            { icon: "📄", text: "Read the EIP" },
            { icon: "⛓️", text: "Watch Sepolia txs" },
          ].map((c) => (
            <div key={c.text} style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.1)", borderRadius: "20px", padding: "5px 12px", fontSize: "12px", fontWeight: 600, color: C.muted, display: "flex", alignItems: "center", gap: "5px" }}>
              <span>{c.icon}</span>{c.text}
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "4px", background: C.card, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "4px", marginBottom: "16px" }}>
        {(["active", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: "8px", borderRadius: "7px", border: "none", background: tab === t ? C.border : "transparent", color: tab === t ? C.text : C.muted, fontSize: "12px", fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
            {t === "active" ? `Active Drops (${activeDrops.length})` : `History (${historyDrops.length})`}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px", color: C.muted }}>
          <div style={{ display: "inline-block", width: "20px", height: "20px", border: `2px solid ${C.border}`, borderTopColor: C.gold, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      {/* Active drops */}
      {!loading && tab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {activeDrops.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>No active drops right now</div>
              <div style={{ color: C.muted, fontSize: "13px" }}>Follow us on X and watch Discord — drops are announced with cryptic hints.</div>
            </div>
          ) : (
            activeDrops.map((d) => <DropCard key={d.dropId} drop={d} uid={uid} walletAddress={walletAddress} />)
          )}
        </div>
      )}

      {/* History */}
      {!loading && tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {historyDrops.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "32px", fontSize: "13px" }}>
              No past drops yet.
            </div>
          ) : (
            historyDrops.map((d) => (
              <div key={d.dropId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: C.muted, marginBottom: "2px" }}>{d.title}</div>
                  <div style={{ color: C.muted, fontSize: "12px" }}>{d.claimCount}/{d.maxClaims} claimed · {d.amount} OTTER each</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {d.full    && <span style={{ color: C.muted, fontSize: "11px", fontWeight: 700 }}>FULLY CLAIMED</span>}
                  {d.expired && !d.full && <span style={{ color: C.red, fontSize: "11px", fontWeight: 700 }}>EXPIRED</span>}
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Trophy size={12} color={C.muted} />
                    <span style={{ color: C.gold, fontWeight: 700, fontSize: "12px" }}>
                      {d.claimCount * d.amount} OTTER
                    </span>
                    <span style={{ color: C.muted, fontSize: "11px" }}>total distributed</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Spin() {
  return <span style={{ width: "12px", height: "12px", border: "2px solid rgba(201,168,76,0.2)", borderTopColor: C.gold, borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}
