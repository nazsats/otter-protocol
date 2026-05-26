"use client";
import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WalletConnect from "@/components/web3/WalletConnect";
import MissionBoard from "@/components/MissionBoard";
import ActivityFeed from "@/components/ActivityFeed";
import DropHunt from "@/components/DropHunt";
import MemeArena from "@/components/MemeArena";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useWallet } from "@/hooks/useWallet";
import { autoCompleteMissions, getLeaderboard, calcProgress, getUserMissions } from "@/lib/missions";
import { ethers } from "ethers";
import {
  Zap, Trophy, Shield, RefreshCw, ExternalLink, Copy,
  ArrowRight, Users, Award, AlertTriangle, Check, Lock,
  TrendingUp, Activity, BarChart2, ChevronRight,
} from "lucide-react";

const C = {
  black: "#000000", card: "#0D0B07", card2: "#0A0800", border: "#1E1A10", border2: "#2A2418",
  gold: "#C9A84C", goldL: "#E2BF6E", text: "#E8DFC8", muted: "#5C4A2A", mutedH: "#8C7A5C",
  green: "#00C896", red: "#FF4545", orange: "#F5A623", purple: "#A78BFA", blue: "#60A5FA",
};

const OTTER_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function holdDuration(address) view returns (uint256)",
  "function holderTier(address) view returns (uint8)",
  "function pendingRewards(address) view returns (uint256)",
  "function governanceWeight(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
  "function claimRewards() returns (uint256)",
];

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_OTTER_CONTRACT || null;
const TIER_LABELS  = ["NEWCOMER", "MEMBER", "OG"];
const TIER_COLORS  = [C.muted,    C.purple, C.gold];
const TIER_BG      = ["rgba(92,92,92,0.08)", "rgba(167,139,250,0.08)", "rgba(201,168,76,0.08)"];
const TIER_DAYS    = [0, 30, 90];
const TIER_REWARDS = ["1.0×", "1.5×", "2.0×"];

type Tab = "dashboard" | "missions" | "onchain" | "leaderboard" | "drops" | "memes";

