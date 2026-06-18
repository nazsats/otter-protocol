"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useWallet } from "@/hooks/useWallet";
import { getUserInitiation, calcInitiationProgress, getTierFromWeight, TIERS } from "@/lib/initiation";
import { getUserMissions } from "@/lib/missions";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  updateProfile, updateEmail, EmailAuthProvider,
  reauthenticateWithCredential, linkWithPopup,
} from "firebase/auth";
import { auth, twitterProvider, googleProvider } from "@/lib/firebase";
import {
  User, Wallet, Mail, Shield, Copy, Check,
  ExternalLink, Edit2, Save, X, AlertTriangle,
  LogOut, RefreshCw, ChevronRight,
} from "lucide-react";

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#000000", card: "#0D0B07", card2: "#0A0800",
  border: "#1E1A10", borderH: "#2A2310",
  gold: "#C9A84C", goldL: "#E2BF6E",
  text: "#E8DFC8", muted: "#8C7A5C", mutedL: "#5C4A2A",
  green: "#00C896", red: "#FF5B5B", amber: "#F5A623",
  purple: "#A78BFA", blue: "#60A5FA",
};
const FONT = "var(--font-cinzel, Georgia, serif)";
const MONO = "var(--font-geist-mono, monospace)";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function fmtDate(ts: number | { seconds: number } | null | undefined) {
  if (!ts) return "—";
  const ms = typeof ts === "number" ? ts : ts.seconds * 1000;
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: "12px", overflow: "hidden", ...style,
    }}>
      {children}
    </div>
  );
}
function CardHeader({ glyph, title, action }: { glyph: string; title: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 20px", borderBottom: `1px solid ${C.border}`,
      background: "rgba(201,168,76,0.02)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: MONO, color: C.gold, fontSize: "14px" }}>{glyph}</span>
        <span style={{ fontFamily: FONT, fontSize: "11px", fontWeight: 700, color: C.text, letterSpacing: "0.14em" }}>
          {title}
        </span>
      </div>
      {action}
    </div>
  );
}
function Row({ label, value, valueColor, mono, action }: {
  label: string; value: React.ReactNode; valueColor?: string; mono?: boolean; action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 20px", borderBottom: `1px solid ${C.border}`,
      gap: "12px",
    }}>
      <span style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL, letterSpacing: "0.14em", flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <span style={{
          fontFamily: mono ? MONO : FONT,
          fontSize: mono ? "11px" : "12px",
          color: valueColor ?? C.text,
          fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: copied ? C.green : C.mutedL, display: "flex" }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}
