"use client";
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Check, ChevronRight, ExternalLink, Shield, Zap, Users, Award, Lock, ArrowRight } from "lucide-react";

const C = { black: "#000", card: "#111111", border: "#1F1F1F", gold: "#C9A84C", goldL: "#E2BF6E", text: "#E8E8E8", muted: "#5C5C5C", mutedH: "#888888", green: "#00C896", purple: "#A78BFA" };

export default function BetaPage() {
  const { user, openAuthModal } = useAuth();
  const toast = useToast();
  const [email, setEmail]       = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // Store in Firestore (or just show success for now)
    setSubmitted(true);
    toast("You're on the early access list!", "success");
  };

  const steps = [
    { step: "01", title: "Sign Up", desc: "Create your account and get your unique referral code. Invite others to climb the leaderboard.", icon: Users, status: "available" },
    { step: "02", title: "Get Testnet ETH", desc: "Claim free Sepolia ETH from the faucet to test transactions with zero real money.", icon: Zap, status: "available" },
    { step: "03", title: "Connect Wallet", desc: "Connect MetaMask or create a new wallet inside the DApp. Your identity, your keys.", icon: Shield, status: "available" },
    { step: "04", title: "Buy Test $OTTER", desc: "Swap testnet ETH for $OTTER on Uniswap Sepolia. Watch your tier counter start.", icon: Award, status: "soon" },
    { step: "05", title: "Submit Memes", desc: "Reach MEMBER tier (30 days hold) and submit community content for voting.", icon: Zap, status: "soon" },
    { step: "06", title: "Vote & Earn", desc: "Vote on submissions, earn from the rewards pool, shape the protocol governance.", icon: Lock, status: "future" },
  ];

  const statusColors = { available: C.green, soon: "#F5A623", future: C.muted };
  const statusLabels = { available: "Live Now", soon: "Coming Soon", future: "Future" };

  return (
    <div style={{ background: C.black, color: C.text, minHeight: "100vh" }}>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{ paddingTop: "64px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(201,168,76,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div className="grid-lines" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />

        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "80px 24px 100px", textAlign: "center", position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "100px", padding: "6px 18px", marginBottom: "32px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.green, display: "inline-block" }} className="animate-pulse-gold" />
            <span style={{ color: C.green, fontSize: "12px", fontWeight: 600, letterSpacing: "0.1em" }}>BETA ACCESS — OPEN NOW</span>
          </div>

          <h1 style={{ fontSize: "clamp(40px, 7vw, 80px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.0, marginBottom: "24px" }}>
            You&apos;re early.<br />
            <span style={{ background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              That matters.
            </span>
          </h1>

          <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: C.mutedH, maxWidth: "580px", margin: "0 auto 16px", lineHeight: 1.7 }}>
            The OTTER Protocol beta is live. Help us test the standard, shape the mechanics,
            and earn founding status in the Raft — before this goes mainnet.
          </p>
          <p style={{ color: C.gold, fontSize: "14px", fontWeight: 600, letterSpacing: "0.06em", marginBottom: "48px", textTransform: "uppercase" }}>
            Early supporters become OG holders at mainnet launch
          </p>

          <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
            {!user ? (
              <button onClick={openAuthModal}
                style={{ background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "14px 32px", fontWeight: 700, fontSize: "16px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                Create Account <ArrowRight size={16} />
              </button>
            ) : (
              <Link href="/dapp"
                style={{ background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", textDecoration: "none", borderRadius: "10px", padding: "14px 32px", fontWeight: 700, fontSize: "16px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                Open DApp <ArrowRight size={16} />
              </Link>
            )}
            <Link href="/eip"
              style={{ border: `1px solid ${C.border}`, color: C.text, textDecoration: "none", borderRadius: "10px", padding: "14px 32px", fontWeight: 600, fontSize: "16px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Read the EIP
            </Link>
          </div>
        </div>
      </section>

      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)" }} />

      {/* ── BETA STEPS ── */}
      <section style={{ padding: "80px 24px", maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ maxWidth: "480px", marginBottom: "56px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
            <div style={{ width: "24px", height: "1px", background: C.gold }} />
            <span style={{ color: C.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>How to Participate</span>
          </div>
          <h2 style={{ fontSize: "clamp(26px, 3vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
            Six steps to become a founding member.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {steps.map((s) => {
            const sc = statusColors[s.status as keyof typeof statusColors];
            const sl = statusLabels[s.status as keyof typeof statusLabels];
            return (
              <div key={s.step} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "24px", transition: "border-color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2E2E2E")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <s.icon size={18} color={C.gold} />
                  </div>
                  <span style={{ background: `${sc}12`, color: sc, border: `1px solid ${sc}30`, borderRadius: "20px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>
                    {sl}
                  </span>
                </div>
                <div style={{ color: C.muted, fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "6px" }}>STEP {s.step}</div>
                <h3 style={{ fontWeight: 700, fontSize: "17px", marginBottom: "8px" }}>{s.title}</h3>
                <p style={{ color: C.muted, fontSize: "14px", lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)" }} />

      {/* ── FAUCET LINKS ── */}
      <section style={{ padding: "80px 24px", maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "60px", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{ width: "24px", height: "1px", background: C.purple }} />
              <span style={{ color: C.purple, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Testnet Resources</span>
            </div>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.2, marginBottom: "16px" }}>
              Get testnet ETH to start testing.
            </h2>
            <p style={{ color: C.mutedH, fontSize: "15px", lineHeight: 1.75, marginBottom: "28px" }}>
              You need Sepolia ETH to pay for test transactions. It&apos;s free — just click
              a faucet link and request some. No real money involved.
            </p>
            {[
              "Connect to Sepolia in MetaMask (network selector → Add network → Sepolia)",
              "Visit a faucet below and paste your wallet address",
              "Receive free test ETH in ~1 minute",
              "Use it to buy test OTTER when the contract deploys",
            ].map((p, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                  <span style={{ color: C.gold, fontSize: "11px", fontWeight: 700 }}>{i + 1}</span>
                </div>
                <span style={{ color: C.text, fontSize: "14px", lineHeight: 1.55 }}>{p}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { name: "Alchemy Sepolia Faucet", url: "https://sepoliafaucet.com", desc: "0.5 ETH/day, no login required", tag: "Recommended" },
              { name: "Infura Sepolia Faucet", url: "https://www.infura.io/faucet/sepolia", desc: "Free with Infura account", tag: null },
              { name: "Chainlink Faucet", url: "https://faucets.chain.link/sepolia", desc: "Multi-chain, Sepolia supported", tag: null },
              { name: "Sepolia PoW Faucet", url: "https://sepolia-faucet.pk910.de", desc: "Mine-based, larger amounts", tag: null },
            ].map((faucet) => (
              <a key={faucet.name} href={faucet.url} target="_blank" rel="noopener noreferrer"
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "12px", padding: "16px 20px", textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", transition: "border-color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2E2E2E")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ color: C.text, fontWeight: 600, fontSize: "14px" }}>{faucet.name}</span>
                    {faucet.tag && <span style={{ background: "rgba(201,168,76,0.1)", color: C.gold, border: "1px solid rgba(201,168,76,0.2)", borderRadius: "20px", padding: "1px 8px", fontSize: "10px", fontWeight: 700 }}>{faucet.tag}</span>}
                  </div>
                  <div style={{ color: C.muted, fontSize: "13px" }}>{faucet.desc}</div>
                </div>
                <ExternalLink size={15} color={C.muted} style={{ flexShrink: 0 }} />
              </a>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)" }} />

      {/* ── EARLY ACCESS PERKS ── */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "16px" }}>
            Why be early?
          </h2>
          <p style={{ color: C.mutedH, fontSize: "16px", lineHeight: 1.7, marginBottom: "56px", maxWidth: "480px", margin: "0 auto 56px" }}>
            Beta testers and early community members get guaranteed OG status — and the protocol
            is designed to reward them forever.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "56px" }}>
            {[
              { title: "OG Status", desc: "Beta testers automatically qualify for OG tier at mainnet launch", icon: Award, color: C.gold },
              { title: "2× Rewards", desc: "OG holders permanently earn 2× the reward multiplier of newcomers", icon: Zap, color: C.purple },
              { title: "Governance Power", desc: "OGs have maximum voting weight in all DAO decisions from day one", icon: Shield, color: C.green },
              { title: "Founding Seat", desc: "First 500 members get a founding seat in the OTTER DAO council", icon: Users, color: "#F5A623" },
            ].map((item) => (
              <div key={item.title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "24px", textAlign: "left", transition: "border-color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = item.color + "40")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: `${item.color}10`, border: `1px solid ${item.color}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <item.icon size={18} color={item.color} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px", color: item.color }}>{item.title}</h3>
                <p style={{ color: C.muted, fontSize: "13px", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Waitlist form */}
          <div style={{ background: C.card, border: "1px solid rgba(201,168,76,0.2)", borderRadius: "20px", padding: "40px", maxWidth: "520px", margin: "0 auto" }}>
            {submitted ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(0,200,150,0.1)", border: "1px solid rgba(0,200,150,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Check size={24} color={C.green} />
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>You&apos;re on the list</h3>
                <p style={{ color: C.muted, fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                  We&apos;ll notify you when testnet contract deploys. In the meantime, explore the DApp.
                </p>
                <Link href="/dapp" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: C.gold, textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
                  Open DApp <ChevronRight size={14} />
                </Link>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "6px" }}>Get early access</h3>
                <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>
                  Join the waitlist for testnet contract access and mainnet OG status.
                </p>
                {!user ? (
                  <>
                    <form onSubmit={handleWaitlist} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ flex: 1, minWidth: "180px", background: "#0A0A0A", border: `1px solid ${C.border}`, borderRadius: "10px", padding: "12px 16px", color: C.text, fontSize: "15px", outline: "none" }}
                        onFocus={(e) => (e.target.style.borderColor = C.gold)}
                        onBlur={(e) => (e.target.style.borderColor = C.border)}
                      />
                      <button type="submit" style={{ background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "12px 24px", fontWeight: 700, fontSize: "15px", cursor: "pointer", whiteSpace: "nowrap" }}>
                        Join Waitlist
                      </button>
                    </form>
                    <div style={{ textAlign: "center", marginTop: "16px" }}>
                      <span style={{ color: C.muted, fontSize: "13px" }}>or </span>
                      <button onClick={openAuthModal} style={{ background: "none", border: "none", cursor: "pointer", color: C.gold, fontSize: "13px", fontWeight: 600 }}>
                        create an account for full access →
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: C.green, fontSize: "14px", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <Check size={15} /> You&apos;re signed in — you already have early access!
                    </p>
                    <Link href="/dapp" style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", textDecoration: "none", borderRadius: "10px", padding: "13px 28px", fontWeight: 700, fontSize: "15px" }}>
                      Open DApp <ArrowRight size={16} />
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
