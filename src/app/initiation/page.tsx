"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import InitiationPath from "@/components/InitiationPath";
import { useInitiation } from "@/context/InitiationContext";
import { useWallet } from "@/hooks/useWallet";
import WalletConnect from "@/components/web3/WalletConnect";
import { ethers } from "ethers";
import { Copy, ExternalLink, Check, ArrowRight, RefreshCw } from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  black:  "#000000",
  card:   "#0D0B07",
  card2:  "#0A0800",
  border: "#1E1A10",
  borderG:"rgba(201,168,76,0.2)",
  gold:   "#C9A84C",
  goldL:  "#E2BF6E",
  text:   "#E8DFC8",
  muted:  "#5C4A2A",
  mutedH: "#8C7A5C",
  green:  "#00C896",
  red:    "#FF5B5B",
  orange: "#F5A623",
  purple: "#A78BFA",
};
const FONT = "var(--font-cinzel, Georgia, serif)";
const MONO = "var(--font-geist-mono, monospace)";

const SIGIL_CONTRACT   = process.env.NEXT_PUBLIC_SIGIL_CONTRACT || null;
const SIGIL_ABI        = [
  "function mintSigil() external",
  "function balanceOf(address) view returns (uint256)",
  "function tokenOfOwnerByIndex(address,uint256) view returns (uint256)",
];

// ─── Sigil SVG preview (rendered locally, matches on-chain SVG) ───────────────
function SigilPreview({ tokenId }: { tokenId?: number }) {
  const num = tokenId !== undefined ? String(tokenId).padStart(5, "0") : "?????";
  return (
    <svg
      viewBox="0 0 200 200"
      width="160"
      height="160"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <rect width="200" height="200" fill="#000" rx="8" />
      <rect x="1" y="1" width="198" height="198" fill="none" stroke="#C9A84C" strokeWidth="1.5" rx="7" />
      <rect x="6" y="6" width="188" height="188" fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="0.5" rx="5" />
      <text x="100" y="95" textAnchor="middle" fill="#C9A84C" fontSize="42" fontFamily="Georgia,serif">◈</text>
      <text x="100" y="130" textAnchor="middle" fill="#E8DFC8" fontSize="13" fontFamily="Georgia,serif" letterSpacing="5">INITIATE</text>
      <text x="100" y="152" textAnchor="middle" fill="#5C4A2A" fontSize="9" fontFamily="monospace" letterSpacing="2">SIGIL #{num}</text>
      <text x="100" y="170" textAnchor="middle" fill="#2A2010" fontSize="8" fontFamily="monospace">OTTER PROTOCOL · SEPOLIA</text>
    </svg>
  );
}

