"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  black:  "#000000",
  gold:   "#C9A84C",
  goldL:  "#E2BF6E",
  green:  "#00C896",
  red:    "#FF4545",
  muted:  "#1A1A1A",
  mutedH: "#3A3A3A",
  text:   "#E8E8E8",
  sub:    "#8A8A8A",
};
const MONO = "'JetBrains Mono','Fira Code','Courier New',monospace";

// ─── Where codes are hidden ───────────────────────────────────────────────────
const SIGNALS = [
  { label: "X.com",    icon: "✕", url: "https://x.com/otter_protocol1" },
  { label: "Discord",  icon: "◆", url: "https://discord.gg/EGzu4NHqP" },
  { label: "Telegram", icon: "◈", url: "https://t.me/otterprotocol" },
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
  const inputRef = useRef<HTMLInputElement>(null);

  const [code,   setCode]   = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"error"|"success">("idle");
  const [shaking, setShaking] = useState(false);

  const [waitEmail,  setWaitEmail]  = useState("");
  const [waitStatus, setWaitStatus] = useState<"idle"|"loading"|"done"|"error">("idle");

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300); }, []);

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
    setTimeout(() => { setShaking(false); setStatus("idle"); }, 1500);
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
        if (typeof window !== "undefined") {
          localStorage.setItem("otter_gate_passed", "true");
        }
        setTimeout(() => router.push("/about"), 1200);
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
    status === "error"   ? C.red :
    status === "success" ? C.green :
    rawLen > 0           ? "rgba(201,168,76,0.4)" :
    "#222";

  return (
    <div style={{
      minHeight: "100vh",
      background: C.black,
      fontFamily: MONO,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 16px",
    }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake  { 10%,90%{transform:translate3d(-2px,0,0)} 20%,80%{transform:translate3d(4px,0,0)} 30%,50%,70%{transform:translate3d(-4px,0,0)} 40%,60%{transform:translate3d(4px,0,0)} }
        .gate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        input:focus { outline: none !important; }
      `}</style>

      {/* Soft gold glow behind the card */}
      <div style={{
        position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        width:"600px", height:"600px", borderRadius:"50%",
        background:`radial-gradient(circle,${status==="success" ? "rgba(0,200,150,0.06)" : "rgba(201,168,76,0.04)"} 0%,transparent 60%)`,
        pointerEvents:"none", transition:"background 0.6s",
      }} />

      {/* ─── Card ─── */}
      <div style={{
        position:"relative", zIndex:1,
        width:"100%", maxWidth:"440px",
        animation:"fadeIn 0.4s ease",
      }}>

        {/* ── Logo + title ── */}
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{
            width:"72px", height:"72px", borderRadius:"50%",
            overflow:"hidden", margin:"0 auto 18px",
            boxShadow: status==="success"
              ? "0 0 0 2px rgba(0,200,150,0.6), 0 0 40px rgba(0,200,150,0.3)"
              : "0 0 0 2px rgba(201,168,76,0.5), 0 0 30px rgba(201,168,76,0.18)",
            transition:"all 0.5s",
          }}>
            <Image src="/otter-logo.png" alt="OTTER" width={72} height={72}
              style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} priority unoptimized />
          </div>
          <h1 style={{
            fontSize:"clamp(20px,5vw,26px)", fontWeight:700,
            letterSpacing:"0.2em", color:C.text, margin:"0 0 8px",
            textTransform:"uppercase",
          }}>
            OTTER Protocol
          </h1>
          <p style={{
            fontSize:"12px", letterSpacing:"0.06em", lineHeight:1.6,
            color: status==="success" ? C.green : C.sub, margin:0,
          }}>
            {status==="success"
              ? "Access granted — welcome, Otter 🦦"
              : "Members only. Enter your access code to continue."}
          </p>
        </div>

        {/* ── STEP 1: Enter code ── */}
        <div style={{
          background:"#080808",
          border:`1px solid ${C.muted}`,
          borderRadius:"12px",
          padding:"24px",
          marginBottom:"16px",
        }}>
          <label style={{
            display:"block", fontSize:"13px", fontWeight:700,
            color:C.text, marginBottom:"4px", letterSpacing:"0.02em",
          }}>
            Have an access code?
          </label>
          <p style={{ fontSize:"11px", color:C.sub, margin:"0 0 16px", lineHeight:1.6 }}>
            Enter your 24-character code below.
          </p>

          <div className={shaking ? "gate-shake" : ""}>
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
                width:"100%", padding:"16px 14px",
                background: status==="success" ? "rgba(0,200,150,0.05)" : "#000",
                border:`1px solid ${borderColor}`,
                borderRadius:"8px",
                color: status==="error" ? C.red : status==="success" ? C.green : C.text,
                fontSize:"16px", fontFamily:MONO,
                letterSpacing:"0.1em", textAlign:"center",
                outline:"none", boxSizing:"border-box",
                transition:"all 0.25s", caretColor:C.gold,
              }}
            />
          </div>

          {/* progress + counter */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginTop:"10px" }}>
            <div style={{ flex:1, height:"3px", background:C.muted, borderRadius:"2px", overflow:"hidden" }}>
              <div style={{
                height:"100%", width:`${(rawLen/24)*100}%`,
                background: status==="error" ? C.red
                  : status==="success" ? C.green
                  : `linear-gradient(90deg,${C.gold},${C.goldL})`,
                borderRadius:"2px", transition:"width 0.1s ease, background 0.3s",
              }} />
            </div>
            <span style={{ fontSize:"10px", color:C.mutedH, minWidth:"38px", textAlign:"right" }}>
              {rawLen}/24
            </span>
          </div>

          {/* status message */}
          <div style={{
            height:"18px", marginTop:"6px", fontSize:"11px",
            letterSpacing:"0.03em", textAlign:"center",
            color: status==="error" ? C.red : status==="success" ? C.green : "transparent",
          }}>
            {status==="error"   && "Incorrect code — please try again"}
            {status==="success" && "Code accepted — entering…"}
          </div>

          <button
            onClick={submit}
            disabled={!isReady}
            style={{
              width:"100%", padding:"14px",
              marginTop:"4px",
              background: isReady ? `linear-gradient(135deg,${C.gold},${C.goldL})` : "#111",
              border:"none", borderRadius:"8px",
              color: isReady ? "#000" : C.mutedH,
              fontSize:"13px", fontWeight:700, letterSpacing:"0.08em",
              cursor: !isReady ? "not-allowed" : "pointer",
              fontFamily:MONO, transition:"all 0.25s",
            }}
          >
            {status==="loading" ? "Verifying…"
              : status==="success" ? "Access granted →"
              : "Unlock access"}
          </button>
        </div>

        {/* ── STEP 2: Join waitlist ── */}
        <div style={{
          background:"#080808",
          border:`1px solid ${C.muted}`,
          borderRadius:"12px",
          padding:"24px",
          marginBottom:"24px",
        }}>
          <label style={{
            display:"block", fontSize:"13px", fontWeight:700,
            color:C.text, marginBottom:"4px", letterSpacing:"0.02em",
          }}>
            No code yet? Join the waitlist
          </label>
          <p style={{ fontSize:"11px", color:C.sub, margin:"0 0 16px", lineHeight:1.6 }}>
            Drop your email and we&apos;ll notify you when a slot opens.
          </p>

          {waitStatus === "done" ? (
            <div style={{
              fontSize:"12px", color:C.green, textAlign:"center",
              padding:"14px", background:"rgba(0,200,150,0.06)",
              border:"1px solid rgba(0,200,150,0.2)", borderRadius:"8px",
            }}>
              ✓ You&apos;re on the list — we&apos;ll reach out soon
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={waitEmail}
                onChange={(e) => setWaitEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitWaitlist()}
                disabled={waitStatus === "loading"}
                style={{
                  width:"100%", padding:"14px",
                  background:"#000",
                  border:`1px solid ${waitStatus === "error" ? C.red : "#222"}`,
                  borderRadius:"8px", color:C.text, fontSize:"14px",
                  fontFamily:MONO, outline:"none", boxSizing:"border-box",
                }}
              />
              <button
                onClick={submitWaitlist}
                disabled={waitStatus === "loading" || !waitEmail.trim()}
                style={{
                  width:"100%", padding:"14px",
                  background:"transparent",
                  border:`1px solid ${C.gold}`,
                  borderRadius:"8px",
                  color: C.gold, fontSize:"13px", fontWeight:700,
                  letterSpacing:"0.08em", fontFamily:MONO,
                  cursor: !waitEmail.trim() ? "not-allowed" : "pointer",
                  opacity: !waitEmail.trim() ? 0.45 : 1,
                  transition:"all 0.2s",
                }}
              >
                {waitStatus === "loading" ? "Sending…"
                  : waitStatus === "error" ? "Try again"
                  : "Join the waitlist"}
              </button>
            </div>
          )}
        </div>

        {/* ── Where to find a code ── */}
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <p style={{ fontSize:"11px", color:C.sub, margin:"0 0 12px", lineHeight:1.6 }}>
            Access codes are hidden across our community channels:
          </p>
          <div style={{ display:"flex", justifyContent:"center", gap:"10px" }}>
            {SIGNALS.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:"flex", alignItems:"center", gap:"8px",
                  padding:"10px 14px",
                  background:"#080808", border:`1px solid ${C.muted}`,
                  borderRadius:"8px", textDecoration:"none",
                  color:C.sub, fontSize:"11px", fontWeight:600,
                  letterSpacing:"0.04em", transition:"all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)";
                  e.currentTarget.style.color = C.gold;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.muted;
                  e.currentTarget.style.color = C.sub;
                }}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          textAlign:"center", fontSize:"9px", color:"#2A2A2A",
          letterSpacing:"0.14em", textTransform:"uppercase",
        }}>
          ERC-OTTER · Ethereum · Restricted Beta
        </div>

      </div>
    </div>
  );
}
