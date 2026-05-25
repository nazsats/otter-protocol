"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const C = {
  black:  "#000000",
  gold:   "#C9A84C",
  goldL:  "#E2BF6E",
  green:  "#00C896",
  red:    "#FF4545",
  muted:  "#3A3A3A",
  mutedH: "#555555",
  text:   "#E8E8E8",
  border: "#1A1A1A",
};

// Format 24 raw chars into XXXXXX-XXXXXX-XXXXXX-XXXXXX
function formatCode(raw: string): string {
  const clean = raw.replace(/-/g, "").toUpperCase().slice(0, 24);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 6) parts.push(clean.slice(i, i + 6));
  return parts.join("-");
}

function stripDashes(s: string) {
  return s.replace(/-/g, "").toUpperCase();
}

export default function GatePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code,    setCode]    = useState("");
  const [status,  setStatus]  = useState<"idle" | "loading" | "error" | "success">("idle");
  const [shaking, setShaking] = useState(false);
  const [dots,    setDots]    = useState("");

  // Animated dots for loading
  useEffect(() => {
    if (status !== "loading") return;
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 400);
    return () => clearInterval(id);
  }, [status]);

  // Auto-focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw  = e.target.value;
    const stripped = stripDashes(raw);
    if (stripped.length <= 24) setCode(formatCode(stripped));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    // Allow backspace to delete the character before the dash
    if (e.key === "Backspace" && code.endsWith("-")) {
      e.preventDefault();
      setCode((c) => c.slice(0, -2));
    }
  };

  const submit = async () => {
    const clean = stripDashes(code);
    if (clean.length < 24) {
      shake("Invalid length");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/access", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: clean }),
      });
      if (res.ok) {
        setStatus("success");
        setTimeout(() => router.push("/about"), 900);
      } else {
        shake("Invalid code");
      }
    } catch {
      shake("Connection error");
    }
  };

  const shake = (msg: string) => {
    setStatus("error");
    setShaking(true);
    setTimeout(() => { setShaking(false); setStatus("idle"); }, 1800);
    void msg;
  };

  const rawLen = stripDashes(code).length;

  return (
    <div style={{
      minHeight: "100vh", background: C.black, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
      position: "relative", overflow: "hidden",
    }}>
      {/* Scanlines */}
      <div className="scanlines" />

      {/* Grid */}
      <div className="grid-lines" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />

      {/* Gold radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: "700px", height: "700px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      {/* Main content */}
      <div className="gate-enter" style={{
        position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", padding: "24px", width: "100%", maxWidth: "520px",
      }}>

        {/* Protocol ID tag */}
        <div style={{
          fontSize: "10px", letterSpacing: "0.2em", color: C.mutedH,
          marginBottom: "40px", fontWeight: 400,
        }}>
          OTTER.PROTOCOL // v0.1-BETA // RESTRICTED
        </div>

        {/* Hexagonal icon */}
        <div style={{
          position: "relative", marginBottom: "32px",
        }}>
          {/* Outer ring pulse */}
          <div style={{
            position: "absolute", inset: "-12px", borderRadius: "50%",
            border: "1px solid rgba(201,168,76,0.1)",
            animation: "season-pulse 3s ease-in-out infinite",
          }} />
          {/* Icon */}
          <div style={{
            width: "72px", height: "72px", borderRadius: "16px",
            background: "linear-gradient(135deg, #C9A84C, #E2BF6E)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(201,168,76,0.2)",
          }}>
            <span style={{
              fontWeight: 900, fontSize: "22px", color: "#000",
              fontFamily: "Georgia, serif", letterSpacing: "-1px",
            }}>OT</span>
          </div>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "clamp(20px, 5vw, 28px)", fontWeight: 700,
          letterSpacing: "0.16em", color: C.text,
          marginBottom: "8px", textTransform: "uppercase",
        }}>
          OTTER PROTOCOL
        </h1>

        {/* Subtitle */}
        <div style={{
          fontSize: "11px", letterSpacing: "0.14em", color: C.gold,
          marginBottom: "48px", fontWeight: 500,
        }}>
          ERC-OTTER · ETHEREUM · ACCESS REQUIRED
        </div>

        {/* Description */}
        <p style={{
          color: C.mutedH, fontSize: "13px", lineHeight: 1.8,
          marginBottom: "48px", maxWidth: "360px",
        }}>
          This protocol is invite-only during beta phase.<br />
          Enter your authorization code to proceed.
        </p>

        {/* Code input container */}
        <div style={{ width: "100%", marginBottom: "20px" }}>
          <div style={{
            fontSize: "10px", letterSpacing: "0.14em", color: C.mutedH,
            marginBottom: "10px", textAlign: "left",
          }}>
            AUTHORIZATION CODE
          </div>

          <div className={shaking ? "gate-shake" : ""} style={{ position: "relative" }}>
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
                width: "100%", padding: "18px 20px",
                background: "#060606",
                border: `1px solid ${
                  status === "error"   ? C.red   :
                  status === "success" ? C.green  :
                  status === "loading" ? "rgba(201,168,76,0.4)" :
                  code.length > 0     ? "rgba(201,168,76,0.25)" :
                  C.border
                }`,
                borderRadius: "12px",
                color: status === "error" ? C.red : status === "success" ? C.green : C.text,
                fontSize: "18px", fontFamily: "inherit",
                letterSpacing: "0.12em", textAlign: "center",
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s, color 0.2s, box-shadow 0.2s",
                boxShadow: status === "success"
                  ? "0 0 24px rgba(0,200,150,0.15)"
                  : status === "loading"
                  ? "0 0 24px rgba(201,168,76,0.08)"
                  : "none",
                caretColor: C.gold,
              }}
            />

            {/* Character count */}
            <div style={{
              position: "absolute", right: "14px", bottom: "8px",
              fontSize: "9px", color: C.mutedH, letterSpacing: "0.06em",
            }}>
              {rawLen}/24
            </div>
          </div>

          {/* Status line */}
          <div style={{
            height: "20px", marginTop: "8px",
            fontSize: "11px", letterSpacing: "0.1em", textAlign: "center",
            color: status === "error" ? C.red : status === "success" ? C.green : "transparent",
          }}>
            {status === "error"   && "// INVALID AUTHORIZATION CODE"}
            {status === "success" && "// ACCESS GRANTED — REDIRECTING"}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          width: "100%", height: "2px", background: C.border,
          borderRadius: "1px", marginBottom: "24px", overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${(rawLen / 24) * 100}%`,
            background: status === "error" ? C.red : status === "success" ? C.green : `linear-gradient(90deg, ${C.gold}, ${C.goldL})`,
            borderRadius: "1px",
            transition: "width 0.1s ease, background 0.3s ease",
          }} />
        </div>

        {/* Submit button */}
        <button
          onClick={submit}
          disabled={status === "loading" || status === "success" || rawLen < 24}
          style={{
            width: "100%", padding: "15px 24px",
            background: rawLen === 24 && status === "idle"
              ? "linear-gradient(135deg, #C9A84C, #E2BF6E)"
              : status === "success"
              ? "rgba(0,200,150,0.15)"
              : "#0A0A0A",
            border: `1px solid ${
              rawLen === 24 && status === "idle" ? "transparent" :
              status === "success" ? "rgba(0,200,150,0.3)" :
              C.border
            }`,
            borderRadius: "10px",
            color: rawLen === 24 && status === "idle" ? "#000" : status === "success" ? C.green : C.mutedH,
            fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em",
            cursor: rawLen < 24 || status !== "idle" ? "not-allowed" : "pointer",
            textTransform: "uppercase", transition: "all 0.2s",
            fontFamily: "inherit",
          }}
        >
          {status === "loading" ? `VERIFYING${dots}` : status === "success" ? "ACCESS GRANTED" : "AUTHORIZE →"}
        </button>

        {/* Footer hints */}
        <div style={{
          marginTop: "48px",
          display: "flex", flexDirection: "column", gap: "8px",
          fontSize: "10px", color: C.muted, letterSpacing: "0.1em",
        }}>
          <div>ACCESS CODES ARE DISTRIBUTED ON X AND FARCASTER</div>
          <div style={{ color: "#2A2A2A" }}>────────────────────────────────</div>
          <div>// ERC-OTTER · ETHEREUM IMPROVEMENT PROPOSAL</div>
        </div>
      </div>
    </div>
  );
}