// ─── Stage Card shell ─────────────────────────────────────────────────────────
function StageCard({ done, active, numeral, title, children }: {
  done?: boolean; active?: boolean; numeral: string; title: string; children: React.ReactNode;
}) {
  if (done) {
    return (
      <div style={{
        background: C.card,
        border: `1px solid rgba(0,200,150,0.2)`,
        borderRadius: "8px",
        padding: "16px 22px",
        display: "flex", alignItems: "center", gap: "14px",
      }}>
        <span style={{ fontFamily: MONO, color: C.green, fontSize: "18px" }}>✓</span>
        <div>
          <span style={{ fontFamily: FONT, fontSize: "9px", letterSpacing: "0.14em", color: C.green }}>
            {numeral} · {title}
          </span>
          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.mutedH, marginTop: "2px" }}>
            Completed
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${active ? C.borderG : C.border}`,
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: active ? "0 0 30px rgba(201,168,76,0.06)" : "none",
      transition: "box-shadow 0.3s",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "14px",
        padding: "18px 22px 14px",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: "36px", height: "36px",
          borderRadius: "8px",
          border: `1.5px solid ${active ? C.gold : C.border}`,
          background: active ? "rgba(201,168,76,0.06)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: MONO, fontSize: "12px", color: active ? C.gold : C.muted,
          fontWeight: 700, flexShrink: 0,
        }}>
          {active ? numeral : "⌀"}
        </div>
        <div>
          <div style={{ fontFamily: FONT, fontSize: "10px", letterSpacing: "0.18em", color: active ? C.text : C.muted, fontWeight: 700 }}>
            {numeral} · {title}
          </div>
        </div>
      </div>
      <div style={{ padding: "20px 22px" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Instruction line ─────────────────────────────────────────────────────────
function Instruction({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <p style={{
      fontFamily: MONO, fontSize: "11px", lineHeight: "1.75",
      color: muted ? C.mutedH : C.text,
      margin: "0 0 14px",
      letterSpacing: "0.03em",
    }}>
      {text}
    </p>
  );
}

// ─── Gold CTA button ──────────────────────────────────────────────────────────
function GoldButton({ onClick, disabled, loading, children, style }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: "12px 24px",
        background: disabled || loading ? "transparent" : "linear-gradient(135deg,#C9A84C,#E2BF6E)",
        border: `1px solid ${disabled || loading ? C.border : "transparent"}`,
        borderRadius: "6px",
        color: disabled || loading ? C.muted : "#000",
        fontFamily: FONT, fontSize: "10px", fontWeight: 700,
        letterSpacing: "0.2em",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", gap: "8px",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        ...style,
      }}
    >
      {loading && <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />}
      {children}
    </button>
  );
}

// ─── Stage II — Sigil Claim ───────────────────────────────────────────────────
function SigilStage({ active }: { active: boolean }) {
  const wallet     = useWallet();
  const initiation = useInitiation();
  const [mintState, setMintState] = useState<"idle"|"pending"|"success"|"error">("idle");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [tokenId,   setTokenId]   = useState<number>();
  const [copied,    setCopied]    = useState(false);

  const shareText = tokenId !== undefined
    ? `I passed the gate. ◈ SIGIL #${String(tokenId).padStart(5,"0")} — otterfi.vercel.app`
    : "";

  const handleMint = async () => {
    if (!wallet.isConnected || !SIGIL_CONTRACT) return;
    setMintState("pending");
    setErrorMsg("");
    try {
      const signer = await wallet.getSigner();
      if (!signer) throw new Error("No signer available");
      const contract = new ethers.Contract(SIGIL_CONTRACT, SIGIL_ABI, signer);
      const tx  = await contract.mintSigil();
      await tx.wait();
      // fetch token id
      const id = await contract.tokenOfOwnerByIndex(wallet.address, 0);
      setTokenId(Number(id));
      setMintState("success");
      initiation.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("user rejected") || msg.includes("denied")) {
        setErrorMsg("Signature declined. The sigil waits.");
      } else if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("gas")) {
        setErrorMsg("You need a little Sepolia ETH for gas. Get some free at sepoliafaucet.com.");
      } else if (msg.includes("AlreadyInitiated")) {
        setErrorMsg("You already hold a sigil.");
      } else {
        setErrorMsg("Something went wrong. Try again.");
      }
      setMintState("error");
    }
  };

  const copyShare = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!active) {
    return (
      <Instruction text="Complete Stage I (Crack the Gate) to unlock this stage." muted />
    );
  }

  // No wallet connected
  if (!wallet.isConnected) {
    return (
      <div>
        <div style={{
          padding: "8px 14px",
          background: "rgba(245,166,35,0.08)",
          border: `1px solid rgba(245,166,35,0.2)`,
          borderRadius: "4px",
          fontFamily: MONO, fontSize: "10px", color: C.orange,
          letterSpacing: "0.1em",
          marginBottom: "16px",
        }}>
          ▶ AWAITING WALLET LINK
        </div>
        <Instruction text="Connect a wallet to mint your soulbound Initiate Sigil — permanently yours, can't be sold or moved." />
        <WalletConnect />
      </div>
    );
  }

  // Wrong network
  if (!wallet.isCorrectNetwork) {
    return (
      <div>
        <div style={{
          padding: "8px 14px",
          background: "rgba(255,91,91,0.08)",
          border: `1px solid rgba(255,91,91,0.2)`,
          borderRadius: "4px",
          fontFamily: MONO, fontSize: "10px", color: C.red,
          letterSpacing: "0.1em",
          marginBottom: "16px",
        }}>
          ✕ WRONG NETWORK
        </div>
        <Instruction text="Switch to Sepolia testnet to continue." />
        <GoldButton onClick={() => wallet.switchToSepolia()}>
          SWITCH TO SEPOLIA
        </GoldButton>
      </div>
    );
  }

  // Contract not deployed yet
  if (!SIGIL_CONTRACT) {
    return (
      <div>
        <div style={{
          padding: "8px 14px",
          background: "rgba(245,166,35,0.06)",
          border: `1px solid rgba(245,166,35,0.15)`,
          borderRadius: "4px",
          fontFamily: MONO, fontSize: "10px", color: C.orange,
          letterSpacing: "0.08em",
          marginBottom: "16px",
          lineHeight: "1.7",
        }}>
          ▶ SIGIL CONTRACT NOT DEPLOYED YET<br />
          <span style={{ color: C.mutedH }}>Minting opens when the contract goes live on Sepolia. Check back soon.</span>
        </div>
        <Instruction text="Your wallet is connected. Once the contract is deployed, return here to mint your free soulbound badge." muted />
      </div>
    );
  }

  // Success state
  if (mintState === "success") {
    return (
      <div>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
          marginBottom: "20px",
        }}>
          <div style={{
            padding: "3px",
            borderRadius: "12px",
            boxShadow: "0 0 0 2px rgba(0,200,150,0.5), 0 0 40px rgba(0,200,150,0.2)",
          }}>
            <SigilPreview tokenId={tokenId} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: FONT, fontSize: "13px", letterSpacing: "0.2em", color: C.green, marginBottom: "4px" }}>
              SIGIL #{tokenId !== undefined ? String(tokenId).padStart(5,"0") : "?????"} CLAIMED
            </div>
            <div style={{ fontFamily: MONO, fontSize: "10px", color: C.mutedH }}>
              Permanently yours — can&apos;t be sold or moved.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              padding: "10px 18px",
              background: "rgba(201,168,76,0.06)",
              border: `1px solid ${C.borderG}`,
              borderRadius: "6px",
              color: C.gold,
              fontFamily: FONT, fontSize: "9px", fontWeight: 700,
              letterSpacing: "0.18em",
              textDecoration: "none",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <ExternalLink size={11} /> SHARE ON X
          </a>
          <button
            onClick={copyShare}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: "6px",
              color: copied ? C.green : C.mutedH,
              fontFamily: FONT, fontSize: "9px", fontWeight: 700,
              letterSpacing: "0.18em",
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "COPIED" : "COPY TEXT"}
          </button>
          <Link
            href="/dapp?tab=memes"
            style={{
              padding: "10px 18px",
              background: "linear-gradient(135deg,#C9A84C,#E2BF6E)",
              borderRadius: "6px",
              color: "#000",
              fontFamily: FONT, fontSize: "9px", fontWeight: 700,
              letterSpacing: "0.18em",
              textDecoration: "none",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            CONTINUE TO STAGE III <ArrowRight size={11} />
          </Link>
        </div>
      </div>
    );
  }

  // Ready to mint
  return (
    <div>
      <div style={{
        display: "flex", gap: "24px", alignItems: "flex-start",
        flexWrap: "wrap", marginBottom: "20px",
      }}>
        <div style={{
          animation: "float 4s ease-in-out infinite",
          flexShrink: 0,
        }}>
          <SigilPreview />
        </div>
        <div style={{ flex: 1, minWidth: "180px" }}>
          <Instruction text="Mint your soulbound Initiate Sigil — permanently yours, can't be sold or moved. Approve with your wallet (free, just a small network fee on testnet — not real money)." />
          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.mutedH, marginBottom: "20px", lineHeight: "1.7" }}>
            One per wallet. The sigil is recorded on-chain (publicly on Ethereum — visible to anyone, forever). It cannot be transferred.
          </div>
          {mintState === "error" && (
            <div style={{
              padding: "8px 12px",
              background: "rgba(255,91,91,0.06)",
              border: `1px solid rgba(255,91,91,0.2)`,
              borderRadius: "4px",
              fontFamily: MONO, fontSize: "10px", color: C.red,
              marginBottom: "14px", lineHeight: "1.6",
            }}>
              {errorMsg}{" "}
              {errorMsg.includes("Sepolia ETH") && (
                <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer"
                  style={{ color: C.gold, textDecoration: "none" }}>
                  Get ETH →
                </a>
              )}
            </div>
          )}
          <GoldButton
            onClick={handleMint}
            loading={mintState === "pending"}
            disabled={mintState === "pending"}
          >
            {mintState === "pending" ? "INSCRIBING…" : "MINT YOUR SIGIL — FREE"}
          </GoldButton>
        </div>
      </div>
    </div>
  );
}

