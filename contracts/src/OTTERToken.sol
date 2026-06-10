// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

import "./IERC_OTTER.sol";

/// @title OTTERToken — ERC-OTTER Reference Implementation
/// @notice Progressive community meme token with on-chain tiers, tax distribution,
///         meme voting, referral tracking, and DAO governance weight.
/// @dev    Standalone implementation (no OpenZeppelin dependency) for portability.
///         Production use requires a full security audit.
contract OTTERToken is IERC_OTTER {

    // ─── ERC-20 STORAGE ───────────────────────────────────────────────────
    string  public name     = "OTTER Protocol";
    string  public symbol   = "OTTER";
    uint8   public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256)                     private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ─── CONSTANTS ────────────────────────────────────────────────────────
    uint256 public constant MAX_SUPPLY      = 100_000_000_000 * 1e18; // 100B
    uint256 public constant EPOCH_DURATION  = 7 days;
    uint256 public constant MEMBER_SECONDS  = 30 days;
    uint256 public constant OG_SECONDS      = 90 days;
    uint16  public constant TAX_RATE_BPS    = 500;  // 5%
    uint256 public constant TOP_MEMES_PAID  = 3;    // top 3 memes per epoch

    // ─── TAX SHARES (must sum to 10000) ──────────────────────────────────
    uint16 private constant _TREASURY_SHARE  = 4000;
    uint16 private constant _REWARDS_SHARE   = 3000;
    uint16 private constant _LIQUIDITY_SHARE = 2000;
    uint16 private constant _BURN_SHARE      = 1000;

    // ─── IMMUTABLE ADDRESSES ──────────────────────────────────────────────
    address public immutable treasury;
    address public immutable liquidityLock; // locked LP address — no withdrawal

    // ─── HOLDER STATE ─────────────────────────────────────────────────────
    mapping(address => uint256) private _holdSince;   // timestamp of first/last buy
    mapping(address => uint256) private _pendingRewards;
    mapping(address => uint256) private _rewardsPerTokenPaid;

    uint256 private _rewardsPerTokenStored;
    uint256 private _rewardsPool;         // tokens in rewards pool
    uint256 private _lastRewardsUpdate;

    // ─── MEME STORAGE ─────────────────────────────────────────────────────
    uint256 private _memeCounter;
    mapping(uint256 => Meme)                     private _memes;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    uint256[] private _currentEpochMemeIds;

    // ─── EPOCH ────────────────────────────────────────────────────────────
    uint256 private _currentEpoch;
    uint256 private _epochStart;

    // ─── REFERRAL ─────────────────────────────────────────────────────────
    mapping(address => uint256) private _referralCount;
    mapping(address => bool)    private _hasReferral;

    // ─── EVENTS (ERC-20) ──────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ─── CONSTRUCTOR ──────────────────────────────────────────────────────
    constructor(address _treasury, address _liquidityLock) {
        if (_treasury     == address(0)) revert ZeroAddress();
        if (_liquidityLock == address(0)) revert ZeroAddress();

        treasury     = _treasury;
        liquidityLock = _liquidityLock;
        _epochStart  = block.timestamp;

        // Mint initial supply to deployer — deployer should immediately
        // distribute via liquidity + community airdrop scripts
        _mint(msg.sender, MAX_SUPPLY);
    }

    // ─── ERC-20 CORE ──────────────────────────────────────────────────────
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "OTTER: insufficient allowance");
            _allowances[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    // ─── TRANSFER WITH TAX ────────────────────────────────────────────────
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0) && to != address(0), "OTTER: zero address");
        require(_balances[from] >= amount, "OTTER: insufficient balance");

        _updateRewards(from);
        _updateRewards(to);

        bool isTaxable = from != address(this)
            && to != address(this)
            && from != liquidityLock
            && to != liquidityLock;

        if (isTaxable) {
            uint256 tax = (amount * TAX_RATE_BPS) / 10_000;
            uint256 net = amount - tax;

            // Debit the sender ONCE for the full amount, then credit the
            // recipient the net and distribute the tax. (Previously the sender
            // was debited both here AND inside _distributeTax — a double-debit.)
            _balances[from] -= amount;
            _balances[to]   += net;

            _distributeTax(from, tax);

            // Reset hold timer on sell
            if (to == liquidityLock || _isPool(to)) {
                _holdSince[from] = 0;
            }
            // Start hold timer on buy
            if (_holdSince[to] == 0 && to != liquidityLock) {
                _holdSince[to] = block.timestamp;
                _emitTierIfChanged(to);
            }

            emit Transfer(from, to, net);
        } else {
            _balances[from] -= amount;
            _balances[to]   += amount;
            emit Transfer(from, to, amount);
        }
    }

    /// @dev The caller (_transfer) has ALREADY debited `from` by the full
    ///      amount, so this function only credits the tax destinations — it must
    ///      not touch `from`'s balance again.
    function _distributeTax(address from, uint256 tax) internal {
        uint256 toTreasury  = (tax * _TREASURY_SHARE)  / 10_000;
        uint256 toRewards   = (tax * _REWARDS_SHARE)   / 10_000;
        uint256 toLiquidity = (tax * _LIQUIDITY_SHARE) / 10_000;
        uint256 toBurn      = tax - toTreasury - toRewards - toLiquidity;

        _balances[treasury]      += toTreasury;
        _balances[liquidityLock] += toLiquidity;
        // Rewards tokens are actually held by the contract so claimRewards()
        // can pay them out (previously they were only counted, never backed).
        _balances[address(this)] += toRewards;
        _rewardsPool             += toRewards;

        // Burn: reduce total supply only. Do NOT credit address(0) — doing both
        // broke the invariant (sum of balances must equal totalSupply).
        totalSupply -= toBurn;

        // Update rewards rate
        if (totalSupply > 0) {
            _rewardsPerTokenStored += (toRewards * 1e18) / totalSupply;
        }

        emit TaxDistributed(toTreasury, toRewards, toLiquidity, toBurn);
        emit Transfer(from, treasury,        toTreasury);
        emit Transfer(from, liquidityLock,   toLiquidity);
        emit Transfer(from, address(this),   toRewards);
        emit Transfer(from, address(0),      toBurn);
    }

    // ─── REWARD ACCOUNTING ────────────────────────────────────────────────
    function _updateRewards(address account) internal {
        if (account == address(0)) return;
        _pendingRewards[account] = pendingRewards(account);
        _rewardsPerTokenPaid[account] = _rewardsPerTokenStored;
    }

    function pendingRewards(address account) public view returns (uint256) {
        uint256 multiplier = rewardMultiplier(account);
        uint256 earned = (_balances[account]
            * ((_rewardsPerTokenStored - _rewardsPerTokenPaid[account]) * multiplier / 10_000))
            / 1e18;
        return _pendingRewards[account] + earned;
    }

    function claimRewards() external returns (uint256 claimed) {
        _updateRewards(msg.sender);
        claimed = _pendingRewards[msg.sender];
        if (claimed == 0) revert NothingToClaim();

        // Never pay out more than the contract actually holds. This caps payouts
        // to backed tokens and prevents underflow from any rounding drift between
        // the staking accrual and the epoch-distribution accounting.
        uint256 available = _balances[address(this)];
        if (claimed > available) claimed = available;
        if (claimed == 0) revert NothingToClaim();

        _pendingRewards[msg.sender] -= claimed;
        _rewardsPool              = _rewardsPool > claimed ? _rewardsPool - claimed : 0;
        _balances[msg.sender]     += claimed;
        _balances[address(this)]  -= claimed;

        emit RewardsClaimed(msg.sender, claimed);
    }

    // ─── TIER SYSTEM ──────────────────────────────────────────────────────
    function holdDuration(address account) public view returns (uint256) {
        if (_holdSince[account] == 0) return 0;
        return block.timestamp - _holdSince[account];
    }

    function holderTier(address account) public view returns (Tier) {
        uint256 duration = holdDuration(account);
        if (duration >= OG_SECONDS)     return Tier.OG;
        if (duration >= MEMBER_SECONDS) return Tier.MEMBER;
        return Tier.NEWCOMER;
    }

    function rewardMultiplier(address account) public view returns (uint256) {
        Tier t = holderTier(account);
        if (t == Tier.OG)     return 20_000; // 2x
        if (t == Tier.MEMBER) return 15_000; // 1.5x
        return 10_000;                        // 1x
    }

    function governanceWeight(address account) public view returns (uint256) {
        return (_balances[account] * rewardMultiplier(account)) / 10_000;
    }

    function _emitTierIfChanged(address account) internal {
        // Simplified: emit on first acquisition
        emit TierUpgraded(account, Tier.NEWCOMER, Tier.NEWCOMER);
    }

    // ─── MEME SUBMISSION & VOTING ─────────────────────────────────────────
    function submitMeme(bytes32 contentHash) external returns (uint256 memeId) {
        if (contentHash == bytes32(0)) revert InvalidContentHash();
        Tier tier = holderTier(msg.sender);
        if (tier == Tier.NEWCOMER) revert InsufficientTier(Tier.MEMBER, tier);

        memeId = ++_memeCounter;
        _memes[memeId] = Meme({
            creator:     msg.sender,
            contentHash: contentHash,
            submittedAt: block.timestamp,
            score:       0,
            epoch:       _currentEpoch
        });
        _currentEpochMemeIds.push(memeId);

        emit MemeSubmitted(msg.sender, contentHash, memeId, _currentEpoch);
    }

    function voteOnMeme(uint256 memeId, bool upvote) external {
        if (_hasVoted[memeId][msg.sender]) revert AlreadyVoted(memeId);
        _hasVoted[memeId][msg.sender] = true;

        int256 weight = int256(governanceWeight(msg.sender));
        _memes[memeId].score += upvote ? weight : -weight;

        emit MemeVoted(memeId, msg.sender, upvote, _memes[memeId].score);
    }

    // ─── EPOCH ────────────────────────────────────────────────────────────
    function currentEpoch() external view returns (uint256) { return _currentEpoch; }

    function advanceEpoch() external {
        if (block.timestamp < _epochStart + EPOCH_DURATION) revert EpochNotComplete();

        // Find top memes by score and distribute rewards
        _distributeEpochRewards();

        _currentEpoch++;
        _epochStart = block.timestamp;
        delete _currentEpochMemeIds;

        emit EpochAdvanced(_currentEpoch, block.timestamp);
    }

    function _distributeEpochRewards() internal {
        uint256 len = _currentEpochMemeIds.length;
        if (len == 0 || _rewardsPool == 0) return;

        // Simple sort to find top 3 (gas-inefficient for large arrays — use off-chain indexing in prod)
        uint256 count = len < TOP_MEMES_PAID ? len : TOP_MEMES_PAID;
        uint256[] memory ids = _currentEpochMemeIds;

        // Bubble sort top `count` by score
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (_memes[ids[j]].score > _memes[ids[i]].score) {
                    (ids[i], ids[j]) = (ids[j], ids[i]);
                }
            }
        }

        uint256 epochPool = _rewardsPool / 4; // Use 25% of pool per epoch
        uint256 share     = epochPool / count;

        for (uint256 i = 0; i < count; i++) {
            address creator = _memes[ids[i]].creator;
            if (creator == address(0)) continue;
            _pendingRewards[creator] += share;
            _rewardsPool -= share;
        }
    }

    // ─── REFERRAL ─────────────────────────────────────────────────────────
    function recordReferral(address referrer) external {
        if (_hasReferral[msg.sender]) return;
        if (referrer == address(0) || referrer == msg.sender) return;
        _hasReferral[msg.sender] = true;
        _referralCount[referrer]++;
        emit ReferralRecorded(referrer, msg.sender);
    }

    function referralCount(address account) external view returns (uint256) {
        return _referralCount[account];
    }

    // ─── TAX CONFIG VIEW ──────────────────────────────────────────────────
    function taxConfig() external pure returns (TaxConfig memory) {
        return TaxConfig({
            taxRate:        TAX_RATE_BPS,
            treasuryShare:  _TREASURY_SHARE,
            rewardsShare:   _REWARDS_SHARE,
            liquidityShare: _LIQUIDITY_SHARE,
            burnShare:      _BURN_SHARE
        });
    }

    // ─── INTERNAL UTILS ───────────────────────────────────────────────────
    function _mint(address to, uint256 amount) internal {
        totalSupply     += amount;
        _balances[to]   += amount;
        emit Transfer(address(0), to, amount);
    }

    function _isPool(address addr) internal view returns (bool) {
        // In production: check against a registry of known DEX pool addresses
        return addr == liquidityLock;
    }
}