function ConnectBadge({ connected, label }: { connected: boolean; label: string }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em",
      padding: "2px 8px", borderRadius: "3px",
      color: connected ? C.green : C.amber,
      background: connected ? "rgba(0,200,150,0.08)" : "rgba(245,166,35,0.08)",
      border: `1px solid ${connected ? "rgba(0,200,150,0.2)" : "rgba(245,166,35,0.2)"}`,
    }}>
      {connected ? "CONNECTED" : label}
    </span>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, profile, logout, refreshProfile, openAuthModal, bindWallet, changeWallet } = useAuth();
  const toast  = useToast();
  const wallet = useWallet();
  const router = useRouter();

  // Edit name state
  const [editName, setEditName]     = useState(false);
  const [nameVal,  setNameVal]      = useState("");
  const [nameBusy, setNameBusy]     = useState(false);

  // Edit discord/telegram state
  const [editSocials, setEditSocials] = useState(false);
  const [discordVal,  setDiscordVal]  = useState("");
  const [telegramVal, setTelegramVal] = useState("");
  const [socialBusy,  setSocialBusy]  = useState(false);

  // Extra profile data from Firestore
  const [extra, setExtra] = useState<{
    discordHandle?: string;
    telegramHandle?: string;
    discordVerified?: boolean;
    discordUsername?: string;
    discordId?: string;
    telegramVerified?: boolean;
    telegramUsername?: string;
    telegramId?: string;
    signalWeight?: number;
    createdAt?: number | { seconds: number };
  } | null>(null);

  // Unlink a verified social so a different account can be re-verified.
  // Does NOT refund signal — the task stays completed.
  const [unlinkBusy, setUnlinkBusy] = useState<"discord" | "telegram" | null>(null);
  const unlinkSocial = async (which: "discord" | "telegram") => {
    if (!user) return;
    setUnlinkBusy(which);
    try {
      const clear = which === "discord"
        ? { discordVerified: false, discordUsername: null, discordId: null }
        : { telegramVerified: false, telegramUsername: null, telegramId: null };
      await setDoc(doc(db, "users", user.uid), { ...clear, updatedAt: serverTimestamp() }, { merge: true });
      await loadExtra();
      toast(`${which === "discord" ? "Discord" : "Telegram"} unlinked — you can link a different account now`, "success");
    } catch {
      toast("Failed to unlink", "error");
    }
    setUnlinkBusy(null);
  };

  // Stats
  const [initiationDone, setInitiationDone] = useState(0);
  const [missionsDone,   setMissionsDone]   = useState(0);
  const [loading,        setLoading]         = useState(true);

  const loadExtra = useCallback(async () => {
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) setExtra(snap.data() as typeof extra);
    setLoading(false);
  }, [user]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const [ini, missions] = await Promise.all([
      getUserInitiation(user.uid),
      getUserMissions(user.uid),
    ]);
    setInitiationDone(calcInitiationProgress(ini).done);
    setMissionsDone(Object.keys(missions).length);
  }, [user]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadExtra();
    loadStats();
  }, [user, loadExtra, loadStats]);

  // Redirect to home if not signed in
  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  // ── Derived ──
  const signal    = extra?.signalWeight ?? (profile as { signalWeight?: number })?.signalWeight ?? 0;
  const tierName  = getTierFromWeight(signal);
  const tierMeta  = TIERS[tierName];
  const providers = user?.providerData?.map((p) => p.providerId) ?? [];
  const hasTwitter = providers.includes("twitter.com");
  const hasGoogle  = providers.includes("google.com");
  const hasEmail   = providers.includes("password");

  // ── Save display name ──
  const saveName = async () => {
    if (!user || !nameVal.trim()) return;
    setNameBusy(true);
    try {
      await updateProfile(user, { displayName: nameVal.trim() });
      await updateDoc(doc(db, "users", user.uid), { displayName: nameVal.trim() });
      await refreshProfile();
      toast("Name updated", "success");
      setEditName(false);
    } catch {
      toast("Failed to update name", "error");
    }
    setNameBusy(false);
  };

  // ── Save socials ──
  const saveSocials = async () => {
    if (!user) return;
    setSocialBusy(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        discordHandle:  discordVal.trim().replace(/^@/, "") || null,
        telegramHandle: telegramVal.trim().replace(/^@/, "") || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await loadExtra();
      toast("Socials saved", "success");
      setEditSocials(false);
    } catch {
      toast("Failed to save", "error");
    }
    setSocialBusy(false);
  };

  // ── Link Twitter ──
  const linkTwitter = async () => {
    if (!user) return;
    try {
      await linkWithPopup(user, twitterProvider);
      await refreshProfile();
      toast("Twitter connected", "success");
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "auth/credential-already-in-use") {
        toast("This Twitter account is already linked to another user", "error");
      } else if (err.code === "auth/provider-already-linked") {
        toast("Twitter already linked to this account", "info");
      } else {
        toast("Failed to connect Twitter", "error");
      }
    }
  };

  // ── Link Google ──
  const linkGoogle = async () => {
    if (!user) return;
    try {
      await linkWithPopup(user, googleProvider);
      await refreshProfile();
      toast("Google connected", "success");
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code === "auth/provider-already-linked") {
        toast("Google already linked", "info");
      } else {
        toast("Failed to connect Google", "error");
      }
    }
  };

  // ── Wallet binding ──
  // Confirmation gate for changing an already-bound wallet (destructive: the old
  // wallet stops being the eligible one).
  const [confirmChange, setConfirmChange] = useState(false);
  const [walletBusy,    setWalletBusy]    = useState(false);

  // Bind the connected wallet for the first time (no wallet bound yet).
  const handleBindWallet = async () => {
    if (!wallet.isConnected || !wallet.address) {
      toast("Open your wallet from the navbar and connect first", "info");
      return;
    }
    if (!user) return;
    setWalletBusy(true);
    try {
      const result = await bindWallet(wallet.address);
      if (result === "bound")   { await loadExtra(); toast("Wallet bound to your account", "success"); }
      else if (result === "already") toast("This wallet is already your bound wallet", "info");
      else toast("A different wallet is already bound — use Change wallet", "error");
    } catch {
      toast("Failed to bind wallet", "error");
    }
    setWalletBusy(false);
  };

  // Explicitly rebind to the currently-connected wallet (after confirm).
  const handleChangeWallet = async () => {
    if (!wallet.isConnected || !wallet.address) {
      toast("Connect the new wallet first", "info");
      return;
    }
    if (!user) return;
    setWalletBusy(true);
    try {
      await changeWallet(wallet.address);
      await loadExtra();
      toast("Bound wallet changed", "success");
      setConfirmChange(false);
    } catch {
      toast("Failed to change wallet", "error");
    }
    setWalletBusy(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: MONO, color: C.gold, fontSize: "11px", letterSpacing: "0.2em" }}>LOADING PROFILE…</div>
      </div>
    );
  }

  if (!user) return null;

  const savedWallet = (profile as { walletAddress?: string })?.walletAddress;
  // Wallet binding state for the UI.
  const activeWallet    = wallet.address ?? null;
  const walletMatches   = !!savedWallet && !!activeWallet && savedWallet.toLowerCase() === activeWallet.toLowerCase();
  const walletMismatch  = !!savedWallet && !!activeWallet && !walletMatches;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      <Navbar />

      <style>{`
        .profile-grid { display: grid; grid-template-columns: 300px 1fr; gap: 24px; align-items: start; }
        @media(max-width: 900px) { .profile-grid { grid-template-columns: 1fr !important; } }
        .inp { background: #050400; border: 1px solid ${C.border}; border-radius: 8px; padding: 9px 14px; color: ${C.text}; font-family: ${FONT}; font-size: 12px; outline: none; width: 100%; letter-spacing: 0.04em; }
        .inp:focus { border-color: ${C.gold}; }
        @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ paddingTop: "88px", maxWidth: "1100px", margin: "0 auto", padding: "88px 24px 80px" }}>

        {/* ── PAGE HEADER ── */}
        <div style={{ marginBottom: "32px", animation: "fade-in 0.3s ease-out" }}>
          <div style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL, letterSpacing: "0.2em", marginBottom: "6px" }}>
            ◈ OTTER PROTOCOL // PROFILE ARCHIVE
          </div>
          <h1 style={{ fontFamily: FONT, fontSize: "22px", fontWeight: 900, letterSpacing: "0.06em", color: C.text }}>
            {user.displayName || "Anonymous Otter"}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: FONT, fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em",
              color: tierMeta.color, background: tierMeta.bg, border: `1px solid ${tierMeta.color}30`,
              padding: "3px 12px", borderRadius: "3px",
            }}>
              {tierMeta.glyph} {tierName}
            </span>
            <span style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL }}>
              {signal.toLocaleString()} SIGNAL WEIGHT
            </span>
            <span style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL }}>
              JOINED {fmtDate(extra?.createdAt as number)}
            </span>
          </div>
        </div>

        <div className="profile-grid">

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Avatar / tier */}
            <Card>
              <div style={{
                padding: "32px 20px", textAlign: "center",
                background: `radial-gradient(ellipse at 50% 0%, ${tierMeta.color}08, transparent 70%)`,
              }}>
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  margin: "0 auto 16px",
                  background: `linear-gradient(135deg, ${tierMeta.color}20, ${tierMeta.color}08)`,
                  border: `2px solid ${tierMeta.color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "32px",
                }}>
                  {user.photoURL
                    ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    : <span style={{ fontFamily: MONO, color: tierMeta.color, fontSize: "28px" }}>{tierMeta.glyph}</span>
                  }
                </div>

                {/* Name edit */}
                {editName ? (
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                    <input
                      className="inp"
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveName()}
                      autoFocus
                    />
                    <button onClick={saveName} disabled={nameBusy} style={{ background: C.gold, border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: "#000", display: "flex" }}>
                      {nameBusy ? "…" : <Save size={12} />}
                    </button>
                    <button onClick={() => setEditName(false)} style={{ background: C.border, border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", color: C.muted, display: "flex" }}>
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "6px" }}>
                    <span style={{ fontFamily: FONT, fontSize: "15px", fontWeight: 700, color: C.text, letterSpacing: "0.04em" }}>
                      {user.displayName || "Set your name"}
                    </span>
                    <button onClick={() => { setEditName(true); setNameVal(user.displayName || ""); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedL, padding: "2px", display: "flex" }}>
                      <Edit2 size={11} />
                    </button>
                  </div>
                )}

                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL, letterSpacing: "0.12em", marginBottom: "12px" }}>
                  {user.email || profile?.email || "—"}
                </div>

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{
                    fontFamily: FONT, fontSize: "10px", fontWeight: 700,
                    color: tierMeta.color, background: tierMeta.bg,
                    border: `1px solid ${tierMeta.color}30`,
                    padding: "4px 14px", borderRadius: "3px", letterSpacing: "0.12em",
                  }}>
                    {tierMeta.glyph} {tierName}
                  </span>
                </div>
              </div>

              {/* Quick stats */}
              {[
                { label: "SIGNAL WEIGHT", value: signal.toLocaleString(), color: tierMeta.color },
                { label: "TASKS DONE",    value: `${initiationDone} tasks`, color: C.text },
                { label: "MISSIONS",      value: `${missionsDone} done`,    color: C.text },
                { label: "REFERRAL CODE", value: (profile as { referralCode?: string })?.referralCode || "—", color: C.gold, copy: true },
              ].map((s) => (
                <div key={s.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 20px", borderTop: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontFamily: MONO, fontSize: "8px", color: C.mutedL, letterSpacing: "0.14em" }}>{s.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: s.color, fontWeight: 700 }}>{s.value}</span>
                    {s.copy && s.value !== "—" && <CopyBtn text={s.value} />}
                  </div>
                </div>
              ))}
            </Card>

            {/* Logout */}
            <button
              onClick={() => { logout(); router.push("/"); }}
              style={{
                width: "100%", background: "transparent",
                border: `1px solid ${C.border}`, borderRadius: "10px",
                padding: "12px", cursor: "pointer",
                fontFamily: FONT, fontSize: "11px", fontWeight: 700,
                color: C.red, letterSpacing: "0.12em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.red)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
            >
              <LogOut size={13} /> SIGN OUT
            </button>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── CONNECTED ACCOUNTS ── */}
            <Card>
              <CardHeader glyph="◈" title="CONNECTED ACCOUNTS" />

              {/* Twitter / X */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#000", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: C.text, fontWeight: 900, fontSize: "14px" }}>𝕏</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 700, letterSpacing: "0.04em" }}>X / Twitter</div>
                    <div style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL, marginTop: "2px" }}>
                      {hasTwitter
                        ? (user.providerData.find(p => p.providerId === "twitter.com")?.displayName ?? "Connected")
                        : "Not connected"
                      }
                    </div>
                  </div>
                </div>
                {hasTwitter
                  ? <ConnectBadge connected={true} label="" />
                  : <button onClick={linkTwitter} style={{ fontFamily: FONT, fontSize: "9px", fontWeight: 700, color: C.text, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 14px", cursor: "pointer", letterSpacing: "0.1em" }}>
                      CONNECT →
                    </button>
                }
              </div>

              {/* Google */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#0D0B07", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "16px" }}>G</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 700, letterSpacing: "0.04em" }}>Google</div>
                    <div style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL, marginTop: "2px" }}>
                      {hasGoogle
                        ? (user.providerData.find(p => p.providerId === "google.com")?.email ?? "Connected")
                        : "Not connected"
                      }
                    </div>
                  </div>
                </div>
                {hasGoogle
                  ? <ConnectBadge connected={true} label="" />
                  : <button onClick={linkGoogle} style={{ fontFamily: FONT, fontSize: "9px", fontWeight: 700, color: C.text, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "6px", padding: "6px 14px", cursor: "pointer", letterSpacing: "0.1em" }}>
                      CONNECT →
                    </button>
                }
              </div>

              {/* Email */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#0D0B07", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Mail size={15} color={C.mutedL} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 700, letterSpacing: "0.04em" }}>Email</div>
                    <div style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL, marginTop: "2px" }}>
                      {user.email || "Not set"}
                    </div>
                  </div>
                </div>
                <ConnectBadge connected={!!user.email} label="NOT SET" />
              </div>
            </Card>

            {/* ── WALLET ── */}
            <Card>
              <CardHeader glyph="⬡" title="ELIGIBLE WALLET" action={
                !savedWallet ? (
                  <button onClick={handleBindWallet} disabled={walletBusy} style={{ fontFamily: MONO, fontSize: "8px", color: C.gold, background: "transparent", border: `1px solid rgba(201,168,76,0.3)`, borderRadius: "4px", padding: "4px 10px", cursor: walletBusy ? "wait" : "pointer", letterSpacing: "0.1em" }}>
                    {walletBusy ? "…" : "LINK WALLET"}
                  </button>
                ) : walletMismatch ? (
                  <button onClick={() => setConfirmChange(true)} style={{ fontFamily: MONO, fontSize: "8px", color: C.amber, background: "transparent", border: `1px solid rgba(245,166,35,0.4)`, borderRadius: "4px", padding: "4px 10px", cursor: "pointer", letterSpacing: "0.1em" }}>
                    CHANGE WALLET
                  </button>
                ) : null
              } />

              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: savedWallet ? "rgba(201,168,76,0.06)" : "#0D0B07", border: `1px solid ${savedWallet ? "rgba(201,168,76,0.2)" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Wallet size={15} color={savedWallet ? C.gold : C.mutedL} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 700, letterSpacing: "0.04em" }}>Bound EVM Wallet</div>
                    <div style={{ fontFamily: MONO, fontSize: "9px", color: savedWallet ? C.gold : C.mutedL, marginTop: "2px" }}>
                      {savedWallet ? shortAddr(savedWallet) : "Not linked — connect a wallet to bind it"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {savedWallet && <CopyBtn text={savedWallet} />}
                  {savedWallet && (
                    <a href={`https://etherscan.io/address/${savedWallet}`} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, display: "flex" }}>
                      <ExternalLink size={11} />
                    </a>
                  )}
                  <ConnectBadge connected={walletMatches} label={savedWallet ? "NOT ACTIVE" : "NOT LINKED"} />
                </div>
              </div>

              {/* Wrong wallet connected */}
              {walletMismatch && !confirmChange && (
                <div style={{ padding: "12px 20px", background: "rgba(245,166,35,0.05)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <AlertTriangle size={13} color={C.amber} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span style={{ fontFamily: MONO, fontSize: "9px", color: C.amber, letterSpacing: "0.04em", lineHeight: 1.6 }}>
                    Wrong wallet connected ({shortAddr(activeWallet!)}). Only your bound wallet
                    {" "}{shortAddr(savedWallet!)} earns points. Switch back to it, or press
                    {" "}CHANGE WALLET to make {shortAddr(activeWallet!)} your eligible wallet.
                  </span>
                </div>
              )}

              {/* Confirm change */}
              {confirmChange && (
                <div style={{ padding: "14px 20px", background: "rgba(245,166,35,0.06)", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontFamily: MONO, fontSize: "9px", color: C.amber, letterSpacing: "0.04em", lineHeight: 1.6, marginBottom: "10px" }}>
                    Change your eligible wallet to {activeWallet ? shortAddr(activeWallet) : "the connected wallet"}?
                    Your old wallet {savedWallet ? shortAddr(savedWallet) : ""} will stop earning points.
                    Existing points stay with your account.
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={handleChangeWallet} disabled={walletBusy || !activeWallet} style={{ fontFamily: MONO, fontSize: "8px", color: "#000", background: C.amber, border: "none", borderRadius: "4px", padding: "6px 12px", cursor: walletBusy ? "wait" : "pointer", letterSpacing: "0.1em" }}>
                      {walletBusy ? "…" : "CONFIRM CHANGE"}
                    </button>
                    <button onClick={() => setConfirmChange(false)} style={{ fontFamily: MONO, fontSize: "8px", color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "4px", padding: "6px 12px", cursor: "pointer", letterSpacing: "0.1em" }}>
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {/* First-time bind hint */}
              {!savedWallet && wallet.isConnected && wallet.address && (
                <div style={{ padding: "12px 20px", background: "rgba(0,200,150,0.04)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Wallet size={12} color={C.green} />
                  <span style={{ fontFamily: MONO, fontSize: "9px", color: C.green, letterSpacing: "0.04em" }}>
                    {shortAddr(wallet.address)} connected — click LINK WALLET to bind it to your account.
                  </span>
                </div>
              )}

              <div style={{ padding: "12px 20px" }}>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.mutedL, letterSpacing: "0.1em" }}>
                  Network: <span style={{ color: wallet.isCorrectNetwork ? C.green : C.amber }}>
                    {wallet.isConnected ? (wallet.isCorrectNetwork ? "SEPOLIA ✓" : "WRONG NETWORK") : "NOT CONNECTED"}
                  </span>
                </div>
              </div>
            </Card>

            {/* ── DISCORD & TELEGRAM ── */}
            <Card>
              <CardHeader glyph="◆" title="COMMUNITY HANDLES" action={
                !editSocials
                  ? <button onClick={() => { setEditSocials(true); setDiscordVal(extra?.discordHandle || ""); setTelegramVal(extra?.telegramHandle || ""); }}
                      style={{ fontFamily: MONO, fontSize: "8px", color: C.gold, background: "transparent", border: `1px solid rgba(201,168,76,0.3)`, borderRadius: "4px", padding: "4px 10px", cursor: "pointer", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "5px" }}>
                      <Edit2 size={9} /> EDIT
                    </button>
                  : <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={saveSocials} disabled={socialBusy} style={{ fontFamily: MONO, fontSize: "8px", color: "#000", background: C.gold, border: "none", borderRadius: "4px", padding: "4px 10px", cursor: "pointer", letterSpacing: "0.1em" }}>
                        {socialBusy ? "…" : "SAVE"}
                      </button>
                      <button onClick={() => setEditSocials(false)} style={{ fontFamily: MONO, fontSize: "8px", color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: "4px", padding: "4px 10px", cursor: "pointer" }}>
                        CANCEL
                      </button>
                    </div>
              } />

              {/* Discord */}
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(88,101,242,0.1)", border: "1px solid rgba(88,101,242,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "14px" }}>💬</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 700, letterSpacing: "0.04em" }}>Discord</div>
                    {extra?.discordVerified
                      ? <div style={{ fontFamily: MONO, fontSize: "9px", color: C.green, marginTop: "2px" }}>
                          🔒 Verified{extra.discordUsername ? ` as ${extra.discordUsername}` : ""} — locked
                        </div>
                      : editSocials
                        ? <input className="inp" value={discordVal} onChange={(e) => setDiscordVal(e.target.value)} placeholder="your_handle" style={{ marginTop: "6px" }} />
                        : <div style={{ fontFamily: MONO, fontSize: "9px", color: extra?.discordHandle ? C.blue : C.mutedL, marginTop: "2px" }}>
                            {extra?.discordHandle ? `@${extra.discordHandle}` : "Not set"}
                          </div>
                    }
                  </div>
                </div>
                {extra?.discordVerified
                  ? <button onClick={() => unlinkSocial("discord")} disabled={unlinkBusy === "discord"} style={{ fontFamily: MONO, fontSize: "8px", color: C.red, background: "transparent", border: `1px solid ${C.red}40`, borderRadius: "4px", padding: "4px 10px", cursor: "pointer", letterSpacing: "0.1em", flexShrink: 0 }}>
                      {unlinkBusy === "discord" ? "…" : "UNLINK"}
                    </button>
                  : !editSocials && <ConnectBadge connected={!!extra?.discordHandle} label="NOT SET" />
                }
              </div>

              {/* Telegram */}
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(38,169,224,0.1)", border: "1px solid rgba(38,169,224,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "14px" }}>✈️</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT, fontSize: "12px", color: C.text, fontWeight: 700, letterSpacing: "0.04em" }}>Telegram</div>
                    {extra?.telegramVerified
                      ? <div style={{ fontFamily: MONO, fontSize: "9px", color: C.green, marginTop: "2px" }}>
                          🔒 Verified{extra.telegramUsername ? ` as @${extra.telegramUsername}` : ""} — locked
                        </div>
                      : editSocials
                        ? <input className="inp" value={telegramVal} onChange={(e) => setTelegramVal(e.target.value)} placeholder="your_handle" style={{ marginTop: "6px" }} />
                        : <div style={{ fontFamily: MONO, fontSize: "9px", color: extra?.telegramHandle ? "#26A9E0" : C.mutedL, marginTop: "2px" }}>
                            {extra?.telegramHandle ? `@${extra.telegramHandle}` : "Not set"}
                          </div>
                    }
                  </div>
                </div>
                {extra?.telegramVerified
                  ? <button onClick={() => unlinkSocial("telegram")} disabled={unlinkBusy === "telegram"} style={{ fontFamily: MONO, fontSize: "8px", color: C.red, background: "transparent", border: `1px solid ${C.red}40`, borderRadius: "4px", padding: "4px 10px", cursor: "pointer", letterSpacing: "0.1em", flexShrink: 0 }}>
                      {unlinkBusy === "telegram" ? "…" : "UNLINK"}
                    </button>
                  : !editSocials && <ConnectBadge connected={!!extra?.telegramHandle} label="NOT SET" />
                }
              </div>
            </Card>

            {/* ── PROTOCOL STATS ── */}
            <Card>
              <CardHeader glyph="ז" title="PROTOCOL STATS" action={
                <button onClick={() => { loadStats(); loadExtra(); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedL, display: "flex" }}>
                  <RefreshCw size={11} />
                </button>
              } />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
                {[
                  { label: "SIGNAL WEIGHT",  value: signal.toLocaleString(),     color: tierMeta.color },
                  { label: "TIER",           value: tierName,                     color: tierMeta.color },
                  { label: "TASKS INSCRIBED",value: `${initiationDone}`,          color: C.text },
                  { label: "MISSIONS DONE",  value: `${missionsDone}`,            color: C.text },
                  { label: "REFERRAL CODE",  value: (profile as { referralCode?: string })?.referralCode || "—", color: C.gold },
                  { label: "REFERRALS",      value: String((profile as { referralCount?: number })?.referralCount ?? 0), color: C.green },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: "14px 20px",
                    borderBottom: i < 4 ? `1px solid ${C.border}` : "none",
                    borderRight: i % 2 === 0 ? `1px solid ${C.border}` : "none",
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: "8px", color: C.mutedL, letterSpacing: "0.14em", marginBottom: "6px" }}>{s.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ fontFamily: MONO, fontSize: "14px", fontWeight: 700, color: s.color }}>{s.value}</span>
                      {s.label === "REFERRAL CODE" && s.value !== "—" && <CopyBtn text={s.value} />}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* ── GO TO DAPP ── */}
            <button
              onClick={() => router.push("/dapp")}
              style={{
                width: "100%", background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`,
                border: "none", borderRadius: "10px", padding: "14px",
                fontFamily: FONT, fontSize: "12px", fontWeight: 700,
                color: "#000", letterSpacing: "0.12em", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}>
              ENTER INITIATION TERMINAL <ChevronRight size={14} />
            </button>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
