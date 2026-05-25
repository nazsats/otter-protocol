// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/// @title IERC-OTTER: Progressive Community Token Standard
/// @notice Interface for community-owned meme tokens on Ethereum
/// @dev Extends ERC-20 with holder tiers, transfer tax distribution,
///      on-chain meme submission/voting, and governance weight.
///      All compliant contracts MUST enforce mechanics without owner override.
interface IERC_OTTER {

    // ─── ENUMS ────────────────────────────────────────────────────────────
    enum Tier { NEWCOMER, MEMBER, OG }

    // ─── STRUCTS ──────────────────────────────────────────────────────────
    struct Meme {
        address  creator;
        bytes32  contentHash; // keccak256 of content URI
        uint256  submittedAt;
        int256   score;       // net upvotes
        uint256  epoch;
    }

    struct TaxConfig {
        uint16 taxRate;        // basis points  (500 = 5%)
        uint16 treasuryShare;  // of tax (4000 = 40%)
        uint16 rewardsShare;   // of tax (3000 = 30%)
        uint16 liquidityShare; // of tax (2000 = 20%)
        uint16 burnShare;      // of tax (1000 = 10%)
    }

    // ─── EVENTS ───────────────────────────────────────────────────────────
    event MemeSubmitted(address indexed creator, bytes32 indexed contentHash, uint256 memeId, uint256 epoch);
    event MemeVoted(uint256 indexed memeId, address indexed voter, bool upvote, int256 newScore);
    event RewardsClaimed(address indexed holder, uint256 amount);
    event TierUpgraded(address indexed holder, Tier previousTier, Tier newTier);
    event TaxDistributed(uint256 toTreasury, uint256 toRewards, uint256 toLiquidity, uint256 burned);
    event EpochAdvanced(uint256 newEpoch, uint256 timestamp);
    event ReferralRecorded(address indexed referrer, address indexed referee);

    // ─── ERRORS ───────────────────────────────────────────────────────────
    error AlreadyVoted(uint256 memeId);
    error NothingToClaim();
    error InsufficientTier(Tier required, Tier actual);
    error InvalidContentHash();
    error EpochNotComplete();
    error ZeroAddress();

    // ─── TAX CONFIG (IMMUTABLE) ───────────────────────────────────────────
    /// @notice Returns the tax configuration. All shares MUST sum to 10000 bps.
    function taxConfig() external view returns (TaxConfig memory);

    // ─── HOLDER MECHANICS ─────────────────────────────────────────────────
    /// @notice Current tier of an address based on uninterrupted hold duration
    function holderTier(address account) external view returns (Tier);

    /// @notice Seconds since the account first acquired tokens (resets on sell)
    function holdDuration(address account) external view returns (uint256);

    /// @notice Pending reward tokens claimable by the account
    function pendingRewards(address account) external view returns (uint256);

    /// @notice Reward multiplier in basis points (10000 = 1x, 20000 = 2x)
    function rewardMultiplier(address account) external view returns (uint256 bps);

    // ─── COMMUNITY ACTIONS ────────────────────────────────────────────────
    /// @notice Submit a meme for community voting. Caller MUST be MEMBER or OG tier.
    /// @param  contentHash keccak256 hash of the IPFS content URI
    /// @return memeId      Unique identifier for this meme
    function submitMeme(bytes32 contentHash) external returns (uint256 memeId);

    /// @notice Cast a vote on a submitted meme. One vote per address per meme.
    function voteOnMeme(uint256 memeId, bool upvote) external;

    /// @notice Claim accumulated reward tokens. Returns amount claimed.
    function claimRewards() external returns (uint256 claimed);

    // ─── GOVERNANCE ───────────────────────────────────────────────────────
    /// @notice Governance voting weight = balance * tier multiplier
    function governanceWeight(address account) external view returns (uint256);

    /// @notice Address of the community treasury (DAO multisig or contract)
    function treasury() external view returns (address);

    // ─── EPOCH ────────────────────────────────────────────────────────────
    /// @notice Current voting epoch (advances every EPOCH_DURATION seconds)
    function currentEpoch() external view returns (uint256);

    /// @notice Duration of each meme voting epoch in seconds (RECOMMENDED: 7 days)
    function EPOCH_DURATION() external view returns (uint256);

    /// @notice Advance to next epoch and distribute rewards to top meme creators
    function advanceEpoch() external;

    // ─── REFERRAL ─────────────────────────────────────────────────────────
    /// @notice Register a referral on-chain (called at first token purchase)
    function recordReferral(address referrer) external;

    /// @notice Total referrals recorded for an address
    function referralCount(address account) external view returns (uint256);
}
