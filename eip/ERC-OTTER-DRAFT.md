# ERC-OTTER: Progressive Community Token Standard

| Field     | Value                          |
|-----------|-------------------------------|
| Author    | OTTER Core Team               |
| Status    | Draft                         |
| Type      | Standards Track               |
| Category  | ERC                           |
| Created   | 2025-05-18                    |
| Requires  | EIP-20, EIP-712               |
| Network   | Ethereum / Sepolia            |
| Chain ID  | 1 (mainnet)                   |

> ⚠ **DRAFT STATUS** — Community feedback welcome. Submit issues or PRs on GitHub.

---

## Abstract

ERC-OTTER defines a formal Solidity interface for community-owned tokens on Ethereum. It builds directly on **EIP-20 (ERC-20)** as the base layer, incorporating principles from **EIP-4626** (vault accounting for reward pools) and **EIP-712** (typed structured data for off-chain signatures), and introducing four novel protocol primitives not found in any existing standard:

| # | Primitive | Description |
|---|-----------|-------------|
| I | **Immutable Transfer Tax Distribution** | 5% auto-split on every transfer — permanent, no admin override possible |
| II | **Time-Based Holder Tier Progression** | Hold duration unlocks MEMBER and OG tiers with multiplied governance weight |
| III | **On-Chain Meme Economy** | Submit, vote, and earn from a community-run content layer with epoch settlement |
| IV | **Protocol Guardian Model** | Transparent founder controls with hard-coded constraints — not omnipotent Ownable |

Any token contract implementing this standard MUST enforce these mechanics without owner override capability. Community protections cannot be disabled after deployment. This is the foundational design invariant.

---

## Motivation

Meme tokens represent a genuinely new type of digital community — one where cultural contribution, loyalty, and shared identity carry real economic value. Yet the current ERC-20 standard provides no mechanisms to encode these community dynamics on-chain. The result is a structural misalignment between developer incentives and community interests.

### Three Unsolved Problems

**🔴 CRITICAL — Rug Pull Vulnerability**
ERC-20 imposes no restrictions on liquidity removal. Developers can drain the liquidity pool at any time. Community trust is built on social promises with zero cryptographic enforcement.

**🟡 STRUCTURAL — No Contribution Incentive**
Holders who create content, grow the community, or promote the project receive no on-chain compensation. Wealth accumulation is the only on-chain signal — rewarding speculation, not contribution.

**🟣 SYSTEMIC — Pure Speculation Trap**
Without standardized utility mechanics, meme tokens cannot evolve beyond zero-sum price speculation. There is no existing ERC framework for sustainable meme community economics.

ERC-OTTER addresses all three problems with a single coherent standard, making community protection a cryptographic guarantee rather than a social promise.

---

## Prior Art

| Standard | What It Defines | What ERC-OTTER Takes From It | What It Lacks |
|----------|----------------|------------------------------|---------------|
| EIP-20 (ERC-20) | Fungible token: transfer, approve, allowance | Base interface — all OTTER tokens ARE ERC-20 | No community mechanics, no tax, no governance |
| EIP-712 | Typed structured data hashing for signatures | Off-chain meme submission signatures (gas-efficient) | No token or community layer |
| EIP-1363 | Callback after transfer/transferFrom | Conceptual basis for auto-distribution on transfer | No standard distribution logic |
| EIP-4626 | Tokenized vault yield accounting | Reward pool share accounting model | Not designed for community governance |
| EIP-5725 | Vesting contract — time-based token release | Time-based hold duration → tier progression concept | No loyalty incentive, no meme layer |
| EIP-173 | Contract ownership — owner() transfer | Guardian role architecture (but with explicit constraints) | Omnipotent owner — no power constraints |

> **What makes ERC-OTTER unique:** No existing standard combines immutable tax distribution, time-based loyalty tiers, on-chain cultural rewards, and a constrained guardian model into a single coherent interface. ERC-OTTER is not a replacement for ERC-20 — it is a community protection layer built on top of it.

---

## Specification

The key words MUST, MUST NOT, REQUIRED, SHALL, SHOULD, and MAY in this document are interpreted as described in RFC 2119.

### Full Interface

```solidity
// SPDX-License-Identifier: CC0-1.0
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
    function holderTier(address account)       external view returns (Tier);
    function holdDuration(address account)     external view returns (uint256);
    function pendingRewards(address account)   external view returns (uint256);
    function rewardMultiplier(address account) external view returns (uint256 bps);
    function governanceWeight(address account) external view returns (uint256);
    function referralCount(address referrer)   external view returns (uint256);

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
}
```

### Holder Tiers

An ERC-OTTER contract MUST maintain three holder tiers based on uninterrupted hold duration. The timer MUST reset to zero whenever an address transfers any tokens out.

