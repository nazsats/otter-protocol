"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  black:   "#000000",
  gold:    "#C9A84C",
  goldL:   "#E2BF6E",
  green:   "#00C896",
  greenB:  "#00FF88",
  red:     "#FF4545",
  muted:   "#1A1A1A",
  mutedH:  "#3A3A3A",
  text:    "#E8E8E8",
  border:  "#111111",
  termG:   "#2A7A5A",   // dim terminal green
  termGL:  "#39D98A",   // bright terminal green
};
const MONO = "'JetBrains Mono','Fira Code','Courier New',monospace";

// ─── 4-stage path preview ─────────────────────────────────────────────────────
const PATH_STAGES = [
  { num: "I",   label: "CRACK THE GATE",     desc: "Three fragments. Three platforms. One password.",           icon: "◈" },
  { num: "II",  label: "CLAIM THE SIGIL",    desc: "Link your wallet. Mint your mark. It costs nothing.",       icon: "◆" },
  { num: "III", label: "FIRST CONTRIBUTION", desc: "Vote on three memes, or submit your own.",                  icon: "▲" },
  { num: "IV",  label: "RECRUIT ONE OTTER",  desc: "Bring one through the gate. Initiation complete.",          icon: "⟳" },
];

// ─── Boot sequence lines ──────────────────────────────────────────────────────
const BOOT: string[] = [
  "> OTTER.PROTOCOL v0.1 — CIPHER GATE",
  "> ESTABLISHING ENCRYPTED CHANNEL.......DONE",
  "> SCANNING AUTHORIZED NODES............ACTIVE",
  "> LOADING CIPHER MATRIX................READY",
  "> AWAITING AUTHORIZATION INPUT...    ",
];

// ─── Progressive hints (revealed per wrong attempt) ──────────────────────────
const HINTS: string[] = [
  "// HINT_01: THE CIPHER IS DISTRIBUTED ACROSS SIGNAL SOURCES",
  "// HINT_02: CHECK OUR POSTS — THE CODE HIDES IN PLAIN SIGHT",
  "// HINT_03: THREE PLATFORMS. ONE COMMUNITY. FIND THE OTTER.",
  "// HINT_04: SOME SEE WHAT OTHERS MISS. LOOK CLOSER.",
  "// HINT_05: THE EARLY OTTERS ALREADY KNOW. THEY ALWAYS DO.",
];

