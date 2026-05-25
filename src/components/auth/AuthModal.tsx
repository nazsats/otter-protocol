"use client";
import { useState, useEffect } from "react";
import { X, Mail, Eye, EyeOff, Globe, ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

type View = "main" | "email-signin" | "email-signup";

const C = { bg: "#0A0A0A", card: "#111", border: "#222", gold: "#C9A84C", text: "#E8E8E8", muted: "#555", red: "#FF4545", green: "#00C896" };

export default function AuthModal() {
  const { closeAuthModal, signInWithGoogle, signInWithTwitter, signInWithEmail, signUpWithEmail } = useAuth();
  const toast   = useToast();
  const [view, setView]       = useState<View>("main");
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [name, setName]       = useState("");
  const [ref, setRef]         = useState("");
  const [showP, setShowP]     = useState(false);
  const [err, setErr]         = useState("");
  const [busy, setBusy]       = useState(false);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Auto-fill referral from URL
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) setRef(r.toUpperCase());
  }, []);

  const go = async (fn: () => Promise<void>) => {
    setErr(""); setBusy(true);
    try { await fn(); closeAuthModal(); toast("Welcome to the Raft!", "success"); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErr(msg.replace("Firebase: ", "").replace(/\(auth\/[^)]+\)/g, "").trim());
    } finally { setBusy(false); }
  };

  const inp: React.CSSProperties = { background: "#080808", border: `1px solid ${C.border}`, borderRadius: "10px", padding: "13px 16px", color: C.text, fontSize: "15px", width: "100%", outline: "none", fontFamily: "inherit" };

  const btnGold: React.CSSProperties = { background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "14px", fontWeight: 700, fontSize: "15px", cursor: busy ? "not-allowed" : "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", opacity: busy ? 0.7 : 1 };
  const btnOut: React.CSSProperties  = { background: "transparent", border: `1px solid ${C.border}`, color: C.text, borderRadius: "10px", padding: "13px", fontWeight: 600, fontSize: "15px", cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }} onClick={closeAuthModal}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, border: "1px solid #2A2A2A", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "400px", position: "relative", animation: "slide-up 0.25s ease-out", boxShadow: "0 40px 100px rgba(0,0,0,0.9)" }}>

        <button onClick={closeAuthModal} style={{ position: "absolute", top: "14px", right: "14px", background: "#1A1A1A", border: "none", borderRadius: "8px", padding: "7px", cursor: "pointer", color: C.muted, display: "flex" }}>
          <X size={15} />
        </button>

        {/* ── MAIN ── */}
        {view === "main" && <>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontWeight: 900, fontSize: "18px", color: "#000", fontFamily: "Georgia,serif" }}>OT</span>
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "6px" }}>Join the Raft</h2>
            <p style={{ color: C.muted, fontSize: "14px", lineHeight: 1.5 }}>Sign in to access OTTER Protocol. Connect your wallet separately in the DApp.</p>
          </div>

          {ref
            ? <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,200,150,0.06)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "20px" }}>
                <Check size={14} color={C.green} />
                <span style={{ color: C.green, fontSize: "13px" }}>Referral code <strong>{ref}</strong> applied</span>
              </div>
            : <input style={{ ...inp, marginBottom: "20px" }} placeholder="Referral code (optional)" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} onFocus={(e) => (e.target.style.borderColor = C.gold)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
          }

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button style={btnGold} onClick={() => go(() => signInWithGoogle(ref || undefined))} disabled={busy}>
              {busy ? <Spin /> : <Globe size={16} />} Continue with Google
            </button>
            <button
              style={{
                ...btnOut,
                background: "rgba(0,0,0,0.6)",
                border: "1px solid #333",
              }}
              onClick={() => go(() => signInWithTwitter(ref || undefined))}
              disabled={busy}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gold)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
            >
              {busy ? <Spin /> : <span style={{ fontWeight: 900, fontSize: "15px" }}>𝕏</span>}
              Continue with X / Twitter
            </button>
            <button style={btnOut} onClick={() => setView("email-signin")} onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gold)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
              <Mail size={16} /> Continue with Email
            </button>
          </div>

          {err && <ErrBox msg={err} />}
          <p style={{ color: C.muted, fontSize: "12px", textAlign: "center", marginTop: "20px" }}>By continuing you agree to our Terms of Service</p>
        </>}

        {/* ── EMAIL SIGN IN ── */}
        {view === "email-signin" && <>
          <BackBtn onClick={() => { setView("main"); setErr(""); }} />
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>Sign In</h2>
          <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>Welcome back.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input style={inp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go(() => signInWithEmail(email, pass))} onFocus={(e) => (e.target.style.borderColor = C.gold)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
            <PassInput value={pass} onChange={setPass} show={showP} toggle={() => setShowP(!showP)} onEnter={() => go(() => signInWithEmail(email, pass))} />
            {err && <ErrBox msg={err} />}
            <button style={btnGold} onClick={() => go(() => signInWithEmail(email, pass))} disabled={busy}>
              {busy ? <Spin /> : null}{busy ? "Signing in…" : "Sign In"}
            </button>
            <button style={{ ...btnOut, marginTop: "2px" }} onClick={() => { setView("email-signup"); setErr(""); }}>Create account instead</button>
          </div>
        </>}

        {/* ── EMAIL SIGN UP ── */}
        {view === "email-signup" && <>
          <BackBtn onClick={() => { setView("email-signin"); setErr(""); }} />
          <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>Create Account</h2>
          <p style={{ color: C.muted, fontSize: "14px", marginBottom: "24px" }}>Join the OTTER Protocol community.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input style={inp} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => (e.target.style.borderColor = C.gold)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
            <input style={inp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={(e) => (e.target.style.borderColor = C.gold)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
            <PassInput value={pass} onChange={setPass} show={showP} toggle={() => setShowP(!showP)} placeholder="Password (min 8 chars)" />
            <input style={inp} placeholder="Referral code (optional)" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} onFocus={(e) => (e.target.style.borderColor = C.gold)} onBlur={(e) => (e.target.style.borderColor = C.border)} />
            {err && <ErrBox msg={err} />}
            <button style={btnGold} onClick={() => go(() => signUpWithEmail(email, pass, name, ref || undefined))} disabled={busy}>
              {busy ? <Spin /> : null}{busy ? "Creating…" : "Create Account & Join"}
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", padding: "0 0 16px" }}>
    <ArrowLeft size={14} /> Back
  </button>;
}
function PassInput({ value, onChange, show, toggle, placeholder = "Password", onEnter }: { value: string; onChange: (v: string) => void; show: boolean; toggle: () => void; placeholder?: string; onEnter?: () => void }) {
  return <div style={{ position: "relative" }}>
    <input style={{ background: "#080808", border: "1px solid #222", borderRadius: "10px", padding: "13px 48px 13px 16px", color: "#E8E8E8", fontSize: "15px", width: "100%", outline: "none", fontFamily: "inherit" }} type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter?.()} onFocus={(e) => (e.target.style.borderColor = "#C9A84C")} onBlur={(e) => (e.target.style.borderColor = "#222")} />
    <button onClick={toggle} type="button" style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex" }}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>;
}
function ErrBox({ msg }: { msg: string }) {
  return <div style={{ background: "rgba(255,69,69,0.06)", border: "1px solid rgba(255,69,69,0.2)", borderRadius: "8px", padding: "10px 14px", display: "flex", gap: "8px" }}>
    <AlertTriangle size={14} color="#FF4545" style={{ flexShrink: 0, marginTop: "1px" }} />
    <span style={{ color: "#FF4545", fontSize: "13px", lineHeight: 1.5 }}>{msg}</span>
  </div>;
}
function Spin() {
  return <span style={{ width: "16px", height: "16px", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}