export default function DAppPage() {
  const { user, profile, openAuthModal } = useAuth();
  const toast  = useToast();
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("dashboard");

  // Destructure stable primitives to avoid infinite loop in fetchChain
  const walletAddr       = wallet.address;
  const walletCorrectNet = wallet.isCorrectNetwork;
  const walletConnected  = wallet.isConnected;
  const getProvider      = wallet.getProvider;
  const getSigner        = wallet.getSigner;

  // On-chain data
  const [balance,    setBalance]    = useState<string | null>(null);
  const [holdDays,   setHoldDays]   = useState<number | null>(null);
  const [tier,       setTier]       = useState<number>(0);
  const [rewards,    setRewards]    = useState<string | null>(null);
  const [govWeight,  setGovWeight]  = useState<string | null>(null);
  const [supply,     setSupply]     = useState<string | null>(null);
  const [chainBusy,  setChainBusy]  = useState(false);

  // Send form
  const [sendTo,     setSendTo]     = useState("");
  const [sendAmt,    setSendAmt]    = useState("");
  const [sendBusy,   setSendBusy]   = useState(false);
  const [claimBusy,  setClaimBusy]  = useState(false);
  const [lastTx,     setLastTx]     = useState<string | null>(null);

  // Leaderboard
  const [leaders,    setLeaders]    = useState<{ rank: number; name: string; points: number; referrals: number; tier: string }[]>([]);

  // Missions summary
  const [progress,   setProgress]   = useState({ done: 0, total: 0, pts: 0, pct: 0 });

  // ── FETCH ON-CHAIN DATA ──────────────────────────────────────────────────
  const fetchChain = useCallback(async () => {
    if (!walletAddr || !walletCorrectNet || !CONTRACT_ADDRESS) return;
    setChainBusy(true);
    try {
      const provider = getProvider();
      if (!provider) return;
      const contract = new ethers.Contract(CONTRACT_ADDRESS, OTTER_ABI, provider);
      const [bal, dur, t, pend, gov, tot] = await Promise.all([
        contract.balanceOf(walletAddr),
        contract.holdDuration(walletAddr),
        contract.holderTier(walletAddr),
        contract.pendingRewards(walletAddr),
        contract.governanceWeight(walletAddr),
        contract.totalSupply(),
      ]);
      setBalance(parseFloat(ethers.formatEther(bal)).toLocaleString(undefined, { maximumFractionDigits: 2 }));
      setHoldDays(Math.floor(Number(dur) / 86400));
      setTier(Number(t));
      setRewards(parseFloat(ethers.formatEther(pend)).toFixed(4));
      setGovWeight(parseFloat(ethers.formatEther(gov)).toFixed(2));
      setSupply(parseFloat(ethers.formatEther(tot)).toLocaleString());
    } catch { /* contract not yet live or no tokens */ }
    setChainBusy(false);
  }, [walletAddr, walletCorrectNet, getProvider]);

  // ── AUTO-COMPLETE MISSIONS ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    autoCompleteMissions(user.uid, {
      hasWallet:     !!walletAddr,
      referralCount: profile?.referralCount ?? 0,
      isOnSepolia:   walletCorrectNet,
      hasTx:         !!lastTx,
    });
  }, [user, walletAddr, walletCorrectNet, profile?.referralCount, lastTx]);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  useEffect(() => {
    getLeaderboard().then(setLeaders).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    getUserMissions(user.uid).then((c) => setProgress(calcProgress(c)));
  }, [user]);

  // ── SEND OTTER ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!ethers.isAddress(sendTo)) { toast("Invalid recipient address", "error"); return; }
    if (!sendAmt || isNaN(Number(sendAmt)) || Number(sendAmt) <= 0) { toast("Enter a valid amount", "error"); return; }
    if (!CONTRACT_ADDRESS) { toast("Contract not deployed yet", "error"); return; }
    setSendBusy(true);
    try {
      const signer   = await getSigner();
      if (!signer) throw new Error("No signer");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, OTTER_ABI, signer);
      const tx       = await contract.transfer(sendTo, ethers.parseEther(sendAmt));
      toast("Transaction sent — waiting for confirmation…", "info");
      await tx.wait();
      setLastTx(tx.hash);
      toast(`Sent ${sendAmt} OTTER successfully`, "success");
      setSendTo(""); setSendAmt("");
      fetchChain();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      toast(msg.includes("rejected") ? "Transaction cancelled" : "Send failed: " + msg.slice(0, 60), "error");
    }
    setSendBusy(false);
  };

  // ── CLAIM REWARDS ────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!CONTRACT_ADDRESS) { toast("Contract not deployed yet", "error"); return; }
    setClaimBusy(true);
    try {
      const signer   = await getSigner();
      if (!signer) throw new Error("No signer");
      const contract = new ethers.Contract(CONTRACT_ADDRESS, OTTER_ABI, signer);
      const tx       = await contract.claimRewards();
      toast("Claiming rewards…", "info");
      await tx.wait();
      setLastTx(tx.hash);
      toast("Rewards claimed!", "success");
      fetchChain();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      toast(msg.includes("rejected") ? "Cancelled" : "Claim failed", "error");
    }
    setClaimBusy(false);
  };

  // ── COPY ─────────────────────────────────────────────────────────────────
  const copy = (v: string, label: string) => { navigator.clipboard.writeText(v); toast(`${label} copied`, "success"); };

  const tierIndex  = tier ?? 0;
  const nextTier   = tierIndex < 2 ? TIER_DAYS[tierIndex + 1] : null;
  const daysLeft   = nextTier !== null && holdDays !== null ? Math.max(0, nextTier - holdDays) : null;
  const tierPct    = nextTier && holdDays !== null ? Math.min(100, Math.round((holdDays / nextTier) * 100)) : 100;

  // ── NAV TABS ─────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard",   label: "Dashboard",   icon: <Activity size={14} /> },
    { id: "missions",    label: "Missions",    icon: <Zap size={14} /> },
    { id: "memes",       label: "Meme Arena",  icon: <span style={{ fontSize: "13px" }}>🔥</span> },
    { id: "drops",       label: "Drop Hunts",  icon: <span style={{ fontSize: "13px" }}>🎯</span> },
    { id: "onchain",     label: "On-Chain",    icon: <Shield size={14} /> },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy size={14} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.black, color: C.text }}>
      <Navbar />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes tab-slide{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .dapp-tab-active { background: rgba(201,168,76,0.1) !important; color: #C9A84C !important; border-bottom: 1px solid rgba(201,168,76,0.35) !important; }
        .dapp-tab-btn:hover:not(.dapp-tab-active) { background: rgba(201,168,76,0.04) !important; color: #8C7A5C !important; }
        .dapp-tab-btn { flex-shrink: 0; transition: all 0.15s; white-space: nowrap; }
        @media(max-width:640px){
          .dapp-sidebar-top { order: -1; }
          .dapp-tab-btn { min-width: 68px; font-size: 9px !important; padding: 7px 4px !important; gap: 3px !important; }
          .dapp-tab-btn span { display: none; }
          .dapp-tab-icon { display: flex !important; }
        }
      `}</style>

      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* ── PAGE HEADER ── */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <span style={{
              fontFamily: "var(--font-cinzel, serif)",
              fontSize: "20px", fontWeight: 900, letterSpacing: "0.04em", color: C.text,
            }}>OTTER Protocol</span>
            <span style={{
              background: "rgba(0,200,150,0.08)", color: C.green,
              border: "1px solid rgba(0,200,150,0.2)", borderRadius: "3px",
              padding: "2px 10px", fontSize: "10px", fontWeight: 700,
              fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.12em",
            }}>⟦ BETA · SEPOLIA ⟧</span>
          </div>
          <p style={{
            fontFamily: "var(--font-geist-mono)",
            color: "rgba(201,168,76,0.35)", fontSize: "11px", letterSpacing: "0.12em",
          }}>
            ━ א ━ connect wallet · hold $OTTER · earn rewards · climb the ranks ━ ת ━
          </p>
        </div>

        <div className="dapp-layout">

          {/* ── LEFT COLUMN ── */}
          <div>
            {/* Tab nav */}
            <div className="dapp-tabs">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`dapp-tab-btn${tab === t.id ? " dapp-tab-active" : ""}`}
                  style={{
                    flex: 1, padding: "8px 6px", borderRadius: "6px", border: "none",
                    background: tab === t.id ? "rgba(201,168,76,0.1)" : "transparent",
                    color: tab === t.id ? C.gold : C.mutedH,
                    fontSize: "11px", fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                    fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.04em",
                    borderBottom: tab === t.id ? `1px solid rgba(201,168,76,0.3)` : "1px solid transparent",
                  }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* ════ DASHBOARD ════ */}
            {tab === "dashboard" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Season 1 banner */}
                <div className="season-pulse" style={{
                  background: "linear-gradient(135deg, #0D0A04 0%, #080600 100%)",
                  border: "1px solid rgba(201,168,76,0.22)", borderRadius: "8px",
                  padding: "14px 18px", position: "relative", overflow: "hidden",
                  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px",
                }}>
                  {/* Hebrew watermark */}
                  <span style={{
                    position: "absolute", right: "12px",
                    fontFamily: "var(--font-geist-mono)",
                    fontSize: "40px", color: "rgba(201,168,76,0.04)",
                    userSelect: "none", pointerEvents: "none",
                  }}>ש</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "30px", height: "30px", borderRadius: "50%",
                      background: "radial-gradient(circle at 35% 30%, #F4DC8A, #C9A84C 50%, #8B6000)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      boxShadow: "0 0 12px rgba(201,168,76,0.3)",
                    }}>
                      <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "10px", color: "#000", fontWeight: 900 }}>◈</span>
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "var(--font-cinzel, serif)",
                        color: C.gold, fontSize: "12px", fontWeight: 800,
                        letterSpacing: "0.12em",
                      }}>⟦ SEASON I · BETA PHASE ⟧</div>
                      <div style={{
                        fontFamily: "var(--font-geist-mono)",
                        color: C.mutedH, fontSize: "10px", letterSpacing: "0.06em", marginTop: "2px",
                      }}>Top 100 Rafters earn Genesis NFT at mainnet launch</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <div style={{
                      background: "rgba(0,200,150,0.07)", color: C.green,
                      border: "1px solid rgba(0,200,150,0.15)", borderRadius: "3px",
                      padding: "3px 10px", fontSize: "9px", fontWeight: 700,
                      fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.1em",
                    }}>
                      ACTIVE
                    </div>
                    <button onClick={() => setTab("memes")} style={{
                      background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)",
                      color: C.gold, borderRadius: "4px", padding: "4px 10px",
                      fontSize: "10px", fontWeight: 700, cursor: "pointer",
                      fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.08em",
                    }}>
                      MEME ARENA →
                    </button>
                  </div>
                </div>

                {/* Protocol stats strip */}
                <div className="dapp-stat-3">
                  {[
                    { label: "Total Supply", value: supply ?? "—",                         sub: "OTTER minted", glyph: "א" },
                    { label: "Contract",     value: CONTRACT_ADDRESS ? "Verified" : "—",   sub: "Sepolia Testnet", glyph: "ב" },
                    { label: "Tax Rate",     value: "5%",                                  sub: "per transfer", glyph: "ג" },
                  ].map((s) => (
                    <div key={s.label} style={{
                      background: C.card2, border: `1px solid ${C.border}`,
                      borderRadius: "8px", padding: "12px", textAlign: "center",
                      position: "relative", overflow: "hidden",
                    }}>
                      <span style={{
                        position: "absolute", right: "6px", bottom: "2px",
                        fontFamily: "var(--font-geist-mono)", fontSize: "22px",
                        color: "rgba(201,168,76,0.05)", userSelect: "none",
                      }}>{s.glyph}</span>
                      <div style={{
                        fontFamily: "var(--font-geist-mono)",
                        color: C.gold, fontWeight: 800, fontSize: "14px",
                      }}>{s.value}</div>
                      <div style={{
                        fontFamily: "var(--font-cinzel, serif)",
                        color: C.muted, fontSize: "9px", marginTop: "3px",
                        letterSpacing: "0.1em", textTransform: "uppercase",
                      }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Points hero card */}
                <div style={{ background: "linear-gradient(135deg, #0D0D0D 0%, #141008 100%)", border: `1px solid rgba(201,168,76,0.15)`, borderRadius: "16px", padding: "28px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, right: 0, width: "200px", height: "200px", background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                    <div>
                      <div style={{
                        fontFamily: "var(--font-cinzel, serif)",
                        color: C.mutedH, fontSize: "11px", fontWeight: 700,
                        letterSpacing: "0.14em", marginBottom: "8px",
                      }}>◈ OTTER POINTS</div>
                      <div style={{ fontSize: "48px", fontWeight: 900, background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1 }}>
                        {user ? (profile?.referralCount !== undefined ? progress.pts.toLocaleString() : "—") : "—"}
                      </div>
                      <div style={{
                        fontFamily: "var(--font-geist-mono)",
                        color: C.mutedH, fontSize: "11px", marginTop: "6px", letterSpacing: "0.06em",
                      }}>
                        {user ? `${progress.done}/${progress.total} missions · ${progress.pct}% complete` : "sign in to track points"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ background: TIER_BG[tierIndex], border: `1px solid ${TIER_COLORS[tierIndex]}30`, borderRadius: "12px", padding: "12px 20px" }}>
                        <div style={{ color: TIER_COLORS[tierIndex], fontWeight: 800, fontSize: "16px", letterSpacing: "0.06em" }}>{TIER_LABELS[tierIndex]}</div>
                        <div style={{ color: C.muted, fontSize: "11px", marginTop: "2px" }}>Rewards: {TIER_REWARDS[tierIndex]}</div>
                      </div>
                    </div>
                  </div>

                  {/* Tier progress bar */}
                  {walletConnected && nextTier !== null && (
                    <div style={{ marginTop: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ color: C.muted, fontSize: "12px" }}>Progress to {TIER_LABELS[tierIndex + 1]}</span>
                        <span style={{ color: C.gold, fontSize: "12px", fontWeight: 600 }}>{daysLeft} days left</span>
                      </div>
                      <div style={{ height: "6px", background: "#1A1A1A", borderRadius: "3px" }}>
                        <div style={{ height: "100%", width: `${tierPct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldL})`, borderRadius: "3px", transition: "width 0.4s" }} />
                      </div>
                      <div style={{ color: C.muted, fontSize: "11px", marginTop: "4px" }}>{holdDays ?? 0} / {nextTier} days held</div>
                    </div>
                  )}
                </div>

                {/* 4-stat grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                  {[
                    { label: "OTTER Balance",  value: balance ? `${balance}` : "—",                sub: "tokens",       icon: <Zap size={13} color={C.gold} />,   color: C.gold,   glyph: "ז" },
                    { label: "Hold Duration",  value: holdDays !== null ? `${holdDays}d` : "—",    sub: "days held",    icon: <Award size={13} color={C.purple} />, color: C.purple, glyph: "ח" },
                    { label: "Pending Rewards",value: rewards ? `${rewards}` : "—",                sub: "OTTER",        icon: <TrendingUp size={13} color={C.green} />, color: C.green, glyph: "ט" },
                    { label: "Gov. Weight",    value: govWeight ? `${govWeight}` : "—",            sub: "voting power", icon: <Shield size={13} color={C.blue} />, color: C.blue,   glyph: "י" },
                  ].map((s) => (
                    <div key={s.label} style={{
                      background: C.card, border: `1px solid ${C.border}`,
                      borderRadius: "8px", padding: "16px",
                      position: "relative", overflow: "hidden",
                    }}>
                      <span style={{
                        position: "absolute", right: "10px", bottom: "6px",
                        fontFamily: "var(--font-geist-mono)", fontSize: "26px",
                        color: "rgba(201,168,76,0.05)", userSelect: "none",
                      }}>{s.glyph}</span>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{
                          fontFamily: "var(--font-cinzel, serif)",
                          color: C.mutedH, fontSize: "10px", fontWeight: 700,
                          letterSpacing: "0.1em",
                        }}>{s.label.toUpperCase()}</span>
                        {s.icon}
                      </div>
                      <div style={{
                        fontFamily: "var(--font-geist-mono)",
                        fontSize: "22px", fontWeight: 800, color: s.color,
                      }}>{s.value}</div>
                      <div style={{
                        fontFamily: "var(--font-cinzel, serif)",
                        color: C.muted, fontSize: "10px", marginTop: "3px",
                        letterSpacing: "0.08em",
                      }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Refresh + last tx */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={fetchChain} disabled={chainBusy || !walletConnected}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    <RefreshCw size={12} style={{ animation: chainBusy ? "spin 0.8s linear infinite" : "none" }} />
                    Refresh chain data
                  </button>
                  {lastTx && (
                    <a href={`https://sepolia.etherscan.io/tx/${lastTx}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: C.green, fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Check size={12} /> Last tx <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {/* Contract info */}
                {CONTRACT_ADDRESS && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ color: C.muted, fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em" }}>CONTRACT</span>
                      <span style={{ background: "rgba(0,200,150,0.08)", color: C.green, border: "1px solid rgba(0,200,150,0.2)", borderRadius: "20px", padding: "2px 8px", fontSize: "10px", fontWeight: 700 }}>LIVE · SEPOLIA</span>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "12px", color: C.text, wordBreak: "break-all", background: "#080808", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
                      {CONTRACT_ADDRESS}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => copy(CONTRACT_ADDRESS, "Contract address")}
                        style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: "8px", padding: "8px", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontWeight: 600 }}>
                        <Copy size={11} /> Copy
                      </button>
                      <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}#code`} target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: "8px", padding: "8px", fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontWeight: 600 }}>
                        <ExternalLink size={11} /> Etherscan
                      </a>
                      <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}#readContract`} target="_blank" rel="noopener noreferrer"
                        style={{ flex: 1, background: "rgba(201,168,76,0.06)", border: `1px solid rgba(201,168,76,0.15)`, color: C.gold, borderRadius: "8px", padding: "8px", fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontWeight: 600 }}>
                        <BarChart2 size={11} /> Read
                      </a>
                    </div>
                    {supply && (
                      <div style={{ marginTop: "10px", padding: "8px 12px", background: "#080808", borderRadius: "8px", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: C.muted, fontSize: "12px" }}>Total Supply</span>
                        <span style={{ color: C.text, fontSize: "12px", fontWeight: 700 }}>{supply} OTTER</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Sign in CTA */}
                {!user && (
                  <div style={{ background: "rgba(201,168,76,0.04)", border: `1px solid rgba(201,168,76,0.12)`, borderRadius: "12px", padding: "20px", textAlign: "center" }}>
                    <div style={{ fontWeight: 700, marginBottom: "6px" }}>Join the Raft</div>
                    <div style={{ color: C.muted, fontSize: "13px", marginBottom: "14px" }}>Sign in to track missions, earn points, and claim your Rafter position.</div>
                    <button onClick={openAuthModal}
                      style={{ background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "10px 24px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                      Sign In / Register
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ════ MISSIONS ════ */}
            {tab === "missions" && (
              <div>
                {user
                  ? <MissionBoard
                      uid={user.uid}
                      walletAddress={walletAddr}
                      referralCount={profile?.referralCount}
                      isOnSepolia={walletCorrectNet}
                    />
                  : <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "40px", textAlign: "center" }}>
                      <Zap size={32} color={C.gold} style={{ marginBottom: "12px" }} />
                      <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>Sign in to access missions</div>
                      <div style={{ color: C.muted, fontSize: "13px", marginBottom: "20px" }}>Complete missions to earn points and climb the leaderboard.</div>
                      <button onClick={openAuthModal} style={{ background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>
                        Get Started
                      </button>
                    </div>
                }
              </div>
            )}

            {/* ════ MEME ARENA ════ */}
            {tab === "memes" && (
              <MemeArena
                uid={user?.uid}
                walletAddress={walletAddr}
                isConnected={walletConnected}
                isCorrectNetwork={walletCorrectNet}
                getProvider={getProvider}
                getSigner={getSigner}
                contractAddress={CONTRACT_ADDRESS}
              />
            )}

            {/* ════ DROP HUNTS ════ */}
            {tab === "drops" && (
              <DropHunt uid={user?.uid} walletAddress={walletAddr} />
            )}

            {/* ════ ON-CHAIN ════ */}
            {tab === "onchain" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {!walletConnected && (
                  <div style={{ background: "rgba(201,168,76,0.04)", border: `1px solid rgba(201,168,76,0.12)`, borderRadius: "12px", padding: "20px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <AlertTriangle size={18} color={C.orange} style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "2px" }}>Connect your wallet</div>
                      <div style={{ color: C.muted, fontSize: "13px" }}>Use the panel on the right to connect MetaMask, WalletConnect, or any EVM wallet.</div>
                    </div>
                  </div>
                )}

                {/* Send OTTER */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Zap size={16} color={C.gold} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "15px" }}>Send OTTER</div>
                      <div style={{ color: C.muted, fontSize: "12px" }}>Transfer tokens on Sepolia testnet</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="Recipient address (0x…)"
                      style={{ background: "#080808", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "12px 14px", color: C.text, fontSize: "13px", fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: "10px" }}>
                      <input value={sendAmt} onChange={(e) => setSendAmt(e.target.value)} placeholder="Amount"
                        style={{ flex: 1, background: "#080808", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "12px 14px", color: C.text, fontSize: "13px", outline: "none" }} />
                      <button onClick={handleSend} disabled={sendBusy || !walletConnected || !walletCorrectNet}
                        style={{ background: walletConnected && walletCorrectNet ? "linear-gradient(135deg,#C9A84C,#E2BF6E)" : "#1A1A1A", color: walletConnected && walletCorrectNet ? "#000" : C.muted, border: "none", borderRadius: "8px", padding: "12px 20px", fontWeight: 700, fontSize: "13px", cursor: sendBusy || !walletConnected ? "not-allowed" : "pointer", opacity: sendBusy ? 0.7 : 1, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
                        {sendBusy ? <><Spin />Sending…</> : <>Send <ArrowRight size={13} /></>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Claim Rewards */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <TrendingUp size={16} color={C.green} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "15px" }}>Claim Rewards</div>
                        <div style={{ color: C.muted, fontSize: "12px" }}>
                          Available: <strong style={{ color: C.green }}>{rewards ?? "—"} OTTER</strong>
                        </div>
                      </div>
                    </div>
                    <button onClick={handleClaim} disabled={claimBusy || !walletConnected || !walletCorrectNet || !rewards || rewards === "0.0000"}
                      style={{ background: "rgba(0,200,150,0.1)", color: C.green, border: "1px solid rgba(0,200,150,0.2)", borderRadius: "8px", padding: "10px 18px", fontWeight: 700, fontSize: "13px", cursor: claimBusy || !walletConnected ? "not-allowed" : "pointer", opacity: claimBusy ? 0.7 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                      {claimBusy ? <><Spin />Claiming…</> : "Claim"}
                    </button>
                  </div>
                </div>

                {/* Last transaction */}
                {lastTx && (
                  <div style={{ background: "rgba(0,200,150,0.03)", border: "1px solid rgba(0,200,150,0.12)", borderRadius: "12px", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Check size={14} color={C.green} />
                      <span style={{ color: C.green, fontSize: "13px", fontWeight: 600 }}>Transaction confirmed</span>
                    </div>
                    <a href={`https://sepolia.etherscan.io/tx/${lastTx}`} target="_blank" rel="noopener noreferrer"
                      style={{ color: C.muted, fontSize: "12px", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                      {lastTx.slice(0, 8)}…{lastTx.slice(-6)} <ExternalLink size={11} />
                    </a>
                  </div>
                )}

                {/* Tier table */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
                  <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Award size={16} color={C.gold} /> Tier System
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {TIER_LABELS.map((label, i) => (
                      <div key={label} style={{ background: i === tierIndex && walletConnected ? TIER_BG[i] : "#0A0A0A", border: `1px solid ${i === tierIndex && walletConnected ? TIER_COLORS[i] + "30" : C.border}`, borderRadius: "10px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {i === tierIndex && walletConnected && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: TIER_COLORS[i], flexShrink: 0 }} />}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "13px", color: TIER_COLORS[i] }}>{label}</div>
                            <div style={{ color: C.muted, fontSize: "11px" }}>{TIER_DAYS[i] === 0 ? "Instant" : `Hold ${TIER_DAYS[i]}+ days`}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: TIER_COLORS[i], fontWeight: 700, fontSize: "13px" }}>{TIER_REWARDS[i]}</div>
                          <div style={{ color: C.muted, fontSize: "11px" }}>rewards</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════ LEADERBOARD ════ */}
            {tab === "leaderboard" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Trophy size={16} color={C.gold} />
                      <span style={{
                        fontFamily: "var(--font-cinzel, serif)",
                        fontWeight: 700, fontSize: "15px", letterSpacing: "0.06em", color: C.text,
                      }}>Raft Leaderboard</span>
                    </div>
                    <span style={{
                      fontFamily: "var(--font-geist-mono)",
                      color: "rgba(201,168,76,0.35)", fontSize: "10px", letterSpacing: "0.14em",
                    }}>◈ TOP 10 RAFTERS</span>
                  </div>

                  {/* Header row */}
                  <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 70px 80px", gap: "8px", padding: "0 12px 10px", borderBottom: `1px solid ${C.border}` }}>
                    {["#", "Rafter", "Points", "Refs", "Tier"].map((h) => (
                      <div key={h} style={{ color: C.muted, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em" }}>{h}</div>
                    ))}
                  </div>

                  {/* Rows */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {leaders.length === 0 && (
                      <div style={{ textAlign: "center", color: C.muted, padding: "32px", fontSize: "13px" }}>
                        No rafters yet — be the first to earn points!
                      </div>
                    )}
                    {leaders.map((r, i) => {
                      const isMe = profile?.displayName === r.name;
                      const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 70px 80px", gap: "8px", padding: "12px", borderRadius: "8px", background: isMe ? "rgba(201,168,76,0.04)" : "transparent", borderBottom: i < leaders.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
                          <div style={{ fontWeight: 800, fontSize: "14px", color: i < 3 ? rankColors[i] : C.muted }}>
                            {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${r.rank}`}
                          </div>
                          <div style={{ fontWeight: isMe ? 700 : 500, fontSize: "13px", color: isMe ? C.gold : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.name} {isMe && <span style={{ color: C.gold, fontSize: "10px" }}>(you)</span>}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "13px", color: C.gold }}>{r.points.toLocaleString()}</div>
                          <div style={{ color: C.muted, fontSize: "13px" }}>{r.referrals}</div>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: r.tier === "OG" ? C.gold : r.tier === "MEMBER" ? C.purple : C.muted }}>{r.tier}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Your position if not in top 10 */}
                  {user && !leaders.some((r) => r.name === profile?.displayName) && (
                    <div style={{ borderTop: `1px solid ${C.border}`, marginTop: "8px", paddingTop: "12px", padding: "12px", background: "rgba(201,168,76,0.03)", borderRadius: "0 0 10px 10px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 70px 80px", gap: "8px", alignItems: "center" }}>
                        <div style={{ color: C.muted, fontSize: "13px" }}>—</div>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: C.gold }}>{profile?.displayName ?? "You"} <span style={{ fontSize: "10px" }}>(you)</span></div>
                        <div style={{ fontWeight: 700, fontSize: "13px", color: C.gold }}>{progress.pts.toLocaleString()}</div>
                        <div style={{ color: C.muted, fontSize: "13px" }}>{profile?.referralCount ?? 0}</div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: C.muted }}>{profile?.tier ?? "NEWCOMER"}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Activity Feed */}
                <ActivityFeed />

                {/* Referral CTA */}
                {user && profile && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px" }}>
                    <div style={{ fontWeight: 700, marginBottom: "4px" }}>Your Referral Link</div>
                    <div style={{ color: C.muted, fontSize: "12px", marginBottom: "14px" }}>Each referral earns you points and moves you up the leaderboard.</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div style={{ flex: 1, background: "#080808", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 12px", fontFamily: "monospace", fontSize: "12px", color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {`${process.env.NEXT_PUBLIC_APP_URL || "https://otterprotocol.xyz"}/?ref=${profile.referralCode}`}
                      </div>
                      <button onClick={() => copy(`${process.env.NEXT_PUBLIC_APP_URL || "https://otterprotocol.xyz"}/?ref=${profile.referralCode}`, "Referral link")}
                        style={{ background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", color: "#000", border: "none", borderRadius: "8px", padding: "10px 16px", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}>
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Wallet */}
            <WalletConnect />

            {/* Rafter # */}
            {user && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px", textAlign: "center" }}>
                <div style={{
                  fontFamily: "var(--font-cinzel, serif)",
                  color: "rgba(201,168,76,0.4)", fontSize: "9px",
                  letterSpacing: "0.18em", marginBottom: "6px",
                }}>◈ YOUR POSITION</div>
                <div style={{ fontSize: "32px", fontWeight: 900, background: `linear-gradient(135deg,${C.gold},${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1 }}>
                  Rafter #{String(leaders.findIndex((r) => r.name === profile?.displayName) + 1 || "?").padStart(3, "0")}
                </div>
                <div style={{ color: C.muted, fontSize: "12px", marginTop: "4px" }}>{leaders.length} total rafters</div>
              </div>
            )}

            {/* Quick stats */}
            {user && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "20px" }}>
                <div style={{
                  fontFamily: "var(--font-cinzel, serif)",
                  color: "rgba(201,168,76,0.4)", fontSize: "9px",
                  letterSpacing: "0.18em", marginBottom: "12px",
                }}>◈ QUICK STATS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[
                    { label: "Missions",    value: `${progress.done}/${progress.total}`, color: C.gold },
                    { label: "Points",      value: progress.pts.toLocaleString(),        color: C.gold },
                    { label: "Referrals",   value: String(profile?.referralCount ?? 0),  color: C.green },
                    { label: "Tier",        value: profile?.tier ?? "NEWCOMER",          color: C.purple },
                  ].map((s) => (
                    <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: C.muted, fontSize: "12px" }}>{s.label}</span>
                      <span style={{ color: s.color, fontWeight: 700, fontSize: "13px" }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* X share */}
            {user && (
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I'm Rafter #${leaders.findIndex((r) => r.name === profile?.displayName) + 1 || "?"} on OTTER Protocol 🦦\n\nHold Together. Build Together.\n\nJoin the Raft 👇`)}&url=${encodeURIComponent((process.env.NEXT_PUBLIC_APP_URL || "https://otterprotocol.xyz") + "/?ref=" + (profile?.referralCode || ""))}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "#080808", border: `1px solid ${C.border}`, color: C.text, borderRadius: "12px", padding: "14px", textDecoration: "none", fontWeight: 700, fontSize: "13px" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gold)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
                <span style={{ fontWeight: 900 }}>𝕏</span> Share on X
              </a>
            )}

            {/* Missions quick access */}
            {user && tab !== "missions" && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>Missions</span>
                  <button onClick={() => setTab("missions")} style={{ background: "none", border: "none", color: C.gold, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", fontWeight: 600 }}>
                    View all <ChevronRight size={12} />
                  </button>
                </div>
                <div style={{ height: "5px", background: "#1A1A1A", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress.pct}%`, background: `linear-gradient(90deg,${C.gold},${C.goldL})`, borderRadius: "3px" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                  <span style={{ color: C.muted, fontSize: "11px" }}>{progress.pct}% complete</span>
                  <span style={{ color: C.gold, fontSize: "11px", fontWeight: 600 }}>{progress.pts.toLocaleString()} pts</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Spin() {
  return <span style={{ width: "12px", height: "12px", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: C.gold, borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}