| Tier | Hold Duration | Reward Multiplier | Governance Weight | Meme Submission |
|------|--------------|-------------------|-------------------|-----------------|
| NEWCOMER | 0–30 days | 1.0× (10000 bps) | 1× balance | View only |
| MEMBER | 30–90 days | 1.5× (15000 bps) | 1.5× balance | Submit + Vote |
| OG | 90+ days | 2.0× (20000 bps) | 2× balance | Submit + Vote + Propose |

```solidity
// Tier thresholds
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
        _holdSince[from] = 0; // Seller loses all accumulated hold time
    }
    if (to != address(0) && _holdSince[to] == 0) {
        _holdSince[to] = block.timestamp;
    }
    _updateTierIfChanged(from);
    _updateTierIfChanged(to);
}
```

### Transfer Tax — Immutable Distribution

An ERC-OTTER contract MUST apply exactly `TAX_RATE` (500 bps = 5%) on all transfers, excluding mints, burns, and internal contract-to-contract transfers. All four distribution shares MUST be declared as `constant` — no setter function for these values is permissible.

| Destination | Constant | Share | Description |
|-------------|----------|-------|-------------|
| Community Treasury | `TREASURY_SHARE` | 40% | DAO-governed spending |
| Creator Rewards Pool | `REWARDS_SHARE` | 30% | Epoch-distributed to top meme creators |
| Liquidity Lock | `LIQUIDITY_SHARE` | 20% | Auto-compounded into locked liquidity |
| Token Burn | `BURN_SHARE` | 10% | Permanently burned — deflationary |

### On-Chain Meme Economy — Epoch System

An ERC-OTTER contract MUST provide on-chain meme submission and voting. Meme rewards are distributed in epochs (default 7 days). Only `MEMBER` and `OG` tier holders may submit memes.

```solidity
uint256 public epochDuration;
uint256 public currentEpoch;
uint256 public epochStartTime;

struct Meme {
    address  creator;
    bytes32  contentHash;
    uint256  epoch;
    int256   netVotes;
    uint256  rewardShare;
    bool     settled;
}

function settleEpoch() external {
    require(block.timestamp >= epochStartTime + epochDuration, "Epoch not over");
    uint256 poolBalance = rewardsPool.balance();
    uint256[] memory winners = _topMemes(currentEpoch, 10);
    uint256 totalWeight;
    for (uint i; i < winners.length; i++) {
        totalWeight += uint256(memes[winners[i]].netVotes);
    }
    for (uint i; i < winners.length; i++) {
        uint256 share = (poolBalance * uint256(memes[winners[i]].netVotes)) / totalWeight;
        memes[winners[i]].rewardShare = share;
        memes[winners[i]].settled = true;
    }
    emit EpochSettled(currentEpoch, poolBalance, winners.length);
    currentEpoch++;
    epochStartTime = block.timestamp;
}
```

---

## Community Governance

ERC-OTTER defines a dual-layer governance model: community-controlled treasury and direction, with a Protocol Guardian layer providing emergency protection.

### Community Powers

| Power | Description |
|-------|-------------|
| Treasury Spending | Propose and vote on how the 40% community treasury is used |
| Feature Proposals | OG holders can propose new protocol mechanics |
| Partner Integrations | Vote on which protocols ERC-OTTER integrates with |
| Epoch Parameters | Community may propose changes to epoch duration (3–30 days) |
| Guardian Transfer | Community vote (>50%) required to transfer the Guardian role |

### Protocol Guardian — Explicit Power Framework

```solidity
abstract contract OTTERGuardian {

    address public guardian;
    uint256 public upgradeTimelockExpiry;
    address public pendingImplementation;

    uint256 constant MAX_PAUSE_DURATION = 86400;   // 24 hours
    uint256 constant UPGRADE_TIMELOCK   = 259200;  // 72 hours
    uint256 constant MIN_EPOCH_DAYS     = 3;
    uint256 constant MAX_EPOCH_DAYS     = 30;

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Guardian only");
        _;
    }

    function emergencyPause(uint256 duration) external onlyGuardian {
        require(duration <= MAX_PAUSE_DURATION, "Exceeds max pause duration");
        _pause(duration);
    }

    function queueUpgrade(address implementation) external onlyGuardian {
        pendingImplementation = implementation;
        upgradeTimelockExpiry = block.timestamp + UPGRADE_TIMELOCK;
    }

    function executeUpgrade() external onlyGuardian {
        require(block.timestamp >= upgradeTimelockExpiry, "Timelock not expired");
        _upgradeTo(pendingImplementation);
    }

    function vetoProposal(uint256 proposalId, bytes32 reason) external onlyGuardian {
        _vetoProposal(proposalId, reason);
    }

    /// @dev NOTE: TAX_RATE and distribution shares are declared as
    ///      'constant' — no setter exists. Guardian CANNOT modify them.
}
```

**✅ Guardian CAN:**
- Emergency pause (max 24 hours)
- Queue contract upgrade (72h timelock)
- Veto harmful governance proposals
- Adjust epoch duration (3–30 day bounds)
- Add approved meme content categories

