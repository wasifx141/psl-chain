// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../pool/PrizePool.sol";
import "../tokens/PSLPlayerToken.sol";

/**
 * @title StakingContract
 * @notice Players stake their player tokens before a match starts to earn proportional rewards.
 *         stakeForMatch requires block.timestamp < match.startTime (MUST be before match).
 *         claimAndUnstake sets s.claimed = true BEFORE transferring tokens back (CEI).
 *
 * Hackathon note: playerStakers arrays are bounded by wallet count (~3 demo + judges).
 *                 For production, add pagination or a separate reward indexer.
 */
contract StakingContract is Ownable, ReentrancyGuard {
    PrizePool public prizePool;
    address public oracleAddress;

    struct Stake {
        uint256 amount;   // whole tokens
        uint8   playerId;
        uint8   matchId;
        bool    claimed;
    }

    struct MatchInfo {
        uint256 startTime;
        bool    resultsIn;
    }

    // wallet => matchId => playerId => Stake
    mapping(address => mapping(uint8 => mapping(uint8 => Stake))) public stakes;
    // matchId => playerId => total staked (whole tokens)
    mapping(uint8 => mapping(uint8 => uint256)) public totalStaked;
    // matchId => staker addresses (unique)
    mapping(uint8 => address[]) public matchStakers;
    mapping(uint8 => mapping(address => bool)) public isMatchStaker;
    // matchId => playerId => staker addresses
    mapping(uint8 => mapping(uint8 => address[])) public playerStakers;
    // playerId => tokenAddr (registered by admin after deployment)
    mapping(uint8 => address) public playerTokenAddresses;

    mapping(uint8 => MatchInfo) public matches;

    event Staked(address indexed wallet, uint8 matchId, uint8 playerId, uint256 amount);
    event Unstaked(address indexed wallet, uint8 matchId, uint8 playerId, uint256 amount);
    event MatchResultsProcessed(uint8 matchId, uint256 totalStakerCount);
    event PlayerTokenRegistered(uint8 playerId, address tokenAddr);

    modifier onlyOracle() { require(msg.sender == oracleAddress, "Not oracle"); _; }

    constructor(address prizePool_, address initialOwner_) Ownable(initialOwner_) {
        require(prizePool_ != address(0), "Zero prizePool");
        prizePool = PrizePool(payable(prizePool_));
    }

    function setOracle(address o) external onlyOwner {
        require(o != address(0), "Zero address");
        oracleAddress = o;
    }

    function setMatch(uint8 matchId, uint256 startTime) external onlyOwner {
        require(startTime > block.timestamp, "Start time must be in future");
        matches[matchId] = MatchInfo(startTime, false);
    }

    /// @notice Register a player token address (called by deploy script after factory deployment)
    function registerPlayerToken(uint8 playerId_, address tokenAddr) external onlyOwner {
        require(tokenAddr != address(0), "Zero address");
        playerTokenAddresses[playerId_] = tokenAddr;
        emit PlayerTokenRegistered(playerId_, tokenAddr);
    }

    /**
     * @notice Stake `amount` whole tokens for a specific player in a specific match.
     *         MUST be called before match.startTime.
     *         Tokens are locked in this contract until claimAndUnstake is called.
     */
    function stakeForMatch(
        address playerTokenAddr,
        uint8   playerId_,
        uint8   matchId_,
        uint256 amount
    ) external nonReentrant {
        require(amount >= 1, "Min 1 token");
        require(matches[matchId_].startTime > 0,           "Match not configured");
        require(block.timestamp < matches[matchId_].startTime, "Match already started");
        require(!matches[matchId_].resultsIn,               "Match completed");
        require(stakes[msg.sender][matchId_][playerId_].amount == 0, "Already staked this player/match");

        PSLPlayerToken token = PSLPlayerToken(playerTokenAddr);
        require(token.balanceOf(msg.sender) >= amount * 1e18, "Insufficient tokens");

        // Lock tokens — user must have approved this contract for amount * 1e18
        token.transferFrom(msg.sender, address(this), amount * 1e18);

        stakes[msg.sender][matchId_][playerId_] = Stake(amount, playerId_, matchId_, false);
        totalStaked[matchId_][playerId_] += amount;

        if (!isMatchStaker[matchId_][msg.sender]) {
            matchStakers[matchId_].push(msg.sender);
            isMatchStaker[matchId_][msg.sender] = true;
        }

        playerStakers[matchId_][playerId_].push(msg.sender);

        emit Staked(msg.sender, matchId_, playerId_, amount);
    }

    /**
     * @notice Called by Oracle after match results are pushed.
     *         Builds flat arrays and calls PrizePool.distributeMatchRewards.
     *         marks match resultsIn = true AFTER prize pool call succeeds.
     */
    function processMatchRewards(
        uint8   matchId_,
        uint8[] calldata uniquePlayerIds,
        uint256[] calldata fpScores,
        uint8   seasonId
    ) external onlyOracle {
        require(!matches[matchId_].resultsIn, "Already processed");
        require(uniquePlayerIds.length == fpScores.length, "Array mismatch");

        // Build flat arrays for PrizePool
        uint256 totalStakerCount = 0;
        for (uint256 p = 0; p < uniquePlayerIds.length; p++) {
            totalStakerCount += playerStakers[matchId_][uniquePlayerIds[p]].length;
        }

        address[] memory stakerWallets    = new address[](totalStakerCount);
        uint256[] memory stakerAmounts    = new uint256[](totalStakerCount);
        uint8[]   memory stakerPlayerIds  = new uint8[](totalStakerCount);
        uint256[] memory totalStakedArr   = new uint256[](uniquePlayerIds.length);

        uint256 idx = 0;
        for (uint256 p = 0; p < uniquePlayerIds.length; p++) {
            uint8 pid = uniquePlayerIds[p];
            totalStakedArr[p] = totalStaked[matchId_][pid];

            address[] storage pStakers = playerStakers[matchId_][pid];
            for (uint256 s = 0; s < pStakers.length; s++) {
                stakerWallets[idx]   = pStakers[s];
                stakerAmounts[idx]   = stakes[pStakers[s]][matchId_][pid].amount;
                stakerPlayerIds[idx] = pid;
                idx++;
            }
        }

        // Trigger proportional distribution in PrizePool
        prizePool.distributeMatchRewards(
            seasonId,
            matchId_,
            stakerWallets,
            stakerAmounts,
            stakerPlayerIds,
            fpScores,
            uniquePlayerIds,
            totalStakedArr
        );

        matches[matchId_].resultsIn = true;
        emit MatchResultsProcessed(matchId_, totalStakerCount);
    }

    /**
     * @notice Return staked tokens after match results are in.
     *         CEI: s.claimed = true BEFORE token transfer.
     *         WC rewards remain in PrizePool — user calls prizePool.claimRewards() separately.
     */
    function claimAndUnstake(
        address playerTokenAddr,
        uint8   playerId_,
        uint8   matchId_
    ) external nonReentrant {
        require(matches[matchId_].resultsIn, "Results not in yet");

        Stake storage s = stakes[msg.sender][matchId_][playerId_];
        require(s.amount > 0, "Nothing staked");
        require(!s.claimed,   "Already claimed");

        // CEI: set claimed BEFORE transfer
        uint256 amount = s.amount;
        s.claimed = true;

        PSLPlayerToken(playerTokenAddr).transfer(msg.sender, amount * 1e18);

        emit Unstaked(msg.sender, matchId_, playerId_, amount);
    }

    function getStake(address wallet, uint8 matchId_, uint8 playerId_) external view returns (Stake memory) {
        return stakes[wallet][matchId_][playerId_];
    }

    function getMatchStakers(uint8 matchId_) external view returns (address[] memory) {
        return matchStakers[matchId_];
    }

    function getPlayerStakers(uint8 matchId_, uint8 playerId_) external view returns (address[] memory) {
        return playerStakers[matchId_][playerId_];
    }
}