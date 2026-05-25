"use client";
import { Wallet, AlertTriangle, ExternalLink, LogOut } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/context/ToastContext";

const C = { card: "#111", border: "#1F1F1F", gold: "#C9A84C", text: "#E8E8E8", muted: "#5C5C5C", green: "#00C896", red: "#FF4545", orange: "#F5A623" };

export default function WalletConnect() {
  const { address, shortAddress, isConnected, isCorrectNetwork, isConnecting, connect, switchToSepolia, openModal } = useWallet();
  const toast = useToast();

  const handleDisconnect = () => {
    openModal({ view: "Account" });
  };

  // ── NOT CONNECTED ──
  if (!isConnected || !address) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "16px", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wallet size={16} color={C.gold} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px" }}>Connect Wallet</div>
            <div style={{ color: C.muted, fontSize: "12px" }}>MetaMask, WalletConnect, Coinbase & more</div>
          </div>
        </div>
        <button onClick={connect} disabled={isConnecting}
          style={{ width: "100%", background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "13px", fontWeight: 700, fontSize: "14px", cursor: isConnecting ? "not-allowed" : "pointer", opacity: isConnecting ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          {isConnecting ? <><Spin /> Connecting…</> : <><Wallet size={15} /> Connect Wallet</>}
        </button>
      </div>
    );
  }

  // ── CONNECTED — WRONG NETWORK ──
  if (!isCorrectNetwork) {
    return (
      <div style={{ background: C.card, border: "1px solid rgba(245,166,35,0.25)", borderRadius: "16px", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <AlertTriangle size={16} color={C.orange} />
          <span style={{ color: C.orange, fontWeight: 700, fontSize: "14px" }}>Wrong Network</span>
        </div>
        <p style={{ color: C.muted, fontSize: "13px", lineHeight: 1.6, marginBottom: "16px" }}>
          OTTER runs on <strong style={{ color: C.text }}>Sepolia testnet</strong>. Switch to continue.
        </p>
        <div style={{ background: "#0A0A0A", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontFamily: "monospace", fontSize: "13px", color: C.muted }}>
          {shortAddress}
        </div>
        <button onClick={switchToSepolia}
          style={{ width: "100%", background: "linear-gradient(135deg,#C9A84C,#E2BF6E)", color: "#000", border: "none", borderRadius: "10px", padding: "13px", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          Switch to Sepolia
        </button>
      </div>
    );
  }

  // ── CONNECTED — SEPOLIA ──
  return (
    <div style={{ background: C.card, border: "1px solid rgba(0,200,150,0.15)", borderRadius: "16px", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.green, display: "inline-block" }} />
          <span style={{ color: C.green, fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em" }}>CONNECTED · SEPOLIA</span>
        </div>
        <button onClick={handleDisconnect} title="Manage wallet"
          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, display: "flex", padding: "4px" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.red)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}>
          <LogOut size={14} />
        </button>
      </div>

      <div style={{ background: "#080808", border: `1px solid ${C.border}`, borderRadius: "10px", padding: "12px 16px", marginBottom: "14px" }}>
        <div style={{ color: C.muted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Address</div>
        <div style={{ fontFamily: "monospace", fontSize: "13px", color: C.text, wordBreak: "break-all" }}>{address}</div>
      </div>

      <a href={`https://sepolia.etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: "8px", padding: "10px", fontSize: "13px", fontWeight: 600, textDecoration: "none", transition: "border-color 0.2s, color 0.2s" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.text; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>
        <ExternalLink size={13} /> View on Etherscan
      </a>
    </div>
  );
}

function Spin() {
  return <span style={{ width: "14px", height: "14px", border: "2px solid rgba(0,0,0,0.25)", borderTopColor: "#000", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}
