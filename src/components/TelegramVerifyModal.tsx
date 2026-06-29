"use client";
import React, { useEffect } from "react";
import { Check, X } from "lucide-react";

const C = {
  card: "#0D0B07", border: "#1E1A10", borderG: "rgba(201,168,76,0.2)",
  gold: "#C9A84C", text: "#E8DFC8", muted: "#8C7A5C", green: "#00C896", red: "#FF5B5B",
};
const MONO = "var(--font-geist-mono, monospace)";
const FONT = "var(--font-cinzel, Georgia, serif)";

declare global { interface Window { __tgOnAuth?: (u: Record<string, unknown>) => void; } }

/**
 * Telegram Login Widget modal. Injects the official widget script and calls
 * `onAuth` with the signed login payload, which the caller forwards to
 * /api/verify/telegram for real membership verification.
 */
export default function TelegramVerifyModal({ botUsername, verifyState, errorMsg, onAuth, onClose }: {
  botUsername:  string | null;
  verifyState:  "idle" | "success" | "error" | "not_member";
  errorMsg:     string;
  onAuth:       (data: Record<string, unknown>) => void;
  onClose:      () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;
    window.__tgOnAuth = onAuth;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size",           "large");
    script.setAttribute("data-onauth",         "__tgOnAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(script);
    return () => { delete window.__tgOnAuth; };
  }, [botUsername, onAuth]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: C.card, border: `1px solid ${C.borderG}`, borderRadius: "10px",
        padding: "28px 32px", minWidth: "320px", maxWidth: "400px", width: "90%", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: "14px", right: "14px",
          background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: "4px",
        }}><X size={16} /></button>

        <div style={{ fontFamily: FONT, fontSize: "11px", letterSpacing: "0.2em", color: C.gold, marginBottom: "6px" }}>
          ◈ TELEGRAM VERIFICATION
        </div>
        <p style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, lineHeight: 1.7, margin: "0 0 20px" }}>
          Join our Telegram channel first, then click the button below to verify your membership.
        </p>

        {verifyState === "success" && (
          <div style={{
            padding: "12px 16px", borderRadius: "6px",
            background: "rgba(0,200,150,0.08)", border: "1px solid rgba(0,200,150,0.3)",
            fontFamily: MONO, fontSize: "11px", color: C.green,
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <Check size={14} /> VERIFIED — membership confirmed
          </div>
        )}

        {(verifyState === "error" || verifyState === "not_member") && (
          <div style={{
            padding: "12px 16px", borderRadius: "6px", marginBottom: "16px",
            background: "rgba(255,91,91,0.06)", border: "1px solid rgba(255,91,91,0.25)",
            fontFamily: MONO, fontSize: "10px", color: C.red, lineHeight: 1.6,
          }}>
            {errorMsg || "Verification failed — please try again."}{" "}
            {verifyState === "not_member" && (
              <a href="https://t.me/otterprotocol" target="_blank" rel="noopener noreferrer"
                style={{ color: C.gold }}>Join now →</a>
            )}
          </div>
        )}

        {verifyState !== "success" && (
          <div ref={containerRef} style={{ minHeight: "56px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!botUsername && (
              <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted }}>Loading widget…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
