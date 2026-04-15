// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PrizePool
 * @notice Accumulates trading fees and distributes match + season rewards.
 *
 * Fee split per trade: 40% → matchPool, 40% → seasonPool, 20% → platformFee
 *
 * Match rewards:
 *   - Proportional to (staked tokens × player FPS score)
 *   - Guard: require(!matchDistributed[seasonId][matchId])
 *   - Edge case: if totalFpsWeightSum == 0, return early (no divide by zero)
 *
 * Season rewards:
 *   - Top 3: 25%, 15%, 10% of seasonPool
 *   - Ranks 4-10: 5% each (35% total)
 *   - Ranks 11-20: 1% each (10% total)
 *   - 5% rollover to next season's pool
 *   - Guard: require(!seasons[seasonId].seasonDistributed)
 *   - Rollover is applied BEFORE marking as distributed
 *
 * Claim rewards (CEI):
 *   - pendingRewards[msg.sender] = 0 BEFORE the external .call{}
 */
contract PrizePool is Ownable, ReentrancyGuard {
    struct Season {
        uint256 matchPool;
        uint256 seasonPool;
        uint256 platformFee;
        uint256 totalFees;
        bool    seasonDistributed;
    }

    mapping(uint8 => Season) public seasons;
    uint8   public currentSeason = 1;
    address public oracleAddress;
    address public marketAddress;

    mapping(address => uint256) public pendingRewards;
    uint256 public totalRewardsDistributed;

    // Prevent double-distribution per match
    mapping(uint8 => mapping(uint8 => bool)) public matchDistributed;

    event FeeReceived(uint8 season, uint256 amount, uint256 matchShare, uint256 seasonShare);
    event MatchRewardsDistributed(uint8 season, uint8 matchId, uint256 totalDistributed);
    event SeasonRewardsDistributed(uint8 season, uint256 totalDistributed);
    event RewardClaimed(address wallet, uint256 amount);
    event RewardAllocated(address wallet, uint256 amount, string reason);

    modifier onlyOracle()         { require(msg.sender == oracleAddress, "Not oracle"); _; }
    modifier onlyMarketOrOwner()  { require(msg.sender == marketAddress || msg.sender == owner(), "Not authorized"); _; }

    constructor(address initialOwner_) Ownable(initialOwner_) {}

    // ─── Fee Reception ───────────────────────────────────────────────────────

    /// @notice Called by MarketContract on every buy/sell (2% of trade value)
    function receiveFee(uint8 seasonId) external payable onlyMarketOrOwner {
        require(msg.value > 0, "No fee sent");

        uint256 matchShare  = (msg.value * 40) / 100;
        uint256 seasonShare = (msg.value * 40) / 100;
        uint256 platformShare = msg.value - matchShare - seasonShare; // exact 20%

        seasons[seasonId].matchPool   += matchShare;
        seasons[seasonId].seasonPool  += seasonShare;
        seasons[seasonId].platformFee += platformShare;
        seasons[seasonId].totalFees   += msg.value;

        emit FeeReceived(seasonId, msg.value, matchShare, seasonShare);
    }

    // ─── Match Reward Distribution ────────────────────────────────────────────

    /**
     * @notice Distribute match pool proportionally to stakers.
     *         Weight = fps[player] × tokensStaked[player]
     *         Staker reward = (stakerTokens / totalStaked[player]) × playerPoolShare
     *
     * @param stakerWallets       Flat list of all staker wallet addresses
     * @param stakerAmounts       Tokens staked by each staker (parallel to stakerWallets)
     * @param stakerPlayerIds     Which player each staker staked on (parallel)
     * @param playerFpsScores     FPS score per unique player (parallel to uniquePlayerIds)
     * @param uniquePlayerIds     Unique player IDs that were staked this match
     * @param totalStakedPerPlayer Total tokens staked per player (parallel to uniquePlayerIds)
     */
    function distributeMatchRewards(
        uint8 seasonId,
        uint8 matchId,
        address[] calldata stakerWallets,
        uint256[] calldata stakerAmounts,
        uint8[]   calldata stakerPlayerIds,
        uint256[] calldata playerFpsScores,
        uint8[]   calldata uniquePlayerIds,
        uint256[] calldata totalStakedPerPlayer
    ) external onlyOracle nonReentrant {
        require(!matchDistributed[seasonId][matchId], "Already distributed");
        require(stakerWallets.length == stakerAmounts.length,  "Array length mismatch");
        require(stakerWallets.length == stakerPlayerIds.length,"Array length mismatch");
        require(uniquePlayerIds.length == playerFpsScores.length, "Array length mismatch");
        require(uniquePlayerIds.length == totalStakedPerPlayer.length, "Array length mismatch");

        uint256 matchPool = seasons[seasonId].matchPool;
        require(matchPool > 0, "No match pool to distribute");

        // Step 1: Compute total FPS-weight sum
        uint256 totalFpsWeightSum = 0;
        for (uint256 p = 0; p < uniquePlayerIds.length; p++) {
            totalFpsWeightSum += playerFpsScores[p] * totalStakedPerPlayer[p];
        }

        // Edge case: all players scored 0 FPS → nothing to distribute, mark as done
        if (totalFpsWeightSum == 0) {
            matchDistributed[seasonId][matchId] = true;
            emit MatchRewardsDistributed(seasonId, matchId, 0);
            return;
        }

        // Step 2: Each player's share of the match pool
        uint256[] memory playerPoolShares = new uint256[](uniquePlayerIds.length);
        for (uint256 p = 0; p < uniquePlayerIds.length; p++) {
            uint256 fpsWeight = playerFpsScores[p] * totalStakedPerPlayer[p];
            playerPoolShares[p] = (fpsWeight * matchPool) / totalFpsWeightSum;
        }

        // Step 3: Distribute to individual stakers within each player's share
        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < stakerWallets.length; i++) {
            uint8 pid = stakerPlayerIds[i];

            uint256 playerIdx = type(uint256).max;
            for (uint256 p = 0; p < uniquePlayerIds.length; p++) {
                if (uniquePlayerIds[p] == pid) { playerIdx = p; break; }
            }
            if (playerIdx == type(uint256).max) continue;

            uint256 totalForPlayer = totalStakedPerPlayer[playerIdx];
            if (totalForPlayer == 0) continue;

            uint256 reward = (stakerAmounts[i] * playerPoolShares[playerIdx]) / totalForPlayer;
            if (reward == 0) continue;

            pendingRewards[stakerWallets[i]] += reward;
            totalDistributed += reward;
            emit RewardAllocated(stakerWallets[i], reward, "match_stake");
        }

        // Deduct distributed amount from matchPool
        seasons[seasonId].matchPool -= totalDistributed;
        totalRewardsDistributed += totalDistributed;
        matchDistributed[seasonId][matchId] = true;

        emit MatchRewardsDistributed(seasonId, matchId, totalDistributed);
    }

    // ─── Season Reward Distribution ──────────────────────────────────────────

    /// @notice Distribute season pool to top ranked wallets. 5% rollover to next season.
    function distributeSeasonRewards(
        uint8 seasonId,
        address[] calldata rankedWallets  // ordered 1st to last by portfolio value
    ) external onlyOwner nonReentrant {
        require(!seasons[seasonId].seasonDistributed, "Already distributed");
        require(rankedWallets.length >= 1, "No wallets provided");

        uint256 pool = seasons[seasonId].seasonPool;
        require(pool > 0, "No season pool");

        // 5% rollover — apply BEFORE marking distributed
        uint256 rollover = (pool * 5) / 100;
        seasons[uint8(seasonId + 1)].seasonPool += rollover;

        uint256 distributed = 0;
        uint256[3] memory topPct = [uint256(25), 15, 10];

        // Ranks 1-3
        for (uint256 i = 0; i < 3 && i < rankedWallets.length; i++) {
            uint256 reward = (pool * topPct[i]) / 100;
            pendingRewards[rankedWallets[i]] += reward;
            distributed += reward;
        }
        // Ranks 4-10 (5% each)
        for (uint256 i = 3; i < 10 && i < rankedWallets.length; i++) {
            uint256 reward = (pool * 5) / 100;
            pendingRewards[rankedWallets[i]] += reward;
            distributed += reward;
        }
        // Ranks 11-20 (1% each)
        for (uint256 i = 10; i < 20 && i < rankedWallets.length; i++) {
            uint256 reward = (pool * 1) / 100;
            pendingRewards[rankedWallets[i]] += reward;
            distributed += reward;
        }

        seasons[seasonId].seasonPool -= distributed + rollover;
        seasons[seasonId].seasonDistributed = true;
        totalRewardsDistributed += distributed;

        emit SeasonRewardsDistributed(seasonId, distributed);
    }

    // ─── Claim (CEI) ─────────────────────────────────────────────────────────

    /// @notice Users call this to withdraw their accrued WC rewards
    function claimRewards() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards to claim");

        // CEI: zero out BEFORE external call
        pendingRewards[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        emit RewardClaimed(msg.sender, amount);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function withdrawPlatformFee(uint8 seasonId) external onlyOwner nonReentrant {
        uint256 fee = seasons[seasonId].platformFee;
        require(fee > 0, "No platform fee");
        seasons[seasonId].platformFee = 0;
        (bool ok, ) = owner().call{value: fee}("");
        require(ok, "Transfer failed");
    }

    function setOracle(address o)  external onlyOwner { require(o != address(0), "Zero"); oracleAddress = o; }
    function setMarket(address m)  external onlyOwner { require(m != address(0), "Zero"); marketAddress = m; }
    function setSeason(uint8  s)   external onlyOwner { currentSeason = s; }

    receive() external payable {}
}