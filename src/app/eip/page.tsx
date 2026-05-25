"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

// ─── PALETTE ─────────────────────────────────────────────────
const C = {
  black:  "#000000",
  deep:   "#050400",
  card:   "#0D0B07",
  border: "#1E1A10",
  borderG:"rgba(201,168,76,0.18)",
  gold:   "#C9A84C",
  goldL:  "#E2BF6E",
  text:   "#E8DFC8",
  muted:  "#8C7A5C",
  mutedL: "#5C4A2A",
  amber:  "#F5A623",
  purple: "#A78BFA",
  red:    "#FF5B5B",
  green:  "#00C896",
};

// ─── TYPOGRAPHY COMPONENTS ───────────────────────────────────
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: "var(--font-cinzel, serif)",
      fontSize: "20px",
      fontWeight: 700,
      color: C.text,
      marginBottom: "16px",
      paddingBottom: "12px",
      borderBottom: `1px solid ${C.border}`,
      marginTop: "44px",
      letterSpacing: "0.04em",
    }}>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: "var(--font-cinzel, serif)",
      fontSize: "15px",
      fontWeight: 700,
      color: C.text,
      marginBottom: "10px",
      marginTop: "28px",
      letterSpacing: "0.06em",
    }}>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: "var(--font-cinzel, serif)",
      color: C.muted, lineHeight: 1.8, fontSize: "15px", marginBottom: "16px",
    }}>
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: "rgba(201,168,76,0.08)",
      color: C.gold,
      padding: "2px 7px",
      borderRadius: "3px",
      fontFamily: "var(--font-geist-mono)",
      fontSize: "12px",
      border: "1px solid rgba(201,168,76,0.15)",
    }}>
      {children}
    </code>
  );
}

function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  return (
    <div style={{
      background: "#050400",
      border: `1px solid ${C.border}`,
      borderRadius: "8px",
      overflow: "hidden",
      marginBottom: "20px",
    }}>
      {filename && (
        <div style={{
          padding: "9px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span style={{
            fontFamily: "var(--font-geist-mono)",
            color: "rgba(201,168,76,0.4)", fontSize: "10px", letterSpacing: "0.12em",
          }}>◈</span>
          <span style={{
            fontFamily: "var(--font-geist-mono)",
            color: C.muted, fontSize: "12px",
          }}>{filename}</span>
        </div>
      )}
      <pre style={{
        padding: "20px",
        overflowX: "auto",
        margin: 0,
        fontSize: "12.5px",
        lineHeight: 1.75,
        color: "#A8B090",
        fontFamily: "var(--font-geist-mono)",
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: "56px" }}>
      {children}
    </section>
  );
}

// ─── INTERFACE CODE ──────────────────────────────────────────
const INTERFACE_CODE = `// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/// @title IERC-OTTER: Community Token Standard
/// @notice Interface for community-owned meme tokens
interface IERC_OTTER {

    // ─── ENUMS ───────────────────────────────────────────────
    enum Tier { NEWCOMER, MEMBER, OG }

    // ─── EVENTS ──────────────────────────────────────────────
    event MemeSubmitted(address indexed creator, bytes32 indexed hash, uint256 id);
    event MemeVoted(uint256 indexed id, address indexed voter, bool upvote);
    event RewardsClaimed(address indexed holder, uint256 amount);
    event TierUpgraded(address indexed holder, Tier newTier);
    event TaxDistributed(
        uint256 toTreasury,
        uint256 toRewards,
        uint256 toLiquidity,
        uint256 burned
    );

    // ─── ERRORS ──────────────────────────────────────────────
    error AlreadyVoted();
    error NothingToClaim();
    error InsufficientHoldTime();

    // ─── CORE READS ──────────────────────────────────────────
    function holderTier(address account) external view returns (Tier);
    function holdDuration(address account) external view returns (uint256 seconds_);
    function pendingRewards(address account) external view returns (uint256);
    function rewardMultiplier(address account) external view returns (uint256 bps);

    // ─── TAX MECHANICS ───────────────────────────────────────
    function TAX_RATE() external view returns (uint16 bps); // 500 = 5%
    function TREASURY_SHARE() external view returns (uint16); // 4000 = 40%
    function REWARDS_SHARE() external view returns (uint16);  // 3000 = 30%
    function LIQUIDITY_SHARE() external view returns (uint16); // 2000 = 20%
    function BURN_SHARE() external view returns (uint16);      // 1000 = 10%

    // ─── COMMUNITY ACTIONS ───────────────────────────────────
    function submitMeme(bytes32 contentHash) external returns (uint256 memeId);
    function voteOnMeme(uint256 memeId, bool upvote) external;
    function claimRewards() external returns (uint256 claimed);

    // ─── GOVERNANCE ──────────────────────────────────────────
    function governanceWeight(address account) external view returns (uint256);
    function treasury() external view returns (address);
}`;