// ─── Stage III — First Contribution ──────────────────────────────────────────
function ContributionStage({ active }: { active: boolean }) {
  if (!active) {
    return <Instruction text="Complete Stage II (Claim the Sigil) to unlock this stage." muted />;
  }
  return (
    <div>
      <Instruction text="Vote on three memes, or submit one of your own in the Meme Arena. Your activity is recorded on-chain." />
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "20px", flexWrap: "wrap",
      }}>
        {[1,2,3].map(n => (
          <div key={n} style={{
            width: "28px", height: "28px",
            borderRadius: "4px",
            border: `1.5px solid ${C.border}`,
            background: C.card2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: MONO, fontSize: "13px", color: C.muted,
          }}>
            ◈
          </div>
        ))}
        <span style={{ fontFamily: MONO, fontSize: "10px", color: C.mutedH }}>
          0 / 3 VOTES
        </span>
      </div>
      <Link
        href="/dapp?tab=memes"
        style={{
          padding: "12px 24px",
          background: "linear-gradient(135deg,#C9A84C,#E2BF6E)",
          borderRadius: "6px",
          color: "#000",
          fontFamily: FONT, fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.2em",
          textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: "8px",
        }}
      >
        GO TO MEME ARENA <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// ─── Stage IV — Recruit One Otter ────────────────────────────────────────────
