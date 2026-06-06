"use client";
import { Wallet, AlertTriangle, ExternalLink, LogOut, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/context/ToastContext";

const C = {
  black: "#000000", card: "#070503", border: "#1E1A10",
  gold: "#C9A84C", goldL: "#E2BF6E", text: "#E8DFC8",
  muted: "#5C4A2A", mutedH: "#8C7A5C",
  green: "#00C896", red: "#FF4545", orange: "#F5A623",
};
const MONO = "var(--font-geist-mono, monospace)";
const FONT = "var(--font-cinzel, Georgia, serif)";

function Spin() {
  return (
    <span style={{
      width: "12px", height: "12px",
      border: `2px solid rgba(201,168,76,0.2)`,
      borderTopColor: C.gold, borderRadius: "50%",
      display: "inline-block", animation: "spin 0.8s linear infinite",
      flexShrink: 0,
    }} />
  );
}

function TRow({ label, value, color = C.text }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 0", borderBottom: "1px solid rgba(201,168,76,0.04)",
      fontFamily: MONO, fontSize: "10px",
    }}>
      <span style={{ color: C.muted, letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ color, fontWeight: 600, letterSpacing: "0.06em" }}>{value}</span>
    </div>
  );
}

function StonePanel({ children, borderColor = C.border, topBarColor = C.gold }: {
  children: React.ReactNode; borderColor?: string; topBarColor?: string;
}) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0A0700 0%, #060400 100%)",
      border: `1px solid ${borderColor}`,
      borderRadius: "8px", overflow: "hidden", position: "relative",
    }}>
      {/* Noise texture */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.025, pointerEvents: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: "200px",
      }} />
      {/* Top accent bar */}
      <div style={{
        height: "2px",
        background: `linear-gradient(90deg, transparent, ${topBarColor}, transparent)`,
        opacity: 0.6,
      }} />
      {children}
    </div>
  );
}