const IMPL_CODE = `// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import "./IERC_OTTER.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract OTTERToken is ERC20, IERC_OTTER {

    uint16 public constant TAX_RATE       = 500;  // 5%
    uint16 public constant TREASURY_SHARE = 4000; // 40% of tax
    uint16 public constant REWARDS_SHARE  = 3000; // 30% of tax
    uint16 public constant LIQUIDITY_SHARE = 2000;// 20% of tax
    uint16 public constant BURN_SHARE     = 1000; // 10% of tax

    // Tier thresholds (in seconds)
    uint256 constant MEMBER_THRESHOLD = 30 days;
    uint256 constant OG_THRESHOLD     = 90 days;

    address public treasury;
    address public rewardsPool;

    mapping(address => uint256) public holdSince;
    mapping(address => uint256) public accruedRewards;

    // ...
    // Full reference implementation available on GitHub
}`;

// ─── PAGE ─────────────────────────────────────────────────────
export default function EIPPage() {
  return (
    <div style={{ background: C.black, color: C.text, minHeight: "100vh" }}>
      <Navbar />

      <div style={{ paddingTop: "64px" }}>

        {/* ── INSCRIPTION HEADER ── */}
        <div style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "56px 24px 44px",
          position: "relative", overflow: "hidden",
        }}>
          {/* Background radial */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(201,168,76,0.04) 0%, transparent 60%)",
          }} />

          <div style={{ maxWidth: "900px", margin: "0 auto", position: "relative" }}>

            {/* Ancient seal badges */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
              {[
                { label: "⟦ EIP DRAFT ⟧",         color: C.amber },
                { label: "◈ STANDARDS TRACK",       color: C.gold },
                { label: "ב ERC",                   color: C.purple },
                { label: "EPOCH I · 2025-05-18",    color: C.muted },
              ].map((badge) => (
                <span key={badge.label} style={{
                  background: badge.color + "12",
                  color: badge.color,
                  border: `1px solid ${badge.color}30`,
                  padding: "4px 12px",
                  borderRadius: "3px",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "var(--font-cinzel, serif)",
                  letterSpacing: "0.1em",
                }}>
                  {badge.label}
                </span>
              ))}
            </div>

            <h1 style={{
              fontFamily: "var(--font-cinzel, serif)",
              fontSize: "clamp(22px, 4vw, 38px)",
              fontWeight: 900,
              marginBottom: "14px",
              letterSpacing: "0.02em",
              lineHeight: 1.2,
              color: C.text,
            }}>
              ERC-OTTER: Progressive Community Token Standard
            </h1>

            <p style={{
              color: C.muted, fontSize: "16px", lineHeight: 1.7, maxWidth: "640px",
              fontFamily: "var(--font-cinzel, serif)",
            }}>
              A standard interface for meme tokens that enforces community ownership, contribution
              rewards, and anti-manipulation mechanics at the protocol level.
            </p>

            {/* Ancient inscription line */}
            <div style={{
              fontFamily: "var(--font-geist-mono)",
              color: "rgba(201,168,76,0.25)", fontSize: "11px",
              letterSpacing: "0.2em", marginTop: "20px",
            }}>
              ━━━━━━━━ א · OTTER PROTOCOL · ERC-OTTER · DRAFT ב ━━━━━━━━
            </div>

            {/* Metadata grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              marginTop: "28px",
            }}>
              {[
                { label: "Author",   value: "OTTER Core Team" },
                { label: "Status",   value: "Draft" },
                { label: "Type",     value: "Standards Track" },
                { label: "Category", value: "ERC" },
                { label: "Created",  value: "2025-05-18" },
                { label: "Requires", value: "EIP-20, EIP-712" },
              ].map((m) => (
                <div key={m.label} style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: "6px",
                  padding: "10px 14px",
                }}>
                  <div style={{
                    fontFamily: "var(--font-geist-mono)",
                    color: "rgba(201,168,76,0.4)", fontSize: "9px",
                    fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.14em", marginBottom: "4px",
                  }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-cinzel, serif)",
                    color: C.text, fontSize: "13px", fontWeight: 600,
                  }}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "60px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          gap: "60px",
          alignItems: "start",
        }} className="eip-grid">

          {/* ── MAIN BODY ── */}
          <div>
            <Section id="abstract">
              <H2>Abstract</H2>
              <P>
                This ERC proposes a standard interface for community-owned meme tokens on Ethereum.
                ERC-OTTER defines a set of on-chain mechanics — including a mandatory transfer tax
                with auto-distribution, holder tier progression, on-chain meme submission and
                community voting, and governance weight tied to hold duration — that together create
                a self-sustaining, community-first token ecosystem.
              </P>
              <P>
                Any token contract implementing this standard MUST enforce these mechanics without
                owner override capability, ensuring that the community protections cannot be disabled
                after deployment.
              </P>
            </Section>

            <Section id="motivation">
              <H2>Motivation</H2>
              <P>
                The current meme token landscape is characterized by a fundamental misalignment
                between developer incentives and community interests. There is no standard that
                enforces community protections at the contract level — teams can drain liquidity,
                disable taxes, or abandon projects at any time.
              </P>
              <P>Three core problems exist today:</P>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                {[
                  {
                    title: "Rug Pull Vulnerability",
                    desc: "No standard prevents developers from removing liquidity. Community trust is based on social promises, not cryptographic guarantees.",
                    glyph: "ג",
                  },
                  {
                    title: "No Contribution Incentive",
                    desc: "Holders have no on-chain mechanism to be rewarded for community contributions such as content creation, promotion, or governance participation.",
                    glyph: "ד",
                  },
                  {
                    title: "Pure Speculation",
                    desc: "Without standardized mechanics, meme tokens cannot evolve beyond zero-sum speculation. There is no framework for sustainable community value.",
                    glyph: "ה",
                  },
                ].map((item) => (
                  <div key={item.title} style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: "8px",
                    padding: "16px 20px",
                    position: "relative", overflow: "hidden",
                  }}>
                    <span style={{
                      position: "absolute", right: "14px", bottom: "8px",
                      fontFamily: "var(--font-geist-mono)",
                      fontSize: "28px", color: "rgba(201,168,76,0.05)",
                      userSelect: "none",
                    }}>{item.glyph}</span>
                    <strong style={{
                      fontFamily: "var(--font-cinzel, serif)",
                      color: C.text, display: "block", marginBottom: "6px",
                      fontSize: "14px", letterSpacing: "0.04em",
                    }}>
                      {item.title}
                    </strong>
                    <span style={{
                      fontFamily: "var(--font-cinzel, serif)",
                      color: C.muted, fontSize: "14px", lineHeight: 1.65,
                    }}>
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
              <P>
                ERC-OTTER solves these problems by defining a formal standard that any community
                meme token can implement — making community protection a technical guarantee rather
                than a social promise.
              </P>
            </Section>

            <Section id="specification">
              <H2>Specification</H2>
              <P>
                The key words &quot;MUST&quot;, &quot;MUST NOT&quot;, &quot;REQUIRED&quot;,
                &quot;SHALL&quot;, &quot;SHOULD&quot;, and &quot;MAY&quot; in this document are to be
                interpreted as described in RFC 2119.
              </P>

              <H3>Interface</H3>
              <P>Every ERC-OTTER compliant contract MUST implement the following interface:</P>
              <CodeBlock code={INTERFACE_CODE} filename="IERC_OTTER.sol" />

              <H3>Holder Tiers</H3>
              <P>
                An ERC-OTTER contract MUST maintain three holder tiers based on uninterrupted hold
                duration:
              </P>
              <div style={{
                border: `1px solid ${C.border}`,
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "20px",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.card }}>
                      {["Tier", "Duration", "Reward Multiplier", "Governance Weight"].map((h) => (
                        <th key={h} style={{
                          padding: "12px 16px",
                          textAlign: "left",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "rgba(201,168,76,0.5)",
                          borderBottom: `1px solid ${C.border}`,
                          fontFamily: "var(--font-cinzel, serif)",
                          letterSpacing: "0.1em",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["NEWCOMER", "0 – 30 days",  "1.0x (10000 bps)", "1x balance"],
                      ["MEMBER",   "30 – 90 days", "1.5x (15000 bps)", "1.5x balance"],
                      ["OG",       "90+ days",     "2.0x (20000 bps)", "2x balance"],
                    ].map((row, i) => {
                      const tierColor = [C.muted, C.purple, C.gold][i];
                      return (
                        <tr key={row[0]} style={{ background: i % 2 === 0 ? "transparent" : "#080600" }}>
                          {row.map((cell, j) => (
                            <td key={j} style={{
                              padding: "12px 16px",
                              fontSize: "13px",
                              color: j === 0 ? tierColor : C.text,
                              fontWeight: j === 0 ? 700 : 400,
                              borderBottom: i < 2 ? `1px solid ${C.border}` : "none",
                              fontFamily: j === 0 ? "var(--font-cinzel, serif)" : "var(--font-geist-mono)",
                              letterSpacing: j === 0 ? "0.08em" : "0",
                            }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <P>
                The hold duration timer MUST reset to zero whenever an address transfers any tokens
                out. Re-purchasing after selling MUST restart the duration counter.
              </P>

              <H3>Transfer Tax</H3>
              <P>
                An ERC-OTTER contract MUST apply a transfer tax of exactly{" "}
                <Code>TAX_RATE</Code> (recommended: 500 basis points = 5%) on all transfers except
                those to/from the contract itself or locked liquidity addresses.
              </P>
              <P>
                The tax MUST be distributed as follows, with all shares summing to{" "}
                <Code>10000 bps</Code>:
              </P>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                {[
                  { label: "Community Treasury", var: "TREASURY_SHARE",  value: "4000 bps (40%)", color: C.gold },
                  { label: "Meme Rewards Pool",  var: "REWARDS_SHARE",   value: "3000 bps (30%)", color: C.purple },
                  { label: "Liquidity Lock",      var: "LIQUIDITY_SHARE", value: "2000 bps (20%)", color: C.amber },
                  { label: "Burn",                var: "BURN_SHARE",      value: "1000 bps (10%)", color: C.red },
                ].map((item) => (
                  <div key={item.var} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 16px",
                    background: C.card,
                    borderRadius: "6px",
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span style={{
                        width: "6px", height: "6px", borderRadius: "50%",
                        background: item.color, display: "inline-block", flexShrink: 0,
                      }} />
                      <span style={{
                        color: C.text, fontSize: "14px",
                        fontFamily: "var(--font-cinzel, serif)",
                      }}>
                        {item.label}
                      </span>
                      <Code>{item.var}</Code>
                    </div>
                    <span style={{
                      color: item.color, fontWeight: 700, fontSize: "13px",
                      fontFamily: "var(--font-geist-mono)",
                    }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <H3>Meme Submission and Voting</H3>
              <P>
                An ERC-OTTER contract MUST provide on-chain meme submission and voting. Submitters
                MUST be holders with at least <Code>MEMBER</Code> tier status. A meme is identified by
                the <Code>keccak256</Code> hash of its content URI.
              </P>
              <P>
                Voting weight MUST equal the caller&apos;s <Code>governanceWeight()</Code>. Each address
                MUST NOT vote on the same meme more than once. Reward distribution from the Meme
                Rewards Pool SHOULD be proportional to net upvotes received over a fixed epoch period
                (RECOMMENDED: 7 days).
              </P>
            </Section>

            <Section id="reference-impl">
              <H2>Reference Implementation</H2>
              <P>
                A minimal reference implementation is provided below. Implementations SHOULD extend
                this with additional security measures, access controls on governance, and audited
                liquidity lock mechanisms.
              </P>
              <CodeBlock code={IMPL_CODE} filename="OTTERToken.sol (abbreviated)" />
              <P>
                The complete reference implementation, including full governance mechanics, reward
                epoch accounting, and audited liquidity lock integration, is available in the
                companion GitHub repository.
              </P>
            </Section>

            <Section id="rationale">
              <H2>Rationale</H2>

              <H3>Why enforce tax at the standard level?</H3>
              <P>
                Community protection that can be disabled by the owner offers false security. By
                making the tax rate and distribution immutable at the interface level, ERC-OTTER
                ensures that no party — including the original deployer — can bypass community
                mechanics after deployment. This is the core design principle.
              </P>

              <H3>Why time-based tiers over balance-based?</H3>
              <P>
                Balance-based tiers reward wealth concentration, creating plutocratic governance.
                Time-based tiers reward loyalty and alignment. A long-term small holder has
                demonstrated more genuine community commitment than a large short-term speculator.
                This design aligns incentives toward sustainable community growth.
              </P>

              <H3>Why on-chain meme voting?</H3>
              <P>
                Moving community contribution on-chain creates a transparent, tamper-proof record of
                cultural value creation. It also enables automatic reward distribution without trusted
                intermediaries. Meme culture is the primary driver of meme token community growth —
                rewarding it directly and transparently is a significant improvement over informal
                recognition.
              </P>

              <H3>Why 5% transfer tax?</H3>
              <P>
                The 5% rate is chosen as a balance between generating sufficient community revenue
                and maintaining reasonable trading liquidity. Rates above 10% have historically
                caused liquidity fragmentation and reduced adoption. Rates below 3% generate
                insufficient treasury funds. Implementations MAY reduce the rate to a minimum of{" "}
                <Code>100 bps</Code> (1%) but MUST NOT increase it beyond <Code>1000 bps</Code> (10%).
              </P>
            </Section>

            <Section id="backwards-compat">
              <H2>Backwards Compatibility</H2>
              <P>
                ERC-OTTER is fully backwards compatible with EIP-20. An ERC-OTTER token IS an
                ERC-20 token. All standard ERC-20 functions (<Code>transfer</Code>,{" "}
                <Code>transferFrom</Code>, <Code>approve</Code>, <Code>allowance</Code>,{" "}
                <Code>balanceOf</Code>, <Code>totalSupply</Code>) MUST behave as specified in
                EIP-20, with the addition that <Code>transfer</Code> and <Code>transferFrom</Code>{" "}
                apply the tax deduction transparently.
              </P>
              <P>
                The <Code>Transfer</Code> event MUST emit the post-tax amount received by the
                recipient. A separate <Code>TaxDistributed</Code> event provides a full breakdown of
                the tax split.
              </P>
            </Section>

            <Section id="security">
              <H2>Security Considerations</H2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  {
                    title: "Re-entrancy in claimRewards()",
                    severity: "HIGH",
                    color: C.red,
                    glyph: "ז",
                    desc: "Implementations MUST follow the checks-effects-interactions pattern. State changes (zeroing pending rewards) MUST occur before any token transfer.",
                  },
                  {
                    title: "Tier manipulation via flash loans",
                    severity: "MEDIUM",
                    color: C.amber,
                    glyph: "ח",
                    desc: "Hold duration is measured from first acquisition. Flash loan positions do not accumulate hold time as the timer resets on any outbound transfer. Implementations SHOULD verify hold time using block timestamps, not block numbers.",
                  },
                  {
                    title: "Meme voting manipulation",
                    severity: "MEDIUM",
                    color: C.amber,
                    glyph: "ט",
                    desc: "Sybil attacks via multiple wallets are mitigated by requiring MEMBER tier status (30+ day hold) to vote. However, implementations SHOULD consider additional anti-Sybil measures for large reward pools.",
                  },
                  {
                    title: "Liquidity lock integrity",
                    severity: "HIGH",
                    color: C.red,
                    glyph: "י",
                    desc: "The locked liquidity mechanism MUST be audited independently. Implementations are strongly RECOMMENDED to use established, audited liquidity lock protocols (e.g., Unicrypt, Team Finance) rather than custom implementations.",
                  },
                ].map((item) => (
                  <div key={item.title} style={{
                    background: C.card,
                    border: `1px solid ${item.color}28`,
                    borderRadius: "8px",
                    padding: "16px 20px",
                    position: "relative", overflow: "hidden",
                  }}>
                    <span style={{
                      position: "absolute", right: "14px", bottom: "8px",
                      fontFamily: "var(--font-geist-mono)",
                      fontSize: "28px", color: "rgba(201,168,76,0.05)", userSelect: "none",
                    }}>{item.glyph}</span>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{
                        background: item.color + "18",
                        color: item.color,
                        border: `1px solid ${item.color}38`,
                        padding: "2px 8px",
                        borderRadius: "3px",
                        fontSize: "10px",
                        fontWeight: 700,
                        fontFamily: "var(--font-cinzel, serif)",
                        letterSpacing: "0.1em",
                      }}>
                        {item.severity}
                      </span>
                      <strong style={{
                        fontFamily: "var(--font-cinzel, serif)",
                        color: C.text, fontSize: "13px", letterSpacing: "0.04em",
                      }}>
                        {item.title}
                      </strong>
                    </div>
                    <p style={{
                      fontFamily: "var(--font-cinzel, serif)",
                      color: C.muted, fontSize: "14px", lineHeight: 1.65, margin: 0,
                    }}>
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="copyright">
              <H2>Copyright</H2>
              <P>
                Copyright and related rights waived via{" "}
                <a
                  href="https://creativecommons.org/publicdomain/zero/1.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: C.gold }}
                >
                  CC0
                </a>.
              </P>
            </Section>

            {/* Bottom nav */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              flexWrap: "wrap", gap: "12px",
              paddingTop: "40px",
              borderTop: `1px solid ${C.border}`,
            }}>
              <Link href="/about" style={{
                fontFamily: "var(--font-cinzel, serif)",
                color: C.muted, textDecoration: "none", fontSize: "13px",
                display: "flex", alignItems: "center", gap: "6px",
                letterSpacing: "0.06em",
              }}>
                ← BACK TO HOME
              </Link>
              <a
                href="https://github.com/ethereum/EIPs"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  background: `linear-gradient(135deg, ${C.gold}, ${C.goldL})`,
                  color: "#000", textDecoration: "none",
                  fontWeight: 700, fontSize: "13px",
                  padding: "10px 20px", borderRadius: "6px",
                  fontFamily: "var(--font-cinzel, serif)",
                  letterSpacing: "0.06em",
                }}
              >
                SUBMIT TO ETHEREUM EIPs →
              </a>
            </div>
          </div>

          {/* ── SIDEBAR TOC ── */}
          <aside
            style={{
              position: "sticky",
              top: "88px",
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: "8px",
              padding: "20px",
            }}
            className="hidden lg:block"
          >
            {/* TOC header */}
            <div style={{
              fontFamily: "var(--font-geist-mono)",
              color: "rgba(201,168,76,0.4)", fontSize: "9px",
              letterSpacing: "0.2em", marginBottom: "4px",
            }}>
              ◈ CODEX
            </div>
            <p style={{
              fontFamily: "var(--font-cinzel, serif)",
              color: C.gold, fontSize: "11px", fontWeight: 700,
              letterSpacing: "0.14em", textTransform: "uppercase",
              marginBottom: "16px",
            }}>
              Table of Contents
            </p>

            {[
              { id: "abstract",        label: "Abstract",                glyph: "א" },
              { id: "motivation",      label: "Motivation",              glyph: "ב" },
              { id: "specification",   label: "Specification",           glyph: "ג" },
              { id: "reference-impl",  label: "Reference Implementation",glyph: "ד" },
              { id: "rationale",       label: "Rationale",               glyph: "ה" },
              { id: "backwards-compat",label: "Backwards Compatibility", glyph: "ו" },
              { id: "security",        label: "Security",                glyph: "ז" },
              { id: "copyright",       label: "Copyright",               glyph: "ח" },
            ].map((item) => (
              <a key={item.id} href={`#${item.id}`} style={{
                display: "flex", alignItems: "center", gap: "8px",
                color: C.muted, textDecoration: "none",
                fontSize: "12px", padding: "7px 0",
                borderBottom: `1px solid ${C.border}`,
                transition: "color 0.15s",
                fontFamily: "var(--font-cinzel, serif)",
              }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = C.gold)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = C.muted)}
              >
                <span style={{
                  fontFamily: "var(--font-geist-mono)",
                  color: "rgba(201,168,76,0.3)", fontSize: "11px", flexShrink: 0,
                }}>{item.glyph}</span>
                {item.label}
              </a>
            ))}

            {/* Discuss CTA */}
            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${C.border}` }}>
              <p style={{
                fontFamily: "var(--font-geist-mono)",
                color: "rgba(201,168,76,0.4)", fontSize: "10px",
                letterSpacing: "0.12em", marginBottom: "10px",
              }}>
                ◈ DISCUSS THIS EIP
              </p>
              <a
                href="https://ethereum-magicians.org"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", textAlign: "center",
                  background: "rgba(201,168,76,0.06)",
                  border: `1px solid rgba(201,168,76,0.2)`,
                  color: C.gold, textDecoration: "none",
                  fontSize: "12px", fontWeight: 700,
                  padding: "10px", borderRadius: "6px",
                  fontFamily: "var(--font-cinzel, serif)",
                  letterSpacing: "0.08em",
                }}
              >
                ETHEREUM MAGICIANS →
              </a>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}
