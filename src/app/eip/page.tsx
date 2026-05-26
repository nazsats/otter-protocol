"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { useState } from "react";

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  black:  "#000000", deep:  "#050400", card:  "#0D0B07", card2: "#0A0800",
  border: "#1E1A10", borderG: "rgba(201,168,76,0.18)",
  gold:   "#C9A84C", goldL: "#E2BF6E", goldD: "#8B6000",
  text:   "#E8DFC8", muted: "#8C7A5C", mutedL: "#5C4A2A",
  amber:  "#F5A623", purple: "#A78BFA", red: "#FF5B5B",
  green:  "#00C896", blue: "#60A5FA",
};
const MONO = "var(--font-geist-mono, monospace)";
const FONT = "var(--font-cinzel, Georgia, serif)";

// ─── TYPOGRAPHY ───────────────────────────────────────────────────────────────
function H2({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} style={{
      fontFamily: FONT, fontSize: "20px", fontWeight: 700, color: C.text,
      marginBottom: "16px", paddingBottom: "12px",
      borderBottom: `1px solid ${C.border}`, marginTop: "52px",
      letterSpacing: "0.04em",
    }}>{children}</h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: FONT, fontSize: "14px", fontWeight: 700, color: C.text,
      marginBottom: "10px", marginTop: "30px", letterSpacing: "0.08em",
    }}>{children}</h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: FONT, color: C.muted, lineHeight: 1.85, fontSize: "14px",
      marginBottom: "16px", letterSpacing: "0.01em",
    }}>{children}</p>
  );
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: "rgba(201,168,76,0.08)", color: C.gold,
      padding: "2px 7px", borderRadius: "3px",
      fontFamily: MONO, fontSize: "12px",
      border: "1px solid rgba(201,168,76,0.15)",
    }}>{children}</code>
  );
}
function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  return (
    <div style={{
      background: "#050400", border: `1px solid ${C.border}`,
      borderRadius: "8px", overflow: "hidden", marginBottom: "20px",
    }}>
      {filename && (
        <div style={{
          padding: "8px 16px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{ fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "10px" }}>◈</span>
          <span style={{ fontFamily: MONO, color: C.muted, fontSize: "12px" }}>{filename}</span>
        </div>
      )}
      <pre style={{
        padding: "20px", overflowX: "auto", margin: 0,
        fontSize: "12px", lineHeight: 1.75, color: "#A8B090", fontFamily: MONO,
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return <section id={id} style={{ marginBottom: "48px" }}>{children}</section>;
}
function Callout({ type, children }: { type: "note" | "warning" | "important" | "community"; children: React.ReactNode }) {
  const map = {
    note:      { color: C.blue,   icon: "ℹ", label: "NOTE" },
    warning:   { color: C.amber,  icon: "⚠", label: "WARNING" },
    important: { color: C.red,    icon: "◈", label: "IMPORTANT" },
    community: { color: C.green,  icon: "🦦", label: "COMMUNITY" },
  };
  const m = map[type];
  return (
    <div style={{
      background: m.color + "09", border: `1px solid ${m.color}30`,
      borderLeft: `3px solid ${m.color}`, borderRadius: "6px",
      padding: "14px 18px", marginBottom: "20px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        fontFamily: FONT, color: m.color, fontSize: "10px", fontWeight: 700,
        letterSpacing: "0.16em", marginBottom: "8px",
      }}>
        <span>{m.icon}</span> {m.label}
      </div>
      <div style={{ fontFamily: FONT, color: C.text, fontSize: "13px", lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  );
}

// ─── CODE CONSTANTS ────────────────────────────────────────────────────────────
const INTERFACE_CODE = `// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/// @title IERC-OTTER: Progressive Community Token Standard
/// @notice Interface for community-owned tokens with immutable protection mechanics
/// @dev Extends ERC-20. All tax constants are immutable — no admin override possible.
interface IERC_OTTER {

    // ─── ENUMS ─────────────────────────────────────────────────────────────
    enum Tier { NEWCOMER, MEMBER, OG }
    enum ProposalStatus { PENDING, ACTIVE, PASSED, FAILED, EXECUTED, VETOED }

    // ─── EVENTS ────────────────────────────────────────────────────────────
    event TierUpgraded(address indexed holder, Tier oldTier, Tier newTier);
    event TaxDistributed(uint256 toTreasury, uint256 toRewards,
                         uint256 toLiquidity, uint256 burned);
    event MemeSubmitted(address indexed creator, bytes32 indexed contentHash,
                        uint256 indexed memeId);
    event MemeVoted(uint256 indexed memeId, address indexed voter,
                    bool upvote, uint256 weight);
    event EpochSettled(uint256 indexed epoch, uint256 distributed,
                       uint256 winnerCount);
    event RewardsClaimed(address indexed holder, uint256 amount);
    event ReferralRecorded(address indexed referrer, address indexed referee);
    event ProposalCreated(uint256 indexed id, address indexed proposer,
                          bytes32 descriptionHash);
    event ProposalPassed(uint256 indexed id, uint256 forVotes,
                         uint256 againstVotes);
    event GuardianAction(address indexed guardian, bytes4 selector, bytes32 reason);

    // ─── ERRORS ────────────────────────────────────────────────────────────
    error AlreadyVoted();
    error NothingToClaim();
    error InsufficientTier(Tier required, Tier actual);
    error GuardianOnly();
    error TimelockActive(uint256 unlocksAt);
    error ExceedsParameterBounds(uint256 value, uint256 min, uint256 max);

    // ─── HOLDER STATE (READ) ────────────────────────────────────────────────
    function holderTier(address account)      external view returns (Tier);
    function holdDuration(address account)    external view returns (uint256);
    function pendingRewards(address account)  external view returns (uint256);
    function rewardMultiplier(address account)external view returns (uint256 bps);
    function governanceWeight(address account)external view returns (uint256);
    function referralCount(address referrer)  external view returns (uint256);

    // ─── TAX CONSTANTS (IMMUTABLE — CANNOT BE CHANGED AFTER DEPLOY) ────────
    function TAX_RATE()        external view returns (uint16); // 500 = 5%
    function TREASURY_SHARE()  external view returns (uint16); // 4000 = 40%
    function REWARDS_SHARE()   external view returns (uint16); // 3000 = 30%
    function LIQUIDITY_SHARE() external view returns (uint16); // 2000 = 20%
    function BURN_SHARE()      external view returns (uint16); // 1000 = 10%

    // ─── COMMUNITY ACTIONS ─────────────────────────────────────────────────
    function submitMeme(bytes32 contentHash) external returns (uint256 memeId);
    function voteOnMeme(uint256 memeId, bool upvote) external;
    function claimRewards() external returns (uint256 claimed);
    function recordReferral(address referee, bytes32 proof) external;

    // ─── GOVERNANCE ────────────────────────────────────────────────────────
    function createProposal(bytes32 descriptionHash, bytes calldata payload)
        external returns (uint256 proposalId);
    function castVote(uint256 proposalId, bool support) external;
    function executeProposal(uint256 proposalId) external;
    function treasury() external view returns (address);

    // ─── PROTOCOL GUARDIAN ─────────────────────────────────────────────────
    // Guardian CAN: pause (max 24h), queue upgrades (72h timelock), veto proposals
    // Guardian CANNOT: change tax constants, access treasury, disable community mechanics
    function guardian() external view returns (address);
    function emergencyPause(uint256 duration) external; // MAX: 86400 seconds
    function queueUpgrade(address implementation) external; // 72h timelock
    function vetoProposal(uint256 proposalId, bytes32 reason) external;
    function setEpochDuration(uint256 days_) external; // bounds: 3–30 days
}`;

const GUARDIAN_CODE = `// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/// @notice Protocol Guardian role — explicit power constraints on-chain
abstract contract OTTERGuardian {

    address public guardian;
    uint256 public upgradeTimelockExpiry;
    address public pendingImplementation;

    uint256 constant MAX_PAUSE_DURATION = 86400;    // 24 hours
    uint256 constant UPGRADE_TIMELOCK   = 259200;   // 72 hours
    uint256 constant MIN_EPOCH_DAYS     = 3;
    uint256 constant MAX_EPOCH_DAYS     = 30;

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Guardian only");
        _;
    }

    /// @notice Pause all transfers for emergency. MAX 24 hours.
    function emergencyPause(uint256 duration) external onlyGuardian {
        require(duration <= MAX_PAUSE_DURATION,
            "Exceeds max pause duration");
        _pause(duration);
        emit GuardianAction(guardian, msg.sig, bytes32(duration));
    }

    /// @notice Queue an upgrade. 72-hour community observation window.
    function queueUpgrade(address implementation) external onlyGuardian {
        pendingImplementation = implementation;
        upgradeTimelockExpiry = block.timestamp + UPGRADE_TIMELOCK;
        emit GuardianAction(guardian, msg.sig, bytes32(uint256(
            uint160(implementation))));
    }

    /// @notice Execute queued upgrade only after timelock.
    function executeUpgrade() external onlyGuardian {
        require(block.timestamp >= upgradeTimelockExpiry,
            "Timelock not expired");
        _upgradeTo(pendingImplementation);
    }

    /// @notice Veto a governance proposal with on-chain reason.
    function vetoProposal(uint256 proposalId, bytes32 reason)
        external onlyGuardian
    {
        _vetoProposal(proposalId, reason);
        emit GuardianAction(guardian, msg.sig, reason);
    }

    /// @dev NOTE: TAX_RATE and distribution shares are declared as
    ///      'constant' — no setter exists. Guardian CANNOT modify them.

    function _pause(uint256) internal virtual;
    function _upgradeTo(address) internal virtual;
    function _vetoProposal(uint256, bytes32) internal virtual;
}`;

const TIER_CODE = `// Tier thresholds
uint256 constant MEMBER_THRESHOLD = 30 days;  // 2,592,000 seconds
uint256 constant OG_THRESHOLD     = 90 days;  // 7,776,000 seconds

// Reward multipliers in basis points
uint256 constant NEWCOMER_BPS = 10000; // 1.0x
uint256 constant MEMBER_BPS   = 15000; // 1.5x
uint256 constant OG_BPS       = 20000; // 2.0x

mapping(address => uint256) private _holdSince;

function holderTier(address account) public view returns (Tier) {
    uint256 held = holdDuration(account);
    if (held >= OG_THRESHOLD)     return Tier.OG;
    if (held >= MEMBER_THRESHOLD) return Tier.MEMBER;
    return Tier.NEWCOMER;
}

function holdDuration(address account) public view returns (uint256) {
    uint256 since = _holdSince[account];
    if (since == 0 || balanceOf(account) == 0) return 0;
    return block.timestamp - since;
}

/// @dev Resets hold timer on ANY outbound transfer — prevents gaming
function _afterTokenTransfer(address from, address to, uint256 amount)
    internal override
{
    if (from != address(0) && amount > 0) {
        // Seller loses all accumulated hold time
        _holdSince[from] = 0;
    }
    if (to != address(0) && _holdSince[to] == 0) {
        _holdSince[to] = block.timestamp;
    }
    _updateTierIfChanged(from);
    _updateTierIfChanged(to);
}`;

const EPOCH_CODE = `// ─── Epoch-Based Meme Reward Settlement ─────────────────────
uint256 public epochDuration;      // settable by Guardian: 3–30 days
uint256 public currentEpoch;
uint256 public epochStartTime;

struct Meme {
    address  creator;
    bytes32  contentHash;
    uint256  epoch;
    int256   netVotes;      // upvotes minus downvotes (weighted)
    uint256  rewardShare;   // set at settlement
    bool     settled;
}

/// @notice Settle current epoch: calculate shares, enable claiming.
/// @dev    Called by any address after epochDuration passes.
function settleEpoch() external {
    require(block.timestamp >= epochStartTime + epochDuration,
        "Epoch not over");

    uint256 poolBalance = rewardsPool.balance();
    uint256[] memory winners = _topMemes(currentEpoch, 10);

    uint256 totalWeight;
    for (uint i; i < winners.length; i++) {
        totalWeight += uint256(memes[winners[i]].netVotes);
    }

    for (uint i; i < winners.length; i++) {
        uint256 share = (poolBalance * uint256(
            memes[winners[i]].netVotes)) / totalWeight;
        memes[winners[i]].rewardShare = share;
        memes[winners[i]].settled = true;
    }

    emit EpochSettled(currentEpoch, poolBalance, winners.length);
    currentEpoch++;
    epochStartTime = block.timestamp;
}`;

// ─── PAGE ─────────────────────────────────────────────────────────────────────
const TOC = [
  { id: "abstract",        label: "Abstract",               glyph: "א" },
  { id: "motivation",      label: "Motivation",             glyph: "ב" },
  { id: "prior-art",       label: "Prior Art",              glyph: "ג" },
  { id: "specification",   label: "Specification",          glyph: "ד" },
  { id: "governance",      label: "Community Governance",   glyph: "ה" },
  { id: "tokenomics",      label: "Token Economics",        glyph: "ו" },
  { id: "reference-impl",  label: "Reference Impl.",        glyph: "ז" },
  { id: "rationale",       label: "Rationale",              glyph: "ח" },
  { id: "backwards-compat",label: "Backwards Compat.",      glyph: "ט" },
  { id: "security",        label: "Security",               glyph: "י" },
  { id: "copyright",       label: "Copyright",              glyph: "כ" },
];

export default function EIPPage() {
  const [activeSection, setActiveSection] = useState("abstract");

  return (
    <div style={{ background: C.black, color: C.text, minHeight: "100vh" }}>
      <Navbar />

      <style>{`
        @keyframes eip-fade-in { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        .eip-toc-link:hover { color: #C9A84C !important; }
        .eip-toc-link.active { color: #C9A84C !important; border-left: 2px solid #C9A84C; padding-left: 8px; }
        .eip-grid { display: grid; grid-template-columns: 1fr 220px; gap: 60px; align-items: start; }
        @media(max-width:900px) { .eip-grid { grid-template-columns: 1fr !important; } }
        @media(max-width:640px) {
          .eip-meta-grid { grid-template-columns: repeat(2,1fr) !important; }
          .prior-art-table { font-size: 11px !important; }
          .guardian-grid { grid-template-columns: 1fr !important; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 11px 14px; text-align: left; border-bottom: 1px solid #1E1A10; }
        th { background: #0D0B07; font-size: 10px; font-weight: 700; color: rgba(201,168,76,0.5); letter-spacing: 0.12em; font-family: var(--font-cinzel,serif); }
        td { font-size: 13px; color: #E8DFC8; font-family: var(--font-geist-mono); }
      `}</style>

      <div style={{ paddingTop: "64px" }}>

        {/* ── DRAFT BANNER ── */}
        <div style={{
          background: "rgba(245,166,35,0.06)",
          borderBottom: "1px solid rgba(245,166,35,0.2)",
          padding: "10px 24px",
          textAlign: "center",
          fontFamily: MONO, fontSize: "11px", color: C.amber,
          letterSpacing: "0.12em",
        }}>
          ⚠ &nbsp; EIP DRAFT STATUS — Community feedback welcome. Submit issues or PRs on GitHub. &nbsp; ⚠
        </div>

        {/* ── INSCRIPTION HEADER ── */}
        <div style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "52px 24px 44px",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 65%)",
          }} />

          <div style={{ maxWidth: "920px", margin: "0 auto", position: "relative" }}>
            {/* Badges */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "22px" }}>
              {[
                { label: "⟦ DRAFT ⟧",              color: C.amber },
                { label: "◈ STANDARDS TRACK",        color: C.gold },
                { label: "ERC — TOKEN STANDARD",      color: C.purple },
                { label: "BUILDS ON: EIP-20, EIP-712",color: C.blue },
                { label: "EPOCH I · 2025",            color: C.muted },
              ].map((b) => (
                <span key={b.label} style={{
                  background: b.color + "11", color: b.color,
                  border: `1px solid ${b.color}28`,
                  padding: "4px 12px", borderRadius: "3px",
                  fontSize: "10px", fontWeight: 700,
                  fontFamily: FONT, letterSpacing: "0.1em",
                }}>{b.label}</span>
              ))}
            </div>

            <h1 style={{
              fontFamily: FONT, fontSize: "clamp(20px, 4vw, 36px)",
              fontWeight: 900, marginBottom: "12px", letterSpacing: "0.02em",
              lineHeight: 1.2, color: C.text,
            }}>
              ERC-OTTER: Progressive Community Token Standard
            </h1>
            <p style={{
              color: C.muted, fontSize: "15px", lineHeight: 1.75,
              maxWidth: "660px", fontFamily: FONT, marginBottom: "20px",
            }}>
              A formal on-chain standard for community-owned tokens — extending ERC-20 with
              immutable community protection mechanics, time-based loyalty tiers, an on-chain
              meme economy, and a transparent Protocol Guardian governance model.
            </p>

            <div style={{
              fontFamily: MONO, color: "rgba(201,168,76,0.22)", fontSize: "10px",
              letterSpacing: "0.18em", marginBottom: "24px",
            }}>
              ━━━━━━━━━━ א · HOLD TOGETHER · BUILD TOGETHER · ERC-OTTER ב ━━━━━━━━━━
            </div>

            {/* Metadata grid */}
            <div className="eip-meta-grid" style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "8px",
            }}>
              {[
                { label: "Author",    value: "OTTER Core Team" },
                { label: "Status",    value: "Draft" },
                { label: "Type",      value: "Standards Track" },
                { label: "Category",  value: "ERC" },
                { label: "Created",   value: "2025-05-18" },
                { label: "Requires",  value: "EIP-20, EIP-712" },
                { label: "Network",   value: "Ethereum / Sepolia" },
                { label: "Chain ID",  value: "1 (mainnet)" },
              ].map((m) => (
                <div key={m.label} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: "6px", padding: "10px 14px",
                }}>
                  <div style={{
                    fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "9px",
                    fontWeight: 700, letterSpacing: "0.14em", marginBottom: "4px",
                  }}>{m.label.toUpperCase()}</div>
                  <div style={{ fontFamily: FONT, color: C.text, fontSize: "13px", fontWeight: 600 }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ maxWidth: "920px", margin: "0 auto", padding: "56px 24px 80px" }}
          className="eip-grid">

          {/* ─── LEFT: BODY ─── */}
          <div>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="abstract">
              <H2 id="abstract">Abstract</H2>
              <P>
                ERC-OTTER defines a formal Solidity interface for community-owned tokens on Ethereum.
                It builds directly on <strong style={{ color: C.text }}>EIP-20 (ERC-20)</strong> as the
                base layer, incorporating principles from <strong style={{ color: C.text }}>EIP-4626</strong>{" "}
                (vault accounting for reward pools) and <strong style={{ color: C.text }}>EIP-712</strong>{" "}
                (typed structured data for off-chain signatures), and introducing four novel
                protocol primitives not found in any existing standard:
              </P>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                {[
                  { n: "I",   label: "Immutable Transfer Tax Distribution",  color: C.gold,   desc: "5% auto-split on every transfer — permanent, no admin override possible" },
                  { n: "II",  label: "Time-Based Holder Tier Progression",   color: C.purple, desc: "Hold duration unlocks MEMBER and OG tiers with multiplied governance weight" },
                  { n: "III", label: "On-Chain Meme Economy",                color: C.green,  desc: "Submit, vote, and earn from a community-run content layer with epoch settlement" },
                  { n: "IV",  label: "Protocol Guardian Model",              color: C.amber,  desc: "Transparent founder controls with hard-coded constraints — not omnipotent Ownable" },
                ].map((item) => (
                  <div key={item.n} style={{
                    display: "flex", gap: "14px", alignItems: "flex-start",
                    background: C.card2, border: `1px solid ${C.border}`,
                    borderRadius: "6px", padding: "14px 16px",
                  }}>
                    <span style={{
                      fontFamily: MONO, color: item.color, fontWeight: 700,
                      fontSize: "11px", flexShrink: 0, letterSpacing: "0.1em",
                      background: item.color + "12", border: `1px solid ${item.color}25`,
                      padding: "3px 10px", borderRadius: "3px",
                    }}>{item.n}</span>
                    <div>
                      <div style={{ fontFamily: FONT, color: C.text, fontWeight: 700, fontSize: "13px", marginBottom: "3px", letterSpacing: "0.04em" }}>{item.label}</div>
                      <div style={{ fontFamily: FONT, color: C.muted, fontSize: "12px", lineHeight: 1.7 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <P>
                Any token contract implementing this standard MUST enforce these mechanics without
                owner override capability. Community protections cannot be disabled after deployment.
                This is the foundational design invariant.
              </P>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="motivation">
              <H2 id="motivation">Motivation</H2>
              <P>
                Meme tokens represent a genuinely new type of digital community — one where cultural
                contribution, loyalty, and shared identity carry real economic value. Yet the current
                ERC-20 standard provides no mechanisms to encode these community dynamics on-chain.
                The result is a structural misalignment between developer incentives and community
                interests.
              </P>

              <H3>Three Unsolved Problems</H3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {[
                  {
                    title: "Rug Pull Vulnerability",
                    glyph: "ג",
                    color: C.red,
                    tag: "CRITICAL",
                    desc: "ERC-20 imposes no restrictions on liquidity removal. Developers can drain the liquidity pool at any time. Community trust is built on social promises with zero cryptographic enforcement.",
                  },
                  {
                    title: "No Contribution Incentive",
                    glyph: "ד",
                    color: C.amber,
                    tag: "STRUCTURAL",
                    desc: "Holders who create content, grow the community, or promote the project receive no on-chain compensation. Wealth accumulation is the only on-chain signal — rewarding speculation, not contribution.",
                  },
                  {
                    title: "Pure Speculation Trap",
                    glyph: "ה",
                    color: C.purple,
                    tag: "SYSTEMIC",
                    desc: "Without standardized utility mechanics, meme tokens cannot evolve beyond zero-sum price speculation. There is no existing ERC framework for sustainable meme community economics.",
                  },
                ].map((item) => (
                  <div key={item.title} style={{
                    background: C.card, border: `1px solid ${item.color}20`,
                    borderLeft: `3px solid ${item.color}`,
                    borderRadius: "6px", padding: "16px 20px",
                    position: "relative", overflow: "hidden",
                  }}>
                    <span style={{
                      position: "absolute", right: "14px", bottom: "8px",
                      fontFamily: MONO, fontSize: "28px",
                      color: "rgba(201,168,76,0.05)", userSelect: "none",
                    }}>{item.glyph}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span style={{
                        background: item.color + "14", color: item.color,
                        border: `1px solid ${item.color}30`,
                        padding: "2px 8px", borderRadius: "3px",
                        fontSize: "9px", fontWeight: 700,
                        fontFamily: FONT, letterSpacing: "0.12em",
                      }}>{item.tag}</span>
                      <strong style={{ fontFamily: FONT, color: C.text, fontSize: "13px", letterSpacing: "0.04em" }}>
                        {item.title}
                      </strong>
                    </div>
                    <p style={{ fontFamily: FONT, color: C.muted, fontSize: "13px", lineHeight: 1.75, margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
              <P>
                ERC-OTTER addresses all three problems with a single coherent standard, making
                community protection a cryptographic guarantee rather than a social promise.
              </P>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="prior-art">
              <H2 id="prior-art">Prior Art</H2>
              <P>
                ERC-OTTER does not start from scratch. It builds on a body of existing Ethereum
                standards and draws specific principles from each:
              </P>

              <div style={{ border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden", marginBottom: "24px" }}>
                <table className="prior-art-table">
                  <thead>
                    <tr>
                      <th>Standard</th>
                      <th>What It Defines</th>
                      <th>What ERC-OTTER Takes From It</th>
                      <th>What It Lacks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["EIP-20 (ERC-20)",    "Fungible token: transfer, approve, allowance",       "Base interface — all OTTER tokens ARE ERC-20",           "No community mechanics, no tax, no governance"],
                      ["EIP-712",            "Typed structured data hashing for signatures",        "Off-chain meme submission signatures (gas-efficient)",    "No token or community layer"],
                      ["EIP-1363",           "Callback after transfer/transferFrom",                "Conceptual basis for auto-distribution on transfer",      "No standard distribution logic"],
                      ["EIP-4626",           "Tokenized vault yield accounting",                    "Reward pool share accounting model",                      "Not designed for community governance"],
                      ["EIP-5725",           "Vesting contract — time-based token release",         "Time-based hold duration → tier progression concept",     "No loyalty incentive, no meme layer"],
                      ["EIP-173",            "Contract ownership — owner() transfer",               "Guardian role architecture (but with explicit constraints)","Omnipotent owner — no power constraints"],
                    ].map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#070500" }}>
                        {row.map((cell, j) => (
                          <td key={j} style={{
                            color: j === 0 ? C.gold : j === 3 ? C.red : C.text,
                            fontWeight: j === 0 ? 700 : 400,
                            fontSize: "11px",
                          }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Callout type="important">
                <strong>What makes ERC-OTTER unique:</strong> No existing standard combines immutable
                tax distribution, time-based loyalty tiers, on-chain cultural rewards, and a
                constrained guardian model into a single coherent interface. ERC-OTTER is not
                a replacement for ERC-20 — it is a community protection layer built on top of it.
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="specification">
              <H2 id="specification">Specification</H2>
              <P>
                The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, and MAY in this document
                are interpreted as described in RFC 2119.
              </P>

              <H3>Full Interface</H3>
              <CodeBlock code={INTERFACE_CODE} filename="IERC_OTTER.sol" />

              <H3>Holder Tiers</H3>
              <P>
                An ERC-OTTER contract MUST maintain three holder tiers based on uninterrupted hold
                duration. The timer MUST reset to zero whenever an address transfers any tokens out.
              </P>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: "8px", overflow: "hidden", marginBottom: "20px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tier</th>
                      <th>Hold Duration</th>
                      <th>Reward Multiplier</th>
                      <th>Governance Weight</th>
                      <th>Meme Submission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["NEWCOMER", "0–30 days",   "1.0× (10000 bps)", "1× balance",   "View only"],
                      ["MEMBER",   "30–90 days",  "1.5× (15000 bps)", "1.5× balance", "Submit + Vote"],
                      ["OG",       "90+ days",    "2.0× (20000 bps)", "2× balance",   "Submit + Vote + Propose"],
                    ].map((row, i) => {
                      const tierColor = [C.muted, C.purple, C.gold][i];
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#070500" }}>
                          {row.map((cell, j) => (
                            <td key={j} style={{
                              color: j === 0 ? tierColor : C.text,
                              fontWeight: j === 0 ? 700 : 400,
                              fontFamily: j === 0 ? FONT : MONO,
                            }}>{cell}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <CodeBlock code={TIER_CODE} filename="OTTERTier.sol (excerpt)" />

              <H3>Transfer Tax — Immutable Distribution</H3>
              <P>
                An ERC-OTTER contract MUST apply exactly <Code>TAX_RATE</Code> (500 bps = 5%) on
                all transfers, excluding mints, burns, and internal contract-to-contract transfers.
                All four distribution shares MUST be declared as <Code>constant</Code> — no setter
                function for these values is permissible.
              </P>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                {[
                  { label: "Community Treasury",  var: "TREASURY_SHARE",  value: "40%", color: C.gold,   desc: "DAO-governed spending — community votes on use of funds" },
                  { label: "Creator Rewards Pool", var: "REWARDS_SHARE",   value: "30%", color: C.purple, desc: "Epoch-distributed to top meme creators by community vote" },
                  { label: "Liquidity Lock",       var: "LIQUIDITY_SHARE", value: "20%", color: C.green,  desc: "Auto-compounded into locked liquidity — no withdrawal" },
                  { label: "Token Burn",           var: "BURN_SHARE",      value: "10%", color: C.red,    desc: "Permanently burned — deflationary pressure on supply" },
                ].map((item) => (
                  <div key={item.var} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px", background: C.card, borderRadius: "6px",
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flex: 1 }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                          <span style={{ fontFamily: FONT, color: C.text, fontSize: "13px" }}>{item.label}</span>
                          <Code>{item.var}</Code>
                        </div>
                        <div style={{ fontFamily: MONO, color: C.mutedL, fontSize: "10px" }}>{item.desc}</div>
                      </div>
                    </div>
                    <span style={{ color: item.color, fontWeight: 700, fontSize: "14px", fontFamily: MONO, flexShrink: 0, marginLeft: "12px" }}>{item.value}</span>
                  </div>
                ))}
              </div>

              <H3>On-Chain Meme Economy — Epoch System</H3>
              <P>
                An ERC-OTTER contract MUST provide on-chain meme submission and voting. Meme
                rewards are distributed in epochs (default 7 days). Only <Code>MEMBER</Code> and{" "}
                <Code>OG</Code> tier holders may submit memes. Any address with positive token
                balance MAY vote.
              </P>
              <CodeBlock code={EPOCH_CODE} filename="OTTEREpoch.sol (excerpt)" />

              <H3>Referral Engine</H3>
              <P>
                An ERC-OTTER contract SHOULD implement on-chain referral tracking. When a new
                holder records a referral via <Code>recordReferral(referee, proof)</Code>, the
                referrer&apos;s count increments on-chain. Referral count MAY contribute to tier
                eligibility and governance weight calculations at the implementer&apos;s discretion.
              </P>

              <Callout type="note">
                The <Code>proof</Code> parameter is a <Code>keccak256</Code> hash of a signed
                message linking referrer and referee. Implementations SHOULD verify this signature
                to prevent false referral claims.
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="governance">
              <H2 id="governance">Community Governance</H2>
              <P>
                ERC-OTTER defines a dual-layer governance model: community-controlled treasury
                and direction, with a Protocol Guardian layer providing emergency protection.
                This model is designed to give the community genuine ownership power while
                ensuring the protocol cannot be broken or exploited.
              </P>

              <H3>Community Powers</H3>
              <P>
                Any holder with <Code>OG</Code> tier status MAY create governance proposals.
                All token holders MAY vote, with weight proportional to{" "}
                <Code>governanceWeight()</Code> (balance × tier multiplier).
              </P>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
                {[
                  { power: "Treasury Spending",     icon: "🏛️", desc: "Propose and vote on how the 40% community treasury is used — grants, development, events, marketing" },
                  { power: "Feature Proposals",     icon: "⚒️", desc: "OG holders can propose new protocol mechanics, which are implemented if passed" },
                  { power: "Partner Integrations",  icon: "🤝", desc: "Vote on which protocols and platforms ERC-OTTER integrates with" },
                  { power: "Epoch Parameters",      icon: "⏱️", desc: "Community may propose changes to epoch duration within the 3–30 day bounds" },
                  { power: "Guardian Transfer",     icon: "🔑", desc: "Community vote (>50% governance weight) required to transfer the Guardian role" },
                ].map((item) => (
                  <div key={item.power} style={{
                    display: "flex", gap: "12px", alignItems: "flex-start",
                    padding: "12px 16px", background: C.card,
                    border: `1px solid ${C.border}`, borderRadius: "6px",
                  }}>
                    <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "2px" }}>{item.icon}</span>
                    <div>
                      <div style={{ fontFamily: FONT, color: C.green, fontWeight: 700, fontSize: "12px", letterSpacing: "0.08em", marginBottom: "3px" }}>{item.power}</div>
                      <div style={{ fontFamily: FONT, color: C.muted, fontSize: "12px", lineHeight: 1.7 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <H3>Protocol Guardian — Explicit Power Framework</H3>
              <P>
                The Protocol Guardian is a named address (initially the core team) with strictly
                limited on-chain powers. Unlike a standard <Code>Ownable</Code> pattern where the
                owner is omnipotent, the Guardian&apos;s capabilities are hard-coded constraints — not
                configurable permissions.
              </P>
              <CodeBlock code={GUARDIAN_CODE} filename="OTTERGuardian.sol" />

              <div className="guardian-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                <div style={{ background: "rgba(0,200,150,0.04)", border: "1px solid rgba(0,200,150,0.2)", borderRadius: "8px", padding: "16px 18px" }}>
                  <div style={{ fontFamily: FONT, color: C.green, fontWeight: 700, fontSize: "11px", letterSpacing: "0.14em", marginBottom: "12px" }}>
                    ✓ GUARDIAN CAN
                  </div>
                  {[
                    "Emergency pause (max 24 hours)",
                    "Queue contract upgrade (72h timelock)",
                    "Veto harmful governance proposals",
                    "Adjust epoch duration (3–30 day bounds)",
                    "Add approved meme content categories",
                  ].map((item) => (
                    <div key={item} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span style={{ color: C.green, fontSize: "10px", flexShrink: 0, marginTop: "3px" }}>●</span>
                      <span style={{ fontFamily: FONT, color: C.text, fontSize: "12px", lineHeight: 1.7 }}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "rgba(255,91,91,0.04)", border: "1px solid rgba(255,91,91,0.2)", borderRadius: "8px", padding: "16px 18px" }}>
                  <div style={{ fontFamily: FONT, color: C.red, fontWeight: 700, fontSize: "11px", letterSpacing: "0.14em", marginBottom: "12px" }}>
                    ✗ GUARDIAN CANNOT
                  </div>
                  {[
                    "Modify TAX_RATE (declared constant)",
                    "Change any distribution share (constant)",
                    "Access treasury without DAO vote",
                    "Disable tier mechanics or meme voting",
                    "Transfer Guardian role without community vote",
                  ].map((item) => (
                    <div key={item} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "8px" }}>
                      <span style={{ color: C.red, fontSize: "10px", flexShrink: 0, marginTop: "3px" }}>●</span>
                      <span style={{ fontFamily: FONT, color: C.text, fontSize: "12px", lineHeight: 1.7 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Callout type="community">
                <strong>Path to Full Decentralization:</strong> The Guardian role is designed to be
                progressively transferred to a community multisig as the protocol matures. Stage 1:
                core team Guardian. Stage 2: 2-of-3 multisig with community members. Stage 3:
                on-chain DAO with no individual Guardian. This roadmap will be published and
                community-voted at each stage.
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="tokenomics">
              <H2 id="tokenomics">Token Economics</H2>

              <H3>Supply Parameters</H3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "24px" }}>
                {[
                  { label: "Total Supply",   value: "100,000,000,000", sub: "100 Billion OTTER",  color: C.gold },
                  { label: "Transfer Tax",   value: "5%",              sub: "immutable constant",  color: C.amber },
                  { label: "Burn Rate",      value: "10%",             sub: "of every tax",        color: C.red },
                  { label: "Creator Rewards",value: "30%",             sub: "of every tax",        color: C.purple },
                  { label: "Treasury Share", value: "40%",             sub: "DAO governed",        color: C.green },
                  { label: "Liquidity",      value: "20%",             sub: "auto-compounding",    color: C.blue },
                ].map((s) => (
                  <div key={s.label} style={{
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: "8px", padding: "14px 16px", textAlign: "center",
                  }}>
                    <div style={{ fontFamily: MONO, color: s.color, fontWeight: 800, fontSize: "16px", marginBottom: "4px" }}>{s.value}</div>
                    <div style={{ fontFamily: FONT, color: C.text, fontWeight: 700, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ fontFamily: MONO, color: C.muted, fontSize: "9px", marginTop: "3px" }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <H3>No Pre-mine. No Team Allocation.</H3>
              <Callout type="community">
                ERC-OTTER&apos;s reference token has no team allocation, no VC round, and no pre-mine.
                The only token distribution mechanism is through the community: 100% of supply
                enters circulation through the open market. Community treasury accumulates through
                the transfer tax — not through a founding team holding tokens. Every holder
                contributes equally to community growth.
              </Callout>

              <H3>Deflationary Mechanics</H3>
              <P>
                Every transfer reduces supply by <Code>BURN_SHARE</Code> (1% of transfer, 10% of
                the 5% tax). With 100 billion initial supply and sustained trading volume, the
                supply is programmatically deflationary. Burn events are emitted as{" "}
                <Code>Transfer</Code> events to the zero address, visible on all block explorers.
              </P>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="reference-impl">
              <H2 id="reference-impl">Reference Implementation</H2>
              <P>
                A minimal reference implementation is available on the companion GitHub repository.
                The abbreviated interface is shown above. The full implementation includes:
              </P>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                {[
                  { file: "OTTERToken.sol",     desc: "Core ERC-20 + tax distribution + tier tracking" },
                  { file: "OTTERGuardian.sol",   desc: "Guardian role with explicit constraint enforcement" },
                  { file: "OTTEREpoch.sol",      desc: "Meme submission, voting, and epoch settlement" },
                  { file: "OTTERGovernance.sol", desc: "Proposal creation, voting, and execution" },
                  { file: "OTTERReferral.sol",   desc: "Referral recording with signature verification" },
                  { file: "OTTERLiquidity.sol",  desc: "Audited liquidity lock with auto-compounding" },
                ].map((f) => (
                  <div key={f.file} style={{
                    display: "flex", gap: "12px", alignItems: "center",
                    padding: "10px 16px", background: C.card,
                    border: `1px solid ${C.border}`, borderRadius: "6px",
                  }}>
                    <span style={{ fontFamily: MONO, color: C.gold, fontSize: "10px", letterSpacing: "0.1em", flexShrink: 0 }}>◈</span>
                    <Code>{f.file}</Code>
                    <span style={{ fontFamily: FONT, color: C.muted, fontSize: "12px" }}>— {f.desc}</span>
                  </div>
                ))}
              </div>
              <P>
                Implementations SHOULD use OpenZeppelin&apos;s audited ERC-20 base. The complete
                reference implementation is available in the companion repository. A Sepolia testnet
                deployment exists for community testing.
              </P>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="rationale">
              <H2 id="rationale">Rationale</H2>

              <H3>Why enforce tax at the standard level?</H3>
              <P>
                Community protection that can be disabled by the owner offers false security. By
                declaring the tax rate and all distribution shares as Solidity <Code>constant</Code>{" "}
                variables — not storage variables — ERC-OTTER ensures no setter function can exist.
                There is no <Code>setTaxRate()</Code>. There is no <Code>setTreasuryShare()</Code>.
                This is the fundamental difference from all existing tax-enabled tokens.
              </P>

              <H3>Why time-based tiers over balance-based?</H3>
              <P>
                Balance-based tiers create plutocracy: large holders gain disproportionate power,
                incentivizing whale accumulation over community commitment. Time-based tiers reward
                conviction and loyalty. A small holder who has held for 90 days has proven genuine
                community alignment — and deserves equivalent governance weight to a larger
                short-term holder. ERC-OTTER chooses alignment over wealth.
              </P>

              <H3>Why on-chain meme voting?</H3>
              <P>
                Meme culture is the primary driver of meme token growth. Moving this on-chain
                creates a transparent, tamper-proof record of cultural contribution and enables
                automatic reward distribution without trusted intermediaries. This is a first — no
                existing ERC standard addresses community cultural value creation.
              </P>

              <H3>Why the Protocol Guardian instead of standard Ownable?</H3>
              <P>
                Standard <Code>Ownable</Code> (EIP-173) gives the owner unrestricted power — they
                can change any storage variable and call any privileged function. This creates the
                same rug-pull risk ERC-OTTER is designed to prevent. The Guardian model explicitly
                enumerates what is and is not permitted, publishes this on-chain, and makes the
                constraints unmodifiable. Transparency of power is as important as limitation of power.
              </P>

              <H3>Why 5% transfer tax?</H3>
              <P>
                Historical analysis of fee-on-transfer tokens shows that rates above 10% cause
                liquidity fragmentation and dex router failures. Rates below 3% generate
                insufficient treasury funding for meaningful community initiatives. 5% is the
                established optimum. Implementations MAY lower to a minimum of <Code>100 bps</Code>{" "}
                (1%) but MUST NOT exceed <Code>1000 bps</Code> (10%).
              </P>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="backwards-compat">
              <H2 id="backwards-compat">Backwards Compatibility</H2>
              <P>
                ERC-OTTER is fully backwards compatible with EIP-20. An ERC-OTTER token IS an
                ERC-20 token. All standard functions — <Code>transfer</Code>,{" "}
                <Code>transferFrom</Code>, <Code>approve</Code>, <Code>allowance</Code>,{" "}
                <Code>balanceOf</Code>, <Code>totalSupply</Code> — behave exactly as specified in
                EIP-20, with one addition: <Code>transfer</Code> and <Code>transferFrom</Code>{" "}
                apply the tax deduction transparently.
              </P>
              <P>
                The <Code>Transfer</Code> event MUST emit the post-tax amount received by the
                recipient. A separate <Code>TaxDistributed</Code> event provides the full breakdown.
                Wallets and block explorers will correctly show the net amount received.
              </P>
              <Callout type="note">
                DEX integrations MUST account for the 5% fee-on-transfer when calculating minimum
                output amounts. Standard Uniswap V2/V3 swaps work correctly with ERC-OTTER tokens
                using the <Code>supportingFeeOnTransfer</Code> variants of swap functions.
              </Callout>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="security">
              <H2 id="security">Security Considerations</H2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    title: "Re-entrancy in claimRewards()",
                    severity: "HIGH", color: C.red, glyph: "ז",
                    desc: "MUST follow checks-effects-interactions. Zero the pending rewards BEFORE the token transfer. Consider using OpenZeppelin ReentrancyGuard as an additional safeguard.",
                  },
                  {
                    title: "Tier manipulation via flash loans",
                    severity: "MEDIUM", color: C.amber, glyph: "ח",
                    desc: "Hold duration uses block.timestamp from first acquisition. Flash loan positions do not accumulate hold time as the timer resets on any outbound transfer. SHOULD verify using timestamps, not block numbers.",
                  },
                  {
                    title: "Meme voting Sybil attacks",
                    severity: "MEDIUM", color: C.amber, glyph: "ט",
                    desc: "Mitigated by MEMBER tier requirement (30+ day hold) to submit. Voting weight is proportional to governance weight, not address count. SHOULD consider snapshot voting for large reward pools.",
                  },
                  {
                    title: "Liquidity lock integrity",
                    severity: "HIGH", color: C.red, glyph: "י",
                    desc: "The locked liquidity mechanism MUST be independently audited. STRONGLY RECOMMENDED to use established audited lock protocols (Unicrypt, Team Finance) rather than custom implementations.",
                  },
                  {
                    title: "Guardian timelock bypass",
                    severity: "LOW", color: C.green, glyph: "כ",
                    desc: "The 72-hour upgrade timelock is enforced in contract code. However, the community SHOULD monitor the queueUpgrade() event and be prepared to coordinate opposition via governance if needed.",
                  },
                  {
                    title: "Epoch settlement manipulation",
                    severity: "LOW", color: C.green, glyph: "ל",
                    desc: "settleEpoch() is callable by anyone after epoch end. Last-minute large votes may influence settlement. SHOULD consider snapshot-based voting weight (balance at epoch start) to prevent last-block manipulation.",
                  },
                ].map((item) => (
                  <div key={item.title} style={{
                    background: C.card, border: `1px solid ${item.color}22`,
                    borderLeft: `3px solid ${item.color}`,
                    borderRadius: "8px", padding: "16px 20px",
                    position: "relative", overflow: "hidden",
                  }}>
                    <span style={{
                      position: "absolute", right: "14px", bottom: "8px",
                      fontFamily: MONO, fontSize: "24px",
                      color: "rgba(201,168,76,0.05)", userSelect: "none",
                    }}>{item.glyph}</span>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{
                        background: item.color + "15", color: item.color,
                        border: `1px solid ${item.color}35`,
                        padding: "2px 8px", borderRadius: "3px",
                        fontSize: "9px", fontWeight: 700,
                        fontFamily: FONT, letterSpacing: "0.12em",
                      }}>{item.severity}</span>
                      <strong style={{ fontFamily: FONT, color: C.text, fontSize: "13px", letterSpacing: "0.04em" }}>
                        {item.title}
                      </strong>
                    </div>
                    <p style={{ fontFamily: FONT, color: C.muted, fontSize: "13px", lineHeight: 1.7, margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            {/* ═══════════════════════════════════════════════════════════ */}
            <Section id="copyright">
              <H2 id="copyright">Copyright</H2>
              <P>
                Copyright and related rights waived via{" "}
                <a href="https://creativecommons.org/publicdomain/zero/1.0/"
                  target="_blank" rel="noopener noreferrer" style={{ color: C.gold }}>
                  CC0 1.0 Universal
                </a>. The ERC-OTTER interface is free for any project to implement.
              </P>
              <Callout type="community">
                ERC-OTTER is open source and community-driven. If you&apos;re building a token using
                this standard, we want to hear from you. Submit your project for inclusion in the
                official ERC-OTTER registry. Compliant implementations receive the{" "}
                <strong>◈ OTTER CERTIFIED</strong> badge.
              </Callout>
            </Section>

            {/* Bottom nav */}
            <div style={{
              display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
              paddingTop: "40px", borderTop: `1px solid ${C.border}`,
            }}>
              <Link href="/about" style={{
                fontFamily: FONT, color: C.muted, textDecoration: "none",
                fontSize: "13px", display: "flex", alignItems: "center", gap: "6px",
                letterSpacing: "0.06em",
              }}>
                ← BACK TO PROTOCOL
              </Link>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <a href="https://ethereum-magicians.org" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    background: "transparent", border: `1px solid rgba(201,168,76,0.25)`,
                    color: C.gold, textDecoration: "none", fontWeight: 700, fontSize: "12px",
                    padding: "10px 18px", borderRadius: "6px",
                    fontFamily: FONT, letterSpacing: "0.08em",
                  }}>
                  DISCUSS ON MAGICIANS
                </a>
                <Link href="/dapp" style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`,
                  color: "#000", textDecoration: "none", fontWeight: 700, fontSize: "12px",
                  padding: "10px 18px", borderRadius: "6px",
                  fontFamily: FONT, letterSpacing: "0.08em",
                }}>
                  ENTER DAPP BETA →
                </Link>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: SIDEBAR ─── */}
          <aside style={{
            position: "sticky", top: "88px",
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: "8px", padding: "20px",
          }}>
            <div style={{
              fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "9px",
              letterSpacing: "0.2em", marginBottom: "4px",
            }}>◈ CODEX</div>
            <p style={{
              fontFamily: FONT, color: C.gold, fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "16px",
            }}>
              Table of Contents
            </p>

            {TOC.map((item) => (
              <a key={item.id} href={`#${item.id}`}
                className={`eip-toc-link${activeSection === item.id ? " active" : ""}`}
                onClick={() => setActiveSection(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  color: C.muted, textDecoration: "none",
                  fontSize: "11px", padding: "7px 0",
                  borderBottom: `1px solid ${C.border}`,
                  transition: "color 0.15s",
                  fontFamily: FONT,
                }}>
                <span style={{
                  fontFamily: MONO, color: "rgba(201,168,76,0.3)",
                  fontSize: "11px", flexShrink: 0, width: "14px",
                }}>{item.glyph}</span>
                {item.label}
              </a>
            ))}

            {/* Community CTA */}
            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${C.border}` }}>
              <p style={{
                fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "9px",
                letterSpacing: "0.14em", marginBottom: "10px",
              }}>◈ CONTRIBUTE</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <a href="https://ethereum-magicians.org" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "block", textAlign: "center",
                    background: "rgba(201,168,76,0.06)", border: `1px solid rgba(201,168,76,0.2)`,
                    color: C.gold, textDecoration: "none", fontSize: "11px", fontWeight: 700,
                    padding: "9px", borderRadius: "6px",
                    fontFamily: FONT, letterSpacing: "0.08em",
                  }}>
                  ETH MAGICIANS →
                </a>
                <Link href="/dapp"
                  style={{
                    display: "block", textAlign: "center",
                    background: "rgba(0,200,150,0.06)", border: `1px solid rgba(0,200,150,0.2)`,
                    color: C.green, textDecoration: "none", fontSize: "11px", fontWeight: 700,
                    padding: "9px", borderRadius: "6px",
                    fontFamily: FONT, letterSpacing: "0.08em",
                  }}>
                  TEST ON SEPOLIA →
                </Link>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${C.border}` }}>
              <p style={{
                fontFamily: MONO, color: "rgba(201,168,76,0.4)", fontSize: "9px",
                letterSpacing: "0.14em", marginBottom: "10px",
              }}>◈ QUICK PARAMS</p>
              {[
                { label: "Tax Rate",     value: "5%   (500 bps)" },
                { label: "Treasury",     value: "40%" },
                { label: "Creators",     value: "30%" },
                { label: "Liquidity",    value: "20%" },
                { label: "Burn",         value: "10%" },
                { label: "MEMBER Tier",  value: "30 days" },
                { label: "OG Tier",      value: "90 days" },
                { label: "Epoch",        value: "7 days (default)" },
              ].map((p) => (
                <div key={p.label} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "5px 0", borderBottom: `1px solid rgba(201,168,76,0.04)`,
                  fontFamily: MONO, fontSize: "10px",
                }}>
                  <span style={{ color: C.mutedL }}>{p.label}</span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{p.value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}