export default function WalletConnect() {
  const {
    address, shortAddress, isConnected, isCorrectNetwork,
    isConnecting, connect, switchToSepolia, openModal,
  } = useWallet();
  const toast  = useToast();
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Render a stable placeholder until client hydration is complete
  if (!mounted) {
    return (
      <StonePanel>
        <div style={{ padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", paddingBottom: "12px", borderBottom: "1px solid rgba(201,168,76,0.07)" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet size={13} color={C.gold} />
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", color: C.text, letterSpacing: "0.12em" }}>WALLET INTERFACE</div>
              <div style={{ fontFamily: MONO, color: C.muted, fontSize: "9px", letterSpacing: "0.1em", marginTop: "2px" }}>STATUS: LOADING…</div>
            </div>
          </div>
          <div style={{ height: "72px", background: "rgba(201,168,76,0.03)", borderRadius: "4px", border: "1px solid rgba(201,168,76,0.06)" }} />
        </div>
      </StonePanel>
    );
  }

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast("Address copied", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── NOT CONNECTED ─────────────────────────────────────────────────── */
  if (!isConnected || !address) {
    return (
      <StonePanel>
        <div style={{ padding: "18px" }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "14px", paddingBottom: "12px",
            borderBottom: "1px solid rgba(201,168,76,0.07)",
          }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "6px",
              background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Wallet size={13} color={C.gold} />
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", color: C.text, letterSpacing: "0.12em" }}>
                WALLET INTERFACE
              </div>
              <div style={{ fontFamily: MONO, color: C.muted, fontSize: "9px", letterSpacing: "0.1em", marginTop: "2px" }}>
                STATUS: UNLINKED
              </div>
            </div>
          </div>

          {/* Readout */}
          <div style={{
            background: "#030200", border: "1px solid rgba(201,168,76,0.07)",
            borderRadius: "4px", padding: "10px 12px", marginBottom: "14px",
          }}>
            <TRow label="> NETWORK"  value="UNDETECTED" color={C.muted} />
            <TRow label="> ADDRESS"  value="— — — — —"  color={C.muted} />
            <TRow label="> STATUS"   value="AWAITING LINK" color={C.orange} />
          </div>

          <div style={{
            fontFamily: MONO, color: "rgba(201,168,76,0.3)", fontSize: "9px",
            letterSpacing: "0.07em", lineHeight: 1.8, marginBottom: "14px",
          }}>
            {"// Link your EVM wallet to access"}<br />
            {"// on-chain features and claim $OTTER"}
          </div>

          <button
            onClick={connect}
            disabled={isConnecting}
            className="btn-press btn-shimmer"
            style={{
              width: "100%",
              background: isConnecting
                ? "rgba(201,168,76,0.07)"
                : "linear-gradient(135deg, #C9A84C, #E2BF6E)",
              color: isConnecting ? C.gold : "#000",
              border: isConnecting ? `1px solid rgba(201,168,76,0.25)` : "none",
              borderRadius: "6px", padding: "12px 16px",
              fontWeight: 700, fontSize: "11px",
              cursor: isConnecting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              fontFamily: FONT, letterSpacing: "0.14em", textTransform: "uppercase",
              transition: "all 0.2s",
            }}
          >
            {isConnecting ? <><Spin />LINKING…</> : <><Wallet size={12} />CONNECT WALLET</>}
          </button>

          <div style={{
            fontFamily: MONO, color: "rgba(201,168,76,0.18)", fontSize: "8px",
            letterSpacing: "0.12em", textAlign: "center", marginTop: "10px",
          }}>
            MetaMask · WalletConnect · Coinbase
          </div>
        </div>
      </StonePanel>
    );
  }

  /* ── WRONG NETWORK ─────────────────────────────────────────────────── */
  if (!isCorrectNetwork) {
    return (
      <StonePanel borderColor="rgba(245,166,35,0.25)" topBarColor={C.orange}>
        <div style={{ padding: "18px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "14px", paddingBottom: "12px",
            borderBottom: "1px solid rgba(245,166,35,0.1)",
          }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "6px",
              background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <AlertTriangle size={13} color={C.orange} />
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: "11px", color: C.orange, letterSpacing: "0.12em" }}>
                WRONG NETWORK
              </div>
              <div style={{ fontFamily: MONO, color: C.muted, fontSize: "9px", letterSpacing: "0.1em", marginTop: "2px" }}>
                CHAIN: UNSUPPORTED
              </div>
            </div>
          </div>

          <div style={{
            background: "#030200", border: "1px solid rgba(245,166,35,0.08)",
            borderRadius: "4px", padding: "10px 12px", marginBottom: "14px",
          }}>
            <TRow label="> WALLET"   value={shortAddress ?? "—"}  color={C.text} />
            <TRow label="> CHAIN"    value="UNSUPPORTED"         color={C.orange} />
            <TRow label="> REQUIRED" value="SEPOLIA [11155111]"  color={C.gold} />
          </div>

          <button
            onClick={switchToSepolia}
            className="btn-press btn-shimmer"
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #C9A84C, #E2BF6E)",
              color: "#000", border: "none", borderRadius: "6px",
              padding: "12px 16px", fontWeight: 700, fontSize: "11px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              fontFamily: FONT, letterSpacing: "0.14em", textTransform: "uppercase",
            }}
          >
            <AlertTriangle size={12} />SWITCH TO SEPOLIA
          </button>
        </div>
      </StonePanel>
    );
  }

  /* ── CONNECTED · SEPOLIA ───────────────────────────────────────────── */
  return (
    <StonePanel borderColor="rgba(0,200,150,0.2)" topBarColor={C.green}>
      <div style={{ padding: "18px" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "14px", paddingBottom: "12px",
          borderBottom: "1px solid rgba(0,200,150,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="wallet-dot-pulse"
              style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.green, display: "inline-block", flexShrink: 0 }}
            />
            <span style={{ fontFamily: FONT, color: C.green, fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em" }}>
              LINK ESTABLISHED
            </span>
          </div>
          <button
            onClick={() => openModal({ view: "Account" })}
            title="Manage wallet"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: "4px", display: "flex", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.red)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
          >
            <LogOut size={12} />
          </button>
        </div>

        {/* Readout */}
        <div style={{
          background: "#020402", border: "1px solid rgba(0,200,150,0.07)",
          borderRadius: "4px", padding: "10px 12px", marginBottom: "12px",
        }}>
          <TRow label="> NETWORK" value="SEPOLIA [11155111]" color={C.green} />
          <TRow label="> STATUS"  value="ACTIVE"             color={C.green} />
          {/* Address row with copy */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "7px 0", fontFamily: MONO, fontSize: "10px",
          }}>
            <span style={{ color: C.muted, letterSpacing: "0.1em" }}>{"> ADDRESS"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: C.text, fontFamily: "monospace", fontSize: "10px" }}>{shortAddress}</span>
              <button
                onClick={copyAddress}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: copied ? C.green : C.muted, display: "flex", transition: "color 0.15s" }}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
              </button>
            </div>
          </div>
        </div>

        <a
          href={`https://sepolia.etherscan.io/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            background: "transparent", border: "1px solid rgba(0,200,150,0.15)",
            color: C.mutedH, borderRadius: "6px", padding: "9px",
            fontSize: "10px", fontWeight: 600, textDecoration: "none",
            fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,200,150,0.4)"; e.currentTarget.style.color = C.green; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(0,200,150,0.15)"; e.currentTarget.style.color = C.mutedH; }}
        >
          <ExternalLink size={10} />VIEW ON ETHERSCAN
        </a>
      </div>
    </StonePanel>
  );
}
