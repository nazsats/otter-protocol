"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Copy, LogOut, Wallet, ChevronDown, Users, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { shortAddress, connectInjectedWallet, hasInjectedWallet } from "@/lib/wallet";

const C = { gold: "#C9A84C", border: "#1E1A10", muted: "#8C7A5C", text: "#E8DFC8", card: "#0D0B07", goldDim: "rgba(201,168,76,0.12)" };

const NAV_LINKS = [
  { label: "Protocol",   href: "/about#eip" },
  { label: "Tokenomics", href: "/about#tokenomics" },
  { label: "Roadmap",    href: "/about#roadmap" },
  { label: "Community",  href: "/about#community" },
  { label: "EIP Draft",  href: "/eip" },
  { label: "DApp Beta",  href: "/dapp", highlight: true },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [dropdown, setDropdown]       = useState(false);
  const [copiedRef, setCopiedRef]     = useState(false);
  const dropdownRef                   = useRef<HTMLDivElement>(null);
  const { user, profile, openAuthModal, logout, bindWallet } = useAuth();
  const toast = useToast();

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdown(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const copyReferral = () => {
    if (!profile?.referralCode) return;
    const url = `${window.location.origin}?ref=${profile.referralCode}`;
    navigator.clipboard.writeText(url);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
    toast("Referral link copied!", "success");
  };

  const handleConnectWallet = async () => {
    if (!hasInjectedWallet()) {
      toast("MetaMask not found. Install it at metamask.io", "error");
      return;
    }
    try {
      const addr = await connectInjectedWallet();
      if (addr) {
        const result = await bindWallet(addr);
        if (result === "bound") {
          toast(`Wallet bound to your account: ${shortAddress(addr)}`, "success");
        } else if (result === "already") {
          toast("Wallet already linked to your account", "info");
        } else {
          // A different wallet than the one bound — never overwritten silently.
          toast(
            `Wrong wallet. Your account is bound to ${profile?.walletAddress ? shortAddress(profile.walletAddress) : "another wallet"}. Change it in Profile.`,
            "error"
          );
        }
      }
    } catch {
      toast("Failed to connect wallet", "error");
    }
    setDropdown(false);
  };

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>

            {/* ── Logo ── */}
            <Link href="/about" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                boxShadow: "0 0 0 1.5px rgba(201,168,76,0.5), 0 0 16px rgba(201,168,76,0.15)",
                overflow: "hidden",
              }}>
                <img src="/otter-logo.png" alt="OTTER" width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <span style={{
                fontFamily: "var(--font-cinzel, serif)",
                fontWeight: 900, fontSize: "14px", letterSpacing: "0.1em", whiteSpace: "nowrap",
                background: "linear-gradient(135deg, #C9A84C, #E2BF6E)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                OTTER PROTOCOL
              </span>
            </Link>

            {/* ── Desktop Nav Links ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}
              className="nav-desktop">
              {NAV_LINKS.map((item) => (
                <Link key={item.label} href={item.href}
                  style={{
                    fontFamily: "var(--font-cinzel, serif)",
                    color: item.highlight ? C.gold : C.muted,
                    textDecoration: "none", fontSize: "11px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", transition: "color 0.15s",
                    border: item.highlight ? `1px solid rgba(201,168,76,0.25)` : "none",
                    padding: item.highlight ? "5px 12px" : "0",
                    borderRadius: item.highlight ? "4px" : "0",
                    background: item.highlight ? "rgba(201,168,76,0.06)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!item.highlight) (e.target as HTMLAnchorElement).style.color = C.text; }}
                  onMouseLeave={(e) => { if (!item.highlight) (e.target as HTMLAnchorElement).style.color = C.muted; }}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* ── Right: Auth ── */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }} className="nav-desktop">
              {!user ? (
                <>
                  <button onClick={openAuthModal}
                    style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.text, padding: "8px 16px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer", transition: "border-color 0.2s", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.08em" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.gold)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
                  >
                    Sign In
                  </button>
                  <button onClick={openAuthModal}
                    style={{ background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", padding: "8px 18px", borderRadius: "6px", fontSize: "11px", fontWeight: 900, cursor: "pointer", border: "none", fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.08em" }}>
                    Join the Raft
                  </button>
                </>
              ) : (
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <button onClick={() => setDropdown(!dropdown)}
                    style={{ display: "flex", alignItems: "center", gap: "8px", background: C.card, border: `1px solid ${dropdown ? C.gold : C.border}`, borderRadius: "10px", padding: "7px 12px", cursor: "pointer", color: C.text, transition: "border-color 0.2s" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#000" }}>
                        {(profile?.displayName || user.email || "U")[0].toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: "13px", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {profile?.displayName || user.email?.split("@")[0]}
                    </span>
                    <ChevronDown size={12} color={C.muted} style={{ transition: "transform 0.2s", transform: dropdown ? "rotate(180deg)" : "rotate(0)" }} />
                  </button>

                  {dropdown && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0,
                      background: "#0D0D0D", border: `1px solid ${C.border}`,
                      borderRadius: "14px", padding: "8px", width: "260px", zIndex: 200,
                      boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                    }}>
                      {/* Profile header */}
                      <div style={{ padding: "10px 12px 14px", borderBottom: `1px solid ${C.border}`, marginBottom: "6px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: C.text, marginBottom: "4px" }}>
                          {profile?.displayName || user.email}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ background: "rgba(201,168,76,0.1)", color: C.gold, border: "1px solid rgba(201,168,76,0.2)", borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: 700 }}>
                            {profile?.tier || "NEWCOMER"}
                          </span>
                          {profile?.walletAddress && (
                            <span style={{ background: "#111", border: `1px solid ${C.border}`, borderRadius: "20px", padding: "2px 10px", fontSize: "11px", color: C.muted, fontFamily: "monospace" }}>
                              {shortAddress(profile.walletAddress)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {!profile?.walletAddress && (
                        <DropdownItem icon={<Wallet size={14} color={C.gold} />} label="Connect Wallet" onClick={handleConnectWallet} />
                      )}

                      <DropdownItem
                        icon={copiedRef ? <Check size={14} color="#00C896" /> : <Copy size={14} color={C.muted} />}
                        label={`Referrals: ${profile?.referralCount || 0}`}
                        sub="Copy invite link"
                        onClick={copyReferral}
                      />

                      <Link href="/profile"
                        onClick={() => setDropdown(false)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", color: C.text, fontSize: "13px", transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1A1A1A")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <Users size={14} color={C.muted} />
                        My Profile
                      </Link>

                      <Link href="/dapp"
                        onClick={() => setDropdown(false)}
                        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", textDecoration: "none", color: C.text, fontSize: "13px", transition: "background 0.15s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#1A1A1A")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <ExternalLink size={14} color={C.muted} />
                        Open DApp
                      </Link>

                      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: "6px", paddingTop: "6px" }}>
                        <DropdownItem icon={<LogOut size={14} color="#FF4545" />} label="Sign Out" color="#FF4545" onClick={() => { logout(); setDropdown(false); toast("Signed out", "info"); }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Mobile Hamburger ── */}
            <button onClick={() => setMobileOpen(!mobileOpen)}
              style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: "6px", display: "flex", borderRadius: "8px" }}
              className="nav-mobile">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99,
          background: "rgba(0,0,0,0.95)",
          paddingTop: "64px", display: "flex", flexDirection: "column",
        }}
          className="nav-mobile">
          <div style={{ padding: "24px", flex: 1, overflowY: "auto" }}>
            {NAV_LINKS.map((item) => (
              <Link key={item.label} href={item.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  fontFamily: "var(--font-cinzel, serif)",
                  display: "block", padding: "16px 0", color: item.highlight ? C.gold : C.text,
                  textDecoration: "none", fontSize: "16px", fontWeight: 700,
                  borderBottom: `1px solid ${C.border}`, letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}>
                {item.label}
              </Link>
            ))}

            <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {!user ? (
                <>
                  <button onClick={() => { openAuthModal(); setMobileOpen(false); }}
                    style={{ fontFamily: "var(--font-cinzel, serif)", padding: "14px", borderRadius: "6px", border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}>
                    SIGN IN
                  </button>
                  <button onClick={() => { openAuthModal(); setMobileOpen(false); }}
                    style={{ fontFamily: "var(--font-cinzel, serif)", padding: "14px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #C9A84C, #E2BF6E)", color: "#000", fontSize: "13px", fontWeight: 900, cursor: "pointer", letterSpacing: "0.1em" }}>
                    JOIN THE RAFT
                  </button>
                </>
              ) : (
                <>
                  <Link href="/profile" onClick={() => setMobileOpen(false)}
                    style={{ fontFamily: "var(--font-cinzel, serif)", padding: "14px", borderRadius: "6px", border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontSize: "13px", fontWeight: 700, textDecoration: "none", textAlign: "center", display: "block", letterSpacing: "0.1em" }}>
                    MY PROFILE
                  </Link>
                  <Link href="/dapp" onClick={() => setMobileOpen(false)}
                    style={{ fontFamily: "var(--font-cinzel, serif)", padding: "14px", borderRadius: "6px", border: `1px solid rgba(201,168,76,0.3)`, background: "rgba(201,168,76,0.06)", color: C.gold, fontSize: "13px", fontWeight: 700, textDecoration: "none", textAlign: "center", display: "block", letterSpacing: "0.1em" }}>
                    OPEN DAPP
                  </Link>
                  <button onClick={() => { logout(); setMobileOpen(false); toast("Signed out", "info"); }}
                    style={{ fontFamily: "var(--font-cinzel, serif)", padding: "14px", borderRadius: "6px", border: "1px solid #FF454530", background: "rgba(255,69,69,0.05)", color: "#FF4545", fontSize: "13px", fontWeight: 700, cursor: "pointer", letterSpacing: "0.1em" }}>
                    SIGN OUT
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline responsive style */}
      <style>{`
        .nav-desktop { display: flex !important; }
        .nav-mobile  { display: none !important; }
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  );
}

function DropdownItem({
  icon, label, sub, onClick, color = "#E8E8E8",
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button onClick={onClick}
      style={{ width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", borderRadius: "8px", textAlign: "left", transition: "background 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#1A1A1A")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      {icon}
      <div>
        <div style={{ color, fontSize: "13px", fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ color: "#5C5C5C", fontSize: "11px", marginTop: "1px" }}>{sub}</div>}
      </div>
    </button>
  );
}
