// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PSLPlayerToken
 * @notice ERC-20 token representing a single PSL player.
 *         Max supply = 100 tokens (100 * 10^18 internally).
 *         All 100 tokens are minted to market on deployment.
 *         updateStreak MUST NOT increment on same-day re-buys — handled by `today == lastDay` guard.
 */
contract PSLPlayerToken is ERC20, Ownable, ReentrancyGuard {
    uint8 public immutable tier;           // 0=Legend, 1=Star, 2=Regular
    uint8 public immutable playerId;
    address public oracleAddress;
    address public marketAddress;

    // performanceMultiplier stored as integer * 100
    // 100 = 1.0x, 150 = 1.5x, 250 = 2.5x, 300 = 3.0x
    uint256 public performanceMultiplier = 100;

    // Streak tracking: wallet => consecutive days held
    mapping(address => uint256) public holdStreak;
    mapping(address => uint256) public lastHoldTimestamp;

    // Total days held (for Diamond Hands achievement)
    mapping(address => uint256) public totalDaysHeld;

    event MultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier, uint256 fps);
    event StreakUpdated(address wallet, uint256 streak);

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Not oracle");
        _;
    }

    modifier onlyMarket() {
        require(msg.sender == marketAddress, "Not market");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 tier_,
        uint8 playerId_,
        address oracle_,
        address market_,
        address initialOwner_
    ) ERC20(name_, symbol_) Ownable(initialOwner_) {
        tier = tier_;
        playerId = playerId_;
        oracleAddress = oracle_;
        marketAddress = market_;

        // Mint all 100 tokens (with 18 decimals) to market
        _mint(market_, 100 * 10 ** decimals());
    }

    function updateMultiplier(uint256 newMultiplier, uint256 fps) external onlyOracle {
        require(newMultiplier > 0, "Invalid multiplier");
        emit MultiplierUpdated(performanceMultiplier, newMultiplier, fps);
        performanceMultiplier = newMultiplier;
    }

    /**
     * @notice Called by market on every BUY to update hold streak.
     *         Same-day calls do NOT increment streak (prevents farming via same-day buys).
     *         Streak breaks if more than 1 day has elapsed since last buy.
     */
    function updateStreak(address wallet) external onlyMarket {
        uint256 lastTs = lastHoldTimestamp[wallet];
        uint256 today = block.timestamp / 1 days;
        uint256 lastDay = lastTs / 1 days;

        if (lastTs == 0) {
            // First ever buy
            holdStreak[wallet] = 1;
            totalDaysHeld[wallet] += 1;
        } else if (today == lastDay) {
            // Same day — do NOT change streak or totalDaysHeld
            // Just update the timestamp to the latest buy within the day
        } else if (today == lastDay + 1) {
            // Consecutive day
            holdStreak[wallet] += 1;
            totalDaysHeld[wallet] += 1;
        } else {
            // Streak broken — gap of more than 1 day
            holdStreak[wallet] = 1;
            totalDaysHeld[wallet] += 1;
        }

        lastHoldTimestamp[wallet] = block.timestamp;
        emit StreakUpdated(wallet, holdStreak[wallet]);
    }

    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Zero address");
        oracleAddress = newOracle;
    }

    function setMarket(address newMarket) external onlyOwner {
        require(newMarket != address(0), "Zero address");
        marketAddress = newMarket;
    }

    /// @notice Returns effective performance multiplier (100 = 1.0x)
    function getEffectiveMultiplier() external view returns (uint256) {
        return performanceMultiplier;
    }
}