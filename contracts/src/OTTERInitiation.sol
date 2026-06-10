// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.24;

/// @title OTTERInitiation — On-Chain Task & Signal Weight Registry
/// @notice Tracks task completions and SIGNAL WEIGHT on Sepolia testnet.
///         Task titles are stored off-chain (frontend constants) to stay under 24KB limit.
contract OTTERInitiation {

    // ─── CONSTANTS ─────────────────────────────────────────────────────────────

    address public guardian;

    uint256 constant TIER_HOLDER    =   500;
    uint256 constant TIER_MEMBER    =  2500;
    uint256 constant TIER_ARCHIVIST =  7500;
    uint256 constant TIER_OG        = 15000;

    uint256 constant NODE_PRESENCE_COOLDOWN = 86400; // 24h

    // ─── ENUMS ─────────────────────────────────────────────────────────────────

    enum Tier { SEEKER, HOLDER, MEMBER, ARCHIVIST, OG }

    // ─── STRUCTS ───────────────────────────────────────────────────────────────

    // title removed — stored in frontend constants, not on-chain (keeps under 24KB)
    struct Task {
        uint256  signalReward;
        bool     active;
        bool     requiresApproval;
        bool     repeatable;
    }

    struct HolderRecord {
        uint256 signalWeight;
        uint256 lastNodePresence;
        uint256 nodeStreak;
        uint256 tasksCompleted;
        uint256 joinedAt;
    }

    // ─── STORAGE ───────────────────────────────────────────────────────────────

    mapping(bytes32 => Task)                        public tasks;
    mapping(address => HolderRecord)                public holders;
    mapping(address => mapping(bytes32 => bool))    public taskCompleted;
    mapping(address => mapping(bytes32 => uint256)) public taskCompletedAt;

    bytes32[] public taskIds;

    // ─── EVENTS ────────────────────────────────────────────────────────────────

    event TaskClaimed(
        address indexed holder,
        bytes32 indexed taskId,
        uint256 signalAwarded,
        uint256 newTotal,
        Tier    newTier
    );
    event NodePresenceRecorded(address indexed holder, uint256 streak, uint256 signalAwarded, uint256 timestamp);
    event TierAscended(address indexed holder, Tier oldTier, Tier newTier, uint256 signalWeight);
    event TaskApproved(address indexed holder, bytes32 indexed taskId, address approvedBy);
    event TaskAdded(bytes32 indexed id, uint256 reward, bool requiresApproval, bool repeatable);
    event TaskUpdated(bytes32 indexed id, uint256 reward, bool active);
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
        if (tasks[id].signalReward == 0 && !tasks[id].active) revert TaskNotFound();
        _;
    }

    // ─── COMMUNITY ACTIONS ─────────────────────────────────────────────────────

    function claimTask(bytes32 taskId) external {
        Task storage t = tasks[taskId];
        if (t.signalReward == 0) revert TaskNotFound();
        if (!t.active)           revert TaskNotActive();
        if (t.requiresApproval)  revert TaskRequiresApproval();
        if (!t.repeatable && taskCompleted[msg.sender][taskId]) revert AlreadyCompleted();
        _registerHolder(msg.sender);
        _awardSignal(msg.sender, taskId, t.signalReward);
    }

    function recordNodePresence() external {
        HolderRecord storage h = holders[msg.sender];
        uint256 cooldownEnd = h.lastNodePresence + NODE_PRESENCE_COOLDOWN;
        if (block.timestamp < cooldownEnd) revert NodePresenceTooEarly(cooldownEnd);

        _registerHolder(msg.sender);
        bool cont = (block.timestamp < h.lastNodePresence + (NODE_PRESENCE_COOLDOWN * 2));
        h.nodeStreak = (cont && h.nodeStreak > 0) ? h.nodeStreak + 1 : 1;
        h.lastNodePresence = block.timestamp;

        uint256 reward = _nodePresenceReward(h.nodeStreak);
        Tier oldTier = _computeTier(h.signalWeight);
        h.signalWeight += reward;
        Tier newTier = _computeTier(h.signalWeight);

        emit NodePresenceRecorded(msg.sender, h.nodeStreak, reward, block.timestamp);
        if (newTier > oldTier) emit TierAscended(msg.sender, oldTier, newTier, h.signalWeight);
    }

    // ─── GUARDIAN ACTIONS ──────────────────────────────────────────────────────

    function approveTask(address holder, bytes32 taskId) external onlyGuardian {
        Task storage t = tasks[taskId];
        if (t.signalReward == 0)                                    revert TaskNotFound();
        if (!t.active)                                              revert TaskNotActive();
        if (taskCompleted[holder][taskId] && !t.repeatable)         revert AlreadyCompleted();
        _registerHolder(holder);
        _awardSignal(holder, taskId, t.signalReward);
        emit TaskApproved(holder, taskId, msg.sender);
    }

    function addTask(bytes32 id, uint256 signalReward, bool requiresApproval, bool repeatable)
        external onlyGuardian
    {
        require(tasks[id].signalReward == 0, "exists");
        tasks[id] = Task({ signalReward: signalReward, active: true, requiresApproval: requiresApproval, repeatable: repeatable });
        taskIds.push(id);
        emit TaskAdded(id, signalReward, requiresApproval, repeatable);
    }

    function updateTask(bytes32 id, uint256 signalReward, bool active) external onlyGuardian {
        if (tasks[id].signalReward == 0) revert TaskNotFound();
        tasks[id].signalReward = signalReward;
        tasks[id].active       = active;
        emit TaskUpdated(id, signalReward, active);
    }

    function setTaskActive(bytes32 id, bool active) external onlyGuardian {
        if (tasks[id].signalReward == 0) revert TaskNotFound();
        tasks[id].active = active;
    }

    function transferGuardian(address newGuardian) external onlyGuardian {
        if (newGuardian == address(0)) revert ZeroAddress();
        emit GuardianTransferred(guardian, newGuardian);
        guardian = newGuardian;
    }

    // ─── VIEWS ─────────────────────────────────────────────────────────────────

    function getSignalWeight(address holder) external view returns (uint256) { return holders[holder].signalWeight; }
    function getTier(address holder) external view returns (Tier) { return _computeTier(holders[holder].signalWeight); }
    function isTaskCompleted(address holder, bytes32 taskId) external view returns (bool) { return taskCompleted[holder][taskId]; }
    function getNodeStreak(address holder) external view returns (uint256) { return holders[holder].nodeStreak; }
    function getAllTaskIds() external view returns (bytes32[] memory) { return taskIds; }
    function getHolderCount() external view returns (uint256) { return taskIds.length; }

    function getNodePresenceCooldownRemaining(address holder) external view returns (uint256) {
        uint256 unlocks = holders[holder].lastNodePresence + NODE_PRESENCE_COOLDOWN;
        return block.timestamp >= unlocks ? 0 : unlocks - block.timestamp;
    }

    function getTierLabel(address holder) external view returns (string memory) {
        Tier t = _computeTier(holders[holder].signalWeight);
        if (t == Tier.OG)        return "OG";
        if (t == Tier.ARCHIVIST) return "ARCHIVIST";
        if (t == Tier.MEMBER)    return "MEMBER";
        if (t == Tier.HOLDER)    return "HOLDER";
        return "SEEKER";
    }

    // ─── INTERNAL ──────────────────────────────────────────────────────────────

    function _computeTier(uint256 w) internal pure returns (Tier) {
        if (w >= TIER_OG)        return Tier.OG;
        if (w >= TIER_ARCHIVIST) return Tier.ARCHIVIST;
        if (w >= TIER_MEMBER)    return Tier.MEMBER;
        if (w >= TIER_HOLDER)    return Tier.HOLDER;
        return Tier.SEEKER;
    }

    function _nodePresenceReward(uint256 streak) internal pure returns (uint256) {
        if (streak >= 90) return 500;
        if (streak >= 30) return 100;
        if (streak >= 7)  return 50;
        return 20;
    }

    function _registerHolder(address holder) internal {
        if (holders[holder].joinedAt == 0) {
            holders[holder].joinedAt = block.timestamp;
        }
    }

    function _awardSignal(address holder, bytes32 taskId, uint256 reward) internal {
        Tier oldTier = _computeTier(holders[holder].signalWeight);
        holders[holder].signalWeight += reward;
        holders[holder].tasksCompleted++;
        taskCompleted[holder][taskId]   = true;
        taskCompletedAt[holder][taskId] = block.timestamp;
        Tier newTier = _computeTier(holders[holder].signalWeight);
        emit TaskClaimed(holder, taskId, reward, holders[holder].signalWeight, newTier);
        if (newTier > oldTier) emit TierAscended(holder, oldTier, newTier, holders[holder].signalWeight);
    }

    function _addTask(bytes32 id, uint256 reward, bool requiresApproval, bool repeatable) internal {
        tasks[id] = Task({ signalReward: reward, active: true, requiresApproval: requiresApproval, repeatable: repeatable });
        taskIds.push(id);
    }

    function _seedTasks() internal {
        // SIGNAL_ACQUISITION
        _addTask(keccak256("join_discord"),     100, false, false);
        _addTask(keccak256("join_telegram"),    100, false, false);
        _addTask(keccak256("follow_x"),         150, false, false);
        _addTask(keccak256("follow_farcaster"), 150, false, false);
        _addTask(keccak256("connect_wallet"),   200, false, false);
        _addTask(keccak256("verify_identity"),  100, false, false);
        // KNOWLEDGE_ARCHIVE
        _addTask(keccak256("read_medium"),      300, false, false);
        _addTask(keccak256("read_abstract"),    400, false, false);
        _addTask(keccak256("read_eip"),        1000, false, false);
        _addTask(keccak256("read_governance"),  500, false, false);
        _addTask(keccak256("read_guardian"),    600, false, false);
        _addTask(keccak256("pass_quiz"),       1500,  true, false);
        // CONTRIBUTION
        _addTask(keccak256("like_post"),         50, false,  true);
        _addTask(keccak256("retweet_post"),     120, false,  true);
        _addTask(keccak256("reply_post"),       200,  true,  true);
        _addTask(keccak256("tweet_otter"),      500,  true, false);
        _addTask(keccak256("create_thread"),   1000,  true, false);
        _addTask(keccak256("create_meme"),     1500,  true, false);
        _addTask(keccak256("edu_video"),       3000,  true, false);
        _addTask(keccak256("write_article"),   5000,  true, false);
        // CIPHER_HUNT
        _addTask(keccak256("cipher_i"),         500, false, false);
        _addTask(keccak256("cipher_ii"),        750, false, false);
        _addTask(keccak256("cipher_iii"),      1000, false, false);
        _addTask(keccak256("gate_unlock"),     2500, false, false);
        _addTask(keccak256("hidden_puzzle"),   5000,  true, false);
        // SIGNAL_RELAY
        _addTask(keccak256("relay_discord"),    200, false,  true);
        _addTask(keccak256("relay_telegram"),   200, false,  true);
        _addTask(keccak256("relay_x"),          250, false,  true);
        _addTask(keccak256("relay_onboarding"), 500, false,  true);
        _addTask(keccak256("relay_member"),    1500,  true,  true);
        _addTask(keccak256("relay_content"),   3000,  true,  true);
        // GOVERNANCE
        _addTask(keccak256("read_proposal"),    200, false,  true);
        _addTask(keccak256("cast_vote"),        500, false,  true);
        _addTask(keccak256("discuss_proposal"), 300,  true,  true);
        _addTask(keccak256("submit_feedback"),  400,  true, false);
    }
}