function RecruitStage({ active }: { active: boolean }) {
  const wallet  = useWallet();
  const [copied, setCopied] = useState(false);
  const [forged, setForged] = useState(false);

  const refLink = wallet.address
    ? `${typeof window !== "undefined" ? window.location.origin : "https://otterfi.vercel.app"}/?ref=${wallet.address}`
    : null;

  const forge = () => setForged(true);

  const copy = () => {
    if (!refLink) return;
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!active) {
    return <Instruction text="Complete Stage III (First Contribution) to unlock this stage." muted />;
  }

  return (
    <div id="recruit">
      <Instruction text="Share your unique link. When someone passes the cipher gate and mints their sigil through your link, your initiation is complete." />
      <Instruction text="Self-referral is not counted. One verified recruit per address." muted />

      {!wallet.isConnected ? (
        <div>
          <div style={{
            padding: "8px 14px",
            background: "rgba(245,166,35,0.08)",
            border: `1px solid rgba(245,166,35,0.2)`,
            borderRadius: "4px",
            fontFamily: MONO, fontSize: "10px", color: C.orange,
            marginBottom: "14px",
          }}>
            ▶ CONNECT WALLET TO FORGE YOUR LINK
          </div>
          <WalletConnect />
        </div>
      ) : !forged ? (
        <GoldButton onClick={forge}>
          FORGE YOUR LINK
        </GoldButton>
      ) : (
        <div>
          <div style={{
            background: C.card2,
            border: `1px solid ${C.border}`,
            borderRadius: "6px",
            padding: "14px 18px",
            marginBottom: "12px",
            fontFamily: MONO, fontSize: "11px", color: C.text,
            lineHeight: "2",
          }}>
            <div style={{ color: C.mutedH, fontSize: "9px", letterSpacing: "0.12em", marginBottom: "4px" }}>
              {">"} YOUR LINK
            </div>
            <div style={{
              display: "flex", alignItems: "center",
              gap: "12px", flexWrap: "wrap",
            }}>
              <span style={{ color: C.goldL, wordBreak: "break-all", flex: 1, fontSize: "10px" }}>
                {refLink}
              </span>
              <button
                onClick={copy}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: "4px",
                  color: copied ? C.green : C.mutedH,
                  fontFamily: FONT, fontSize: "8px", letterSpacing: "0.18em",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "4px",
                  flexShrink: 0,
                }}
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
            <div style={{ color: C.mutedH, fontSize: "9px", letterSpacing: "0.1em", marginTop: "8px" }}>
              {">"} RECRUITS  <span style={{ color: C.gold }}>0</span> VERIFIED
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.mutedH, lineHeight: "1.7" }}>
            A recruit is verified when they pass the gate and mint their own sigil.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InitiationPage() {
  const initiation = useInitiation();
  const router     = useRouter();
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => setMounted(true), []);

  // Redirect to gate if not passed (shouldn't be here without passing)
  useEffect(() => {
    if (mounted && !initiation.gate_passed) {
      router.replace("/");
    }
  }, [mounted, initiation.gate_passed, router]);

  if (!mounted) return null;

  const { gate_passed, sigil_claimed, contribution_done, referral_done, isInitiated } = initiation;
  const stageActive = {
    sigil:        gate_passed && !sigil_claimed,
    contribution: sigil_claimed && !contribution_done,
    recruit:      contribution_done && !referral_done,
  };

  return (
    <div style={{ background: C.black, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes seal-appear {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <Navbar />

      <main style={{
        flex: 1,
        maxWidth: "720px",
        width: "100%",
        margin: "0 auto",
        padding: "clamp(24px,5vw,56px) clamp(16px,5vw,32px)",
      }}>

        {/* ── Completion ceremony ── */}
        {isInitiated && (
          <div style={{
            background: C.card,
            border: `1px solid rgba(0,200,150,0.3)`,
            borderRadius: "8px",
            padding: "40px 32px",
            textAlign: "center",
            marginBottom: "32px",
            boxShadow: "0 0 60px rgba(0,200,150,0.08)",
          }}>
            <div style={{
              fontSize: "52px",
              animation: "seal-appear 0.6s cubic-bezier(0.34,1.56,0.64,1) both",
              marginBottom: "16px",
            }}>◈</div>
            <h1 style={{
              fontFamily: FONT, fontSize: "clamp(18px,4vw,26px)", fontWeight: 900,
              letterSpacing: "0.2em", color: C.green, margin: "0 0 12px",
            }}>
              INITIATION COMPLETE
            </h1>
            <p style={{ fontFamily: MONO, fontSize: "12px", color: C.mutedH, margin: 0 }}>
              You hold together. You build together.
            </p>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{
            fontFamily: MONO, fontSize: "9px", letterSpacing: "0.2em",
            color: C.mutedH, marginBottom: "10px",
          }}>
            OTTER.PROTOCOL // THE INITIATION PATH
          </div>
          <h1 style={{
            fontFamily: FONT, fontSize: "clamp(16px,4vw,22px)", fontWeight: 900,
            letterSpacing: "0.18em", color: C.text, margin: "0 0 8px",
          }}>
            THE PATH
          </h1>
          <p style={{
            fontFamily: MONO, fontSize: "11px", color: C.mutedH,
            lineHeight: "1.7", margin: 0,
          }}>
            Four stages. Each one earns your place. Complete them in order.
          </p>
        </div>

        {/* ── Progress stepper ── */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: "8px",
          padding: "20px 24px",
          marginBottom: "32px",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "16px",
          }}>
            <span style={{ fontFamily: FONT, fontSize: "9px", letterSpacing: "0.18em", color: C.mutedH }}>
              YOUR PROGRESS
            </span>
            <span style={{ fontFamily: MONO, fontSize: "11px", color: C.gold, fontWeight: 700 }}>
              {initiation.percentComplete}%
            </span>
          </div>
          <InitiationPath variant="full" />
          <div style={{
            height: "3px", background: C.border, borderRadius: "2px",
            marginTop: "8px", overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${initiation.percentComplete}%`,
              background: `linear-gradient(90deg, ${C.gold}, ${C.green})`,
              borderRadius: "2px",
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>

        {/* ── Stage Cards ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Stage I */}
          <StageCard done={gate_passed} active={!gate_passed} numeral="I" title="CRACK THE GATE">
            <Instruction text="Three fragments. Three platforms. One password." />
            <Instruction text="Find the cipher key distributed across our social channels and enter it at the gate." muted />
            <Link href="/" style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg,#C9A84C,#E2BF6E)",
              borderRadius: "6px", color: "#000",
              fontFamily: FONT, fontSize: "10px", fontWeight: 700,
              letterSpacing: "0.2em", textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: "8px",
            }}>
              GO TO GATE <ArrowRight size={12} />
            </Link>
          </StageCard>

          {/* Stage II */}
          <StageCard done={sigil_claimed} active={stageActive.sigil} numeral="II" title="CLAIM THE SIGIL">
            <SigilStage active={stageActive.sigil || sigil_claimed} />
          </StageCard>

          {/* Stage III */}
          <StageCard done={contribution_done} active={stageActive.contribution} numeral="III" title="FIRST CONTRIBUTION">
            <ContributionStage active={stageActive.contribution || contribution_done} />
          </StageCard>

          {/* Stage IV */}
          <StageCard done={referral_done} active={stageActive.recruit} numeral="IV" title="RECRUIT ONE OTTER">
            <RecruitStage active={stageActive.recruit || referral_done} />
          </StageCard>

        </div>
      </main>

      <Footer />
    </div>
  );
}