// ─── Social signal sources — update URLs to your actual profiles ──────────────
const SIGNALS = [
  {
    id: "01",
    label: "X.COM",
    sub: "INTERCEPT PRIMARY SIGNAL",
    hint: "Fragment I awaits",
    icon: "✕",
    url: "https://x.com/otter_protocol1",
  },
  {
    id: "02",
    label: "DISCORD",
    sub: "ACCESS THE DEN PROTOCOL",
    hint: "Fragment II is buried",
    icon: "◆",
    url: "https://discord.gg/EGzu4NHqP",
  },
  {
    id: "03",
    label: "TELEGRAM",
    sub: "TUNE TO FREQUENCY 03",
    hint: "Fragment III lies dormant",
    icon: "◈",
    url: "https://t.me/otterprotocol",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCode(raw: string): string {
  const clean = raw.replace(/-/g, "").toUpperCase().slice(0, 24);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 6) parts.push(clean.slice(i, i + 6));
  return parts.join("-");
}
function stripDashes(s: string) { return s.replace(/-/g, "").toUpperCase(); }

// ─── Component ────────────────────────────────────────────────────────────────
export default function GatePage() {
  const router = useRouter();
  const inputRef  = useRef<HTMLInputElement>(null);
  const attRef    = useRef(0);
  const hintsRef  = useRef<string[]>([]);

  const [code,     setCode]     = useState("");
  const [status,   setStatus]   = useState<"idle"|"loading"|"error"|"success">("idle");
  const [shaking,  setShaking]  = useState(false);
  const [glitch,   setGlitch]   = useState(false);
  const [dots,     setDots]     = useState("");
  const [hints,    setHints]    = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [bootDone,  setBootDone]  = useState(false);
  const [hoveredSignal, setHoveredSignal] = useState<string | null>(null);
  const [waitEmail,    setWaitEmail]    = useState("");
  const [waitStatus,   setWaitStatus]   = useState<"idle"|"loading"|"done"|"error">("idle");

  // Random community stats — initialized with stable values, randomized client-side to avoid hydration mismatch
  const [nodeCount, setNodeCount] = useState(200);
  const [lastAccess, setLastAccess] = useState("3m AGO");

  useEffect(() => {
    setNodeCount(Math.floor(Math.random() * 80) + 190);
    setLastAccess(`${Math.floor(Math.random() * 8) + 1}m AGO`);
  }, []);

  // Boot sequence
  useEffect(() => {
    let i = 0;
    function next() {
      if (i < BOOT.length) {
        const line = BOOT[i];
        i++;
        setBootLines(prev => [...prev, line]);
        setTimeout(next, 150);
      } else {
        setBootDone(true);
      }
    }
    setTimeout(next, 400);
  }, []);

  // Focus after boot
  useEffect(() => {
    if (bootDone) setTimeout(() => inputRef.current?.focus(), 200);
  }, [bootDone]);

  // Loading dots
  useEffect(() => {
    if (status !== "loading") { setDots(""); return; }
    const id = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 350);
    return () => clearInterval(id);
  }, [status]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = stripDashes(e.target.value);
    if (stripped.length <= 24) setCode(formatCode(stripped));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    if (e.key === "Backspace" && code.endsWith("-")) {
      e.preventDefault();
      setCode(c => c.slice(0, -2));
    }
  };

  const handleError = () => {
    setStatus("error");
    setShaking(true);
    setGlitch(true);
    attRef.current += 1;
    setAttempts(attRef.current);
    const hintIdx = Math.min(attRef.current - 1, HINTS.length - 1);
    const h = HINTS[hintIdx];
    if (!hintsRef.current.includes(h)) {
      hintsRef.current = [...hintsRef.current, h];
      setHints([...hintsRef.current]);
    }
    setTimeout(() => { setShaking(false); setGlitch(false); setStatus("idle"); }, 1800);
  };

  const submit = async () => {
    const clean = stripDashes(code);
    if (clean.length < 24) { handleError(); return; }
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/access", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: clean }),
      });
      if (res.ok) {
        setStatus("success");
        // Mark Stage I (gate) complete for the Initiation Path
        if (typeof window !== "undefined") {
          localStorage.setItem("otter_gate_passed", "true");
        }
        setTimeout(() => router.push("/about"), 1400);
      } else {
        handleError();
      }
    } catch {
      handleError();
    }
  };

  const submitWaitlist = async () => {
    const email = waitEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    setWaitStatus("loading");
    try {
      await addDoc(collection(db, "waitlist"), { email, createdAt: serverTimestamp() });
      setWaitStatus("done");
    } catch {
      setWaitStatus("error");
      setTimeout(() => setWaitStatus("idle"), 3000);
    }
  };

  const rawLen = stripDashes(code).length;
  const isReady = rawLen === 24 && status === "idle";

  const borderColor =
    status === "error"   ? C.red   :
    status === "success" ? C.green :
    status === "loading" ? "rgba(201,168,76,0.5)" :
    rawLen > 0           ? "rgba(201,168,76,0.28)" :
    C.border;

  const inputColor =
    status === "error"   ? C.red   :
    status === "success" ? C.green :
    C.text;

  return (
    <div style={{
      minHeight: "100vh",
      background: C.black,
      fontFamily: MONO,
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Inline styles ── */}
      <style>{`
        @keyframes bootLine   { from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)} }
        @keyframes cursorBlink{ 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes scanBeam   { 0%{top:-2px}100%{top:100vh} }
        @keyframes pulseRing  { 0%,100%{transform:scale(1);opacity:.18}50%{transform:scale(1.18);opacity:.06} }
        @keyframes nodeFlicker{ 0%,100%{opacity:1}50%{opacity:.5} }
        @keyframes glitchGate { 0%,100%{transform:none;filter:none} 20%{transform:translate(-3px,0);filter:hue-rotate(30deg)} 40%{transform:translate(3px,0);filter:hue-rotate(-30deg)} 60%{transform:translate(-1px,0)} }
        @keyframes successPulse{0%,100%{box-shadow:0 0 40px rgba(0,200,150,.2)}50%{box-shadow:0 0 70px rgba(0,200,150,.45)} }
        @keyframes termIn     { from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn     { from{opacity:0}to{opacity:1} }
        @keyframes shake      { 10%,90%{transform:translate3d(-2px,0,0)} 20%,80%{transform:translate3d(4px,0,0)} 30%,50%,70%{transform:translate3d(-4px,0,0)} 40%,60%{transform:translate3d(4px,0,0)} }
        @keyframes greenReveal{ 0%{opacity:0;transform:scaleX(0)}100%{opacity:1;transform:scaleX(1)} }
        .gate-shake { animation: shake 0.45s cubic-bezier(.36,.07,.19,.97) both; }
        .gate-glitch { animation: glitchGate 0.4s ease; }
        .signal-btn  { transition: all 0.18s ease !important; }
        .signal-btn:hover { border-color: rgba(201,168,76,0.28) !important; background: rgba(201,168,76,0.04) !important; }
        .signal-btn:hover .sig-arrow { transform: translateX(5px); color: #C9A84C !important; }
        .sig-arrow { transition: transform 0.18s, color 0.18s; }
        input:focus { outline: none !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Scanlines */}
      <div className="scanlines" />
      {/* Grid */}
      <div className="grid-lines" style={{ position:"absolute", inset:0, opacity:0.25 }} />

      {/* Horizontal scan beam */}
      <div style={{
        position:"fixed", left:0, right:0, height:"1px",
        background:`linear-gradient(90deg,transparent,rgba(0,200,150,0.2),rgba(201,168,76,0.3),rgba(0,200,150,0.2),transparent)`,
        animation:"scanBeam 10s linear infinite",
        pointerEvents:"none", zIndex:20,
      }} />

      {/* Gold radial glow */}
      <div style={{
        position:"fixed", top:"42%", left:"50%", transform:"translate(-50%,-50%)",
        width:"900px", height:"900px", borderRadius:"50%",
        background:"radial-gradient(circle,rgba(201,168,76,0.025) 0%,transparent 55%)",
        pointerEvents:"none",
      }} />

      {/* Green success glow */}
      <div style={{
        position:"fixed", top:"42%", left:"50%", transform:"translate(-50%,-50%)",
        width:"700px", height:"700px", borderRadius:"50%",
        background:"radial-gradient(circle,rgba(0,200,150,0.07) 0%,transparent 55%)",
        opacity: status==="success" ? 1 : 0,
        transition:"opacity 0.6s",
        pointerEvents:"none",
      }} />

      {/* ─── Main container ─── */}
      <div style={{
        position:"relative", zIndex:1,
        maxWidth:"580px", width:"100%",
        margin:"0 auto",
        padding:"clamp(20px,4vw,44px) clamp(16px,4vw,32px)",
        display:"flex", flexDirection:"column",
        minHeight:"100vh",
        animation:"fadeIn 0.4s ease",
      }}>

        {/* ── TOP STATUS BAR ── */}
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          marginBottom:"32px",
          borderBottom:`1px solid ${C.muted}`, paddingBottom:"12px",
        }}>
          <div style={{ fontSize:"9px", letterSpacing:"0.2em", color:C.mutedH }}>
            OTTER.PROTOCOL // CIPHER GATE
          </div>
          <div style={{ display:"flex", gap:"14px", fontSize:"9px", letterSpacing:"0.1em" }}>
            <span style={{ color:C.green, animation:"nodeFlicker 3.5s ease-in-out infinite" }}>
              ● {nodeCount} NODES
            </span>
            <span style={{ color:C.mutedH }}>LAST: {lastAccess}</span>
            <span style={{ color:C.gold, opacity:0.7 }}>◈ 0 INITIATED</span>
          </div>
        </div>

        {/* ── BOOT TERMINAL ── */}
        <div style={{
          background:"#020202",
          border:`1px solid ${C.muted}`,
          borderRadius:"4px",
          padding:"14px 18px",
          marginBottom:"32px",
          minHeight:"118px",
          position:"relative",
          overflow:"hidden",
        }}>
          {/* terminal top bar */}
          <div style={{
            position:"absolute", top:0, left:0, right:0, height:"1px",
            background:`linear-gradient(90deg,transparent,rgba(0,200,150,0.15),transparent)`,
          }} />
          {bootLines.map((line, i) => {
            const isPositive = line.includes("DONE") || line.includes("READY") || line.includes("ACTIVE");
            const isHeader   = i === 0;
            return (
              <div key={i} style={{
                animation:"bootLine 0.22s ease both",
                fontSize:"10px", lineHeight:"1.9", letterSpacing:"0.04em",
                color: isHeader ? C.gold : isPositive ? C.green : C.mutedH,
                fontWeight: isHeader ? 600 : 400,
              }}>
                {line}
                {isPositive && (
                  <span style={{ color:C.green, marginLeft:"4px", fontWeight:700 }}>✓</span>
                )}
              </div>
            );
          })}
          {!bootDone && (
            <span style={{ color:C.gold, fontSize:"12px", animation:"cursorBlink 0.9s step-end infinite" }}>█</span>
          )}
          {/* Progressive hints */}
          {hints.map((h, i) => (
            <div key={`h-${i}`} style={{
              color:C.gold, fontSize:"10px", lineHeight:"1.9",
              animation:"termIn 0.35s ease both",
              marginTop:"2px",
            }}>
              {h}
            </div>
          ))}
        </div>

        {/* ── LOGO + TITLE ── */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          {/* Animated rings + icon */}
          <div style={{ position:"relative", display:"inline-block", marginBottom:"22px" }}>
            <div style={{
              position:"absolute", inset:"-18px", borderRadius:"50%",
              border:`1px solid ${status==="success" ? "rgba(0,200,150,0.2)" : "rgba(201,168,76,0.1)"}`,
              animation:"pulseRing 3.5s ease-in-out infinite",
              transition:"border-color 0.5s",
            }} />
            <div style={{
              position:"absolute", inset:"-32px", borderRadius:"50%",
              border:`1px solid ${status==="success" ? "rgba(0,200,150,0.08)" : "rgba(201,168,76,0.04)"}`,
              animation:"pulseRing 3.5s ease-in-out infinite 1.2s",
              transition:"border-color 0.5s",
            }} />
            <div style={{
              width:"88px", height:"88px", borderRadius:"50%",
              overflow:"hidden",
              boxShadow: status==="success"
                ? "0 0 0 2px rgba(0,200,150,0.7), 0 0 50px rgba(0,200,150,0.35)"
                : "0 0 0 2px rgba(201,168,76,0.55), 0 0 40px rgba(201,168,76,0.22)",
              transition:"all 0.5s",
              animation: status==="success" ? "successPulse 1.8s ease-in-out infinite" : "coin-glow-anim 4s ease-in-out infinite",
              filter: status==="success" ? "hue-rotate(120deg) brightness(1.05)" : "none",
            }}>
              <Image src="/otter-logo.png" alt="OTTER" width={88} height={88} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} priority unoptimized />
            </div>
          </div>

          <h1 className={glitch ? "gate-glitch" : ""} style={{
            fontSize:"clamp(22px,5vw,28px)", fontWeight:700,
            letterSpacing:"0.22em", color:C.text,
            marginBottom:"6px", textTransform:"uppercase",
          }}>
            OTTER PROTOCOL
          </h1>
          <div style={{
            fontSize:"10px", letterSpacing:"0.15em",
            color: status==="success" ? C.green : C.gold,
            transition:"color 0.4s",
            fontWeight:500,
          }}>
            {status==="success"
              ? "// ACCESS GRANTED — WELCOME, OTTER 🦦"
              : "ERC-OTTER · ETHEREUM · ACCESS REQUIRED"
            }
          </div>
        </div>

        {/* ── WAITLIST ── */}
        <div style={{
          background:"#030303",
          border:`1px solid ${C.muted}`,
          borderRadius:"6px",
          padding:"20px",
          marginBottom:"24px",
        }}>
          <div style={{ fontSize:"9px", letterSpacing:"0.2em", color:C.gold, marginBottom:"8px" }}>
            ◈ NO CODE? JOIN THE WAITLIST
          </div>
          <div style={{ fontSize:"10px", color:"#555", letterSpacing:"0.05em", lineHeight:1.7, marginBottom:"14px" }}>
            Early access codes are hidden in our social channels. Not found one yet? Drop your email — we&apos;ll notify you when a slot opens.
          </div>
          {waitStatus === "done" ? (
            <div style={{ fontSize:"11px", color:C.green, letterSpacing:"0.1em", padding:"10px 0" }}>
              ✓ YOU&apos;RE ON THE LIST — WE&apos;LL REACH OUT SOON
            </div>
          ) : (
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={waitEmail}
                onChange={(e) => setWaitEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitWaitlist()}
                disabled={waitStatus === "loading"}
                style={{
                  flex:1, minWidth:"160px",
                  background:"#040404", border:`1px solid ${waitStatus === "error" ? C.red : "#222"}`,
                  borderRadius:"4px", padding:"11px 14px",
                  color:C.text, fontSize:"12px", fontFamily:MONO,
                  outline:"none", letterSpacing:"0.04em",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(201,168,76,0.3)")}
                onBlur={(e) => (e.target.style.borderColor = waitStatus === "error" ? C.red : "#222")}
              />
              <button
                onClick={submitWaitlist}
                disabled={waitStatus === "loading" || !waitEmail.trim()}
                style={{
                  padding:"11px 20px",
                  background: waitStatus === "loading" ? "#040404" : "rgba(201,168,76,0.08)",
                  border:`1px solid ${waitStatus === "loading" ? "#222" : "rgba(201,168,76,0.2)"}`,
                  borderRadius:"4px",
                  color: waitStatus === "loading" ? C.mutedH : C.gold,
                  fontSize:"10px", fontFamily:MONO, fontWeight:700,
                  letterSpacing:"0.18em", cursor: !waitEmail.trim() ? "not-allowed" : "pointer",
                  whiteSpace:"nowrap",
                  opacity: !waitEmail.trim() ? 0.5 : 1,
                }}
              >
                {waitStatus === "loading" ? "SENDING…" : waitStatus === "error" ? "RETRY" : "JOIN WAITLIST →"}
              </button>
            </div>
          )}
        </div>

        {/* ── HAVE A CODE? ── */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
          <div style={{ flex:1, height:"1px", background:C.muted }} />
          <div style={{ fontSize:"8px", letterSpacing:"0.24em", color:C.mutedH }}>
            ◈ HAVE AN ACCESS CODE?
          </div>
          <div style={{ flex:1, height:"1px", background:C.muted }} />
        </div>

        {/* ── CIPHER INPUT ── */}
        <div style={{ marginBottom:"16px" }}>
          <div style={{
            display:"flex", justifyContent:"space-between", alignItems:"center",
            marginBottom:"10px",
          }}>
            <div style={{ fontSize:"9px", letterSpacing:"0.2em", color:C.mutedH }}>
              {">"} CIPHER KEY INPUT
            </div>
            <div style={{ fontSize:"9px", letterSpacing:"0.08em", color:C.mutedH }}>
              {attempts > 0 && (
                <span style={{ color:C.red, marginRight:"10px" }}>ATTEMPTS: {attempts}</span>
              )}
              <span>{rawLen}/24</span>
            </div>
          </div>

          <div className={shaking ? "gate-shake" : ""} style={{ position:"relative" }}>
            <input
              ref={inputRef}
              value={code}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
              maxLength={27}
              disabled={status === "loading" || status === "success"}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              style={{
                width:"100%", padding:"18px 20px",
                background: status==="success" ? "rgba(0,200,150,0.04)" : "#040404",
                border:`1px solid ${borderColor}`,
                borderRadius:"6px",
                color:inputColor,
                fontSize:"18px", fontFamily:MONO,
                letterSpacing:"0.14em", textAlign:"center",
                outline:"none", boxSizing:"border-box",
                transition:"all 0.25s",
                boxShadow:
                  status==="success" ? "0 0 30px rgba(0,200,150,0.12), inset 0 0 20px rgba(0,200,150,0.04)" :
                  status==="error"   ? "0 0 20px rgba(255,69,69,0.1)" :
                  rawLen > 0         ? "0 0 16px rgba(201,168,76,0.04)" :
                  "none",
                caretColor:C.gold,
              }}
            />
          </div>

          {/* Progress bar */}
          <div style={{
            height:"2px", background:C.muted,
            borderRadius:"1px", marginTop:"8px", overflow:"hidden",
          }}>
            <div style={{
              height:"100%",
              width:`${(rawLen/24)*100}%`,
              background:
                status==="error"   ? C.red :
                status==="success" ? `linear-gradient(90deg,${C.green},${C.greenB})` :
                `linear-gradient(90deg,${C.gold},${C.goldL})`,
              borderRadius:"1px",
              transition:"width 0.08s ease, background 0.3s",
              boxShadow: status==="success" ? "0 0 8px rgba(0,255,136,0.6)" : "none",
            }} />
          </div>

          {/* Status message */}
          <div style={{
            height:"22px", marginTop:"6px",
            fontSize:"10px", letterSpacing:"0.12em", textAlign:"center",
            color:
              status==="error"   ? C.red :
              status==="success" ? C.green :
              "transparent",
          }}>
            {status==="error"   && "> CIPHER REJECTED — AUTHORIZATION FAILED"}
            {status==="success" && "> CIPHER ACCEPTED — INITIALIZING SECURE ACCESS"}
          </div>
        </div>

        {/* ── SUBMIT ── */}
        <button
          onClick={submit}
          disabled={!isReady}
          style={{
            width:"100%", padding:"15px 24px",
            background: status==="success"
              ? "rgba(0,200,150,0.1)"
              : isReady
              ? "linear-gradient(135deg,#C9A84C,#E2BF6E)"
              : "#040404",
            border:`1px solid ${
              status==="success" ? "rgba(0,200,150,0.4)" :
              isReady ? "transparent" :
              C.muted
            }`,
            borderRadius:"6px",
            color: status==="success" ? C.green : isReady ? "#000" : C.mutedH,
            fontSize:"11px", fontWeight:700, letterSpacing:"0.22em",
            cursor: !isReady ? "not-allowed" : "pointer",
            textTransform:"uppercase",
            transition:"all 0.25s",
            fontFamily:MONO,
            marginBottom:"36px",
          }}
        >
          {status==="loading"  ? `> VERIFYING CIPHER${dots}` :
           status==="success"  ? "> ACCESS GRANTED — ENTERING PROTOCOL" :
           "> SUBMIT CIPHER KEY →"}
        </button>

        {/* ── DIVIDER ── */}
        <div style={{
          display:"flex", alignItems:"center", gap:"12px",
          marginBottom:"14px",
        }}>
          <div style={{ flex:1, height:"1px", background:C.muted }} />
          <div style={{ fontSize:"8px", letterSpacing:"0.24em", color:C.mutedH }}>
            ◈ SIGNAL SOURCES
          </div>
          <div style={{ flex:1, height:"1px", background:C.muted }} />
        </div>

        {/* ── SIGNAL SOURCE DESCRIPTION ── */}
        <div style={{
          fontSize:"10px", color:C.mutedH, textAlign:"center",
          marginBottom:"16px", letterSpacing:"0.07em", lineHeight:1.8,
        }}>
          The cipher is distributed across community channels.{" "}
          <span style={{ color:C.gold }}>Intercept the signal. Find the key.</span>
        </div>

        {/* ── SOCIAL SIGNAL BUTTONS ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"32px" }}>
          {SIGNALS.map((s) => {
            const hovered = hoveredSignal === s.id;
            return (
              <a
                key={s.id}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="signal-btn"
                onMouseEnter={() => setHoveredSignal(s.id)}
                onMouseLeave={() => setHoveredSignal(null)}
                style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"13px 18px",
                  background: hovered ? "rgba(201,168,76,0.04)" : "rgba(201,168,76,0.015)",
                  border:`1px solid ${hovered ? "rgba(201,168,76,0.25)" : "rgba(201,168,76,0.07)"}`,
                  borderRadius:"6px",
                  textDecoration:"none",
                  cursor:"pointer",
                  position:"relative", overflow:"hidden",
                }}
              >
                {/* Left scan line on hover */}
                {hovered && (
                  <div style={{
                    position:"absolute", left:0, top:0, bottom:0, width:"2px",
                    background:`linear-gradient(180deg,transparent,${C.gold},transparent)`,
                    animation:"greenReveal 0.3s ease",
                  }} />
                )}
                <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                  <div style={{
                    width:"32px", height:"32px",
                    borderRadius:"6px",
                    background: hovered ? "rgba(201,168,76,0.1)" : "rgba(201,168,76,0.04)",
                    border:`1px solid ${hovered ? "rgba(201,168,76,0.2)" : "rgba(201,168,76,0.06)"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.2s",
                    fontSize:"13px", color: hovered ? C.gold : C.mutedH,
                  }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={{ fontSize:"8px", letterSpacing:"0.2em", color:C.mutedH }}>
                      SIGNAL_{s.id}
                    </div>
                    <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", color: hovered ? C.text : "#888" }}>
                      {s.label}
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <span style={{ fontSize:"9px", letterSpacing:"0.08em", color: hovered ? C.gold : C.mutedH, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"2px" }}>
                    <span>{s.sub}</span>
                    {hovered && (
                      <span style={{ color:C.green, animation:"termIn 0.2s ease", fontSize:"8px" }}>
                        {s.hint}
                      </span>
                    )}
                  </span>
                  <span className="sig-arrow" style={{ color: hovered ? C.gold : C.mutedH, fontSize:"14px" }}>→</span>
                </div>
              </a>
            );
          })}
        </div>

        {/* ── COMMUNITY ACTIVITY BAR ── */}
        <div style={{
          background:"#030303",
          border:`1px solid ${C.muted}`,
          borderRadius:"4px",
          padding:"12px 18px",
          marginBottom:"28px",
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }}>
          <div style={{ fontSize:"9px", letterSpacing:"0.1em", color:C.mutedH }}>
            COMMUNITY STATUS
          </div>
          <div style={{ display:"flex", gap:"20px", fontSize:"9px", letterSpacing:"0.08em" }}>
            <span style={{ color:C.green }}>
              ● {nodeCount} ACTIVE
            </span>
            <span style={{ color:C.mutedH }}>
              LAST ENTRY: {lastAccess}
            </span>
            <span style={{ color:C.gold, opacity:0.6 }}>
              SEASON I OPEN
            </span>
          </div>
        </div>

        {/* ── WHAT AWAITS ── */}
        <div style={{ marginBottom:"28px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
            <div style={{ flex:1, height:"1px", background:C.muted }} />
            <div style={{ fontSize:"8px", letterSpacing:"0.24em", color:C.mutedH }}>
              ◈ WHAT AWAITS INSIDE
            </div>
            <div style={{ flex:1, height:"1px", background:C.muted }} />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
            {PATH_STAGES.map((stage, i) => (
              <div key={i} style={{
                background:"#030303",
                border:`1px solid ${C.muted}`,
                borderRadius:"6px",
                padding:"12px 14px",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" }}>
                  <span style={{ fontSize:"10px", color:C.gold, fontFamily:MONO }}>{stage.icon}</span>
                  <span style={{ fontSize:"7px", letterSpacing:"0.2em", color:C.mutedH }}>
                    STAGE {stage.num}
                  </span>
                </div>
                <div style={{ fontSize:"8px", fontWeight:700, letterSpacing:"0.12em", color:"#777", marginBottom:"4px" }}>
                  {stage.label}
                </div>
                <div style={{ fontSize:"8px", color:"#3A3A3A", lineHeight:"1.6", letterSpacing:"0.03em" }}>
                  {stage.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          marginTop:"auto",
          paddingTop:"20px",
          borderTop:`1px solid ${C.muted}`,
          display:"flex", justifyContent:"space-between",
          fontSize:"9px", color:"#1C1C1C", letterSpacing:"0.14em",
        }}>
          <span>ERC-OTTER · ETHEREUM</span>
          <span style={{ color:C.mutedH }}>// RESTRICTED BETA</span>
          <span>CIPHER GATE v0.1</span>
        </div>

      </div>
    </div>
  );
}
