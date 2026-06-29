"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import {
  Shield, Zap, Users, TrendingUp, Lock, Award, ArrowRight,
  CheckCircle, Circle, Copy,
} from "lucide-react";

const C = {
  black: "#000000", deep: "#030200", card: "#0D0B07", cardAlt: "#110E08",
  border: "#1E1A10", borderG: "rgba(201,168,76,0.18)",
  gold: "#C9A84C", goldL: "#E2BF6E", goldD: "#8B6000",
  text: "#E8DFC8", muted: "#5C5040", mutedH: "#8C7A5C",
  green: "#00C896", red: "#FF4545", stone: "#1A150C",
};
const FONT = "var(--font-cinzel, Georgia, serif)";
const MONO = "var(--font-geist-mono, monospace)";

const HEBREW = "אבגדהוזחטיכלמנסעפצקרשת";
const RUNIC  = "ᚠᚢᚦᚨᚩᚪᚫᚬᚭᚮᚯᚰᚱᚲᚳᚴᚵᚶᚷᚸ";
const SYMB   = "◈◉⊕⊗▲△◆◇⬡⬢✦✧❖⁂";
const POOL   = HEBREW + RUNIC + SYMB;

// ── Boot Sequence ─────────────────────────────────────────────────────────
const BOOT_LINES = [
  "> INITIALIZING OTTER PROTOCOL v1.0.0...",
  "> LOADING ANCIENT CODEX...",
  "> VERIFYING HARAPPAN SEAL INTEGRITY...",
  "> DECRYPTING ERC-OTTER STANDARD...",
  "> CONNECTING TO ETHEREUM MAINNET...",
  "> COMMUNITY NODES: 4,712 ACTIVE",
  "> RAFT STATUS: ████████████ OPERATIONAL",
  "> HOLD TOGETHER. BUILD TOGETHER.",
  "> ACCESS GRANTED ◈",
];

function BootSequence({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone]   = useState(false);
  const [fade, setFade]   = useState(false);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setLines((p) => [...p, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => {
          setFade(true);
          setTimeout(() => { setDone(true); onDone(); }, 600);
        }, 500);
      }
    }, 180);
    return () => clearInterval(iv);
  }, [onDone]);

  if (done) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: fade ? 0 : 1, transition: "opacity 0.6s ease",
    }}>
      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)",
      }} />
      <div style={{ maxWidth: "640px", width: "100%", padding: "32px" }}>
        <div style={{
          fontFamily: MONO, fontSize: "11px", color: C.green,
          letterSpacing: "0.06em", lineHeight: 2.2,
        }}>
          {lines.map((l, i) => (
            <div key={i} style={{
              opacity: 0, animation: "bootLine 0.3s ease forwards",
              animationDelay: `${i * 0.05}s`,
              color: l.includes("GRANTED") ? C.gold : l.includes("OTTER") ? "#E2BF6E" : C.green,
            }}>
              {l}
            </div>
          ))}
          {lines.length > 0 && lines.length < BOOT_LINES.length && (
            <span style={{ animation: "cursorBlink 0.7s step-end infinite", color: C.green }}>█</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Decode Text ───────────────────────────────────────────────────────────
function DecodeText({ text, startAfterMs = 0, charDelayMs = 65, style, className }: {
  text: string; startAfterMs?: number; charDelayMs?: number;
  style?: React.CSSProperties; className?: string;
}) {
  type Ch = { ch: string; locked: boolean };
  const [chars, setChars] = useState<Ch[]>([]);
  const lockedIdx = useRef(0);
  const shimRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const decRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setChars(text.split("").map(c => ({ ch: c === " " ? " " : POOL[Math.floor(Math.random() * POOL.length)], locked: c === " " })));
    lockedIdx.current = 0;
    const tid = setTimeout(() => {
      shimRef.current = setInterval(() => {
        setChars(p => p.map(item => item.locked ? item : { ch: POOL[Math.floor(Math.random() * POOL.length)], locked: false }));
      }, 90);
      decRef.current = setInterval(() => {
        const idx = lockedIdx.current;
        if (idx >= text.length) { clearInterval(decRef.current!); clearInterval(shimRef.current!); return; }
        setChars(p => p.map((item, i) => i === idx ? { ch: text[i], locked: true } : item));
        lockedIdx.current++;
      }, charDelayMs);
    }, startAfterMs);
    return () => { clearTimeout(tid); clearInterval(shimRef.current!); clearInterval(decRef.current!); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span className={className} style={style}>
      {chars.map((item, i) => (
        <span key={i} style={{
          color: item.locked ? "inherit" : "rgba(201,168,76,0.28)",
          fontFamily: item.locked ? "inherit" : MONO,
          transition: "color 0.1s", display: "inline-block",
          minWidth: item.ch === " " ? "0.35em" : undefined,
        }}>{item.ch}</span>
      ))}
    </span>
  );
}

// ── Coin Logo ─────────────────────────────────────────────────────────────
function CoinLogo({ size = 100 }: { size?: number }) {
  return (
    <div className="coin-glow-anim" style={{
      width: size, height: size, borderRadius: "50%",
      overflow: "hidden", flexShrink: 0, position: "relative",
      boxShadow: "0 0 0 2px rgba(201,168,76,0.5), 0 0 0 6px rgba(201,168,76,0.08), 0 0 60px rgba(201,168,76,0.25)",
    }}>
      <Image
        src="/otter-logo.png"
        alt="OTTER Protocol"
        width={120} height={120}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        priority unoptimized
      />
    </div>
  );
}

// ── Floating Artifact — reduced to 4 for cleaner look ─────────────────────
const ARTIFACTS = [
  { el: "🦦", label: "otter",  size: 64, opacity: 0.10, cls: "rune-float-1", top: "12%", left: "3%" },
  { el: "🦦", label: "otter2", size: 72, opacity: 0.08, cls: "rune-float-4", top: "78%", right: "4%" },
  { el: "🌊", label: "wave",   size: 60, opacity: 0.06, cls: "rune-float-4", top: "60%", left: "7%" },
  { el: "◈",  label: "glyph",  size: 40, opacity: 0.07, cls: "rune-float-2", top: "30%", right: "3%" },
];

// ── Particle Field ────────────────────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 60 }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      vx:  (Math.random() - 0.5) * 0.3,
      vy:  -Math.random() * 0.4 - 0.1,
      size: Math.random() * 1.5 + 0.3,
      alpha: Math.random() * 0.4 + 0.05,
      life: Math.random(),
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.life += 0.003;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; p.life = 0; }
        const a = p.alpha * Math.sin(p.life * Math.PI);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${a.toFixed(3)})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, zIndex: 0,
      pointerEvents: "none", opacity: 0.7,
    }} />
  );
}

