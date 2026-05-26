// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/// @title OTTERInitiation — On-Chain Task & Signal Weight Registry
/// @notice Tracks community task completions and SIGNAL WEIGHT on Sepolia testnet.
///         Every task claim is an on-chain transaction. Immutable completion records.
/// @dev Guardian can add/edit tasks and approve manual submissions.
///      Signal weight never decreases. Tiers auto-compute from accumulated weight.

contract OTTERInitiation {

    // ─── CONSTANTS ─────────────────────────────────────────────────────────────

    address public guardian;

    uint256 constant TIER_HOLDER    =   500;   // SEEKER  → HOLDER
    uint256 constant TIER_MEMBER    =  2500;   // HOLDER  → MEMBER
    uint256 constant TIER_ARCHIVIST =  7500;   // MEMBER  → ARCHIVIST
    uint256 constant TIER_OG        = 15000;   // ARCHIVIST → OG

    uint256 constant NODE_PRESENCE_COOLDOWN = 86400; // 24 hours between check-ins

    // ─── ENUMS ─────────────────────────────────────────────────────────────────

    enum Tier { SEEKER, HOLDER, MEMBER, ARCHIVIST, OG }

    enum TaskCategory {
        SIGNAL_ACQUISITION,  // 0 — join socials, connect wallet
        KNOWLEDGE_ARCHIVE,   // 1 — read docs, pass quiz
        CONTRIBUTION,        // 2 — create content, memes
        CIPHER_HUNT,         // 3 — puzzle fragments
        SIGNAL_RELAY,        // 4 — referral system
        GOVERNANCE,          // 5 — proposals, voting
        NODE_PRESENCE        // 6 — daily check-in
    }

    // ─── STRUCTS ───────────────────────────────────────────────────────────────

    struct Task {
        bytes32     id;
        string      title;
        uint256     signalReward;
        TaskCategory category;
        bool        active;
        bool        requiresApproval; // guardian must approve (memes, articles, etc.)
        bool        repeatable;       // false = one-time claim
        uint256     createdAt;
    }

    struct HolderRecord {
        uint256 signalWeight;
        uint256 lastNodePresence;
        uint256 nodeStreak;
        uint256 tasksCompleted;
        uint256 joinedAt;
    }

    // ─── STORAGE ───────────────────────────────────────────────────────────────

    mapping(bytes32 => Task)                          public tasks;
    mapping(address => HolderRecord)                  public holders;
    mapping(address => mapping(bytes32 => bool))      public taskCompleted;
    mapping(address => mapping(bytes32 => uint256))   public taskCompletedAt;

    bytes32[] public taskIds;
    address[] public holderList;
    mapping(address => bool) private _isHolder;

    // ─── EVENTS ────────────────────────────────────────────────────────────────

    event TaskClaimed(
        address indexed holder,
        bytes32 indexed taskId,
        uint256 signalAwarded,
        uint256 newTotal,
        Tier    newTier
    );

    event NodePresenceRecorded(
        address indexed holder,
        uint256 streak,
        uint256 signalAwarded,
        uint256 timestamp
    );

    event TierAscended(
        address indexed holder,
        Tier    oldTier,
        Tier    newTier,
        uint256 signalWeight
    );

    event TaskApproved(
        address indexed holder,
        bytes32 indexed taskId,
        address approvedBy
    );

    event TaskAdded(bytes32 indexed id, string title, uint256 reward, TaskCategory category);
    event TaskUpdated(bytes32 indexed id, string title, uint256 reward, bool active);
    event GuardianTransferred(address indexed oldGuardian, address indexed newGuardian);

    // ─── ERRORS ────────────────────────────────────────────────────────────────

    error GuardianOnly();
    error TaskNotFound();
    error TaskNotActive();
    error AlreadyCompleted();
    error NodePresenceTooEarly(uint256 unlocksAt);
    error TaskRequiresApproval();
    error ZeroAddress();

    // ─── CONSTRUCTOR ───────────────────────────────────────────────────────────

    constructor(address _guardian) {
        require(_guardian != address(0));
        guardian = _guardian;
        _seedTasks();
    }

    // ─── MODIFIERS ─────────────────────────────────────────────────────────────

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert GuardianOnly();
        _;
    }

    modifier taskExists(bytes32 id) {
        if (tasks[id].createdAt == 0) revert TaskNotFound();
        _;
    }

    // ─── COMMUNITY ACTIONS ─────────────────────────────────────────────────────

    /// @notice Claim a completed task. Emits on-chain event. Updates signal weight.
    /// @dev    For tasks requiring guardian approval, use approveTask() instead.
    function claimTask(bytes32 taskId) external taskExists(taskId) {
        Task storage t = tasks[taskId];
        if (!t.active)                                    revert TaskNotActive();
        if (t.requiresApproval)                           revert TaskRequiresApproval();
        if (!t.repeatable && taskCompleted[msg.sender][taskId]) revert AlreadyCompleted();

        _registerHolder(msg.sender);
        _awardSignal(msg.sender, taskId, t.signalReward);
    }

    /// @notice Daily node presence check-in. 24h cooldown enforced on-chain.
    /// @dev    Streak resets if >48h gap. Rewards scale with streak.
    function recordNodePresence() external {
        HolderRecord storage h = holders[msg.sender];
        uint256 cooldownEnd = h.lastNodePresence + NODE_PRESENCE_COOLDOWN;

        if (block.timestamp < cooldownEnd)
            revert NodePresenceTooEarly(cooldownEnd);

        _registerHolder(msg.sender);

        // Streak logic: reset if gap > 48h
        bool streakContinues = (block.timestamp < h.lastNodePresence + (NODE_PRESENCE_COOLDOWN * 2));
        if (streakContinues && h.nodeStreak > 0) {
            h.nodeStreak++;
        } else {
            h.nodeStreak = 1;
        }

        h.lastNodePresence = block.timestamp;

        // Scaled signal reward based on streak
        uint256 reward = _nodePresenceReward(h.nodeStreak);
        uint256 oldW   = h.signalWeight;
        Tier oldTier   = _computeTier(oldW);

        h.signalWeight += reward;
        Tier newTier    = _computeTier(h.signalWeight);

        emit NodePresenceRecorded(msg.sender, h.nodeStreak, reward, block.timestamp);

        if (newTier > oldTier) {
            emit TierAscended(msg.sender, oldTier, newTier, h.signalWeight);
        }
    }

    // ─── GUARDIAN ACTIONS ──────────────────────────────────────────────────────

    /// @notice Approve a manual task submission for a holder.
    function approveTask(address holder, bytes32 taskId)
        external onlyGuardian taskExists(taskId)
    {
        if (!tasks[taskId].active)                               revert TaskNotActive();
        if (taskCompleted[holder][taskId] && !tasks[taskId].repeatable) revert AlreadyCompleted();

        _registerHolder(holder);
        _awardSignal(holder, taskId, tasks[taskId].signalReward);

        emit TaskApproved(holder, taskId, msg.sender);
    }

    /// @notice Add a new task to the protocol.
    function addTask(
        bytes32      id,
        string calldata title,
        uint256      signalReward,
        TaskCategory category,
        bool         requiresApproval,
        bool         repeatable
    ) external onlyGuardian {
        require(tasks[id].createdAt == 0, "Task ID exists");
        tasks[id] = Task({
            id:               id,
            title:            title,
            signalReward:     signalReward,
            category:         category,
            active:           true,
            requiresApproval: requiresApproval,
            repeatable:       repeatable,
            createdAt:        block.timestamp
        });
        taskIds.push(id);
        emit TaskAdded(id, title, signalReward, category);
    }

    /// @notice Update an existing task's title, reward, or active state.
    function updateTask(
        bytes32      id,
        string calldata title,
        uint256      signalReward,
        bool         active
    ) external onlyGuardian taskExists(id) {
        tasks[id].title        = title;
        tasks[id].signalReward = signalReward;
        tasks[id].active       = active;
        emit TaskUpdated(id, title, signalReward, active);
    }

    /// @notice Toggle a task on or off without changing other params.
    function setTaskActive(bytes32 id, bool active)
        external onlyGuardian taskExists(id)
    {
        tasks[id].active = active;
    }

    /// @notice Transfer guardian role. Requires community vote off-chain.
    function transferGuardian(address newGuardian) external onlyGuardian {
        if (newGuardian == address(0)) revert ZeroAddress();
        emit GuardianTransferred(guardian, newGuardian);
        guardian = newGuardian;
    }

    // ─── VIEWS ─────────────────────────────────────────────────────────────────

    function getSignalWeight(address holder) external view returns (uint256) {
        return holders[holder].signalWeight;
    }

    function getTier(address holder) external view returns (Tier) {
        return _computeTier(holders[holder].signalWeight);
    }

    function getTierLabel(address holder) external view returns (string memory) {
        Tier t = _computeTier(holders[holder].signalWeight);
        if (t == Tier.OG)        return "OG";
        if (t == Tier.ARCHIVIST) return "ARCHIVIST";
        if (t == Tier.MEMBER)    return "MEMBER";
        if (t == Tier.HOLDER)    return "HOLDER";
        return "SEEKER";
    }

    function isTaskCompleted(address holder, bytes32 taskId) external view returns (bool) {
        return taskCompleted[holder][taskId];
    }

    function getNodeStreak(address holder) external view returns (uint256) {
        return holders[holder].nodeStreak;
    }

    function getNodePresenceCooldownRemaining(address holder) external view returns (uint256) {
        uint256 unlocks = holders[holder].lastNodePresence + NODE_PRESENCE_COOLDOWN;
        if (block.timestamp >= unlocks) return 0;
        return unlocks - block.timestamp;
    }

    function getAllTaskIds() external view returns (bytes32[] memory) {
        return taskIds;
    }

    function getHolderCount() external view returns (uint256) {
        return holderList.length;
    }

    // ─── INTERNAL ──────────────────────────────────────────────────────────────

    function _computeTier(uint256 weight) internal pure returns (Tier) {
        if (weight >= TIER_OG)        return Tier.OG;
        if (weight >= TIER_ARCHIVIST) return Tier.ARCHIVIST;
        if (weight >= TIER_MEMBER)    return Tier.MEMBER;
        if (weight >= TIER_HOLDER)    return Tier.HOLDER;
        return Tier.SEEKER;
    }

    function _nodePresenceReward(uint256 streak) internal pure returns (uint256) {
        if (streak >= 90) return 500;
        if (streak >= 30) return 100;
        if (streak >= 7)  return 50;
        return 20;
    }

    function _registerHolder(address holder) internal {
        if (!_isHolder[holder]) {
            _isHolder[holder]          = true;
            holders[holder].joinedAt   = block.timestamp;
            holderList.push(holder);
        }
    }

    function _awardSignal(address holder, bytes32 taskId, uint256 reward) internal {
        Tier oldTier = _computeTier(holders[holder].signalWeight);

        holders[holder].signalWeight += reward;
        holders[holder].tasksCompleted++;
        taskCompleted[holder][taskId]    = true;
        taskCompletedAt[holder][taskId]  = block.timestamp;

        Tier newTier = _computeTier(holders[holder].signalWeight);

        emit TaskClaimed(holder, taskId, reward, holders[holder].signalWeight, newTier);

        if (newTier > oldTier) {
            emit TierAscended(holder, oldTier, newTier, holders[holder].signalWeight);
        }
    }

    /// @dev Seed the initial task set on deployment
    function _seedTasks() internal {
        // ── SIGNAL ACQUISITION ──────────────────────────────────────────────
        _addSeedTask(keccak256("join_discord"),    "Join the Discord Den",       100, TaskCategory.SIGNAL_ACQUISITION, false, false);
        _addSeedTask(keccak256("join_telegram"),   "Join Telegram Channel",      100, TaskCategory.SIGNAL_ACQUISITION, false, false);
        _addSeedTask(keccak256("follow_x"),        "Follow on X",                150, TaskCategory.SIGNAL_ACQUISITION, false, false);
        _addSeedTask(keccak256("follow_farcaster"),"Follow on Farcaster",        150, TaskCategory.SIGNAL_ACQUISITION, false, false);
        _addSeedTask(keccak256("connect_wallet"),  "Link Wallet to Protocol",    200, TaskCategory.SIGNAL_ACQUISITION, false, false);
        _addSeedTask(keccak256("verify_identity"), "Verify Identity",            100, TaskCategory.SIGNAL_ACQUISITION, false, false);

        // ── KNOWLEDGE ARCHIVE ───────────────────────────────────────────────
        _addSeedTask(keccak256("read_medium"),     "Read Medium Introduction",   300, TaskCategory.KNOWLEDGE_ARCHIVE,  false, false);
        _addSeedTask(keccak256("read_abstract"),   "Study the ERC-OTTER Abstract",400, TaskCategory.KNOWLEDGE_ARCHIVE, false, false);
        _addSeedTask(keccak256("read_eip"),        "Read Full EIP Draft",       1000, TaskCategory.KNOWLEDGE_ARCHIVE,  false, false);
        _addSeedTask(keccak256("read_governance"), "Read Governance Model",      500, TaskCategory.KNOWLEDGE_ARCHIVE,  false, false);
        _addSeedTask(keccak256("read_guardian"),   "Study Guardian Constraints", 600, TaskCategory.KNOWLEDGE_ARCHIVE,  false, false);
        _addSeedTask(keccak256("pass_quiz"),       "Pass EIP Protocol Quiz",    1500, TaskCategory.KNOWLEDGE_ARCHIVE,  true,  false);

        // ── CONTRIBUTION ────────────────────────────────────────────────────
        _addSeedTask(keccak256("like_post"),       "Like Protocol Post",          50, TaskCategory.CONTRIBUTION, false, true);
        _addSeedTask(keccak256("retweet_post"),    "Retweet Protocol Post",      120, TaskCategory.CONTRIBUTION, false, true);
        _addSeedTask(keccak256("reply_post"),      "Thoughtful Reply",           200, TaskCategory.CONTRIBUTION, true,  true);
        _addSeedTask(keccak256("tweet_otter"),     "Tweet About OTTER",          500, TaskCategory.CONTRIBUTION, true,  false);
        _addSeedTask(keccak256("create_thread"),   "Create X Thread",           1000, TaskCategory.CONTRIBUTION, true,  false);
        _addSeedTask(keccak256("create_meme"),     "Submit Meme to Archive",    1500, TaskCategory.CONTRIBUTION, true,  false);
        _addSeedTask(keccak256("edu_video"),       "Create Educational Video",  3000, TaskCategory.CONTRIBUTION, true,  false);
        _addSeedTask(keccak256("write_article"),   "Write Medium Article",      5000, TaskCategory.CONTRIBUTION, true,  false);

        // ── CIPHER HUNT ─────────────────────────────────────────────────────
        _addSeedTask(keccak256("cipher_i"),        "Find Fragment I",             500, TaskCategory.CIPHER_HUNT, false, false);
        _addSeedTask(keccak256("cipher_ii"),       "Find Fragment II",            750, TaskCategory.CIPHER_HUNT, false, false);
        _addSeedTask(keccak256("cipher_iii"),      "Find Fragment III",          1000, TaskCategory.CIPHER_HUNT, false, false);
        _addSeedTask(keccak256("gate_unlock"),     "Unlock the Cipher Gate",    2500, TaskCategory.CIPHER_HUNT, false, false);
        _addSeedTask(keccak256("hidden_puzzle"),   "Solve Hidden Protocol Puzzle",5000, TaskCategory.CIPHER_HUNT, true, false);

        // ── SIGNAL RELAY ────────────────────────────────────────────────────
        _addSeedTask(keccak256("relay_discord"),   "Relay: Discord Join",        200, TaskCategory.SIGNAL_RELAY, false, true);
        _addSeedTask(keccak256("relay_telegram"),  "Relay: Telegram Join",       200, TaskCategory.SIGNAL_RELAY, false, true);
        _addSeedTask(keccak256("relay_x"),         "Relay: X Follow",            250, TaskCategory.SIGNAL_RELAY, false, true);
        _addSeedTask(keccak256("relay_onboarding"),"Relay: Full Onboarding",     500, TaskCategory.SIGNAL_RELAY, false, true);
        _addSeedTask(keccak256("relay_member"),    "Relay: Invite Reaches MEMBER",1500, TaskCategory.SIGNAL_RELAY, true, true);
        _addSeedTask(keccak256("relay_content"),   "Relay: Invite Creates Content",3000, TaskCategory.SIGNAL_RELAY, true, true);

        // ── GOVERNANCE ──────────────────────────────────────────────────────
        _addSeedTask(keccak256("read_proposal"),   "Read Governance Proposal",   200, TaskCategory.GOVERNANCE, false, true);
        _addSeedTask(keccak256("cast_vote"),       "Participate in Vote",        500, TaskCategory.GOVERNANCE, false, true);
        _addSeedTask(keccak256("discuss_proposal"),"Discuss Proposal",           300, TaskCategory.GOVERNANCE, true,  true);
        _addSeedTask(keccak256("submit_feedback"), "Submit Governance Feedback", 400, TaskCategory.GOVERNANCE, true,  false);
    }

    function _addSeedTask(
        bytes32 id, string memory title, uint256 reward,
        TaskCategory cat, bool requiresApproval, bool repeatable
    ) internal {
        tasks[id] = Task({
            id: id, title: title, signalReward: reward, category: cat,
            active: true, requiresApproval: requiresApproval,
            repeatable: repeatable, createdAt: block.timestamp
        });
        taskIds.push(id);
    }
}