**❌ Guardian CANNOT:**
- Modify TAX_RATE (declared constant)
- Change any distribution share (constant)
- Access treasury without DAO vote
- Disable tier mechanics or meme voting
- Transfer Guardian role without community vote

> **Path to Full Decentralization:** Stage 1: core team Guardian. Stage 2: 2-of-3 multisig with community members. Stage 3: on-chain DAO with no individual Guardian.

---

## Token Economics

### Supply Parameters

| Parameter | Value |
|-----------|-------|
| Total Supply | 100,000,000,000 (100 Billion OTTER) |
| Transfer Tax | 5% (immutable constant) |
| Burn Rate | 10% of every tax |
| Creator Rewards | 30% of every tax |
| Treasury Share | 40% — DAO governed |
| Liquidity | 20% — auto-compounding |

### No Pre-mine. No Team Allocation.

ERC-OTTER's reference token has no team allocation, no VC round, and no pre-mine. 100% of supply enters circulation through the open market. Community treasury accumulates through the transfer tax — not through a founding team holding tokens.

---

## Reference Implementation

| File | Description |
|------|-------------|
| `OTTERToken.sol` | Core ERC-20 + tax distribution + tier tracking |
| `OTTERGuardian.sol` | Guardian role with explicit constraint enforcement |
| `OTTEREpoch.sol` | Meme submission, voting, and epoch settlement |
| `OTTERGovernance.sol` | Proposal creation, voting, and execution |
| `OTTERReferral.sol` | Referral recording with signature verification |
| `OTTERLiquidity.sol` | Audited liquidity lock with auto-compounding |
| `OTTERInitiation.sol` | Community onboarding + signal weight system (Sepolia) |

See [`/contracts/src/`](../contracts/src/) for all Solidity source files.

---

## Rationale

**Why enforce tax at the standard level?**
Community protection that can be disabled by the owner offers false security. By declaring the tax rate and all distribution shares as Solidity `constant` variables — not storage variables — ERC-OTTER ensures no setter function can exist. There is no `setTaxRate()`. There is no `setTreasuryShare()`.

**Why time-based tiers over balance-based?**
Balance-based tiers create plutocracy: large holders gain disproportionate power. Time-based tiers reward conviction and loyalty. A small holder who has held for 90 days has proven genuine community alignment — and deserves equivalent governance weight to a larger short-term holder.

**Why on-chain meme voting?**
Meme culture is the primary driver of meme token growth. Moving this on-chain creates a transparent, tamper-proof record of cultural contribution and enables automatic reward distribution without trusted intermediaries.

**Why 5% transfer tax?**
Historical analysis shows rates above 10% cause liquidity fragmentation; rates below 3% generate insufficient treasury funding. Implementations MAY lower to a minimum of `100 bps` (1%) but MUST NOT exceed `1000 bps` (10%).

---

## Backwards Compatibility

ERC-OTTER is fully backwards compatible with EIP-20. All standard functions — `transfer`, `transferFrom`, `approve`, `allowance`, `balanceOf`, `totalSupply` — behave exactly as specified in EIP-20. The `Transfer` event MUST emit the post-tax amount received by the recipient. A separate `TaxDistributed` event provides the full breakdown.

> DEX integrations MUST account for the 5% fee-on-transfer when calculating minimum output amounts. Use `supportingFeeOnTransfer` variants of Uniswap V2/V3 swap functions.

---

## Security Considerations

| Severity | Issue | Mitigation |
|----------|-------|------------|
| 🔴 HIGH | Re-entrancy in `claimRewards()` | Follow checks-effects-interactions. Zero pending rewards BEFORE transfer. Use OpenZeppelin ReentrancyGuard. |
| 🔴 HIGH | Liquidity lock integrity | MUST be independently audited. Use established audited lock protocols (Unicrypt, Team Finance). |
| 🟡 MEDIUM | Tier manipulation via flash loans | Hold duration uses `block.timestamp` from first acquisition. Flash loans do not accumulate hold time. |
| 🟡 MEDIUM | Meme voting Sybil attacks | Mitigated by MEMBER tier requirement (30+ day hold). Voting weight is proportional to governance weight. |
| 🟢 LOW | Guardian timelock bypass | 72h timelock enforced in contract code. Community SHOULD monitor `queueUpgrade()` events. |
| 🟢 LOW | Epoch settlement manipulation | Consider snapshot-based voting weight (balance at epoch start) to prevent last-block manipulation. |

---

## Copyright

Copyright and related rights waived via [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). The ERC-OTTER interface is free for any project to implement.

ERC-OTTER is open source and community-driven. If you are building a token using this standard, submit your project for inclusion in the official ERC-OTTER registry. Compliant implementations receive the **◈ OTTER CERTIFIED** badge.

---

*Discuss on [Ethereum Magicians](https://ethereum-magicians.org) · Test on [Sepolia DApp](https://otterfi.vercel.app/dapp)*