// ── Scroll Reveal ─────────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(32px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>{children}</div>
  );
}

// ── Ancient Divider ────────────────────────────────────────────────────────
function AncientDivider({ glyph = "◈" }: { glyph?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", maxWidth: "1280px", margin: "0 auto", padding: "0 24px" }}>
      <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg, transparent, ${C.borderG})` }} />
      <span style={{ fontFamily: MONO, color: "rgba(201,168,76,0.3)", fontSize: "12px", letterSpacing: "0.2em", userSelect: "none" }}>{glyph}</span>
      <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg, ${C.borderG}, transparent)` }} />
    </div>
  );
}

// ── Ancient Section Label ─────────────────────────────────────────────────
function AncientLabel({ children, hebrewChar = "א", color = C.gold }: {
  children: React.ReactNode; hebrewChar?: string; color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
      <span style={{ fontFamily: MONO, color: "rgba(201,168,76,0.35)", fontSize: "14px" }}>{hebrewChar}</span>
      <div style={{ width: "20px", height: "1px", background: color, opacity: 0.5 }} />
      <span style={{ fontFamily: FONT, color, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}>{children}</span>
      <div style={{ width: "20px", height: "1px", background: color, opacity: 0.5 }} />
      <span style={{ fontFamily: MONO, color: "rgba(201,168,76,0.35)", fontSize: "14px" }}>ת</span>
    </div>
  );
}

// ── Stone Card ────────────────────────────────────────────────────────────
function StoneCard({ children, style, onMouseEnter, onMouseLeave }: { children: React.ReactNode; style?: React.CSSProperties; onMouseEnter?: React.MouseEventHandler<HTMLDivElement>; onMouseLeave?: React.MouseEventHandler<HTMLDivElement> }) {
  return (
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{
      background: `linear-gradient(135deg, #0F0C06 0%, #0A0800 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: "4px",
      boxShadow: "inset 0 1px 0 rgba(201,168,76,0.06), 0 4px 24px rgba(0,0,0,0.6)",
      position: "relative", overflow: "hidden",
      ...style,
    }}>
      {/* Stone texture overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: "200px",
      }} />
      {children}
    </div>
  );
}

// ── Hacking Terminal Block ─────────────────────────────────────────────────
function HackBlock({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let i = 0;
        const iv = setInterval(() => { setShown((p) => p + 1); i++; if (i >= lines.length) clearInterval(iv); }, 120);
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [lines.length]);

  return (
    <div ref={ref} style={{
      background: "#020100", border: `1px solid rgba(201,168,76,0.1)`,
      borderRadius: "6px", padding: "20px 24px",
      fontFamily: MONO, fontSize: "11px", color: C.green,
      letterSpacing: "0.06em", lineHeight: 2,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px", paddingBottom: "10px", borderBottom: `1px solid rgba(201,168,76,0.08)` }}>
        {["#FF5F56","#FFBD2E","#27C93F"].map((c) => <div key={c} style={{ width: "8px", height: "8px", borderRadius: "50%", background: c }} />)}
        <span style={{ color: "rgba(201,168,76,0.3)", fontSize: "10px", marginLeft: "8px", letterSpacing: "0.1em" }}>OTTER_PROTOCOL.sol — SEPOLIA:11155111</span>
      </div>
      {lines.slice(0, shown).map((l, i) => (
        <div key={i} style={{
          color: l.startsWith("//") ? "rgba(201,168,76,0.45)" : l.startsWith("function") ? "#60A5FA" : l.includes("emit") ? C.gold : l.includes("require") ? C.red : C.green,
          animation: "bootLine 0.2s ease forwards",
        }}>{l}</div>
      ))}
      {shown < lines.length && <span style={{ animation: "cursorBlink 0.7s step-end infinite" }}>█</span>}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function AboutPage() {
  const { openAuthModal, user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied]             = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) setReferralCode(ref);
    }
  }, []);

  const copyLink = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div style={{ background: C.black, color: C.text, minHeight: "100vh", overflow: "hidden" }}>

      {/* Global styles */}
      <style>{`
        @keyframes bootLine   { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        @keyframes cursorBlink{ 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes scanMove   { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes glitch1    { 0%,96%,100%{clip-path:none;transform:none} 97%{clip-path:inset(20% 0 60% 0);transform:translate(-3px,2px)} 98%{clip-path:inset(60% 0 10% 0);transform:translate(3px,-2px)} 99%{clip-path:inset(40% 0 30% 0);transform:translate(-1px,1px)} }
        @keyframes stoneReveal{ from{opacity:0;transform:scale(0.92) rotate(-2deg)} to{opacity:1;transform:scale(1) rotate(0deg)} }
        @keyframes runeType   { from{opacity:0;letter-spacing:0.6em;filter:blur(4px)} to{opacity:1;letter-spacing:0.14em;filter:blur(0)} }
        @keyframes artifactDrift { 0%,100%{transform:translateY(0) rotate(0deg)} 33%{transform:translateY(-18px) rotate(3deg)} 66%{transform:translateY(-9px) rotate(-2deg)} }
        @keyframes goldPulse  { 0%,100%{opacity:0.06} 50%{opacity:0.14} }
        @keyframes horizScan  { 0%{transform:translateX(-100%)} 100%{transform:translateX(100vw)} }
        .glitch { animation: glitch1 8s ease-in-out infinite; }
        .rune-type { animation: runeType 1.2s ease-out forwards; }
      `}</style>

      {/* Fixed particles */}
      <ParticleField />

      {/* Fixed scanline */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "2px", zIndex: 50,
        background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)",
        animation: "horizScan 6s linear infinite",
        pointerEvents: "none",
      }} />

      <Navbar />

      <div>

        {/* ═══ HERO ════════════════════════════════════════════════════════ */}
        <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "64px", overflow: "hidden" }}>

          {/* Grid background */}
          <div className="grid-lines" style={{ position: "absolute", inset: 0, opacity: 0.35 }} />

          {/* Radial glow */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: `
              radial-gradient(ellipse 70% 50% at 50% 40%, rgba(201,168,76,0.06) 0%, transparent 65%),
              radial-gradient(ellipse 30% 40% at 15% 80%, rgba(139,96,0,0.05) 0%, transparent 50%),
              radial-gradient(ellipse 30% 40% at 85% 20%, rgba(139,96,0,0.05) 0%, transparent 50%)
            `,
          }} />

          {/* Floating historical artifacts */}
          {ARTIFACTS.map((a) => (
            <div
              key={a.label}
              style={{
                position: "absolute",
                top: a.top, left: (a as {left?: string}).left, right: (a as {right?: string}).right,
                fontSize: a.size,
                opacity: a.opacity,
                filter: "grayscale(0.3) sepia(0.5)",
                userSelect: "none", pointerEvents: "none", zIndex: 0,
                animation: `artifactDrift ${9 + Math.random() * 8}s ${Math.random() * 4}s ease-in-out infinite`,
              }}
            >
              {a.el}
            </div>
          ))}

          {/* Subtle rune floaters — 2 only */}
          {[
            { ch: "◈", top: "22%", left: "5%",  size: 60 },
            { ch: "א", top: "72%", right: "5%", size: 70 },
          ].map((r) => (
            <div key={r.ch} style={{
              position: "absolute", top: r.top,
              left: (r as {left?: string}).left, right: (r as {right?: string}).right,
              fontSize: r.size, fontFamily: MONO, color: C.gold,
              opacity: 0.05, pointerEvents: "none", userSelect: "none", zIndex: 0,
            }}>{r.ch}</div>
          ))}

          {/* Hero content */}
          <div style={{ position: "relative", zIndex: 2, maxWidth: "960px", margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>

            {/* Coin + otter emoji cluster */}
            <div className="hero-coin-wrap" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginBottom: "40px" }}>
              <span style={{ fontSize: "40px", opacity: 0.5, filter: "grayscale(0.2)", animation: "artifactDrift 7s 1s ease-in-out infinite" }}>🦦</span>
              <CoinLogo size={120} />
              <span style={{ fontSize: "40px", opacity: 0.5, filter: "grayscale(0.2)", animation: "artifactDrift 9s 3s ease-in-out infinite" }}>🦦</span>
            </div>

            {/* Badge */}
            <div className="inscription-in badge-glow" style={{
              display: "inline-flex", alignItems: "center", gap: "10px",
              background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.22)",
              borderRadius: "3px", padding: "7px 20px", marginBottom: "44px", fontFamily: FONT,
            }}>
              <span style={{ color: "rgba(201,168,76,0.5)", fontSize: "13px" }}>⟦</span>
              <span className="status-dot" />
              <span style={{ color: C.gold, fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em" }}>EIP · EPOCH I · ETHEREUM · 2025</span>
              <span style={{ color: "rgba(201,168,76,0.5)", fontSize: "13px" }}>⟧</span>
            </div>

            {/* Headline with glitch + decode */}
            <h1 className="glitch hero-h1" style={{
              fontFamily: FONT,
              fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.02em", marginBottom: "28px",
              fontSize: "clamp(26px, 8.5vw, 96px)",
            }}>
              <span style={{ display: "block", color: C.text }}>
                <DecodeText text="Hold Together." startAfterMs={200} charDelayMs={55} />
              </span>
              <span style={{
                display: "block",
                background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldL} 40%, ${C.gold} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                <DecodeText text="Build Together." startAfterMs={1400} charDelayMs={55} />
              </span>
            </h1>

            <p style={{ fontFamily: FONT, fontSize: "clamp(15px, 1.8vw, 18px)", color: C.mutedH, maxWidth: "560px", margin: "0 auto 48px", lineHeight: 1.85 }}>
              The first{" "}
              <span style={{ color: C.text, fontWeight: 700 }}>community-owned</span>{" "}
              meme token standard on Ethereum.{" "}
              <span style={{ color: C.gold, fontWeight: 700 }}>ERC-OTTER</span>{" "}
              makes community protection a{" "}
              <span style={{ color: C.text, fontWeight: 600 }}>cryptographic guarantee</span>
              {" "}— not a social promise.
            </p>

            {referralCode && !user && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "20px", background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.18)", borderRadius: "6px", padding: "10px 18px" }}>
                <Award size={14} color={C.green} />
                <span style={{ color: C.green, fontSize: "13px", fontFamily: MONO }}>CODE: <strong>{referralCode}</strong> — sign in to claim your bonus</span>
              </div>
            )}

            {/* CTAs */}
            <div className="hero-cta" style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap", marginBottom: "72px" }}>
              {/* 1 — dApp Beta (dark, animated light border) → /dapp */}
              <Link href="/dapp" className="dapp-cta" aria-label="Open the OTTER dApp Beta" style={{ fontFamily: FONT, fontSize: "14px" }}>
                <span className="dapp-cta-inner">
                  <span className="dapp-cta-coin" style={{ fontFamily: MONO, fontSize: "16px", color: "#F4DC8A" }}>◈</span>
                  dApp Beta
                  <ArrowRight size={15} />
                </span>
              </Link>

              {/* 2 — Claim +1,000 OTTER (green, animated light border) → /dapp */}
              <Link href="/dapp" className="dapp-cta dapp-cta-green" aria-label="Claim 1000 OTTER in the dApp" style={{ fontFamily: FONT, fontSize: "14px" }}>
                <span className="dapp-cta-inner is-green">
                  <span className="dapp-cta-coin" style={{ fontFamily: MONO, fontSize: "16px", color: "#002018" }}>◈</span>
                  Claim +1,000 OTTER
                  <ArrowRight size={15} />
                </span>
              </Link>
              <button onClick={openAuthModal} style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                background: "transparent", border: `1px solid rgba(201,168,76,0.25)`,
                color: C.text, fontWeight: 600, fontSize: "14px",
                padding: "14px 32px", borderRadius: "4px", cursor: "pointer",
                fontFamily: FONT, letterSpacing: "0.06em",
              }}>
                Join the Raft
              </button>
            </div>

            {/* Stats strip */}
            <div className="hero-stats" style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center",
              gap: "48px", paddingTop: "40px",
              borderTop: "1px solid rgba(201,168,76,0.1)",
            }}>
              {[
                { value: "ERC",  label: "Standard Type", glyph: "א" },
                { value: "100B", label: "Max Supply",    glyph: "ב" },
                { value: "5%",   label: "Transfer Tax",  glyph: "ג" },
                { value: "DAO",  label: "Governance",    glyph: "ד" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: MONO, fontSize: "10px", color: "rgba(201,168,76,0.3)", letterSpacing: "0.15em", marginBottom: "6px" }}>{s.glyph}</div>
                  <div style={{ fontFamily: FONT, fontSize: "30px", fontWeight: 900, background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{s.value}</div>
                  <div style={{ fontFamily: FONT, fontSize: "10px", color: C.muted, marginTop: "4px", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <AncientDivider glyph="🦦 · ◈ · 🦦" />

        {/* ═══ THE PROBLEM ═════════════════════════════════════════════════ */}
        <section id="about" style={{ padding: "100px 24px", maxWidth: "1280px", margin: "0 auto" }}>
          <div className="problem-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "60px", alignItems: "center" }}>
            <Reveal>
              <AncientLabel hebrewChar="ב">The Problem</AncientLabel>
              <h2 style={{ fontFamily: FONT, fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "0.01em", marginBottom: "20px" }}>
                Meme tokens are built to fail their communities.
              </h2>
              <p style={{ fontFamily: FONT, color: C.mutedH, fontSize: "15px", lineHeight: 1.9, marginBottom: "28px", letterSpacing: "0.02em" }}>
                There is <span style={{ color: C.text, fontWeight: 600 }}>no standard</span> preventing
                developers from draining liquidity or abandoning projects.
                Community trust is a social promise.{" "}
                <span style={{ color: C.gold, fontWeight: 700 }}>ERC-OTTER replaces promises with code.</span>
              </p>
              <Link href="/eip" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: C.gold, textDecoration: "none", fontSize: "12px", fontWeight: 600, fontFamily: FONT, letterSpacing: "0.06em" }}>
                READ THE FULL PROPOSAL <ArrowRight size={12} />
              </Link>
            </Reveal>

            <Reveal delay={150}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { glyph: "ג", icon: Shield,     title: "No anti-rug protection",   desc: "Devs can drain liquidity at any time — zero on-chain enforcement exists." },
                  { glyph: "ד", icon: Zap,         title: "Holders earn nothing",     desc: "No reward for loyalty, governance participation, or content creation." },
                  { glyph: "ה", icon: TrendingUp,  title: "Built to pump and dump",   desc: "Without a standard, every meme token ends the same way." },
                ].map((item) => (
                  <StoneCard key={item.title} style={{ padding: "20px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <span style={{ position: "absolute", right: "14px", bottom: "8px", fontFamily: MONO, fontSize: "30px", color: "rgba(201,168,76,0.05)", userSelect: "none" }}>{item.glyph}</span>
                    <div style={{ width: "38px", height: "38px", borderRadius: "6px", flexShrink: 0, background: "rgba(255,69,69,0.06)", border: "1px solid rgba(255,69,69,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <item.icon size={17} color={C.red} />
                    </div>
                    <div>
                      <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: "13px", marginBottom: "4px", color: C.text, letterSpacing: "0.04em" }}>{item.title}</h3>
                      <p style={{ fontFamily: FONT, color: C.mutedH, fontSize: "13px", lineHeight: 1.75, letterSpacing: "0.02em" }}>{item.desc}</p>
                    </div>
                  </StoneCard>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <AncientDivider glyph="🪨 · ◈ · 🪨" />

        {/* ═══ HACKING TERMINAL SECTION ════════════════════════════════════ */}
        <section style={{ padding: "80px 24px", maxWidth: "1280px", margin: "0 auto" }}>
          <Reveal>
            <div style={{ textAlign: "center", marginBottom: "48px" }}>
              <AncientLabel hebrewChar="ו" color={C.green}>The Protocol</AncientLabel>
              <h2 style={{ fontFamily: FONT, fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 700, letterSpacing: "0.02em", color: C.text }}>
                ERC-OTTER in{" "}
                <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  machine language
                </span>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <HackBlock lines={[
              "// ERC-OTTER Standard — Community Protection Layer",
              "// Deployed: Sepolia Testnet | Author: The Raft",
              "",
              "pragma solidity ^0.8.20;",
              "",
              "function _transfer(address from, address to, uint256 amount) internal {",
              "    require(amount > 0, 'Zero transfer');",
              "    uint256 tax    = (amount * TAX_RATE) / 10000;   // 5%",
              "    uint256 net    = amount - tax;",
              "    _treasury     += (tax * 40) / 100;  // Community",
              "    _memePool     += (tax * 30) / 100;  // Creators",
              "    _liquidityLock += (tax * 20) / 100; // Liquidity",
              "    _burn(from,    (tax * 10) / 100);   // Deflation",
              "    emit Transfer(from, to, net);",
              "    // Tier auto-upgrade — no admin key required",
              "    _updateHolderTier(to);",
              "}",
              "",
              "// ◈ HOLD LONGER · EARN MORE · OWN THE PROTOCOL ◈",
            ]} />
          </Reveal>
        </section>

        <AncientDivider glyph="⚙️ · ◈ · ⚙️" />

        {/* ═══ THE CODEX ═══════════════════════════════════════════════════ */}
        <section id="eip" style={{ padding: "100px 24px" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <Reveal>
              <div style={{ textAlign: "center", marginBottom: "64px" }}>
                <AncientLabel hebrewChar="ז" color={C.gold}>The Codex</AncientLabel>
                <h2 style={{ fontFamily: FONT, fontSize: "clamp(26px, 4vw, 46px)", fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.1, marginBottom: "16px" }}>
                  ERC-OTTER:{" "}
                  <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    Progressive Community Token Standard
                  </span>
                </h2>
                <p style={{ fontFamily: FONT, color: C.mutedH, fontSize: "13px", lineHeight: 1.85, maxWidth: "520px", margin: "0 auto", letterSpacing: "0.02em" }}>
                  A formal ERC interface that hard-codes community protections into every compliant token.
                </p>
              </div>
            </Reveal>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
              {[
                { glyph: "ח", icon: Lock,      title: "Locked Liquidity",   desc: "Liquidity is locked by the contract. No admin key, no escape hatch.", tag: "ANTI-RUG",    seal: "I",   emoji: "🔒" },
                { glyph: "ט", icon: Zap,        title: "5% Auto Tax Split",  desc: "40% community · 30% creators · 20% liquidity · 10% burn. Every transfer.", tag: "BUILT-IN",   seal: "II",  emoji: "⚡" },
                { glyph: "י", icon: Award,      title: "Holder Tiers",       desc: "Hold longer, earn more. NEWCOMER → MEMBER → OG, tracked automatically.", tag: "LOYALTY",    seal: "III", emoji: "🏺" },
                { glyph: "כ", icon: Users,      title: "Meme Voting",        desc: "On-chain meme submissions and voting. Top creators earn from the pool.", tag: "COMMUNITY",  seal: "IV",  emoji: "🦦" },
                { glyph: "ל", icon: Shield,     title: "DAO Governance",     desc: "Every treasury decision is an on-chain vote. OG holders have 2× weight.", tag: "GOVERNANCE", seal: "V",   emoji: "🗿" },
                { glyph: "מ", icon: TrendingUp, title: "Referral Engine",    desc: "Invite others, track on-chain. Top referrers earn bonus allocation at launch.", tag: "GROWTH",     seal: "VI",  emoji: "🌊" },
              ].map((item, idx) => (
                <Reveal key={item.title} delay={idx * 60}>
                  <StoneCard style={{ padding: "24px", height: "100%", cursor: "default", transition: "border-color 0.2s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(201,168,76,0.3)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
                  >
                    <span style={{ position: "absolute", right: "14px", bottom: "10px", fontFamily: MONO, fontSize: "36px", color: "rgba(201,168,76,0.05)", userSelect: "none" }}>{item.glyph}</span>
                    <span style={{ position: "absolute", top: "14px", left: "14px", fontSize: "22px", opacity: 0.18, filter: "sepia(0.6)" }}>{item.emoji}</span>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", paddingTop: "8px" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "8px", background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <item.icon size={17} color={C.gold} />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "9px", letterSpacing: "0.1em" }}>SEAL {item.seal}</div>
                        <span style={{ background: "rgba(201,168,76,0.07)", color: C.gold, border: "1px solid rgba(201,168,76,0.2)", borderRadius: "3px", padding: "2px 8px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", fontFamily: FONT }}>{item.tag}</span>
                      </div>
                    </div>
                    <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: "14px", marginBottom: "8px", color: C.text, letterSpacing: "0.04em" }}>{item.title}</h3>
                    <p style={{ fontFamily: FONT, color: C.mutedH, fontSize: "13px", lineHeight: 1.8, letterSpacing: "0.02em" }}>{item.desc}</p>
                  </StoneCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <AncientDivider glyph="🏺 · ◈ · 🏺" />

        {/* ═══ TOKENOMICS ══════════════════════════════════════════════════ */}
        <section id="tokenomics" style={{ padding: "100px 24px", maxWidth: "1280px", margin: "0 auto" }}>
          <Reveal>
            <div style={{ maxWidth: "640px", marginBottom: "64px" }}>
              <AncientLabel hebrewChar="נ">The Compact</AncientLabel>
              <h2 style={{ fontFamily: FONT, fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 700, letterSpacing: "0.01em", lineHeight: 1.15, marginBottom: "16px" }}>
                Every transaction funds the community.
              </h2>
              <p style={{ fontFamily: FONT, color: C.mutedH, fontSize: "14px", lineHeight: 1.85, letterSpacing: "0.02em" }}>
                No hidden wallets. No team allocation. On-chain and verifiable from day one.
              </p>
            </div>
          </Reveal>

          <div className="tokenomics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "32px" }}>
            <Reveal delay={0}>
              <StoneCard style={{ padding: "32px" }}>
                <div style={{ fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "10px", letterSpacing: "0.18em", marginBottom: "6px" }}>◈ INSCRIPTION I</div>
                <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: "16px", marginBottom: "6px", color: C.text }}>Transfer Tax Distribution</h3>
                <p style={{ fontFamily: FONT, color: C.muted, fontSize: "11px", marginBottom: "28px", letterSpacing: "0.08em" }}>5% AUTO-SPLIT ON EVERY TRANSFER</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {[
                    { label: "Community Treasury", pct: 40, color: C.gold, emoji: "🏛️" },
                    { label: "Meme Rewards Pool",  pct: 30, color: "#A78BFA", emoji: "🎭" },
                    { label: "Liquidity Lock",      pct: 20, color: "#34D399", emoji: "🔒" },
                    { label: "Token Burn",          pct: 10, color: C.red, emoji: "🔥" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
                        <span style={{ fontFamily: FONT, color: C.text, fontSize: "12px", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "14px" }}>{item.emoji}</span>{item.label}
                        </span>
                        <span style={{ color: item.color, fontWeight: 700, fontSize: "13px", fontFamily: MONO }}>{item.pct}%</span>
                      </div>
                      <div style={{ height: "4px", background: "#1A1608", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${item.pct}%`, background: item.color, borderRadius: "2px", boxShadow: `0 0 6px ${item.color}60`, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </StoneCard>
            </Reveal>

            <Reveal delay={120}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "10px", letterSpacing: "0.18em", marginBottom: "8px" }}>◈ INSCRIPTION II — HOLDER TIERS</div>
                {[
                  { tier: "OG",       duration: "90+ days",   multiplier: "2.0x rewards", weight: "2x governance",   color: C.gold,    highlight: true,  glyph: "ש", emoji: "👑" },
                  { tier: "MEMBER",   duration: "30–90 days", multiplier: "1.5x rewards", weight: "1.5x governance", color: "#A78BFA", highlight: false, glyph: "ר", emoji: "🦦" },
                  { tier: "NEWCOMER", duration: "0–30 days",  multiplier: "1.0x rewards", weight: "1x governance",   color: C.muted,   highlight: false, glyph: "ק", emoji: "🌊" },
                ].map((t) => (
                  <StoneCard key={t.tier} style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", border: t.highlight ? "1px solid rgba(201,168,76,0.22)" : `1px solid ${C.border}` }}>
                    <span style={{ position: "absolute", right: "12px", fontFamily: MONO, fontSize: "28px", color: "rgba(201,168,76,0.06)", userSelect: "none" }}>{t.glyph}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "20px", filter: "sepia(0.4)" }}>{t.emoji}</span>
                      <div>
                        <div style={{ color: t.color, fontWeight: 900, fontSize: "13px", letterSpacing: "0.12em", fontFamily: FONT }}>{t.tier}</div>
                        <div style={{ color: C.muted, fontSize: "11px", fontFamily: MONO }}>{t.duration}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: FONT, color: C.text, fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em" }}>{t.multiplier}</div>
                      <div style={{ fontFamily: FONT, color: C.muted, fontSize: "11px", letterSpacing: "0.04em" }}>{t.weight}</div>
                    </div>
                  </StoneCard>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <AncientDivider glyph="⚱️ · ◈ · ⚱️" />

        {/* ═══ REFERRAL ════════════════════════════════════════════════════ */}
        <section id="referral" style={{ padding: "100px 24px" }}>
          <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
            <div className="referral-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: "60px", alignItems: "center" }}>
              <Reveal>
                <AncientLabel hebrewChar="ס" color="#A78BFA">Grow the Raft</AncientLabel>
                <h2 style={{ fontFamily: FONT, fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "0.01em", marginBottom: "20px" }}>
                  Grow the Raft.{" "}
                  <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    Earn together.
                  </span>
                </h2>
                <p style={{ fontFamily: FONT, color: C.mutedH, fontSize: "14px", lineHeight: 1.9, marginBottom: "32px", letterSpacing: "0.02em" }}>
                  Every member gets a unique referral link. When someone joins through your link,
                  both of you climb the leaderboard.
                </p>
                {[
                  "Unique referral code generated per account",
                  "On-chain referral tracking via smart contract",
                  "Referral count tracked toward OG tier eligibility",
                  "Top referrers earn bonus allocation at launch",
                ].map((p, i) => (
                  <div key={p} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                    <span style={{ fontFamily: MONO, color: "rgba(201,168,76,0.5)", fontSize: "12px", marginTop: "3px", flexShrink: 0 }}>{["א","ב","ג","ד"][i]}</span>
                    <span style={{ fontFamily: FONT, color: C.text, fontSize: "13px", lineHeight: 1.75, letterSpacing: "0.02em" }}>{p}</span>
                  </div>
                ))}
              </Reveal>

              <Reveal delay={150}>
                <StoneCard style={{ padding: "32px" }}>
                  <div style={{ fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "10px", letterSpacing: "0.18em", marginBottom: "12px" }}>◈ YOUR REFERRAL LINK</div>
                  <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: "16px", marginBottom: "6px", color: C.text }}>Spread the Signal</h3>
                  <p style={{ fontFamily: FONT, color: C.muted, fontSize: "12px", marginBottom: "24px", letterSpacing: "0.02em", lineHeight: 1.7 }}>
                    Sign in to get your unique referral link and start growing the Raft.
                  </p>
                  <div style={{ background: "#030200", border: `1px solid ${C.border}`, borderRadius: "4px", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", fontFamily: MONO, fontSize: "11px", color: C.muted }}>
                    <span>otterprotocol.xyz?ref=YOUR_CODE</span>
                    <button onClick={copyLink} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedH }}>
                      {copied ? <CheckCircle size={13} color={C.green} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <button onClick={openAuthModal} style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, color: "#000", border: "none", borderRadius: "4px", padding: "13px 24px", fontWeight: 700, fontSize: "13px", cursor: "pointer", width: "100%", fontFamily: FONT, letterSpacing: "0.06em", boxShadow: "0 0 20px rgba(201,168,76,0.2)" }}>
                    SIGN IN TO GET YOUR CODE
                  </button>
                </StoneCard>
              </Reveal>
            </div>
          </div>
        </section>

        <AncientDivider glyph="🗿 · ◈ · 🗿" />

        {/* ═══ ROADMAP (THE SEALS) ═════════════════════════════════════════ */}
        <section id="roadmap" style={{ padding: "100px 24px", maxWidth: "1280px", margin: "0 auto" }}>
          <Reveal>
            <div style={{ maxWidth: "480px", marginBottom: "64px" }}>
              <AncientLabel hebrewChar="פ">The Seals</AncientLabel>
              <h2 style={{ fontFamily: FONT, fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "0.01em" }}>
                From draft to Ethereum standard.
              </h2>
            </div>
          </Reveal>

          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {[
              { seal: "SEAL I",   title: "Draft & Publish",  status: "ACTIVE", done: true,  emoji: "📜", items: ["EIP document written","Website launched","Medium & X announcement","Community feedback gathering"] },
              { seal: "SEAL II",  title: "Build & Prove",    status: "ACTIVE", done: false, emoji: "⚒️", items: ["Solidity reference implementation","Sepolia testnet deployment","Independent security audit","Community beta testing"] },
              { seal: "SEAL III", title: "Community Launch", status: "SOON",   done: false, emoji: "🚀", items: ["Ethereum Magicians forum discussion","EIP GitHub PR submission","DAO formation","The Raft official launch"] },
              { seal: "SEAL IV",  title: "Mainnet Standard", status: "FUTURE", done: false, emoji: "🏛️", items: ["Ethereum mainnet deployment","First ERC-OTTER compliant token","Ecosystem integrations","ERC Final status"] },
            ].map((p, i) => (
              <Reveal key={p.seal} delay={i * 80}>
                <div className="roadmap-item" style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "32px", paddingBottom: "48px", borderLeft: `1px solid ${i === 0 ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.1)"}`, paddingLeft: "32px", position: "relative", marginLeft: "80px" }}>
                  {/* Seal medallion */}
                  <div style={{ position: "absolute", left: "-14px", top: "0", width: "28px", height: "28px", borderRadius: "50%", background: p.done ? `radial-gradient(circle at 35% 30%, #F4DC8A, #C9A84C 50%, #8B6000)` : C.card, border: `2px solid ${p.done ? C.gold : "rgba(201,168,76,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.done ? <span style={{ fontFamily: MONO, fontSize: "9px", color: "#000", fontWeight: 900 }}>◈</span> : <span style={{ fontSize: "12px" }}>{p.emoji}</span>}
                  </div>
                  <div>
                    <div style={{ fontFamily: MONO, color: p.done ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.15)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", marginBottom: "8px" }}>{p.seal}</div>
                    <div style={{ display: "inline-flex", background: p.done ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${p.done ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.07)"}`, color: p.done ? C.gold : C.muted, borderRadius: "3px", padding: "2px 10px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", fontFamily: FONT }}>{p.status}</div>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: FONT, fontWeight: 700, fontSize: "18px", marginBottom: "16px", color: C.text, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{p.emoji}</span>{p.title}
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {p.items.map((item) => (
                        <div key={item} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          {p.done ? <CheckCircle size={14} color={C.gold} /> : <Circle size={14} color="rgba(201,168,76,0.15)" />}
                          <span style={{ fontFamily: FONT, color: p.done ? C.text : C.muted, fontSize: "13px", letterSpacing: "0.02em" }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <AncientDivider glyph="🌊 · ◈ · 🌊" />

        {/* ═══ COMMUNITY CTA ═══════════════════════════════════════════════ */}
        <section id="community" style={{ padding: "100px 24px", position: "relative", overflow: "hidden" }}>
          {/* Big otter background */}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", userSelect: "none" }}>
            <span style={{ fontSize: "340px", opacity: 0.025, filter: "sepia(0.8)", animation: "artifactDrift 12s ease-in-out infinite" }}>🦦</span>
          </div>

          <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
            <Reveal>
              <AncientLabel hebrewChar="ת">The Raft</AncientLabel>
              <h2 style={{ fontFamily: FONT, fontSize: "clamp(30px, 5vw, 60px)", fontWeight: 900, lineHeight: 1.05, marginBottom: "20px", letterSpacing: "0.01em" }}>
                Building in public.<br />
                <span style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Come build with us.
                </span>
              </h2>
              <p style={{ fontFamily: FONT, color: C.mutedH, fontSize: "15px", lineHeight: 1.9, marginBottom: "40px", maxWidth: "520px", margin: "0 auto 40px", letterSpacing: "0.02em" }}>
                Every line of code and every EIP discussion is open.{" "}
                <span style={{ color: C.text, fontWeight: 600 }}>The community owns the protocol.</span>
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginBottom: "48px" }}>
                <button onClick={openAuthModal} style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`, color: "#000", border: "none", borderRadius: "4px", padding: "14px 36px", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: FONT, letterSpacing: "0.06em", boxShadow: "0 0 30px rgba(201,168,76,0.3)" }}>
                  JOIN THE RAFT <ArrowRight size={14} />
                </button>
                <Link href="/eip" style={{ display: "inline-flex", alignItems: "center", gap: "8px", border: `1px solid rgba(201,168,76,0.2)`, color: C.text, textDecoration: "none", fontWeight: 600, fontSize: "14px", padding: "14px 36px", borderRadius: "4px", fontFamily: FONT, letterSpacing: "0.06em" }}>
                  READ EIP DRAFT
                </Link>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="community-socials" style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                {[
                  { label: "X / Twitter", sub: "@otter_protocol1",  glyph: "𝕏",   href: "https://x.com/otter_protocol1" },
                  { label: "Discord",     sub: "Join the Den",       glyph: "◆",   href: "https://discord.gg/EGzu4NHqP" },
                  { label: "Medium",      sub: "Blog & Updates",     glyph: "M",   href: "https://medium.com/@protocolotter" },
                  { label: "GitHub",      sub: "Open Source",        glyph: "</>", href: "https://github.com/nazsats/otter-protocol" },
                ].map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    style={{ background: C.card, border: `1px solid rgba(201,168,76,0.12)`, borderRadius: "8px", padding: "14px 18px", textDecoration: "none", transition: "border-color 0.2s, background 0.2s", textAlign: "center", minWidth: "120px" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,168,76,0.35)"; (e.currentTarget as HTMLAnchorElement).style.background = C.cardAlt; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,168,76,0.12)"; (e.currentTarget as HTMLAnchorElement).style.background = C.card; }}>
                    <div style={{ fontFamily: MONO, color: C.gold, fontSize: "16px", marginBottom: "6px", opacity: 0.6 }}>{s.glyph}</div>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: "12px", fontFamily: FONT, letterSpacing: "0.04em" }}>{s.label}</div>
                    <div style={{ color: C.mutedH, fontSize: "11px", marginTop: "3px" }}>{s.sub}</div>
                  </a>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
